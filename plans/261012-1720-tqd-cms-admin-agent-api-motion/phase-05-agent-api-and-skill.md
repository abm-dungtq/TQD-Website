---
phase: 5
title: "API cho agent và skill tqd-publish"
status: pending
priority: P1
effort: 8h
dependencies: [4]
---

# Phase 5 — API cho agent và skill `tqd-publish`

> Đọc mục Constraints trong `plan.md` trước khi bắt đầu. API key là secret: không in ra log/chat, chỉ lưu trong `.secrets/` hoặc file người dùng chỉ định. Báo cáo ghi `[redacted]`.

## Goal

Agent của anh dùng API key gọi `PUT /api/v1/articles/{slug}` và `POST /api/v1/media` để đăng bài có ảnh/video; key thiếu scope `publish` chỉ tạo nháp; quản lý key trong `/admin/api-keys`; skill `tqd-publish` gói các lệnh này cho Claude Code/Codex.

## Hợp đồng API (người thực thi làm đúng như bảng)

Xác thực: header `Authorization: Bearer tqd_<43 ký tự base64url>`. Scope: `articles:write`, `media:write`, `publish`. Mọi lỗi trả JSON `{ "error": "<mã>", "message": "<tiếng Việt>" }`.

| Method & path | Scope | Thành công | Lỗi |
|---|---|---|---|
| `GET /api/v1/me` | bất kỳ key hợp lệ | 200 `{ name, scopes }` | 401 `unauthorized` |
| `GET /api/v1/articles?status=draft\|published` | `articles:write` | 200 `[{ slug, title, status, version, updatedAt }]` (≤ 50, mới nhất trước) | 401, 403 `forbidden` |
| `GET /api/v1/articles/{slug}` | `articles:write` | 200 bài đầy đủ (`slug, title, summary, bodyMd, coverKey, tags, status, version, fbOverlap, publishedAt, updatedAt`) + `ETag: "v{version}"` | 404 `not_found` |
| `PUT /api/v1/articles/{slug}` body JSON `{ title, summary?, bodyMd, coverKey?, tags?, publish? }`, tối đa 200 KB | `articles:write` | 201 (tạo) / 200 (sửa) `{ slug, url, status, version, fbOverlap, warning? }` + `ETag` | 400 `invalid` (kèm `errors`), 403, 412 `version_mismatch` (kèm ETag hiện tại), 413, 428 `if_match_required` |
| `DELETE /api/v1/articles/{slug}` | `articles:write` (+ `publish` nếu bài đang đăng) | 204 | 403, 404 |
| `POST /api/v1/media?filename=&alt=` body là file thô, có `Content-Length` | `media:write` | 201 `{ key, url, markdown, contentType, size }` | 411, 413, 415 |
| `DELETE /api/v1/media?key=` | `media:write` | 204 (dùng `deleteMedia`; key `backups/...` hoặc không có trong bảng `media` → 404) | 404 |

Quy tắc trạng thái của `PUT`:
- Bài chưa có: `publish: true` + key có `publish` → `published`; `publish: true` + key thiếu `publish` → `draft` và `warning: "Key không có quyền publish nên bài được lưu nháp."`; không có `publish` → `draft`.
- Bài đã có: bắt buộc header `If-Match: "v{version}"` (thiếu → 428; sai → 412). Đọc `If-Match`: bỏ tiền tố `W/` nếu có, bỏ dấu `"`, so với `v${version}`. Bài chưa có mà gửi `If-Match` → 412. Bài đang `published` mà key thiếu `publish` → 403. `publish: false` với key có `publish` → chuyển về `draft`. Không gửi `publish` → giữ trạng thái cũ.
- Nguồn bài lưu là `agent:<tên key>`.
- Giới hạn 60 request/phút mỗi key (bảng `rate_limits`, bucket `api:<id key>`); vượt → 429 + `Retry-After`.

## Files to Create / Modify

- Create: `src/lib/api-key.ts`, `src/lib/api-key.test.ts`, `src/lib/api.ts`, `src/pages/api/v1/me.ts`, `src/pages/api/v1/articles/index.ts`, `src/pages/api/v1/articles/[slug].ts`, `src/pages/api/v1/media.ts`, `src/pages/admin/api-keys.astro`, `scripts/api-key.mjs`, `scripts/verify/api.mjs`, `skills/tqd-publish/SKILL.md`, `skills/tqd-publish/scripts/tqd-publish.mjs`, `docs/agent-publishing.md`
- Modify: `src/middleware.ts` (chỉ nếu cần loại `/api/` khỏi kiểm Origin), `src/layouts/AdminLayout.astro`, `README.md`

## Task 5.1 — Tạo và kiểm API key

- Target files: `src/lib/api-key.ts`, `src/lib/api-key.test.ts`.
- Steps:
  1. `SCOPES = ['articles:write', 'media:write', 'publish'] as const`.
  2. `generateApiKey()`: 32 byte ngẫu nhiên → base64url (không `=`) → `key = 'tqd_' + chuỗi`; `prefix = key.slice(0, 12)`; `hash = await sha256Hex(key)` (từ `src/lib/auth.ts`). Trả `{ key, prefix, hash }`.
  3. `parseScopes(text)`: tách dấu phẩy, bỏ khoảng trắng, chỉ giữ giá trị trong `SCOPES`, bỏ trùng.
  4. `authenticate(db, authHeader)`: không khớp `^Bearer (tqd_[A-Za-z0-9_-]{43})$` → `null`; tìm `api_keys` theo `hash` với `revoked_at IS NULL` → `{ id, name, scopes: string[] }` hoặc `null`.
  5. Test: key bắt đầu `tqd_` dài 47; hai lần sinh khác nhau; `parseScopes('publish, x, publish')` → `['publish']`.
- Verify: `npx vitest run src/lib/api-key.test.ts` exit 0.

## Task 5.2 — Endpoint API

- Target files: `src/lib/api.ts`, các file `src/pages/api/v1/*`.
- Steps:
  1. `src/lib/api.ts`: `jsonResponse(data, status, headers?)`, `apiError(status, code, message, extra?)`, và `requireKey(request, db, scope?)` → trả `{ key }` hoặc `Response` lỗi: không xác thực → 401; thiếu scope → 403; `hit(db, 'api:' + key.id, 60, 60)` không `allowed` → 429 với `Retry-After`. Khi đạt, cập nhật `last_used_at` qua `context.locals.cfContext.waitUntil(...)` (không `await`, nhưng phải đưa vào `waitUntil` để không bị huỷ).
  2. Viết các endpoint đúng bảng "Hợp đồng API", dùng lại `saveArticle` (trả `{ article, created }` → 201 khi `created`, 200 khi sửa), `deleteArticle`, `getArticle` (có `includeDrafts: true`), `storeMedia`, `deleteMedia`, `ConflictError`. `PUT` đọc `Content-Length` trước khi parse; > 200 000 → 413.
  3. `/api/` không dùng cookie, không cache (middleware đã đặt `no-store`). Xác nhận middleware KHÔNG áp kiểm `Origin` cho `/api/` (chỉ cho `/admin`).
- Verify: `npm run build` exit 0.

## Task 5.3 — Quản lý key trong admin và bằng script

- Target files: `src/pages/admin/api-keys.astro`, `src/layouts/AdminLayout.astro`, `scripts/api-key.mjs`.
- Steps:
  1. Menu admin thêm `API key /admin/api-keys`.
  2. Trang: form tạo (tên ≤ 60 ký tự, checkbox 3 scope, mặc định chỉ tick `articles:write` và `media:write`); sau khi tạo, hiện key **một lần** trong ô chỉ đọc kèm câu `Chép key ngay, key sẽ không hiện lại.` (không redirect, để key không nằm trong URL). Bảng key: tên, prefix, scope, tạo lúc, dùng lần cuối, trạng thái; nút `Thu hồi` (POST, đặt `revoked_at`).
  3. `scripts/api-key.mjs` (import `../src/lib/api-key.ts`):
     - `create --name <tên> --scopes <a,b> --out <file> [--remote]`: sinh key, chạy `npx wrangler d1 execute tqd_db <--local|--remote> --command "INSERT INTO api_keys(name,prefix,hash,scopes) VALUES (...)"`, ghi key vào `<file>` (tạo thư mục cha). In `created <tên> <prefix>`; KHÔNG in key.
     - `revoke --name <tên> [--remote]`: `UPDATE api_keys SET revoked_at = datetime('now') WHERE name = ... AND revoked_at IS NULL`. In `revoked <tên>`.
- Verify: `node scripts/api-key.mjs create --name verify-local --scopes articles:write --out .secrets/key-verify-local` in `created verify-local tqd_` VÀ `node scripts/api-key.mjs revoke --name verify-local` in `revoked verify-local`.

## Task 5.4 — Kiểm tra API đầu-cuối

- Target files: `scripts/verify/api.mjs`.
- Steps:
  1. Script nhận `<base>` và cờ `--remote`. Đọc key từ file thì `.trim()`. Upload gửi `Content-Type: image/png` và `Content-Length`; PUT gửi `Content-Type: application/json`. Tự tạo 2 key bằng `scripts/api-key.mjs`: `verify-full-<ts>` (3 scope) và `verify-draft-<ts>` (`articles:write,media:write`), lưu trong `.secrets/`. Các bước:
     1. `GET /api/v1/me` không header → 401; với `Bearer tqd_sai` → 401; với key full → 200 có `name`.
     2. Full: `POST /api/v1/media?filename=verify.png&alt=verify` (PNG 1×1) → 201, nhận `key`.
     3. Full: `PUT /api/v1/articles/api-test-<ts>` với `publish: true`, `coverKey`, `bodyMd` gồm `![x](/media/<key>)` và `<script>alert(1)</script>` → 201, `status` = `published`, header `etag` = `"v1"`. `GET /bai-viet` chứa tiêu đề; `GET /bai-viet/api-test-<ts>` không chứa `<script>alert`.
     4. Full: `PUT` cùng slug không `If-Match` → 428; `If-Match: "v9"` → 412; `If-Match: "v1"` → 200, `version` = 2.
     5. Draft: `PUT /api/v1/articles/api-draft-<ts>` với `publish: true` → 201, `status` = `draft`, có `warning`. `GET /bai-viet/api-draft-<ts>` → 404.
     6. Draft: `PUT` slug ở bước 3 với `If-Match: "v2"` → 403.
     7. Draft: gửi 61 request `GET /api/v1/me` liên tiếp → có ít nhất một 429.
     8. Dọn: full `DELETE /api/v1/media?key=backups/khong-co.json` → 404; full `DELETE` hai bài → 204; full `DELETE /api/v1/media?key=<key>` → 204.
     9. Thu hồi full bằng `scripts/api-key.mjs revoke`; `GET /api/v1/me` bằng key full → 401. Thu hồi draft. Xoá 2 file key trong `.secrets/`.
     In `OK api` hoặc `FAIL <bước> ...`, exit 1.
  2. Chạy trên local (dev server nền 4321), rồi `npm run deploy:preview` và chạy với base preview + `--remote`.
- Verify: `node scripts/verify/api.mjs http://localhost:4321` in `OK api` VÀ `node scripts/verify/api.mjs https://tqd-next.<subdomain>.workers.dev --remote` in `OK api`.

## Task 5.5 — Skill `tqd-publish`

- Target files: `skills/tqd-publish/SKILL.md`, `skills/tqd-publish/scripts/tqd-publish.mjs`, `docs/agent-publishing.md`.
- Steps:
  1. `tqd-publish.mjs` (Node ≥ 20, không phụ thuộc gói ngoài):
     - Cấu hình: `TQD_API_BASE` (mặc định `https://tqd.io.vn`); key từ `TQD_API_KEY`, hoặc `--key-file <path>`, hoặc mặc định `~/.config/tqd/api-key`. Không bao giờ in key.
     - Lệnh: `whoami`; `upload <file> [--alt "..."]`; `put <slug> --title "..." --body-file <file.md> [--summary "..."] [--tags a,b] [--cover <mediaKey>] [--publish]`; `get <slug>`; `list [--status draft|published]`; `delete <slug>`; `delete-media <key>`.
     - `put`: `GET` bài trước; 200 → gửi `If-Match` bằng ETag nhận được; 404 → không gửi `If-Match`.
     - In kết quả là JSON một dòng ra stdout; lỗi HTTP → in JSON lỗi ra stderr, exit 1.
  2. `SKILL.md`: frontmatter `name: tqd-publish`, `description: Đăng bài viết, ảnh và video lên tqd.io.vn qua API có API key. Dùng khi cần đăng hoặc sửa bài trên website DũngTQ.` Nội dung: cách cấu hình key; quy trình (viết Markdown → tạo ảnh/video bằng công cụ sẵn có → `upload` → chèn `![alt](/media/<key>)` hoặc dùng `--cover` → `put`); link TikTok đứng riêng một dòng sẽ thành player; HTML thô bị loại bỏ; ảnh ngoài `/media/` bị loại bỏ; giới hạn 10 MB ảnh, 95 MB video; slug chữ thường không dấu nối `-`; chỉ dùng `--publish` khi người dùng yêu cầu đăng; nếu kết quả có `"fbOverlap": true` thì báo người dùng bài có đoạn trùng bài Facebook; không chép nguyên văn bài Facebook.
  3. `docs/agent-publishing.md`: bảng "Hợp đồng API" ở đầu phase này, ví dụ `curl` (dùng `$TQD_API_KEY`, không ghi key thật), cách tạo/thu hồi key trong `/admin/api-keys`, cách cài skill: chép thư mục `skills/tqd-publish` vào `~/.claude/skills/tqd-publish` (Claude Code) và `~/.codex/skills/tqd-publish` (Codex).
- Verify: no verification needed (Task 5.6 chạy thật).

## Task 5.6 — Đăng thử bằng skill lên `tqd.io.vn`

- Goal: tiêu chí 3 — skill đăng một bài thử lên production rồi xoá.
- Steps:
  1. `npm run deploy` (production).
  2. `node scripts/api-key.mjs create --name claude-test --scopes articles:write,media:write,publish --out .secrets/api-key-claude-test --remote`
  3. Chép `skills/tqd-publish` vào `C:/Users/ABM/.claude/skills/tqd-publish`.
  4. Với `--key-file .secrets/api-key-claude-test`:
     a. `node C:/Users/ABM/.claude/skills/tqd-publish/scripts/tqd-publish.mjs whoami` → JSON có `"name":"claude-test"`.
     b. Chép `public/og.png` thành `.secrets/skill-test.png` rồi `upload .secrets/skill-test.png --alt "Ảnh thử"` → JSON có `"key"`.
     c. Viết `.secrets/skill-test.md` (2 đoạn tiếng Việt tự viết + `![Ảnh thử](/media/<key>)`), `put skill-test-<ts> --title "Bài thử skill" --body-file .secrets/skill-test.md --publish` → JSON có `"status":"published"`.
     d. `node scripts/verify/live.mjs` vẫn `OK live`; `GET https://tqd.io.vn/bai-viet/skill-test-<ts>` → 200 chứa `Bài thử skill`.
     e. `delete skill-test-<ts>` và `delete-media <key>` → exit 0; `GET https://tqd.io.vn/bai-viet/skill-test-<ts>` → 404.
  5. `node scripts/api-key.mjs revoke --name claude-test --remote`; xoá `.secrets/api-key-claude-test`.
  6. Nhắn người dùng: tạo key cho agent thật trong `https://tqd.io.vn/admin/api-keys`, lưu vào `~/.config/tqd/api-key` trên máy chạy agent.
- Verify: các bước 4a–4e cho đúng kết quả đã ghi; bước 5 in `revoked claude-test`.

## Task 5.7 — Tài liệu và commit

- Steps: `README.md` thêm mục "Đăng bài từ agent" trỏ tới `docs/agent-publishing.md`; `npm test` exit 0; dừng dev server nền; `git add -A`; `git status --porcelain` không có `.secrets`; commit `feat: add api-key publishing api and tqd-publish skill`.
- Verify: `git status --porcelain` rỗng.

## Failure Protocol
If any Verify step does not meet its stated pass condition, STOP this phase.
Do not improvise a fix, retry blindly, or reason around the failure.
Spawn the `kongming` subagent for next-step counsel and pass:
- the phase and task id,
- what you attempted (the steps you ran),
- the exact command and its full output,
- the pass condition it failed to meet.
Apply kongming's guidance, then re-run the Verify step.
If `kongming` cannot be spawned in this environment, STOP and report the same
failure evidence to the user. Never continue by self-reasoning.
