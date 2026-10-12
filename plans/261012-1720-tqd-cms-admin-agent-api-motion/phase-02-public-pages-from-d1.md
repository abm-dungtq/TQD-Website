---
phase: 2
title: "Trang công khai đọc D1, cache, kiểm tra quyền riêng tư"
status: completed
priority: P1
effort: 6h
dependencies: [1]
---

# Phase 2 — Trang công khai đọc D1, cache, kiểm tra quyền riêng tư

> Đọc mục Constraints trong `plan.md` trước khi bắt đầu.

## Goal

Mọi trang công khai (`/`, 6 mục, `/bai-viet`, `.md`, `/llms.txt`, `/sitemap.xml`) lấy nội dung từ D1; `/chuyen-mon` chuyển 301 sang `/bai-viet`; HTML được cache theo `content_version`; kiểm tra quyền riêng tư chạy trên URL thay vì thư mục build. Giao diện nhìn như bản v1.

## Files to Create / Modify

- Create: `src/lib/content.ts`, `src/middleware.ts`, `src/env.d.ts`, `src/pages/chuyen-mon.ts`, `src/pages/chuyen-mon.md.ts`, `scripts/verify/site.mjs`, `src/lib/content.test.ts`
- Modify: `src/pages/index.astro`, `src/pages/[section].astro`, `src/pages/[section].md.ts`, `src/pages/index.md.ts`, `src/pages/llms.txt.ts`, `src/pages/sitemap.xml.ts`, `src/pages/404.astro`, `src/layouts/BaseLayout.astro`, `src/components/SectionBody.astro`, `src/components/DesktopShell.astro`, `src/components/StatGrid.astro`, `src/components/ItemCard.astro`, `src/lib/profile-markdown.ts`, `src/scripts/desktop.ts`, `scripts/check-no-post-text.mjs`, `public/robots.txt`, `package.json`
- Delete: `src/data/profile.ts`, `src/data/stats.ts`, `scripts/verify/build-files.mjs`, `scripts/verify/build-contains.mjs`, `scripts/verify/sitemap.mjs`, `scripts/verify/stats.mjs`, `scripts/verify/contact.mjs`, `scripts/verify/no-js.mjs`

## Task 2.1 — Lớp dữ liệu `src/lib/content.ts`

- Goal: một module duy nhất đọc nội dung từ D1; không import `cloudflare:workers` (nhận `db` qua tham số để test được).
- Target files: `src/lib/content.ts`, `src/env.d.ts`.
- Steps:
  1. `src/env.d.ts`:
     ```ts
     /// <reference types="astro/client" />
     /// <reference types="@astrojs/cloudflare/types.d.ts" />
     ```
  2. Trong `src/lib/content.ts`, chuyển các type `Link`, `Item`, `SectionId`, `IconName`, `Section` từ `src/data/profile.ts` sang; đổi `SectionId` thành `'ho-so' | 'san-pham' | 'dao-tao' | 'video-ai' | 'bai-viet' | 'so-lieu' | 'lien-he'`. Thêm vào `Item`: `id: number`, `kind: ItemKind`, `tiktokId?: string`, `coverKey?: string`, `sort: number`, `visible: boolean`. Thêm type `ItemKind = 'product' | 'training' | 'video'`, `Person`, `Stats`, `Topics`, `Article` (`id, slug, title, summary, bodyHtml, bodyMd, coverKey, tags: string[], status, source, fbOverlap: boolean, version, publishedAt, updatedAt`).
  3. Export các hàm (đều `async`, tham số đầu là `db: D1Database`):
     - `getVersion(db): Promise<number>` — `SELECT value FROM settings WHERE key='content_version'`.
     - `getSite(db): Promise<{ person; stats; links; topics; sections }>` — 1 query `SELECT key,value FROM settings WHERE key IN (...)`, `JSON.parse` từng value.
     - `listItems(db, kind, opts?: { includeHidden?: boolean })` — `ORDER BY sort, id`; map cột snake_case sang camelCase; parse `tags`, `links`.
     - `listArticles(db, opts?: { includeDrafts?: boolean; limit?: number })` — bài `published` sắp theo `published_at DESC`.
     - `getArticle(db, slug, opts?: { includeDrafts?: boolean })`.
     - `bumpVersion(db): D1PreparedStatement` — trả statement `UPDATE settings SET value = CAST(value AS INTEGER) + 1 WHERE key = 'content_version'` (không chạy; người gọi đưa vào `db.batch([...])` cùng lệnh ghi).
     - `mediaUrl(key: string): string` → `/media/${key}`.
  4. Viết `src/lib/content.test.ts` (vitest) với một `db` giả tối thiểu (object có `prepare().bind().all()/first()` trả dữ liệu cố định) kiểm `listItems` map đúng `tags` thành mảng và `visible` thành boolean.
- Success criteria: type-check pass, test pass.
- Verify: `npx vitest run src/lib/content.test.ts` exit 0.

## Task 2.2 — Trang và component đọc D1

- Goal: các trang render từ `getSite`/`listItems`/`listArticles`; không còn import `src/data/*`.
- Steps:
  1. Trong mỗi trang `.astro`/endpoint `.ts`, lấy DB bằng `import { env } from 'cloudflare:workers';` rồi gọi hàm ở Task 2.1. Truyền dữ liệu xuống component qua props (`site`, `products`, `trainings`, `videos`, `articles`).
  2. `SectionBody.astro`: nhận props thay vì import; case `chuyen-mon` đổi thành `bai-viet`: danh sách `articles` (tiêu đề link tới `/bai-viet/{slug}`, ngày, tóm tắt); nếu rỗng hiện `Chưa có bài viết.` và danh sách chủ đề từ `site.topics` dưới tiêu đề `Chủ đề thường viết`. Ảnh chân dung: thay `<Image>` bằng
     `<img src={person.portrait} srcset={`${person.portraitSmall} 240w, ${person.portrait} 480w`} sizes="(min-width: 640px) 240px, 60vw" width="240" height="320" alt={person.portraitAlt} loading={eager ? 'eager' : 'lazy'} decoding="async">`.
  3. `DesktopShell.astro`, `StatGrid.astro`, `ItemCard.astro`, `BaseLayout.astro`: nhận dữ liệu qua props; `BaseLayout` nhận `sections` để vẽ nav.
  4. `[section].astro`: nếu `Astro.params.section` không nằm trong `site.sections` thì `return Astro.rewrite('/404')` và đặt `Astro.response.status = 404` trong `404.astro`.
  5. `src/pages/chuyen-mon.ts`: `export const GET = () => new Response(null, { status: 301, headers: { Location: '/bai-viet' } });`. Tương tự `chuyen-mon.md.ts` → `/bai-viet.md`.
  6. `src/lib/profile-markdown.ts`, `index.md.ts`, `[section].md.ts`, `llms.txt.ts`, `sitemap.xml.ts`: nhận dữ liệu qua tham số; sitemap liệt kê `/`, mọi section, mọi bài `published` (`/bai-viet/{slug}`), `lastmod` = ngày `updated_at` mới nhất (YYYY-MM-DD).
  7. `src/scripts/desktop.ts`: đổi mọi `chuyen-mon` thành `bai-viet` (nếu có).
  8. `public/robots.txt`: thêm `Disallow: /admin` và `Disallow: /api/` dưới `Allow: /`.
  9. Xoá `src/data/profile.ts` và `src/data/stats.ts`. Giữ `src/assets/portrait.jpg` (nguồn của `scripts/make-portrait.mjs` và `scripts/make-og.mjs`).
- Success criteria: không còn tham chiếu `src/data/` hay `astro:assets` trong `src/`.
- Verify: `npm run build` exit 0 VÀ Grep `data/profile|data/stats|astro:assets|chuyen-mon` trong `src/` chỉ trả về `src/pages/chuyen-mon.ts` và `src/pages/chuyen-mon.md.ts`.

## Task 2.3 — Middleware: cache theo `content_version` và header bảo mật

- Goal: HTML công khai lấy từ Cache API khi `content_version` không đổi; mọi phản hồi có header bảo mật; `/admin` và `/api/` không bao giờ bị cache.
- Target files: `src/middleware.ts`.
- Steps:
  1. Viết middleware (`defineMiddleware` từ `astro:middleware`):
     - `isPrivate` = path bắt đầu `/admin` hoặc `/api/`.
     - `cacheable` = `GET` VÀ không `isPrivate` VÀ không bắt đầu `/media/` VÀ `url.search === ''`.
     - Nếu `cacheable`: `version = await getVersion(env.DB)`; `key = new Request(url.origin + url.pathname + '?v=' + version)`; `hit = await caches.default.match(key)`; nếu có thì trả `out = new Response(hit.body, hit)` với `Cache-Control: public, max-age=0, must-revalidate` (Task 3.8 thêm `X-Cache: HIT` vào `out` ở đây). Nếu không: `res = await next()`; nếu `res.status === 200`, tạo bản lưu `stored = new Response(res.clone().body, res)` với `Cache-Control: public, max-age=86400`, gọi `context.locals.cfContext.waitUntil(caches.default.put(key, stored))`; trả `res` với `Cache-Control: public, max-age=0, must-revalidate`.
     - Mọi phản hồi: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, và CSP **chỉ khi phản hồi chưa có** (`if (!headers.has('Content-Security-Policy'))`, để giữ CSP chặt hơn của `/media/`): `frame-src https://www.tiktok.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`.
     - `isPrivate`: thêm `Cache-Control: no-store` và `X-Robots-Tag: noindex`.
  2. Nếu một header không đặt được vì response bất biến, tạo `new Response(res.body, res)` rồi đặt.
- Success criteria: lần gọi thứ hai cùng URL trên `tqd.io.vn` lấy từ cache (kiểm ở Task 3.8, vì Cache API không chạy trên `workers.dev`).
- Verify: no verification needed (Task 2.5 kiểm header; Task 3.8 kiểm cache).

## Task 2.4 — Kiểm tra quyền riêng tư theo URL

- Goal: `npm run check:privacy -- <base>` tải mọi trang công khai và báo `LEAK` nếu có đoạn ≥ 60 ký tự của bài Facebook.
- Target files: `scripts/check-no-post-text.mjs`, `package.json`.
- Steps:
  1. Đổi script: tham số 1 là base URL (mặc định `http://localhost:4321`), tham số 2 là file nguồn (mặc định như cũ). Lấy danh sách URL từ `<base>/sitemap.xml` (regex `<loc>([^<]+)</loc>`, thay origin bằng base), cộng thêm `/llms.txt`, `/index.md` và `<url>.md` cho mỗi URL section. Tải từng URL, `normalize` rồi nối thành `haystack`. Phần so khớp giữ nguyên thuật toán (WINDOW 60, STEP 20, MIN_LENGTH 30). In `OK no post text (<số bài>) over <số URL> urls`.
  2. Xoá các script đọc thư mục build đã liệt kê ở mục Delete.
- Success criteria: script không còn đọc thư mục build.
- Verify: no verification needed (Task 2.5 chạy).

## Task 2.5 — Kiểm tra trang công khai

- Goal: script `scripts/verify/site.mjs <base>` xác nhận đủ route, nội dung và header.
- Steps:
  1. Tạo `scripts/verify/site.mjs`. Kiểm (fetch với `redirect: 'manual'` cho 301):
     - 200: `/`, `/ho-so`, `/san-pham`, `/dao-tao`, `/video-ai`, `/bai-viet`, `/so-lieu`, `/lien-he`, `/index.md`, `/bai-viet.md`, `/llms.txt`, `/sitemap.xml`, `/robots.txt`, `/og.png`, `/img/portrait-480.webp`.
     - 404: `/khong-co-trang-nay`.
     - 301 với `Location` kết thúc bằng `/bai-viet`: `/chuyen-mon`.
     - HTML `/` chứa `Trịnh Quang Dũng`, `dungtq.ceo@gmail.com`, `zalo.me/trinhquangdung`; HTML `/so-lieu` chứa `>71<`; HTML `/san-pham` chứa `Viết Pro`.
     - Header `content-security-policy` của `/` chứa `frame-src https://www.tiktok.com`.
     - `/robots.txt` chứa `Disallow: /admin`.
     In `OK site` hoặc các dòng `FAIL ...` rồi exit 1.
  2. Chạy dev server nền: kiểm `netstat -ano | findstr :4321`; nếu trống, chạy `npm run dev` bằng chế độ chạy nền của harness, ghi PID.
  3. `node scripts/verify/site.mjs http://localhost:4321`
  4. `npm run check:privacy -- http://localhost:4321`
  5. Dừng dev server (Task Stop hoặc `taskkill /PID <pid> /T /F`), kiểm lại `netstat -ano | findstr :4321` rỗng.
  6. `npm run deploy`, rồi chạy bước 3–4 với base `https://tqd-next.<subdomain>.workers.dev`.
- Success criteria: bản local và bản preview đều đạt.
- Verify (mỗi lệnh trên cả local và preview): `node scripts/verify/site.mjs <base>` in `OK site` VÀ `npm run check:privacy -- <base>` in dòng bắt đầu bằng `OK no post text`, exit 0.

## Task 2.6 — Commit

- Steps: `npm test` (exit 0), `git add -A`, commit `feat: render public pages from d1 with versioned cache`.
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
