---
title: "tqd.io.vn v2: /admin, bài viết từ AI Agent, video TikTok, hiệu ứng kiểu Zuey OS"
description: "Chuyển site tĩnh sang Astro SSR trên Cloudflare Worker với D1 + R2; admin mật khẩu riêng; API có API key và skill tqd-publish cho agent; player TikTok; bộ hiệu ứng viết mới"
status: in-progress
priority: P2
effort: 6d
branch: main
tags: [astro, cloudflare, d1, r2, cms, api, animation]
blockedBy: []
blocks: []
created: 2026-10-12
---

# tqd.io.vn v2

Nguồn quyết định: [brainstorm v2](../reports/brainstorm-261012-1657-tqd-cms-admin-agent-api-motion.md). Nền hiện tại: [plan v1](../261012-1604-tqd-personal-website/plan.md) (site tĩnh, live, Worker `tqd-website` version `8ffa1fd5`).

Plan viết theo hợp đồng `--advice`: người thực thi có thể là model yếu hơn. Mỗi task có Goal, file đích, Steps, Success criteria và Verify so sánh được. Mỗi phase có khối Failure Protocol: **Verify sai thì DỪNG**, không tự sửa vòng vo.

## Outcome

1. `/admin` (mật khẩu riêng) quản lý toàn bộ nội dung: hồ sơ, sản phẩm, đào tạo & sự kiện, video, bài viết, số liệu, liên hệ, media, API key, sao lưu.
2. Mục Video AI phát video TikTok ngay trên trang bằng player chính thức (tải khi bấm).
3. Mục Chuyên môn đổi thành **Bài viết** (`/bai-viet`, `/bai-viet/{slug}`); `/chuyen-mon` chuyển hướng 301.
4. Agent đăng bài qua `PUT /api/v1/articles/{slug}` và tải media qua `POST /api/v1/media` bằng API key; skill `tqd-publish` gọi API này. Media nằm trong R2 `tqd-media`.
5. Bộ hiệu ứng viết mới: cửa sổ & dock, hình nền & giao diện, mobile & ⌘K, linh vật & thời tiết.

## Constraints (bắt buộc cho mọi phase)

- **Hook máy:** mọi lệnh shell chứa chữ `dist`, `node_modules` hoặc `.git/` bị chặn (`BLOCKED: Access to 'dist...' denied`). Lệnh build (`npm run build`, `npx astro build`, `npx wrangler deploy`) vẫn chạy được. Kiểm tra nào cần đọc thư mục build thì viết thành file `scripts/verify/<tên>.mjs` rồi chạy `node scripts/verify/<tên>.mjs`. Không sửa cấu hình hook.
- **Không chép code zuey-me** (repo không có license). Chỉ dùng thông số hiệu ứng ghi trong phase 6–7.
- **Không đăng văn bản bài Facebook.** Trang tổng hợp từ dữ liệu Facebook phải qua `npm run check:privacy`. Bài do agent viết: chỉ **cảnh báo** trong admin khi trùng (mặc định của brainstorm, chưa bị người dùng phản đối).
- **Không làm gián đoạn site đang chạy:** phase 1–3 deploy lên Worker riêng `tqd-next` (`*.workers.dev`). `tqd.io.vn` chỉ chuyển ở Task 3.7.
- **Preview dùng chung D1/R2 với production.** Kiểm tra trên preview tạo bài/media thử, chúng hiện vài giây trên `tqd.io.vn` rồi bị xoá. Slug thử luôn bắt đầu `kiem-thu-`, `api-test-`, `api-draft-`, `skill-test-` hoặc `lighthouse-test-`; script kiểm tra phải tự dọn.
- **Tài khoản Cloudflare:** Xaotiensinh (`b243f38bff984ce1741c379547e97a75`). Luôn đặt `CLOUDFLARE_ACCOUNT_ID=b243f38bff984ce1741c379547e97a75` khi chạy `wrangler`.
- **Secret:** không in, không commit mật khẩu, hash mật khẩu, API key. File chứa secret chỉ nằm trong `.secrets/` hoặc `.dev.vars` (cả hai đã/được thêm vào `.gitignore`). Khi báo cáo, ghi `[redacted]`.
- **Nội dung agent không tin cậy:** Markdown → HTML qua `rehype-sanitize`; không HTML thô; ảnh chỉ từ `/media/`; iframe chỉ `https://www.tiktok.com/player/v1/{id số}`.
- **File `src/lib/*.ts` được script Node import** (`password.ts`, `auth.ts`, `api-key.ts`, `normalize-text.ts`, `fb-overlap.ts`): import file anh em phải có đuôi `.ts` (ví dụ `import { sha256Hex } from './auth.ts'`), import chỉ-type dùng `import type`; không enum, không namespace. Astro tsconfig đã bật `allowImportingTsExtensions`.
- **Request ghi tới `/admin/*` trong script kiểm tra** luôn gửi `Origin: <base>` và `Content-Type` tường minh (`application/x-www-form-urlencoded` cho form, `application/octet-stream` hoặc type của file cho upload, `application/json` cho JSON).
- **Chuỗi đọc từ file/pipe** (mật khẩu, hash, key) luôn `.trim()` trước khi dùng (PowerShell thêm CRLF).
- **Deploy:** luôn build ngay trước deploy (`npm run deploy` / `npm run deploy:preview`); không chạy `npx wrangler deploy` lẻ sau khi đã build cho môi trường khác.
- **Process:** dev server chạy nền ở cổng cố định `4321`. Trước khi chạy, kiểm tra cổng (`netstat -ano | findstr :4321`); nếu đã có process của dự án này thì dùng lại, không mở cổng khác. Cuối mỗi phase, dừng dev server mình đã mở.
- Commit local theo conventional commits, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Không push (repo không có remote).

## Sự thật đã kiểm tra (2026-10-12)

| Mục | Giá trị | Hệ quả cho plan |
|---|---|---|
| `@astrojs/cloudflare` | 14.3.4, peer `astro ^7.2.0`, `wrangler ^4.125.0`, dùng `@cloudflare/vite-plugin` | Binding đọc bằng `import { env } from 'cloudflare:workers'` (không còn `Astro.locals.runtime.env`). Có thể đặt `main` riêng trong `wrangler.jsonc` và dùng `handle` từ `@astrojs/cloudflare/handler` |
| Adapter và `cf` CLI | Adapter **không** tạo `.cloudflare/output/v0/config.json` | `cf deploy` nhiều khả năng vẫn lỗi; chỉ thử 1 lần (Task 1.6), Wrangler là đường chính |
| Astro 7 `session` | Chấp nhận `session: false` | Tắt session của Astro để adapter không đòi KV `SESSION` |
| Astro 7 `security.checkOrigin` | Mặc định bật cho trang on-demand | Thêm lớp chặn POST form khác origin; vẫn tự kiểm `Origin` trong middleware admin |
| PBKDF2 trên Workers | WebCrypto Workers giới hạn **100 000** vòng; gói Free chỉ có 10 ms CPU mỗi request | Mặc định 100 000 vòng, số vòng ghi trong chuỗi hash; nếu đăng nhập vượt CPU thì hạ 20 000 (quy tắc ở Task 3.6). Bù bằng khoá 15 phút sau 5 lần sai |
| Kiểm trùng Facebook | Băm SHA-256 từng cửa sổ (tới 100k lần/bài) vượt 10 ms CPU | Dùng hash đồng bộ 53-bit (cyrb53) dùng chung cho script và Worker |
| Workers Rate Limiting binding | Chỉ cho chu kỳ 10 hoặc 60 giây | Dùng bảng D1 `rate_limits` (khoá 15 phút, giới hạn API theo key), một hàm dùng chung |
| Cache API trên `*.workers.dev` | Không có tác dụng | Cache chỉ kiểm được sau khi lên `tqd.io.vn` (Task 3.8) |
| Node | 24.19, chạy `.ts` chỉ-xoá-type trực tiếp | Script `.mjs` import được `src/lib/*.ts` nếu file đó không dùng enum/namespace và import có đuôi `.ts` |

## Kiến trúc

```
Trình duyệt ──► Worker tqd-website (src/worker.ts)
                 ├─ fetch → Astro handle (SSR, output: 'server')
                 │    ├─ src/middleware.ts: cache theo content_version, CSP, bảo vệ /admin, /api
                 │    ├─ trang công khai  → src/lib/content.ts → D1 (DB)
                 │    ├─ /admin/*         → src/lib/auth.ts (session D1)
                 │    ├─ /api/v1/*        → src/lib/api-auth.ts (API key SHA-256)
                 │    └─ /media/*         → R2 (MEDIA), hỗ trợ Range cho video
                 └─ scheduled (cron 19:00 UTC) → src/lib/backup.ts → R2 backups/YYYY-MM-DD.json
```

## Phases

| # | Phase | File | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| 1 | Nền SSR, D1, R2, dữ liệu gốc, Worker preview | [phase-01](phase-01-ssr-foundation-d1-r2.md) | — | completed |
| 2 | Trang công khai đọc D1, cache, kiểm tra quyền riêng tư | [phase-02](phase-02-public-pages-from-d1.md) | 1 | completed |
| 3 | Admin, sao lưu và chuyển `tqd.io.vn` | [phase-03](phase-03-admin-backup-cutover.md) | 2 | completed |
| 4 | Bài viết, media R2, player TikTok | [phase-04](phase-04-articles-media-tiktok.md) | 3 | in-progress (chờ link TikTok, task 4.9) |
| 5 | API cho agent và skill `tqd-publish` | [phase-05](phase-05-agent-api-and-skill.md) | 4 | completed |
| 6 | Hiệu ứng: ⌘K, mobile, cửa sổ/dock/Exposé, hình nền | [phase-06](phase-06-motion-os-shell.md) | 4 | completed |
| 7 | Linh vật và thời tiết | [phase-07](phase-07-mascot-and-weather.md) | 6 | pending |

Phase 5 và 6 độc lập nhau (khác file), có thể làm theo thứ tự bất kỳ sau phase 4.

## Acceptance criteria

1. `/admin` yêu cầu đăng nhập; 5 lần sai trong 15 phút thì bị khoá 15 phút (HTTP 429); sửa được mọi mục và thay đổi hiện ngay trên trang công khai (`scripts/verify/admin.mjs` in `OK admin`).
2. `PUT /api/v1/articles/{slug}` với key hợp lệ tạo bài có ảnh từ R2, bài hiện ở `/bai-viet`; key sai → 401; key đã thu hồi → 401 (`scripts/verify/api.mjs` in `OK api`).
3. Skill `tqd-publish` đăng một bài thử lên `https://tqd.io.vn` rồi xoá nó (Task 5.6).
4. Mục Video AI phát được video TikTok trên trang; iframe chỉ xuất hiện sau khi bấm.
5. `npx vitest run` pass, gồm test XSS: `<script>`, `onerror=`, `javascript:` không còn trong HTML đầu ra.
6. Hiệu ứng trong phase 6–7 chạy được và tắt khi `prefers-reduced-motion: reduce`; Lighthouse mobile hiệu năng và truy cập ≥ 0.9 ở `/` và một trang `/bai-viet/{slug}`.
7. D1 có đủ: 1 hồ sơ, 6 sản phẩm, 4 đào tạo, 5 video, số liệu 71/13/11/73K và phân bổ 9/5/5/17/35 (`scripts/verify/seed.mjs` in `OK seed`).
8. Cron sao lưu D1 → R2 chạy hằng đêm; `docs/backup-restore.md` có cách khôi phục đã thử trên local.

## Risks

- `cf deploy` lỗi do thiếu Build Output Specification → dùng Wrangler (đã lên kế hoạch, không phải ứng biến).
- Tài khoản chưa bật R2 → `wrangler r2 bucket create` báo lỗi bật R2 trong dashboard → STOP, nhờ người dùng bật (Task 1.3).
- `vm.tiktok.com` chặn request từ Worker → admin báo "dán link đầy đủ dạng tiktok.com/@.../video/{id}".
- Cache sai làm hiện nội dung cũ → mọi lệnh ghi tăng `content_version` trong cùng `db.batch()`.
- Agent đăng nhầm hàng loạt → key không có scope `publish` chỉ tạo nháp; giới hạn 60 request/phút mỗi key; thu hồi key trong admin.
- Gói Free giới hạn 10 ms CPU mỗi request: render Markdown bài rất dài có thể vượt (lỗi `1102`). Nếu gặp, STOP và hỏi người dùng có nâng Workers Paid (5 USD/tháng) không; không tự cắt tính năng.
- Model tạo ảnh cho linh vật không đều → dùng avatar cách điệu (Task 7.1 có nhánh dự phòng).

## Rà soát

kongming đã duyệt bản nháp (2026-10-12) và đánh giá các điểm lệch so với brainstorm là hợp lý. Đã áp dụng đủ: xoá media không đụng được `backups/`; đề phòng giới hạn 10 ms CPU (số vòng PBKDF2 nằm trong chuỗi hash, hash cyrb53 cho kiểm trùng); mẫu upload `FixedLengthStream` chạy song song; Range/ETag/If-Match ghi rõ; header Origin/Content-Type trong script kiểm tra; CSP không ghi đè CSP của `/media/`; `X-Cache: HIT` đặt trên bản sao; bỏ `types` trong tsconfig; ảnh chân dung sửa được trong admin.

## Unresolved questions

1. Link TikTok thật cho 5 video hiện có: chưa có trong dữ liệu nguồn. Task 4.7 cần ít nhất 1 link video TikTok công khai của anh; nếu chưa có, người thực thi hỏi anh tại bước đó.
2. Kiểm "trùng văn bản Facebook" cho bài agent: plan dùng mặc định **chỉ cảnh báo**. Nếu anh muốn chặn, đổi một dòng ở Task 4.3.
