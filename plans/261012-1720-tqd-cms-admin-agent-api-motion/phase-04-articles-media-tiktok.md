---
phase: 4
title: "Bài viết, media R2, player TikTok"
status: pending
priority: P1
effort: 10h
dependencies: [3]
---

# Phase 4 — Bài viết, media R2, player TikTok

> Đọc mục Constraints trong `plan.md` trước khi bắt đầu. Nội dung bài viết là dữ liệu không tin cậy: chỉ đưa ra HTML qua `renderMarkdown` (Task 4.3).

## Goal

Admin viết/sửa/xoá bài Markdown, tải ảnh/video lên R2; `/bai-viet` và `/bai-viet/{slug}` hiển thị bài đã đăng; mục Video AI và bài viết phát TikTok bằng player chính thức, iframe chỉ tạo khi người xem bấm.

## Files to Create / Modify

- Create: `src/lib/normalize-text.ts`, `src/lib/tiktok.ts`, `src/lib/tiktok.test.ts`, `src/lib/markdown.ts`, `src/lib/markdown.test.ts`, `src/lib/fb-overlap.ts`, `src/lib/fb-overlap.test.ts`, `src/data/fb-fingerprints.json`, `scripts/make-fb-fingerprints.mjs`, `src/lib/articles.ts`, `src/lib/articles.test.ts`, `src/lib/media.ts`, `src/lib/media.test.ts`, `src/pages/media/[...key].ts`, `src/pages/bai-viet/[slug].astro`, `src/pages/bai-viet/[slug].md.ts`, `src/components/TikTokPlayer.astro`, `src/scripts/tiktok.ts`, `src/pages/admin/bai-viet/index.astro`, `src/pages/admin/bai-viet/[id].astro`, `src/pages/admin/media.astro`, `src/pages/admin/api/media.ts`, `src/pages/admin/api/preview.ts`, `scripts/verify/articles.mjs`
- Modify: `package.json`, `scripts/check-no-post-text.mjs`, `src/components/SectionBody.astro`, `src/pages/admin/muc/[kind].astro`, `src/pages/admin/muc/[kind]/[id].astro`, `src/lib/admin-writes.ts`, `src/layouts/AdminLayout.astro`, `src/lib/profile-markdown.ts`, `src/styles/global.css`

## Task 4.1 — Thư viện Markdown

- Steps: `npm install unified remark-parse remark-gfm remark-rehype rehype-sanitize rehype-stringify unist-util-visit`
- Verify: `npm ls rehype-sanitize remark-gfm unified` exit 0.

## Task 4.2 — TikTok: lấy id và URL player

- Goal: từ link TikTok bất kỳ dạng phổ biến lấy được id số 15–21 chữ số.
- Target files: `src/lib/tiktok.ts`, `src/lib/tiktok.test.ts`.
- Steps:
  1. `parseTikTokId(input: string): string | null` nhận:
     - `https://www.tiktok.com/@ten.kenh/video/7420000000000000001` (có/không `www.`, `m.`, có query `?is_from_webapp=1`)
     - `https://www.tiktok.com/player/v1/7420000000000000001`
     - `https://www.tiktok.com/embed/v2/7420000000000000001`
     - chuỗi chỉ gồm 15–21 chữ số.
     Mọi dạng khác (gồm `/photo/`, host khác `tiktok.com`) → `null`.
  2. `isTikTokShortLink(url)`: host `vm.tiktok.com`, `vt.tiktok.com`, hoặc `www.tiktok.com` với path bắt đầu `/t/`.
  3. `resolveTikTokId(input, fetchFn = fetch)`: nếu là link rút gọn → `fetchFn(url, { redirect: 'manual' })`, đọc header `Location`, `parseTikTokId(location)`; lỗi mạng → `null`. Ngược lại → `parseTikTokId(input)`.
  4. `playerUrl(id)` → `https://www.tiktok.com/player/v1/${id}?autoplay=1&rel=0`.
  5. Test: mỗi dạng ở bước 1 trả đúng id; `https://evil.com/@a/video/7420000000000000001` → `null`; `https://www.tiktok.com/@a/photo/7420000000000000001` → `null`; link rút gọn với `fetchFn` giả trả `Location` hợp lệ → id.
- Verify: `npx vitest run src/lib/tiktok.test.ts` exit 0.

## Task 4.3 — Markdown an toàn và cảnh báo trùng Facebook

- Goal: `renderMarkdown(md)` chỉ ra HTML an toàn; cảnh báo (không chặn) khi bài trùng ≥ 60 ký tự với bài Facebook.
- Target files: `src/lib/normalize-text.ts`, `src/lib/markdown.ts`, `src/lib/markdown.test.ts`, `src/lib/fb-overlap.ts`, `src/lib/fb-overlap.test.ts`, `scripts/make-fb-fingerprints.mjs`, `src/data/fb-fingerprints.json`, `scripts/check-no-post-text.mjs`.
- Steps:
  1. Chuyển hàm `normalize` từ `scripts/check-no-post-text.mjs` sang `src/lib/normalize-text.ts` (export `normalizeText`, TS xoá-type được); script import lại từ `../src/lib/normalize-text.ts`. Chạy `npm run check:privacy -- https://tqd.io.vn` vẫn in `OK no post text`.
  2. `renderMarkdown(md: string): Promise<string>` theo đúng thứ tự: `remark-parse` → `remark-gfm` → `remark-rehype` (KHÔNG bật `allowDangerousHtml`) → `rehype-sanitize` (schema mặc định `defaultSchema`) → plugin `rehypeSitePolicy` tự viết → `rehype-stringify`. `rehypeSitePolicy` (dùng `unist-util-visit`):
     - `img`: giữ chỉ khi `src` bắt đầu bằng `/media/`; thêm `loading="lazy"`, `decoding="async"`; ảnh khác → xoá node.
     - `a` có `href` bắt đầu `http://` hoặc `https://` và không thuộc `tqd.io.vn` → `rel="noopener nofollow ugc"`.
     - Đoạn `p` chỉ chứa đúng 1 phần tử `a` mà `parseTikTokId(href)` khác `null` → thay bằng `<div class="tiktok-embed" data-tiktok-id="{id}"><a href="https://www.tiktok.com/player/v1/{id}" rel="noopener nofollow">Xem video trên TikTok</a></div>` (chạy SAU sanitize nên không cần nới schema).
  3. `markdown.test.ts`, mỗi đầu vào sau, HTML đầu ra KHÔNG chứa chuỗi bị cấm:
     - `<script>alert(1)</script>` → không chứa `<script`.
     - `<img src=x onerror=alert(1)>` → không chứa `onerror`.
     - `[bấm](javascript:alert(1))` → không chứa `javascript:`.
     - `![a](https://evil.example/x.png)` → không chứa `evil.example`.
     - `![a](/media/2026/10/abc.png)` → chứa `src="/media/2026/10/abc.png"`.
     - Một dòng chỉ có `https://www.tiktok.com/@a/video/7420000000000000001` → chứa `data-tiktok-id="7420000000000000001"`, không chứa `<iframe`.
     - `[x](https://example.com)` → chứa `rel="noopener nofollow ugc"`.
  4. Trong `src/lib/normalize-text.ts` thêm `windowHash(text: string): string` — hash đồng bộ cyrb53 (53-bit, seed 0) trả 14 ký tự hex đệm `0` bên trái. Không dùng `crypto.subtle` (quá tốn CPU khi băm từng cửa sổ trên gói Free). Ghi chú trong file: hash không làm lộ chữ gốc.
     `scripts/make-fb-fingerprints.mjs`: đọc `D:/TQD/tqd-browser/automation_data/portfolio/portfolio-ai-3-thang.json` (không tồn tại → STOP, hỏi người dùng đường dẫn); với mỗi bài `normalizeText(text)` dài ≥ 60: lấy cửa sổ 60 ký tự bước 20, `windowHash`; ghi mảng đã sắp xếp, bỏ trùng vào `src/data/fb-fingerprints.json`. File chỉ chứa hash, không chứa chữ. In `wrote <n> fingerprints`.
  5. `src/lib/fb-overlap.ts`: `hasFacebookOverlap(text: string, fingerprints?: Set<string>): boolean` (đồng bộ) — `normalizeText(text)`, trượt cửa sổ 60 ký tự **bước 1**, `windowHash`, trả `true` khi có hash nằm trong tập fingerprint (mặc định nạp từ `src/data/fb-fingerprints.json` một lần). Test: chuỗi không liên quan → `false`; tập fingerprint giả chứa `windowHash` của một cửa sổ 60 ký tự trong chuỗi thử → `true`.
  6. Mặc định là **chỉ cảnh báo**: kết quả lưu vào cột `fb_overlap`, không chặn lưu. (Nếu người dùng yêu cầu chặn: trong `saveArticle` ở Task 4.4, ném lỗi khi `fb_overlap` là `true` và `status` là `published`.)
- Verify: `npx vitest run src/lib/markdown.test.ts src/lib/fb-overlap.test.ts` exit 0 VÀ `node scripts/make-fb-fingerprints.mjs` in `wrote ` VÀ `npm run check:privacy -- https://tqd.io.vn` in dòng bắt đầu `OK no post text`.

## Task 4.4 — Lưu bài viết

- Goal: một hàm lưu bài dùng chung cho admin và API (phase 5), có kiểm phiên bản.
- Target files: `src/lib/articles.ts`, `src/lib/articles.test.ts`.
- Steps:
  1. `slugify(title)`: NFD, bỏ dấu, `đ`/`Đ` → `d`, chữ thường, ký tự khác `[a-z0-9]` → `-`, gộp và cắt `-` ở hai đầu, tối đa 80 ký tự. Test: `Trợ lý AI: Đánh giá 2026!` → `tro-ly-ai-danh-gia-2026`.
  2. `validateArticle(input)`: slug khớp `^[a-z0-9]+(?:-[a-z0-9]+)*$` và ≤ 80; title 1–200; summary ≤ 500; body 1–100 000 ký tự; tags ≤ 10, mỗi tag ≤ 40; `status` ∈ `draft|published`. Trả danh sách lỗi tiếng Việt.
  3. `saveArticle(db, input, { source, expectedVersion? })`:
     - Nếu `coverKey` có: phải tồn tại trong bảng `media`, không thì lỗi.
     - `bodyHtml = await renderMarkdown(bodyMd)`; `fbOverlap = hasFacebookOverlap(title + ' ' + summary + ' ' + bodyMd)`.
     - Tìm bài theo `slug`. Chưa có → `INSERT` (`version` = 1). Có → nếu `expectedVersion` được truyền và khác `version` hiện tại → ném `ConflictError` (class export, có `currentVersion`); không thì `UPDATE ... version = version + 1, updated_at = datetime('now')`.
     - `published_at` = `datetime('now')` khi bài chuyển sang `published` lần đầu; giữ nguyên các lần sau.
     - Ghi bằng `db.batch([lệnh ghi, bumpVersion(db)])`. Trả `{ article, created }` (`created` = `true` khi vừa INSERT) để API chọn 201/200.
  4. `deleteArticle(db, slug)`: `db.batch([DELETE, bumpVersion(db)])`; trả `true` nếu có dòng bị xoá.
  5. Test cho `slugify` và `validateArticle`.
- Verify: `npx vitest run src/lib/articles.test.ts` exit 0.

## Task 4.5 — Media trên R2

- Goal: tải ảnh/video lên R2 bằng stream (không giữ cả file trong bộ nhớ), kiểm magic bytes, phục vụ qua `/media/{key}` có hỗ trợ Range.
- Target files: `src/lib/media.ts`, `src/lib/media.test.ts`, `src/pages/media/[...key].ts`, `src/pages/admin/api/media.ts`.
- Steps:
  1. `sniffType(head: Uint8Array): string | null`: JPEG `FF D8 FF` → `image/jpeg`; PNG `89 50 4E 47 0D 0A 1A 0A` → `image/png`; GIF `47 49 46 38` → `image/gif`; WebP `RIFF` ở 0–3 và `WEBP` ở 8–11 → `image/webp`; MP4 `ftyp` ở 4–7 → `video/mp4`; WebM `1A 45 DF A3` → `video/webm`. Khác (gồm SVG, HTML) → `null`.
  2. `LIMITS = { image: 10 * 1024 * 1024, video: 95 * 1024 * 1024 }` (Cloudflare gói Free nhận body tối đa 100 MB).
  3. `storeMedia(env, body: ReadableStream<Uint8Array>, length: number, filename: string, alt: string, source: string)`:
     - `length` lấy từ header `Content-Length`; thiếu → lỗi 411.
     - Đọc chunk đầu tới khi đủ 16 byte; `sniffType`; `null` → lỗi 415. `length` vượt giới hạn theo loại → lỗi 413.
     - Key: `YYYY/MM/<12 ký tự hex ngẫu nhiên>-<slugify(tên file không đuôi), tối đa 40>.<đuôi theo type>`.
     - Tạo stream `rebuilt`: enqueue lại NGUYÊN các chunk đã đọc (không cắt ở byte 16), rồi pump phần còn lại của `body`. Ghi đúng mẫu sau (chạy song song, không `await pipeTo` trước `put`, nếu không sẽ treo):
       ```ts
       const { readable, writable } = new FixedLengthStream(length);
       const putP = env.MEDIA.put(key, readable, { httpMetadata: { contentType, cacheControl: 'public, max-age=31536000, immutable' } });
       await Promise.all([rebuilt.pipeTo(writable), putP]);
       ```
     - `INSERT INTO media(key, content_type, size, alt, source)`. Trả `{ key, url: '/media/' + key, contentType, size }`.
  4. `src/pages/media/[...key].ts`: `GET` và `HEAD`:
     key bắt đầu `backups/` → 404 ngay (không lộ bản sao lưu). `const obj = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers })`; không có → 404. Header: `obj.writeHttpMetadata(headers)`, `ETag: obj.httpEtag`, `Accept-Ranges: bytes`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox`. Khi `onlyIf` không thoả (object không có `body`) → 304. Khi có `obj.range`: nếu có `offset` → `start = offset`, `end = offset + (length ?? obj.size - offset) - 1`; nếu có `suffix` → `start = obj.size - suffix`, `end = obj.size - 1`; đặt `Content-Range: bytes ${start}-${end}/${obj.size}`, `Content-Length: ${end - start + 1}`, status 206. Không có range → `Content-Length: obj.size`, status 200. `HEAD` trả cùng header, không body.
  5. `src/lib/media.ts` thêm `deleteMedia(env, key)`: key bắt đầu `backups/` → trả `false`; chạy `DELETE FROM media WHERE key = ?1 RETURNING key` trước; không có dòng trả về → `false` và KHÔNG gọi `env.MEDIA.delete`; có → `env.MEDIA.delete(key)`, trả `true`. Mọi đường xoá media (admin, API) chỉ dùng hàm này.
     `src/pages/admin/api/media.ts`: `POST ?filename=...&alt=...`, body là file thô → `storeMedia(..., source 'admin')` → JSON 201. `DELETE ?key=...` → `deleteMedia` → `true` 204, `false` 404.
  6. `media.test.ts`: `sniffType` với đầu file JPEG, PNG, MP4 (`00 00 00 18 66 74 79 70`), và `<svg` → `null`; `deleteMedia` với key `backups/2026-10-12.json` → `false` (dùng `env` giả, kiểm `MEDIA.delete` không được gọi).
- Verify: `npx vitest run src/lib/media.test.ts` exit 0.

## Task 4.6 — Admin: bài viết, media, link TikTok cho video

- Target files: `src/pages/admin/bai-viet/index.astro`, `src/pages/admin/bai-viet/[id].astro`, `src/pages/admin/media.astro`, `src/pages/admin/api/preview.ts`, `src/pages/admin/muc/[kind].astro`, `src/pages/admin/muc/[kind]/[id].astro`, `src/lib/admin-writes.ts`, `src/layouts/AdminLayout.astro`.
- Steps:
  1. Menu admin thêm `Bài viết /admin/bai-viet` và `Media /admin/media`.
  2. `bai-viet/index.astro`: bảng bài (tiêu đề, slug, trạng thái, nguồn `admin`/`agent:<tên key>`, cập nhật lúc); bài có `fb_overlap` hiện nhãn `Có đoạn trùng bài Facebook`. Link `Viết bài mới` → `/admin/bai-viet/moi`.
  3. `bai-viet/[id].astro` (`id` = `moi` hoặc số): trường `title`, `slug` (để trống → `slugify(title)`), `summary`, `tags` (dấu phẩy), `coverKey` (select từ bảng `media` loại ảnh, có lựa chọn trống), `bodyMd` (textarea), `status` (Nháp/Đăng), hidden `version`. POST `_action=save` → `saveArticle(..., { source: 'admin', expectedVersion })`; `ConflictError` → hiện `Bài đã được sửa ở nơi khác. Tải lại trang để xem bản mới.`; `_action=delete` → `deleteArticle` → `303 /admin/bai-viet`. Nút `Xem trước`: script nhỏ gửi `bodyMd` tới `/admin/api/preview` rồi gán HTML trả về vào khung xem trước. Hiện nhãn trùng Facebook nếu `fb_overlap`.
  4. `api/preview.ts`: `POST` JSON `{ bodyMd }` → `{ html: await renderMarkdown(bodyMd) }`.
  5. `media.astro`: input file (accept `image/*,video/mp4,video/webm`) + ô alt; script gửi file thô tới `/admin/api/media` bằng `fetch` (body = File, header `Content-Type` của file), rồi tải lại trang. Danh sách media: ảnh xem trước, loại, dung lượng, nút `Chép Markdown` (`![alt](/media/key)` cho ảnh, `/media/key` cho video), nút Xoá (gọi `DELETE`).
  6. `ho-so.astro`: thêm select `portraitKey` (ảnh trong bảng `media`, có lựa chọn `Ảnh mặc định`); chọn ảnh media → `person.portrait` = `person.portraitSmall` = `/media/<key>`; chọn mặc định → `/img/portrait-480.webp` và `/img/portrait-240.webp`.
  7. Mục video: form thêm/sửa có trường `tiktokUrl`; khi lưu: rỗng → `tiktok_id = NULL`; có → `resolveTikTokId`; `null` → báo `Không đọc được link TikTok. Dán link đầy đủ dạng https://www.tiktok.com/@kenh/video/<số>.` và không lưu. Có thêm trường `coverKey` tuỳ chọn (ảnh bìa từ media).
- Verify: `npm run build` exit 0.

## Task 4.7 — Trang công khai: bài viết và player TikTok

- Target files: `src/pages/bai-viet/[slug].astro`, `src/pages/bai-viet/[slug].md.ts`, `src/components/TikTokPlayer.astro`, `src/scripts/tiktok.ts`, `src/components/SectionBody.astro`, `src/lib/profile-markdown.ts`, `src/styles/global.css`.
- Steps:
  1. `bai-viet/[slug].astro`: `getArticle(db, slug)` (chỉ bài `published`); không có → `Astro.rewrite('/404')`. Hiện tiêu đề (h1), ngày đăng (dd/mm/yyyy, giờ Việt Nam), ảnh bìa (`/media/{coverKey}`, có `width`/`height` cố định theo tỉ lệ 16:9 bằng CSS `aspect-ratio`), tags, thân bài `<div class="prose-article" set:html={article.bodyHtml} />` (chỗ DUY NHẤT trong `src/` dùng `set:html` với nội dung người dùng; HTML đã qua `renderMarkdown`). Meta `description` = summary, `og:type` = `article`, `<link rel="alternate" type="text/markdown" href="/bai-viet/{slug}.md">`. Link `← Tất cả bài viết`.
  2. `bai-viet/[slug].md.ts`: trả `# {title}\n\n{summary}\n\n{bodyMd}` với `Content-Type: text/markdown; charset=utf-8`.
  3. `TikTokPlayer.astro` props `id`, `title`, `coverUrl?`: `<button type="button" class="tiktok-facade" data-tiktok-id={id} aria-label={'Phát video: ' + title}>` chứa ảnh bìa (nếu có) hoặc nền gradient, biểu tượng play SVG, tiêu đề. Khung tỉ lệ 9:16, rộng tối đa 325px.
  4. `src/scripts/tiktok.ts`: lắng nghe click trên `[data-tiktok-id]` (cả `.tiktok-facade` và `.tiktok-embed` trong bài; với `.tiktok-embed` thì chặn mở link và dựng facade khi trang tải); khi bấm, thay nội dung bằng `<iframe src="https://www.tiktok.com/player/v1/{id}?autoplay=1&rel=0" title="{title}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="lazy">` cùng khung 9:16; chuyển focus vào iframe. `id` phải khớp `^\d{15,21}$` trước khi dựng URL.
  5. `SectionBody.astro` mục `video-ai`: mỗi video có `tiktokId` → `TikTokPlayer` + tiêu đề + tóm tắt; không có → thẻ như cũ (`ItemCard`).
  6. `global.css`: kiểu `.prose-article` (khoảng cách đoạn, h2/h3, list, `img` max-width 100%, `pre` cuộn ngang) và `.tiktok-facade`/`.tiktok-embed`.
  7. `profile-markdown.ts` / `llms.txt`: liệt kê bài đã đăng (tiêu đề + `/bai-viet/{slug}`); mục video có `tiktokId` kèm link `https://www.tiktok.com/player/v1/{id}`.
- Verify: `npm run build` exit 0 VÀ Grep `set:html` trong `src/` chỉ khớp `src/pages/bai-viet/[slug].astro`.

## Task 4.8 — Kiểm tra bài viết + media đầu-cuối

- Goal: `scripts/verify/articles.mjs <base>` (mật khẩu từ `TQD_ADMIN_PASSWORD`) chứng minh luồng admin → công khai, chặn XSS, Range video.
- Steps:
  1. Script (mọi request ghi gửi `Origin: <base>`; upload gửi `Content-Type: image/png` hoặc `image/svg+xml`; form gửi `application/x-www-form-urlencoded`), theo thứ tự:
     1. Đăng nhập admin (như `admin.mjs`).
     2. Upload ảnh PNG 1×1 tạo trong script (`89504E470D0A1A0A...` hợp lệ, có thể tạo bằng zlib) qua `POST /admin/api/media?filename=verify.png&alt=verify` → 201, nhận `key`.
     3. Upload file `verify.svg` nội dung `<svg xmlns="http://www.w3.org/2000/svg"/>` → 415.
     4. `GET /media/<key>` → 200, `content-type: image/png`; `GET` kèm `Range: bytes=0-3` → 206 và body 4 byte.
     5. Tạo bài slug `kiem-thu-<Date.now()>` qua form `POST /admin/bai-viet/moi` (`_action=save`, `status=published`, `coverKey=<key>`, body có: dòng `![x](/media/<key>)`, dòng `<script>alert(1)</script>`, dòng `https://www.tiktok.com/@a/video/7420000000000000001`) → 303.
     6. `GET /bai-viet` chứa tiêu đề; `GET /bai-viet/<slug>` 200, chứa `/media/<key>` và `data-tiktok-id="7420000000000000001"`, KHÔNG chứa `<script>alert` và KHÔNG chứa `<iframe`.
     7. `GET /sitemap.xml` chứa `/bai-viet/<slug>`.
     8. Xoá bài (`_action=delete`) → `GET /bai-viet/<slug>` 404. Xoá media (`DELETE /admin/api/media?key=<key>`) → 204 và `GET /media/<key>` 404. `DELETE /admin/api/media?key=backups/khong-co.json` → 404.
     In `OK articles` hoặc `FAIL <bước> ...`, exit 1.
  2. Chạy trên local (dev server nền 4321, mật khẩu `.secrets/admin-local.txt`), rồi `npm run deploy:preview` và chạy trên preview (mật khẩu `.secrets/admin-next.txt`).
- Verify: `node scripts/verify/articles.mjs <base>` in `OK articles`, exit 0, trên local và preview.

## Task 4.9 — Video TikTok thật

- Goal: ít nhất một video ở mục Video AI phát được bằng player TikTok.
- Steps:
  1. Hỏi người dùng đúng câu: "Anh gửi em link TikTok (dạng https://www.tiktok.com/@kenh/video/<số>) cho các video AI muốn hiện trên web, và cho biết mỗi link ứng với video nào trong 5 mục hiện có (hoặc là video mới)." Chờ trả lời. Không tự tìm hay đoán link.
  2. `npm run deploy` (production). Nhắn người dùng nhập link trong `https://tqd.io.vn/admin/muc/video` (executor không có mật khẩu production), hoặc nếu người dùng muốn, nhập trên preview bằng mật khẩu `.secrets/admin-next.txt` (cùng D1, nên hiện cả trên production).
  3. Tạo `C:/Users/ABM/.cache/tqd-verify/tiktok-check.mjs <url>` (dùng `playwright-core` và Chrome hệ thống như `desktop-check.mjs` cùng thư mục): mở `<url>/video-ai` cỡ 390×844; đạt khi có `[data-tiktok-id]`, chưa có `iframe`; bấm phần tử đầu tiên; trong 5 giây có `iframe[src^="https://www.tiktok.com/player/v1/"]`. In `PASS tiktok` hoặc `FAIL ...`.
- Verify: `node C:/Users/ABM/.cache/tqd-verify/tiktok-check.mjs https://tqd.io.vn` in `PASS tiktok`.

## Task 4.10 — Commit

- Steps: `npm test` exit 0; `node scripts/verify/site.mjs https://tqd.io.vn` in `OK site`; `npm run check:privacy -- https://tqd.io.vn` OK; dừng dev server nền; `git add -A`; commit `feat: add articles, r2 media and tiktok player`.
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
