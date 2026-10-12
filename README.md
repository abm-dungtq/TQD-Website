# tqd.io.vn — website cá nhân của Trịnh Quang Dũng (DũngTQ)

Website giới thiệu hồ sơ, sản phẩm AI tự xây, đào tạo, video AI, bài viết, số liệu và liên hệ của DũngTQ. Trang chủ có giao diện kiểu màn hình máy tính (dock, cửa sổ) trên màn hình rộng; trên điện thoại hoặc khi tắt JavaScript, mỗi mục là một trang thường tại `/{mục}`.

Giao diện lấy cảm hứng từ zuey.me; mã nguồn viết mới, không sao chép từ repo đó.

## Hiệu ứng

Trên màn hình rộng: tìm nhanh bằng `Ctrl K` / `⌘K`; cửa sổ mở, thu nhỏ, phóng to, ghép nửa màn hình; nút **Tất cả cửa sổ** (hoặc `F3`) bày mọi cửa sổ kiểu Exposé; dock phóng to icon khi rê chuột; nền aurora; linh vật DũngTQ đổi tư thế theo thao tác và thỉnh thoảng đi dạo; thời tiết Hà Nội ở thanh menu kèm mưa/tuyết trên nền khi trời mưa/tuyết (trình duyệt lấy trực tiếp từ [Open-Meteo](https://open-meteo.com/), giấy phép CC BY 4.0). Trên điện thoại mỗi mục mở thành một tấm trượt lên, kéo xuống để đóng.

Menu **Giao diện** chọn sáng/tối/tự động, màu nhấn, và tắt/bật **Linh vật**, **Hiệu ứng thời tiết**. Khi hệ điều hành bật giảm chuyển động (`prefers-reduced-motion`), mọi hiệu ứng đứng yên. Ảnh linh vật tạo lại bằng `node scripts/make-mascot.mjs` (hoặc `--fallback` để dùng ảnh chân dung tròn).

## Nội dung

- Nội dung nằm trong D1 (`tqd_db`) và được sửa tại **`/admin`** (đăng nhập bằng email + mật khẩu admin). Không còn sửa nội dung trong mã nguồn.
- Site **không** chứa văn bản bài Facebook nào; `npm run check:privacy -- <url>` quét toàn bộ trang công khai để chặn việc này.
- Bản cho máy đọc: `/llms.txt`, `/index.md`, `/{mục}.md`, `/sitemap.xml`.
- Sao lưu D1 → R2 hằng đêm và cách khôi phục: [docs/backup-restore.md](docs/backup-restore.md).

## Đăng bài từ agent

Agent (Claude Code, Codex) đăng bài, ảnh và video qua API `/api/v1` bằng API key tạo tại `/admin/api-keys`. Skill đóng gói sẵn nằm ở `skills/tqd-publish`. Hợp đồng API, ví dụ và cách cài skill: [docs/agent-publishing.md](docs/agent-publishing.md).

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
