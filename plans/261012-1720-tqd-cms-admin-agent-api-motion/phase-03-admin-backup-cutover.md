---
phase: 3
title: "Admin, sao lưu và chuyển tqd.io.vn"
status: completed
priority: P1
effort: 10h
dependencies: [2]
---

# Phase 3 — Admin, sao lưu và chuyển `tqd.io.vn`

> Đọc mục Constraints trong `plan.md` trước khi bắt đầu. Không in mật khẩu, hash mật khẩu hay cookie phiên ra log/chat.

## Goal

`/admin` đăng nhập bằng mật khẩu riêng (PBKDF2-SHA256 100 000 vòng, hash trong secret `ADMIN_PASSWORD_HASH`), sửa được hồ sơ, sản phẩm, đào tạo, video, số liệu, liên hệ, chủ đề; có sao lưu D1 → R2 hằng đêm và nút "Sao lưu ngay"; `tqd.io.vn` chuyển sang bản mới, `tqd-next` thành Worker preview.

## Files to Create / Modify

- Create: `src/lib/password.ts`, `src/lib/password.test.ts`, `src/lib/rate-limit.ts`, `src/lib/auth.ts`, `src/lib/auth.test.ts`, `src/lib/admin-writes.ts`, `src/lib/backup.ts` (thay bản tạm), `src/layouts/AdminLayout.astro`, `src/pages/admin/login.astro`, `src/pages/admin/logout.ts`, `src/pages/admin/index.astro`, `src/pages/admin/ho-so.astro`, `src/pages/admin/muc/[kind].astro`, `src/pages/admin/muc/[kind]/[id].astro`, `src/pages/admin/so-lieu.astro`, `src/pages/admin/lien-he.astro`, `src/pages/admin/sao-luu.astro`, `src/pages/admin/api/settings/[key].ts`, `scripts/admin-password.mjs`, `scripts/restore-backup.mjs`, `scripts/deploy-preview.mjs`, `scripts/verify/admin.mjs`, `docs/backup-restore.md`
- Modify: `src/middleware.ts`, `src/env.d.ts`, `wrangler.jsonc`, `package.json`, `README.md`, `docs/deployment.md`

## Task 3.1 — Băm mật khẩu

- Goal: hàm băm/kiểm mật khẩu dùng chung cho Worker và script Node.
- Target files: `src/lib/password.ts`, `src/lib/password.test.ts`, `scripts/admin-password.mjs`.
- Steps:
  1. `src/lib/password.ts` (chỉ TS xoá-type được: không enum, không namespace; chỉ dùng `crypto.subtle`, `crypto.getRandomValues`, `btoa`/`atob`):
     - `export const ITERATIONS = 100_000;` (giới hạn tối đa của WebCrypto PBKDF2 trên Workers).
     - `hashPassword(password: string): Promise<string>` → salt 16 byte ngẫu nhiên, PBKDF2-SHA256, 32 byte; trả `pbkdf2-sha256$100000$<salt base64>$<hash base64>`.
     - `verifyPassword(password: string, stored: string): Promise<boolean>` → `stored.trim()`, tách 4 phần theo `$`, sai định dạng thì `false`; **số vòng lấy từ phần thứ 2 của chuỗi** (không dùng hằng `ITERATIONS`); tính lại; so sánh độ dài rồi XOR từng byte (không thoát sớm).
  2. `src/lib/password.test.ts`: hash rồi verify đúng → `true`; mật khẩu sai → `false`; chuỗi `abc` → `false`; hai lần hash cùng mật khẩu ra chuỗi khác nhau.
  3. `scripts/admin-password.mjs` (import `../src/lib/password.ts`):
     - `--generate <file>`: tạo mật khẩu ngẫu nhiên 24 ký tự base64url, ghi vào `<file>` không có ký tự xuống dòng cuối (tạo thư mục cha), in **chỉ hash** ra stdout.
     - `--prompt`: hỏi mật khẩu trên stderr, không hiện ký tự gõ (readline với output tắt echo), hỏi lại để xác nhận, yêu cầu ≥ 12 ký tự; in **chỉ hash** ra stdout.
- Verify: `npx vitest run src/lib/password.test.ts` exit 0 VÀ `node scripts/admin-password.mjs --generate .secrets/admin-local.txt` in một dòng bắt đầu bằng `pbkdf2-sha256$100000$` và file `.secrets/admin-local.txt` tồn tại.

## Task 3.2 — Giới hạn tần suất và phiên đăng nhập

- Goal: 5 lần đăng nhập trong 15 phút mỗi IP; phiên 12 giờ lưu D1, cookie `__Host-tqd_admin`.
- Target files: `src/lib/rate-limit.ts`, `src/lib/auth.ts`, `src/lib/auth.test.ts`, `src/env.d.ts`.
- Steps:
  1. `src/lib/rate-limit.ts`: `hit(db, bucket, limit, windowSec): Promise<{ allowed: boolean; retryAfter: number }>` chạy một câu:
     ```sql
     INSERT INTO rate_limits(bucket, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(bucket) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start <= ?2 - ?3 THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start <= ?2 - ?3 THEN ?2 ELSE rate_limits.window_start END
     RETURNING count, window_start
     ```
     với `?2` = giây hiện tại, `?3` = `windowSec`. `allowed = count <= limit`; `retryAfter = window_start + windowSec - now`. Thêm `reset(db, bucket)` xoá dòng.
  2. `src/lib/auth.ts`:
     - `COOKIE = '__Host-tqd_admin'`, `TTL_SEC = 12 * 3600`.
     - `sha256Hex(text)` (export, dùng lại ở phase 5).
     - `createSession(db)`: token = base64url 32 byte ngẫu nhiên; lưu `sha256Hex(token)` và `expires_at`; xoá phiên hết hạn trong cùng `db.batch`; trả token.
     - `readSession(db, token)`: `true` nếu có dòng còn hạn.
     - `destroySession(db, token)`.
     - `cookieHeader(token)`: `__Host-tqd_admin=<token>; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=43200`. `clearCookieHeader()`: cùng thuộc tính, `Max-Age=0`.
  3. `src/env.d.ts`: thêm
     ```ts
     declare namespace App { interface Locals { admin?: boolean } }
     ```
  4. `src/lib/auth.test.ts`: `cookieHeader('x')` chứa `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, không chứa `Domain`.
- Verify: `npx vitest run src/lib/auth.test.ts` exit 0.

## Task 3.3 — Bảo vệ `/admin` trong middleware và trang đăng nhập

- Goal: mọi `/admin/*` trừ `/admin/login` cần phiên; mọi request ghi (`POST`, `PUT`, `PATCH`, `DELETE`) vào `/admin/*` phải cùng origin.
- Target files: `src/middleware.ts`, `src/pages/admin/login.astro`, `src/pages/admin/logout.ts`, `src/layouts/AdminLayout.astro`.
- Steps:
  1. Trong middleware, trước nhánh cache, với path bắt đầu `/admin`:
     - Nếu method ghi: `Origin` phải bằng `url.origin`; nếu có `Sec-Fetch-Site` thì phải là `same-origin`. Sai → `403` text `Forbidden`.
     - Nếu path khác `/admin/login`: đọc cookie `__Host-tqd_admin`; `readSession` sai → với `GET` trả `303 Location: /admin/login`, với method khác trả `401`. Đúng → `context.locals.admin = true`.
  2. `login.astro`: form `POST` trường `password`. Khi POST:
     - `ip = request.headers.get('cf-connecting-ip') ?? 'local'`; `hit(db, 'login:' + ip, 5, 900)`; không `allowed` → status 429, hiện `Sai quá nhiều lần. Thử lại sau N phút.`
     - `env.ADMIN_PASSWORD_HASH` rỗng → status 503, hiện `Chưa đặt mật khẩu admin.`
     - `verifyPassword` đúng → `reset` bucket, `createSession`, trả `303 Location: /admin` kèm `Set-Cookie: cookieHeader(token)`.
     - Sai → status 401, hiện `Sai mật khẩu.`
  3. `logout.ts`: `POST` → `destroySession`, `303 Location: /admin/login`, `Set-Cookie: clearCookieHeader()`.
  4. `AdminLayout.astro`: `<meta name="robots" content="noindex">`, menu: Tổng quan `/admin`, Hồ sơ `/admin/ho-so`, Sản phẩm `/admin/muc/san-pham`, Đào tạo `/admin/muc/dao-tao`, Video `/admin/muc/video`, Số liệu `/admin/so-lieu`, Liên hệ `/admin/lien-he`, Sao lưu `/admin/sao-luu`, nút Đăng xuất (form POST `/admin/logout`). Phase 4–5 thêm Bài viết, Media, API key.
  5. Thêm `ADMIN_PASSWORD_HASH` vào `.dev.vars` (tạo file nếu chưa có) bằng hash ở Task 3.1 (`ADMIN_PASSWORD_HASH=<hash>`). Không in hash ra chat.
  6. `npm run cf-typegen` để `Env` có `ADMIN_PASSWORD_HASH: string`.
- Verify: no verification needed (Task 3.6 kiểm toàn bộ).

## Task 3.4 — Trang sửa nội dung

- Goal: sửa được mọi mục đang có; mỗi lần ghi tăng `content_version` trong cùng batch.
- Target files: `src/lib/admin-writes.ts`, các trang `src/pages/admin/*` liệt kê ở trên.
- Steps:
  1. `src/lib/admin-writes.ts`:
     - `saveSetting(db, key, value: unknown)`: `db.batch([INSERT ... ON CONFLICT(key) DO UPDATE SET value=excluded.value, bumpVersion(db)])`.
     - `saveItem(db, input)` (thêm nếu không có `id`, sửa nếu có), `deleteItem(db, id)`: đều trong `db.batch` cùng `bumpVersion(db)`; cập nhật `updated_at = datetime('now')`.
     - `parseLinks(text)`: mỗi dòng `Nhãn | https://...`; chỉ nhận `https:`, `http:` hoặc `mailto:`; dòng sai → lỗi có số dòng.
     - Giới hạn độ dài: tiêu đề ≤ 200, tóm tắt ≤ 1000, intro ≤ 2000. Sai → hiện lỗi, không ghi.
  2. `ho-so.astro`: form các trường `name, handle, initials, role, intro, focus (mỗi dòng một ý), email, zalo, portraitAlt`; POST → `saveSetting(db, 'person', {...giữ portrait/portraitSmall cũ, ...trường mới})` → `303 Location: /admin/ho-so?ok=1`. (Phase 4 Task 4.6 thêm chọn ảnh chân dung từ media.)
  3. `muc/[kind].astro`: `kind` ∈ `san-pham`→`product`, `dao-tao`→`training`, `video`→`video`; khác thì 404. Liệt kê mục (tiêu đề, ngày, ẩn/hiện, link Sửa) và form Thêm (title, date, summary, tags phân cách dấu phẩy, links theo `parseLinks`, sort, visible).
  4. `muc/[kind]/[id].astro`: form sửa như trên + nút Xoá (POST với `_action=delete`).
  5. `so-lieu.astro`: textarea JSON của `stats`; khi lưu, `JSON.parse` và yêu cầu có mảng `headline` và `byGroup`; sai → báo lỗi, không ghi. Cùng trang có textarea JSON `topics` (yêu cầu `howTo` và `marketWatch` là mảng chuỗi).
  6. `lien-he.astro`: textarea liên kết theo `parseLinks` → `saveSetting(db, 'links', ...)`.
  7. `index.astro` (admin): số sản phẩm/đào tạo/video, `content_version`, link các trang.
  8. `api/settings/[key].ts`: `GET` trả JSON của setting (`person`, `stats`, `links`, `topics`, `sections`), key khác → 404. Dùng cho script kiểm tra.
  9. Không dùng `set:html` với dữ liệu nhập ở bất kỳ trang admin nào.
- Verify: `npm run build` exit 0.

## Task 3.5 — Sao lưu D1 → R2

- Goal: cron và nút "Sao lưu ngay" ghi `backups/YYYY-MM-DD.json` vào R2; có script khôi phục đã thử.
- Target files: `src/lib/backup.ts`, `src/pages/admin/sao-luu.astro`, `scripts/restore-backup.mjs`, `docs/backup-restore.md`.
- Steps:
  1. `runBackup(env)`: đọc toàn bộ `settings`, `items`, `articles`, `media`, `api_keys` (KHÔNG `sessions`, `rate_limits`); ghi `{ createdAt, tables: { <tên>: rows[] } }` vào `env.MEDIA.put('backups/' + ngày theo giờ Việt Nam + '.json', json, { httpMetadata: { contentType: 'application/json' } })`; liệt kê `backups/`, giữ 30 bản mới nhất, xoá phần còn lại. Trả về key vừa ghi.
  2. `sao-luu.astro`: liệt kê `env.MEDIA.list({ prefix: 'backups/' })` (tên, dung lượng, thời gian); nút POST "Sao lưu ngay" gọi `runBackup(env)`, hiện key vừa ghi trong phần tử `<code data-backup-key>`. Ngày trong tên file tính theo múi giờ `Asia/Ho_Chi_Minh` bằng `new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())`.
  3. `scripts/restore-backup.mjs <backup.json> <out.sql>`: sinh SQL `DELETE FROM <bảng>;` rồi `INSERT` từng dòng cho 5 bảng theo đúng thứ tự trên, escape `'` thành `''`, `NULL` cho giá trị null.
  4. Thử trên local (dev server chạy nền ở 4321, đăng nhập bằng mật khẩu trong `.secrets/admin-local.txt`):
     a. Bấm/POST "Sao lưu ngay"; chép key trong `<code data-backup-key>` (dạng `backups/YYYY-MM-DD.json`).
     b. `npx wrangler r2 object get tqd-media/<key ở bước a> --local --file .secrets/backup-test.json`
     c. `node scripts/restore-backup.mjs .secrets/backup-test.json .secrets/restore-test.sql`
     d. `npx wrangler d1 execute tqd_db --local --file .secrets/restore-test.sql`
     e. `node scripts/verify/seed.mjs`
  5. `docs/backup-restore.md`: lịch cron (19:00 UTC = 02:00 giờ Việt Nam), vị trí file, cách tải bản sao lưu (lệnh bước 4b với `--remote` thay `--local`), cách khôi phục (bước 4c–4d với `--remote`), và cách dùng D1 Time Travel: `npx wrangler d1 time-travel info tqd_db` rồi `npx wrangler d1 time-travel restore tqd_db --timestamp <ISO>`.
- Verify: bước 4e in `OK seed` VÀ file `.secrets/restore-test.sql` chứa `INSERT INTO items`.

## Task 3.6 — Kiểm tra admin tự động

- Goal: `scripts/verify/admin.mjs <base>` chứng minh đăng nhập, sửa, phản ánh ra trang công khai, chặn khác origin, đăng xuất, khoá sau 5 lần sai.
- Target files: `scripts/verify/admin.mjs`.
- Steps:
  1. Script đọc mật khẩu từ biến môi trường `TQD_ADMIN_PASSWORD` rồi `.trim()` (không nhận qua tham số dòng lệnh). Dùng `fetch` với `redirect: 'manual'`, tự giữ cookie. Mọi request ghi gửi `Origin: <base>` (trừ bước 5) và `Content-Type: application/x-www-form-urlencoded`. Các bước, theo đúng thứ tự:
     1. `GET /admin` → 303, `Location` kết thúc `/admin/login`.
     2. `POST /admin/login` (form, header `Origin: <base>`) mật khẩu đúng → 303 và có `set-cookie` chứa `__Host-tqd_admin=`.
     3. `GET /admin/api/settings/person` → 200 JSON; giữ bản gốc.
     4. `POST /admin/ho-so` (Origin đúng) với `role` = `Kiểm thử <Date.now()>` và các trường khác từ bản gốc → 303. `GET /` chứa chuỗi kiểm thử.
     5. `POST /admin/ho-so` với `Origin: https://evil.example` → 403.
     6. `POST /admin/ho-so` không có cookie (vẫn gửi `Origin` đúng) → 401.
     7. Khôi phục `role` gốc → 303; `GET /` không còn chuỗi kiểm thử.
     8. `POST /admin/logout` → 303; `GET /admin` với cookie cũ → 303 tới `/admin/login`.
     9. 5 lần `POST /admin/login` mật khẩu sai → mỗi lần 401; lần thứ 6 (mật khẩu đúng) → 429.
     In `OK admin` hoặc `FAIL <bước> <status>` rồi exit 1.
  2. Chạy trên local: dev server nền ở 4321; PowerShell: `$env:TQD_ADMIN_PASSWORD = Get-Content .secrets/admin-local.txt -Raw` rồi `node scripts/verify/admin.mjs http://localhost:4321`. Sau đó xoá khoá: `npx wrangler d1 execute tqd_db --local --command "DELETE FROM rate_limits"`.
  3. Đặt mật khẩu preview: `node scripts/admin-password.mjs --generate .secrets/admin-next.txt | npx wrangler secret put ADMIN_PASSWORD_HASH --name tqd-next`; `npm run deploy` (lúc này `wrangler.jsonc` vẫn tên `tqd-next`); chạy lại bước 2 với `.secrets/admin-next.txt` và base preview; rồi `npx wrangler d1 execute tqd_db --remote --command "DELETE FROM rate_limits"`.
  4. Quy tắc CPU (đã lên kế hoạch, không phải ứng biến): nếu ở bước 3 `POST /admin/login` trả 500, hoặc body/log chứa `1102` hoặc `exceeded`, thì đổi `ITERATIONS = 20_000` trong `src/lib/password.ts`, tạo lại hash cho cả `.dev.vars` và preview (`--generate` + `secret put`), `npm run deploy`, chạy lại bước 2–3. Ghi lý do vào báo cáo (mật khẩu ngẫu nhiên 24 ký tự đã đủ entropy; khoá 15 phút chặn dò).
- Verify: `node scripts/verify/admin.mjs <base>` in `OK admin`, exit 0, trên cả local và preview.

## Task 3.7 — Chuyển `tqd.io.vn` sang bản mới

- Goal: `tqd.io.vn` chạy Worker v2 tên `tqd-website`; `tqd-next` thành môi trường preview (`env.preview`).
- Target files: `wrangler.jsonc`, `scripts/deploy-preview.mjs`, `package.json`.
- Steps:
  1. Ghi lại phiên bản đang chạy để rollback: `npx wrangler deployments list --name tqd-website` → lưu Version ID mới nhất (bắt đầu `8ffa1fd5`) vào báo cáo.
  2. Sửa `wrangler.jsonc`: `"name": "tqd-website"`, `"workers_dev": false`, thêm `"routes": [{ "pattern": "tqd.io.vn", "custom_domain": true }]`, và thêm:
     ```jsonc
     "env": {
       "preview": {
         "name": "tqd-next",
         "workers_dev": true,
         "routes": [],
         "triggers": { "crons": [] },
         "d1_databases": [
           { "binding": "DB", "database_name": "tqd_db", "database_id": "<D1_UUID>", "migrations_dir": "migrations" }
         ],
         "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "tqd-media" }]
       }
     }
     ```
  3. `scripts/deploy-preview.mjs`: chạy `npm run build` rồi `npx wrangler deploy` bằng `execSync(..., { stdio: 'inherit', env: { ...process.env, CLOUDFLARE_ENV: 'preview' } })`. Thêm script `"deploy:preview": "node scripts/deploy-preview.mjs"`.
  4. `npm run deploy:preview` → output phải nhắc `tqd-next`, KHÔNG nhắc `tqd.io.vn`. Nếu output nhắc `tqd.io.vn`: STOP (env preview chưa được áp dụng).
  5. `npm run deploy` → output chứa `tqd.io.vn`. Nếu lỗi bản ghi DNS xung đột: STOP và hỏi người dùng, không xoá bản ghi.
  6. Nhắn người dùng đúng câu: "Anh chạy lệnh sau trong terminal này để đặt mật khẩu admin (gõ `!` ở đầu): `! node scripts/admin-password.mjs --prompt | npx wrangler secret put ADMIN_PASSWORD_HASH --name tqd-website`, rồi đăng nhập thử `https://tqd.io.vn/admin` và báo em." Chờ người dùng xác nhận.
- Success criteria: `tqd.io.vn` phục vụ bản v2; người dùng đăng nhập được.
- Verify (tất cả phải đạt):
  - `node scripts/verify/site.mjs https://tqd.io.vn` in `OK site`.
  - `npm run check:privacy -- https://tqd.io.vn` in dòng bắt đầu `OK no post text`.
  - `node scripts/verify/live.mjs` in `OK live`.
  - Người dùng xác nhận đăng nhập `/admin` thành công.
- Rollback nếu site lỗi sau bước 5: `npx wrangler rollback <Version ID ở bước 1> --name tqd-website`, rồi báo người dùng.

## Task 3.8 — Kiểm cache trên tên miền thật

- Goal: HTML công khai được phục vụ từ Cache API khi `content_version` không đổi.
- Steps:
  1. Trong middleware, cho route `cacheable`: đặt `X-Cache: HIT` trên `out` (bản sao mới tạo từ `hit`, KHÔNG sửa bản lưu trong cache) và `X-Cache: MISS` trên `res` khi render mới; cả hai có `X-Content-Version: <version>`.
  2. `npm run deploy`.
  3. Tạo `scripts/verify/cache.mjs <base>`: gọi `GET <base>/san-pham` 3 lần cách nhau 1 giây; đạt nếu ít nhất một lần sau lần đầu có `x-cache: HIT` và cả 3 lần cùng `x-content-version`. In `OK cache`.
- Verify: `node scripts/verify/cache.mjs https://tqd.io.vn` in `OK cache`.

## Task 3.9 — Tài liệu và commit

- Steps:
  1. `docs/deployment.md`: Worker giờ có mã server (Astro SSR); binding `DB` (`tqd_db`), `MEDIA` (`tqd-media`); secret `ADMIN_PASSWORD_HASH` và cách đặt; `npm run deploy` (production) và `npm run deploy:preview` (`tqd-next`); kết quả thử `cf deploy` ở Task 1.6; rollback với Version ID cũ.
  2. `README.md`: nội dung giờ sửa trong `/admin` (không còn `src/data/profile.ts`); lệnh `npm test`, `npm run deploy:preview`, `npm run check:privacy -- <url>`; link `docs/backup-restore.md`.
  3. Dừng dev server nền nếu còn; `git add -A`; `git status --porcelain` không được có `.dev.vars` hay `.secrets`; commit `feat: add password-protected admin, nightly backup and cut over domain`.
- Verify: `git status --porcelain` rỗng VÀ `docs/deployment.md` chứa `ADMIN_PASSWORD_HASH` và `deploy:preview`.

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
