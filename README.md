# tqd.io.vn — website cá nhân của Trịnh Quang Dũng (DũngTQ)

Website tĩnh giới thiệu hồ sơ, sản phẩm AI tự xây, đào tạo và sự kiện, video AI, chuyên môn, số liệu và liên hệ của DũngTQ. Trang chủ có giao diện kiểu màn hình máy tính (dock, cửa sổ) trên màn hình rộng; trên điện thoại hoặc khi tắt JavaScript, mỗi mục là một trang thường tại `/{mục}`.

Giao diện lấy cảm hứng từ zuey.me; mã nguồn viết mới, không sao chép từ repo đó.

## Nội dung

- Toàn bộ nội dung nằm trong `src/data/profile.ts` (số liệu tổng hợp ở `src/data/stats.ts`). Sửa hai file này để cập nhật site.
- Nội dung được tổng hợp từ hoạt động AI trên Facebook 10/07–10/10/2026. Site **không** chứa văn bản bài Facebook nào; `npm run check:privacy` chặn việc này bằng cách so bản build với dữ liệu nguồn.
- Ảnh chân dung: `src/assets/portrait.jpg`. Ảnh chia sẻ `public/og.png` được tạo từ `public/og.svg` bằng `node scripts/make-og.mjs`.
- Bản cho máy đọc: `/llms.txt`, `/index.md`, `/{mục}.md`, `/sitemap.xml`.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm install` | Cài phụ thuộc (Node ≥ 22.12) |
| `npm run dev` | Chạy thử tại `http://localhost:4321` |
| `npm run build` | Kiểm tra type và build ra thư mục output tĩnh |
| `npm run check:privacy` | Xác nhận bản build không chứa văn bản bài Facebook |
| `npm run deploy` | Build, kiểm tra quyền riêng tư rồi deploy lên Cloudflare bằng Wrangler |

Các kiểm tra bổ sung nằm trong `scripts/verify/` (chạy bằng `node scripts/verify/<tên>.mjs` sau khi build).

Cách deploy, tài khoản Cloudflare đích và cách gắn tên miền: [docs/deployment.md](docs/deployment.md).
