# Chuyển tqd.me sang EzyPlatform (phương án Kết hợp)

Hợp đồng đã chốt với chủ site (2026-11-21). Đây là bản tham chiếu cho mọi phase.

## Done means
0a. EzyPlatform native chạy trên máy dev (C:\ezyplatform, admin http://127.0.0.1:9090, web http://127.0.0.1:8080); mọi việc làm và kiểm tra ở đây trước.
0b. EzyPlatform trên VPS riêng (cạnh bản masoi đang chạy, không đụng tới nó); nội dung và giao diện từ local đưa lên; admin.tqd.me và stg.tqd.me đi qua Cloudflare.
0c. Đăng nhập SSH bằng khóa riêng; chủ site tự đổi mật khẩu root.
1. Mọi trang công khai trên stg.tqd.me giống tqd.me (desktop + 375px), có ảnh so sánh.
2. Mọi nội dung D1 (21 bài viết, 21 item, gallery, hồ sơ, số liệu) có trên EzyPlatform, số lượng khớp.
3. Mọi đường dẫn công khai và bản máy đọc trả 200/301 như cũ trên stg.tqd.me (danh sách gốc: `.artifacts/live/status.txt`).
4. Tải video, chatbot, Viral Lab, thống kê chạy từ trang EzyPlatform.
5. Form liên hệ qua Contact-us của EzyPlatform, mail tới được.
6. /admin, API đăng bài /api/v1, skills/tqd-publish gỡ khỏi repo; tqd.me bản cũ không bị ảnh hưởng (không redeploy worker `tqd-website`).

Ngoài phạm vi: đổi DNS tqd.me, plugin Java, thêm ngôn ngữ (chỉ tiếng Việt).

## Kiến trúc
- EzyPlatform: plugin ezyarticle, ezysupport, ezymail, ezyseo, markdown, data-backup; theme freestyle (khung trống).
  Trang EzyArticle phục vụ ở `/{slug}`, bài viết ở `/posts/{slug}`.
- Worker `tqd-edge` (mới, thư mục `edge/`) giữ stg.tqd.me và admin.tqd.me:
  - `/bai-viet/<slug>` → proxy tới origin `/posts/<slug>` (URL hiển thị giữ nguyên).
  - `/api/chat*`, `/api/dl/*`, `/api/viral/*`, `/api/t`, `/xray/*`, `/media/*` → service binding tới worker công cụ (`tqd-next`, env preview của repo này, đã cắt gọn).
  - `/llms.txt`, `/llms-full.txt`, `/*.md`, `/rss.xml`, `/feed.json`, `/search.json`, `/catalog.json`, `/.well-known/*`, `/robots.txt`, `/sitemap.xml` → edge tự sinh từ API công khai của EzyPlatform (`/api/v1/posts`, `/api/v1/posts/{slug}`, trang).
  - `/dao-tao` → 301 `/thu-vien`.
  - còn lại → origin EzyPlatform web trên VPS.
- Origin VPS: Caddy, host `*.103-161-119-32.sslip.io` (không cần ghi DNS trong zone tqd.me), web origin chỉ nhận request mang header bí mật của edge.

## Hợp đồng dữ liệu (EzyArticle)
Nguyên tắc: nội dung **có URL riêng** → post thật (article). Nội dung chỉ là thẻ hiển thị (item, gallery) → post với `postType` riêng, **content của post = đúng đoạn HTML thẻ đã render trên tqd.me**, fragment chỉ lặp và bọc lại. Nhờ vậy bản render giống hệt bản cũ mà vẫn sửa được từng thẻ trong admin. Không dùng `metadata` (API PUT từ chối — gotcha 3).

| Nguồn D1 | EzyPlatform |
|---|---|
| `articles` | post `postType=POST`, slug giữ nguyên, content = body_html (URL media đã đổi sang `/api/v1/media/<tên>`), summary, status PUBLISHED/DRAFT theo D1, publishedAt |
| `items` kind product | post `postType=tqd_product`, slug `sp-<id>-<slug>`, title = title, content = HTML thẻ sản phẩm; DRAFT nếu `visible=0`; thứ tự theo `sort` thể hiện bằng thứ tự tạo (priority mặc định) — fragment sắp theo tiêu đề nếu không lấy được priority |
| `items` kind video | post `postType=tqd_video`, slug `video-<id>-<slug>`, content = HTML thẻ video |
| settings `gallery` | post `postType=tqd_gallery`, slug `tv-<n>-<slug-caption>`, title = caption, content = `<img>`/`<video>` + caption |
| settings person/stats/links/topics/sections | fragment HTML đã render (phase giao diện), sửa trong admin |
| media R2 `a/b/c.webp` | media library tên `a-b-c.webp`, URL `/api/v1/media/a-b-c.webp`; video nền vẫn ở R2 qua `/media/*` |

Đếm để đối chiếu: articles 21, items 21 (product/video), gallery = số phần tử mảng `gallery` trong D1.

## Phase
1. Nội dung + media (`tools/migrate/`, `posts/`, `api/v1/media/` trừ `tqd-*`).
2. Giao diện (`page-fragments/tqd-*`, `page-fragments/common/*`, `pages/*`, `api/v1/media/tqd-*`, `tools/build-assets/`).
3. Edge + cắt gọn worker công cụ (`edge/`, `src/`, `wrangler.jsonc`, `skills/`, `docs/`).
4. VPS (orchestrator).
5. Đưa lên VPS, kiểm chứng, review độc lập.
