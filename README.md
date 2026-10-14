# tqd.io.vn — website cá nhân của Trịnh Quang Dũng (DũngTQ)

Website giới thiệu hồ sơ, sản phẩm AI tự xây, thư viện ảnh và video, video AI, bài viết và liên hệ của DũngTQ. Trang chủ có giao diện kiểu màn hình máy tính (dock, cửa sổ) trên màn hình rộng; trên điện thoại hoặc khi tắt JavaScript, mỗi mục là một trang thường tại `/{mục}`. Địa chỉ cũ `/dao-tao` chuyển hướng 301 sang `/thu-vien`.

Video được đánh dấu "Phát ở trang chủ" trong **`/admin/thu-vien`** tự phát không tiếng bên phải cửa sổ Hồ sơ trên màn hình từ 1280px (dưới 1440px cửa sổ Hồ sơ thu hẹp còn khoảng 60% để chừa chỗ); nút **Bật tiếng** phát lại từ đầu có tiếng một lần rồi trở về vòng lặp không tiếng. Video dừng khi bị cửa sổ khác che hoặc khi tab ẩn, và không tự phát khi bật giảm chuyển động hay tiết kiệm dữ liệu. Trên điện thoại video là một thẻ ngay dưới đồng hồ, chỉ tải khi chạm. Tệp ảnh và video tải lên ở `/admin/media` trước rồi chọn trong `/admin/thu-vien`.

Giao diện lấy cảm hứng từ zuey.me; mã nguồn viết mới, không sao chép từ repo đó.

## Hiệu ứng

Trên màn hình rộng: tìm nhanh bằng `Ctrl K` / `⌘K`; cửa sổ mở, thu nhỏ, phóng to, ghép nửa màn hình; nút **Tất cả cửa sổ** (hoặc `F3`) bày mọi cửa sổ kiểu Exposé; dock phóng to icon khi rê chuột; nền động là video lặp dải voan champagne trên nền ngà (tạo bằng Grok, gốc ở `src/assets/wallpaper-silk.mp4`, phục vụ từ R2 qua `/media/2026/10/silk-wallpaper.mp4` để có byte-range cho Safari; chỉ tải trên desktop khi trình duyệt rảnh, trước đó và khi tắt là nền aurora; tải lại bằng `npx wrangler r2 object put tqd-media/2026/10/silk-wallpaper.mp4 --file src/assets/wallpaper-silk.mp4 --content-type video/mp4 --cache-control "public, max-age=31536000, immutable" --remote`); linh vật DũngTQ đổi tư thế theo thao tác, thỉnh thoảng đi dạo và là lối vào chatbot; thời tiết Hà Nội ở thanh menu kèm mưa/tuyết trên nền khi trời mưa/tuyết (trình duyệt lấy trực tiếp từ [Open-Meteo](https://open-meteo.com/), giấy phép CC BY 4.0). Trên điện thoại mỗi mục mở thành một tấm trượt lên, kéo xuống để đóng.

Giao diện chỉ có một bảng màu sáng: nền ngà `#faf7f1`, chữ mực `#1b2030`, màu chữ ký vàng champagne (`#8a6420` cho chữ và nút, `#b8935a` chỉ để trang trí); tiêu đề dùng Cormorant Garamond. Token màu nằm trong `src/styles/global.css`. Menu **Hiệu ứng** tắt/bật **Linh vật**, **Hiệu ứng thời tiết** và **Nền động**. Khi hệ điều hành bật giảm chuyển động (`prefers-reduced-motion`), mọi hiệu ứng đứng yên. Ảnh linh vật tạo lại bằng `node scripts/make-mascot.mjs` (hoặc `--fallback` để dùng ảnh chân dung tròn).

## Chatbot

Bấm linh vật (desktop) hoặc nút tròn mặt linh vật (điện thoại) để trò chuyện với **Agent DũngTQ**, một agent chạy trên GoClaw tự host, trả lời dựa trên nội dung website. Khi máy chủ nhà tắt, khung chat mời khách nhắn Zalo. Giới hạn, cấu hình, cách đồng bộ kiến thức sau khi đăng bài và cách thu hồi key: [docs/chatbot.md](docs/chatbot.md).

## Nội dung

- Nội dung nằm trong D1 (`tqd_db`) và được sửa tại **`/admin`** (đăng nhập bằng email + mật khẩu admin). Không còn sửa nội dung trong mã nguồn.
- Site **không** chứa văn bản bài Facebook nào; `npm run check:privacy -- <url>` quét toàn bộ trang công khai để chặn việc này.
- Bản cho máy đọc: `/llms.txt`, `/index.md`, `/{mục}.md`, `/sitemap.xml`.
- Sao lưu D1 → R2 hằng đêm và cách khôi phục: [docs/backup-restore.md](docs/backup-restore.md).

## Đăng bài từ agent

Agent (Claude Code, Codex) đăng bài, ảnh và video qua API `/api/v1` bằng API key tạo tại `/admin/api-keys`. Skill đóng gói sẵn nằm ở `skills/tqd-publish`. Hợp đồng API, ví dụ và cách cài skill: [docs/agent-publishing.md](docs/agent-publishing.md). Agent làm các việc còn lại của `/admin` (hồ sơ, số liệu, liên hệ, sản phẩm, video, thư viện, sao lưu, API key, thống kê chat) theo [docs/admin-agent-operations.md](docs/admin-agent-operations.md).

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm install` | Cài phụ thuộc (Node ≥ 22.12) |
| `npx astro dev --background` | Chạy thử tại `http://localhost:4321` (cần `.dev.vars`, xem docs/deployment.md) |
| `npm run build` | Kiểm tra type và build |
| `npm test` | Unit test (Vitest) |
| `npm run check:privacy -- <url>` | Xác nhận site tại `<url>` không chứa văn bản bài Facebook |
| `npm run deploy:preview` | Deploy bản preview `tqd-next` |
| `npm run deploy` | Deploy production lên `tqd.io.vn` |

Các kiểm tra khác nằm trong `scripts/verify/` (`site`, `admin`, `articles`, `api`, `cache`, `seed`, `live`, `lighthouse`, `mascot-files`).

Cách deploy, secret admin, cache và rollback: [docs/deployment.md](docs/deployment.md).
