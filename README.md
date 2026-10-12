# tqd.io.vn — website cá nhân của Trịnh Quang Dũng (DũngTQ)

Website giới thiệu hồ sơ, sản phẩm AI tự xây, đào tạo, video AI, bài viết, số liệu và liên hệ của DũngTQ. Trang chủ có giao diện kiểu màn hình máy tính (dock, cửa sổ) trên màn hình rộng; trên điện thoại hoặc khi tắt JavaScript, mỗi mục là một trang thường tại `/{mục}`.

Giao diện lấy cảm hứng từ zuey.me; mã nguồn viết mới, không sao chép từ repo đó.

## Nội dung

- Nội dung nằm trong D1 (`tqd_db`) và được sửa tại **`/admin`** (đăng nhập bằng email + mật khẩu admin). Không còn sửa nội dung trong mã nguồn.
- Site **không** chứa văn bản bài Facebook nào; `npm run check:privacy -- <url>` quét toàn bộ trang công khai để chặn việc này.
- Bản cho máy đọc: `/llms.txt`, `/index.md`, `/{mục}.md`, `/sitemap.xml`.
- Sao lưu D1 → R2 hằng đêm và cách khôi phục: [docs/backup-restore.md](docs/backup-restore.md).

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

Các kiểm tra khác nằm trong `scripts/verify/` (`site`, `admin`, `cache`, `seed`, `live`).

Cách deploy, secret admin, cache và rollback: [docs/deployment.md](docs/deployment.md).
