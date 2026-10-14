# Brainstorm: thay mục Đào tạo bằng Thư viện ảnh/video, video đào tạo phát ở góc phải

Ngày 14/10/2026. Chế độ `--advice` (kongming đã duyệt, xem cuối).

## Hiện trạng (đã kiểm tra)

- `D:\TQD\Profile-DungTQ`: `Video-Agribank.mp4` (26 giây, 1920×1080, 32 MB, có tiếng) và 3 ảnh 1280×720: lớp Agribank TP.HCM "AI nâng cao hiệu suất công việc trong hoạt động ngân hàng" (15–16/6/2026), buổi giảng "AI tạo sinh" ở hội trường, buổi làm việc tại Vina2.
- Mục `dao-tao`: 4 dòng `items` kind `training` trong D1; được dùng ở `SectionBody.astro`, `profile-markdown.ts`, `search.json.ts`, `command-palette.ts`, `admin-writes.ts`, `AdminLayout.astro` (`/admin/muc/dao-tao`), `content.ts` (`SectionId`, `trainings`), settings `sections`, `scripts/verify/site.mjs`, `scripts/verify/seed.mjs`.
- Bố cục desktop (`src/scripts/desktop.ts:89-96, 310-319`): số khe cửa sổ = 1 nếu `innerWidth - 174 < 1264`, tức dưới 1438px chỉ có 1 khe, cửa sổ rộng tối đa 980px. Ở 1440px có 2 khe 621px (Hồ sơ + Sản phẩm). Ở ≥2442px có 3 khe.
- `/media/...` (R2) đã hỗ trợ byte-range, ảnh và mp4.

## Hợp đồng

- **Outcome:** Mục "Đào tạo & sự kiện" bị bỏ hẳn, thay bằng mục **Thư viện** (ảnh + video). Mở website trên desktop: cửa sổ Hồ sơ bên trái, video đào tạo bên phải tự phát không tiếng, có nút bật tiếng.
- **Constraints:** Lighthouse mobile/desktop ≥ 0.95; tôn trọng giảm chuyển động (chỉ hiện poster); không tự phát trên điện thoại; sao lưu D1 trước khi xoá; chỉ tông sáng; dữ liệu thật, không bịa chú thích.
- **Non-goals:** sửa ảnh/video; lightbox phức tạp (zoom, vuốt) ngoài mức cần xem ảnh to; đổi schema D1.
- **Acceptance:** `/dao-tao` và `/dao-tao.md` 301 sang `/thu-vien`(`.md`); không còn chữ "Đào tạo & sự kiện" trên site, llms, search, admin; 3 ảnh + 1 video hiển thị trong Thư viện; desktop ≥ ngưỡng đã chọn mở Hồ sơ + video, video tự phát không tiếng, nút bật tiếng dùng được bằng bàn phím; Lighthouse ≥ 0.95; agent GoClaw được đồng bộ lại nội dung.

## Phương án video bên phải

| | A. Mở sẵn cửa sổ Thư viện bên phải, video ở đầu cửa sổ | B. Khung video không viền nằm ở khe phải (đề xuất) |
|---|---|---|
| Giả định chính | Người xem chấp nhận cửa sổ có thanh tiêu đề | Khe phải luôn trống khi mới mở |
| Hỏng đầu tiên khi | Video nhỏ, bị lẫn với lưới ảnh | Màn hình chỉ có 1 khe (dưới 1438px) |
| Chi phí | Thấp, dùng lại hệ cửa sổ | Thấp, một phần tử định vị theo cùng phép tính khe |

Đề xuất **B**: một phần tử duy nhất, đặt theo `layoutWindows()`, nằm dưới các cửa sổ, tạm dừng khi bị cửa sổ che quá nửa hoặc tab ẩn; Thư viện vẫn là cửa sổ riêng mở từ dock.

## Kỹ thuật đã chốt với kongming

- Nén video: 720p H.264 CRF ~26, `yuv420p`, `+faststart`, keyframe 2 giây, AAC 96k (~3 MB); poster WebP ≤ 40 KB; bản 480p cho điện thoại.
- Phát: `muted playsinline loop preload="none"` + poster `<img>`; gắn `src` sau khi trình duyệt rảnh; `play()` lỗi thì hiện nút play. Nút "Bật tiếng" là `<button aria-pressed>`; bật tiếng thì phát lại từ đầu một lượt có tiếng rồi trở về lặp không tiếng; nền động tạm dừng khi đang có tiếng.
- Dữ liệu: settings `gallery` = JSON `[{key, caption, featured}]` trỏ tới thư viện media; trang admin nhỏ để sắp xếp, chú thích, chọn video nổi bật. Xoá 4 dòng `training` sau khi sao lưu; giữ nguyên ràng buộc CHECK (kind `training` chỉ không còn dòng nào).

## Better approaches

none — hướng được chọn là hướng người dùng yêu cầu; chỉ bổ sung cách xử lý màn hình 1 khe (bằng chứng: `desktop.ts:92`).

## Quyết định của người dùng (14/10/2026)

1. Laptop 1280–1437px: thu hẹp cửa sổ Hồ sơ còn khoảng 60%, video chiếm phần phải; dưới 1280px ẩn video.
2. Điện thoại: video (poster + chạm để phát, không tự phát) nằm đầu màn hình chính.
3. Tên mục: **Thư viện** (`/thu-vien`).
4. Ảnh hội trường "AI tạo sinh" là chương trình Agribank.
