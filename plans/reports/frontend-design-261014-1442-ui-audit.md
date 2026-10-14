# Báo cáo Kiểm toán Giao diện & Đề xuất Nâng cấp UI/UX — `tqd.io.vn` (Checkpoint 1)

- **Ngày thực hiện:** 2026-10-14 (Asia/Saigon)
- **Phạm vi:** Checkpoint 1 — Khảo sát mã nguồn, kiểm tra hiển thị thực tế ở 3 kích thước viewport (`1440×900`, `768×1024`, `375×812`), trích xuất Design Brief từ hệ thống hiện có, chấm điểm Rubric 12 tiêu chí của skill `ak:frontend-design` và đề xuất nâng cấp theo thứ tự ưu tiên **Must / Should / Could**.
- **Ràng buộc:** Giữ nguyên định hướng nghệ thuật đã duyệt (**Luxury + Technology**, **chỉ dùng giao diện sáng — Light Only**, nội dung tiếng Việt), không thêm tính năng mới, không viết lại nội dung, không sửa mã nguồn trong bước này.

---

## 1. Độ phủ khảo sát & Bằng chứng chụp màn hình

Toàn bộ các trang công khai và trạng thái tương tác đã được kiểm tra bằng công cụ `scripts/render-check.mjs` của skill `ak:frontend-design` kết hợp chụp trạng thái tương tác qua Chrome DevTools Protocol trên máy chủ local (`http://localhost:4321`).

### Danh mục ảnh chụp màn hình (`C:\Users\ABM\.cache\tqd-verify\ui-audit\`)

| Bề mặt / Trạng thái | Đường dẫnUrl | Desktop (`1440×900`) | Tablet (`768×1024`) | Mobile (`375×812`) | Kết quả `render-check.mjs` |
|---|---|---|---|---|---|
| **Trang chủ** (Cửa sổ Hồ sơ + Video nổi bật / Màn hình chính mobile) | `/` | `home/1440x900.png` | `home/768x1024.png` | `home/375x812.png` | 1 ERROR (`404 silk-wallpaper.mp4`), 4 WARN (`sr-only` clipped, wordmark contrast `2.67:1`, dialog-visible-on-load) |
| **Danh sách bài viết** | `/bai-viet` | `bai-viet/1440x900.png` | `bai-viet/768x1024.png` | `bai-viet/375x812.png` | 0 lỗi, 0 cảnh báo |
| **Chi tiết bài viết** (`Viết Pro`) | `/bai-viet/viet-pro-skill-viet-tieng-viet-cho-ai` | `article/1440x900.png` | `article/768x1024.png` | `article/375x812.png` | 1 WARN (`small-touch-target` ở `375×812`) |
| **Sản phẩm** | `/san-pham` | `san-pham/1440x900.png` | `san-pham/768x1024.png` | `san-pham/375x812.png` | 0 lỗi, 0 cảnh báo |
| **Thư viện** (Ảnh & Video đào tạo) | `/thu-vien` | `thu-vien/1440x900.png` | `thu-vien/768x1024.png` | `thu-vien/375x812.png` | 0 lỗi, 0 cảnh báo |
| **Video AI** | `/video-ai` | `video-ai/1440x900.png` | `video-ai/768x1024.png` | `video-ai/375x812.png` | 0 lỗi, 0 cảnh báo |
| **Liên hệ** | `/lien-he` | `lien-he/1440x900.png` | `lien-he/768x1024.png` | `lien-he/375x812.png` | 1 WARN (`small-touch-target`: link Email & Zalo `< 44px` ở `375×812`) |
| **Hồ sơ (trang độc lập)** | `/ho-so` | `ho-so/1440x900.png` | `ho-so/768x1024.png` | `ho-so/375x812.png` | 0 lỗi, 0 cảnh báo |
| **Khung Chatbot (Agent DũngTQ)** | `/ (mở chat)` | `chat-panel/1440x900.png` | `chat-panel/768x1024.png` | `chat-panel/375x812.png` | Đã mở và kiểm tra ở cả 3 viewport (không gửi tin nhắn) |
| **Các lớp phủ (Overlays)** | `/ (tương tác)` | `overlays/1440x900-cmdk.png`, `1440x900-effects.png`, `1440x900-expose.png` | `overlays/768x1024-sheet-ho-so.png` | `overlays/375x812-cmdk.png`, `375x812-sheet-san-pham.png` | Đã kiểm tra Command Palette (`Ctrl K`), Menu Hiệu ứng, Exposé và Bottom Sheet |

---

## 2. Design Brief (Trích xuất từ hệ thống hiện có — Route: Preserve & Improve)

```text
Register:  Brand (kết hợp lớp vỏ tương tác kiểu hệ điều hành cá nhân hóa ở trang chủ)
Scene:     Lãnh đạo doanh nghiệp, đối tác đào tạo và kỹ sư AI tại Việt Nam xem hồ sơ, sản phẩm và bài viết chuyên sâu của Trịnh Quang Dũng trên laptop hoặc điện thoại trong không gian làm việc ban ngày; cần cảm giác tin cậy, điềm tĩnh, sang trọng như một atelier thủ công nhưng sắc bén về công nghệ.
Direction: Luxury / refined kết hợp Neo-grotesque OS shell ("Ivory Atelier") vì nội dung vừa mang tính biên tập – học thuật (bài viết, đào tạo ngân hàng/doanh nghiệp lớn) vừa trình diễn năng lực kỹ thuật AI Agent thực chiến.
Color:     Restrained (Light-only); bg oklch(0.978 0.010 85) [#faf7f1 --color-paper] & oklch(1 0 0) [#ffffff --color-panel], text oklch(0.245 0.030 265) [#1b2030 --color-ink], muted oklch(0.500 0.028 78) [#6a6253 --color-muted], accent oklch(0.525 0.096 75) [#8a6420 --color-accent], accent-ink oklch(0.395 0.076 74) [#5e4413 --color-accent-ink], decorative champagne oklch(0.685 0.082 75) [#b8935a --color-champagne].
Type:      Cormorant Garamond (600, lining-nums) + Be Vietnam Pro (400/500/600) + JetBrains Mono (chỉ số, ngày tháng, phím tắt); trục tương phản: cổ điển biên tập (high-contrast serif) đối lập với hiện đại kỹ thuật (humanist sans + mono).
Signature: Không gian máy tính "Ivory Atelier" trên màn hình rộng (cửa sổ macOS viền mảnh ấm, thanh Dock phóng đại, Exposé, nền lụa champagne và linh vật Agent DũngTQ tương tác) chuyển đổi mượt thành màn hình ứng dụng kèm tấm trượt (bottom sheet) trên di động.
Dials:     variance 7, motion 6, density 4
```

**Lý giải bảng màu & hệ thống token (`src/styles/global.css:6-21`):**
- Bảng màu giữ nguyên triết lý **Light-only**: nền giấy ngà ấm (`#faf7f1`), bề mặt thẻ/cửa sổ trắng tinh (`#ffffff`), viền mảnh màu cát ấm (`#e6dfd2`), bóng đổ pha sắc nâu đồng từ `--color-accent-ink` (`rgb(94 68 19 / ...)`).
- Tách bạch rõ vai trò giữa màu nhấn chức năng (`--color-accent: #8a6420`, đạt tương phản ≥ 5.1:1 trên nền ngà và ≥ 5.5:1 trên nền trắng cho chữ/nút) và màu trang trí (`--color-champagne: #b8935a`, chỉ dùng cho đường kẻ mảnh, viền lồng, hào quang nền).

---

## 3. Đánh giá thực trạng: Những điểm đã tốt (Không được chạm vào) & Chấm điểm Rubric

### 3.1. Những điểm đã tốt và PHẢI GIỮ NGUYÊN

1. **Hệ thống Token màu sắc & Bóng đổ ấm (`src/styles/global.css:6-50`):**
   - Cách phân tách `--color-accent` (`#8a6420` cho chữ/liên kết/nút) và `--color-champagne` (`#b8935a` chỉ dùng trang trí) rất kỷ luật, giúp toàn bộ văn bản chính và phụ đạt chuẩn tương phản WCAG AA mà vẫn giữ được chất vàng champagne sang trọng.
   - Bóng đổ `--shadow-soft` và `--shadow-lift` pha màu nâu vàng ấm (`rgb(94 68 19 / ...)`), tuyệt đối không dùng bóng xám đen mặc định.
2. **Cặp phông chữ & Xử lý dấu tiếng Việt (`src/layouts/BaseLayout.astro:60-74`, `src/styles/global.css:54-62`):**
   - `Cormorant Garamond` (weight 600, `font-variant-numeric: lining-nums`, `line-height: 1.15`) hiển thị dấu chồng tiếng Việt (`Ứng`, `Đũng`, `Viết`, `ể`, `ự`) rõ nét, không bị cắt dấu; kết hợp hài hòa với `Be Vietnam Pro` và `JetBrains Mono`.
3. **Kiến trúc Progressive Enhancement & Tương tác Desktop (`src/scripts/desktop.ts`, `dock.ts`, `expose.ts`, `window-motion.ts`):**
   - Cơ chế FLIP animation khi phóng to/ghép nửa màn hình, hiệu ứng thu nhỏ kiểu genie vào Dock, phóng đại icon trên Dock theo hàm cosine khi rê chuột, và chế độ xem Exposé (`F3`) hoạt động mượt, chỉ dùng `transform` và `opacity`.
4. **Cơ chế phát Video nổi bật thông minh (`src/scripts/featured-video.ts`):**
   - Tự động tạm dừng khi cửa sổ khác đè lên ≥ 50% diện tích hoặc khi ẩn tab; tôn trọng `prefers-reduced-motion` và `Save-Data`; nút "Bật tiếng" phát lại từ đầu có âm thanh một lượt rồi quay về vòng lặp tắt tiếng.
5. **Kỷ luật về Reduced Motion & Bảo mật nội dung (`src/styles/motion.css:16-26`, `src/scripts/motion.ts:6-16`, `src/lib/chat-render.ts`):**
   - Mọi hoạt ảnh Web Animations API đi qua hàm `play()` đều tự ngắt khi bật `prefers-reduced-motion: reduce`; nội dung bài viết và phản hồi chatbot được lọc/dựng DOM an toàn.

---

### 3.2. Bảng chấm điểm Rubric 12 tiêu chí (`references/self-critique-loop.md`)

Ba tính từ cảm nhận thực tế khi nhìn trang hiện tại: **Sang trọng (Refined)**, **Điềm tĩnh (Calm)**, **Chưa đồng nhất ở di động (Uneven on mobile)** — khớp với tinh thần của Scene trên desktop nhưng bị giảm sự chỉn chu ở màn hình nhỏ và một số trạng thái tương tác.

| # | Tiêu chí | Điểm (0–2) | Bằng chứng cụ thể (Ảnh chụp màn hình & `file:line`) |
|---|---|:---:|---|
| 1 | **Brief fidelity** | **2/2** | Thể hiện rõ chất "Ivory Atelier" (luxury + tech, sáng hoàn toàn) qua nền ngà, khung chân dung viền kép `.lux-portrait` và hệ cửa sổ macOS (`home/1440x900.png`, `src/styles/global.css:6-139`). |
| 2 | **Hierarchy** | **1/2** | Trên desktop (`home/1440x900.png`), cột chữ trong cửa sổ Hồ sơ bị ép còn `315px` trong khi thẻ Video bên phải chiếm ngang bằng (`621px`). Trên mobile (`home/375x812.png`, `home/768x1024.png`), `.site-header` và `.site-footer` của `BaseLayout` bọc ngoài `MobileShell`, tạo ra 2 tầng điều hướng và 3 lần lặp lại tên/vai trò trên cùng một trang. |
| 3 | **Spacing rhythm** | **1/2** | Trên mobile (`home/375x812.png`), nút nổi `.chat-fab` (`right: 16px; bottom: 16px`, `src/components/ChatPanel.astro:73-74`) đè trực tiếp lên icon và nhãn "Video AI" của lưới ứng dụng `.m-grid`. Khi mở tấm trượt (`overlays/375x812-sheet-san-pham.png`), phần `<header class="mb-10 sm:mb-14">` bị bỏ sót sau khi xóa `<h1>` (`src/scripts/mobile-shell.ts:52`) tạo khoảng trống thừa và lặp tiêu đề phụ. |
| 4 | **Alignment** | **1/2** | Trên desktop khi mở khung chat (`chat-panel/1440x900.png`), `.chat-panel` (`right: 168px; bottom: 84px`, `src/components/ChatPanel.astro:128-129`) đè lên nửa dưới thẻ `.desktop-feature`, cắt ngang dòng chú thích `"Đào tạo AI cho cán bộ Agribank"`. Trong Command Palette (`overlays/375x812-cmdk.png`), tiêu đề bài viết dài gãy thành 4 dòng lệch hẳn so với cột hint bên phải và bị cắt nửa dòng cuối. |
| 5 | **Typography** | **1/2** | Cặp phông rất đẹp nhưng `.display` (`src/styles/global.css:54-62`) thiếu `text-wrap: balance`, khiến tiêu đề `<h1>` bài viết (`article/1440x900.png`, `article/768x1024.png`) bị rớt chữ mồ côi 1 từ (`"kiện"`) ở dòng thứ 3; cột văn bản trong cửa sổ Hồ sơ ở `1440×900` (`home/1440x900.png`) chỉ rộng `315px` (~34 ký tự/dòng, thấp hơn ngưỡng chuẩn 45–75ch). |
| 6 | **Color discipline** | **1/2** | Tổng thể bảng màu đạt 2/2, nhưng bị trừ 1 điểm vì lỗi tương phản nghiêm trọng ở `.tiktok-title` (`src/styles/global.css:255-284`): chữ kế thừa màu nâu sẫm `--color-accent-ink` (`#5e4413`) đặt trên nền gradient tối `rgb(27 32 48 / 0.72)` (tương phản ~1.4:1, không đọc được). |
| 7 | **Depth and shape** | **2/2** | Nhất quán một ngôn ngữ bo góc mềm (`14px–20px` cho khung lớn, `16px` cho `.lux-card`, `999px` cho chip/nút) kết hợp viền mảnh `1px solid var(--color-line)` và bóng đổ ấm `--shadow-soft` / `--shadow-lift` (`san-pham/1440x900.png`). |
| 8 | **States and feedback** | **1/2** | Tự động `.focus()` vào nút đóng khi khởi tạo cửa sổ/tấm trượt (`src/scripts/desktop.ts:154`, `src/scripts/mobile-shell.ts:74`) làm xuất hiện vòng focus đậm quanh nút `×` ngay khi mới vào trang hoặc vừa chạm mở (`home/1440x900.png`, `overlays/375x812-sheet-san-pham.png`). Danh sách bài viết (`bai-viet/1440x900.png`, `src/components/SectionBody.astro:113`) dùng `<li class="lux-card">` nên rê chuột lên thẻ không có phản hồi nâng thẻ như `a.lux-card`. |
| 9 | **Responsiveness** | **1/2** | Ở `375×812` (`lien-he/375x812.png`, `bai-viet/375x812.png`), thanh `.site-nav` làm mờ chữ `"Bài viết"` và ẩn hoàn toàn `"Liên hệ"` mà không tự cuộn mục đang chọn (`aria-current="page"`) vào khung nhìn; ở `768×1024` (`bai-viet/768x1024.png`), `.site-nav` bị đẩy xuống dòng thứ 2 dù thừa chỗ trên 1 dòng; nhiều vùng chạm `< 44px` (`lien-he/375x812.png`, `article/375x812.png`). |
| 10 | **Slop tells** | **2/2** | Không có bất kỳ dấu hiệu AI slop nào (không gradient tím, không chữ chuyển sắc, không số liệu tròn giả tạo, không từ sáo rỗng). |
| 11 | **Content and copy** | **2/2** | Văn phong tiếng Việt tự nhiên, rõ ràng, cụ thể về công việc và sản phẩm thực tế (`ho-so/1440x900.png`, `article/1440x900.png`). |
| 12 | **Craft details** | **1/2** | Console báo lỗi runtime 404 cho `/media/2026/10/silk-wallpaper.mp4` (`home/1440x900.png`, `src/scripts/wallpaper.ts:9`); trên mục `/video-ai` (`src/components/SectionBody.astro:95-100`), nhánh có `tiktokId` thiếu khung `.lux-card`, thiếu ngày/tag và lệch kiểu chữ so với `ItemCard`; trùng tên thuộc tính `data-mascot` giữa `<html>` và `<button class="mascot">`. |
| **Tổng** | | **16 / 24** | **Mục tiêu của skill: ≥ 20/24 và không có tiêu chí nào dưới 1.** |

---

## 4. Phân tích chi tiết các vấn đề phát hiện

### 4.1. Lỗi bố cục, chồng lấp & Responsive theo từng Viewport

1. **Nút nổi `.chat-fab` đè lên lưới ứng dụng trên Mobile & Tablet (`375×812`, `768×1024`):**
   - **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\home\375x812.png`, `home\768x1024.png`; `src/components/ChatPanel.astro:70-87`.
   - **Chi tiết:** Ở `375×812`, nút tròn `.chat-fab` (`56×56px`, `position: fixed; right: 16px; bottom: 16px`) nằm đè trực tiếp lên góc dưới phải của icon ứng dụng thứ 4 (**Video AI**) và che khuất chữ `"Video AI"` (chỉ còn thấy `"Vi..."`).
2. **Trùng lặp khung điều hướng (`site-header` + `site-footer`) trên màn hình chính Mobile/Tablet (`/`):**
   - **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\home\375x812.png`, `home\768x1024.png`; `src/pages/index.astro:15-22`, `src/layouts/BaseLayout.astro:85-129`.
   - **Chi tiết:** Trang chủ ở màn hình `< 1024px` hiển thị `MobileShell` (vốn được thiết kế như một màn hình chính điện thoại có đồng hồ lớn, thẻ video, thẻ định danh `Trịnh Quang Dũng` và lưới 6 ứng dụng), nhưng lại bị bọc trong `.site-header` (cũng chứa logo + 6 mục điều hướng ngang) và `.site-footer` (lặp lại tên + vai trò lần thứ 3). Khi người dùng bấm vào một icon trong `.m-grid`, nó mở tấm trượt (`m-sheet`), nhưng nếu bấm vào cùng tên mục đó trên `.site-header` ngay phía trên thì trình duyệt lại chuyển trang cứng sang `/{mục}`.
3. **Cửa sổ Hồ sơ bị bóp hẹp ở `1440×900` và không khớp mô tả 60%/40% trong `README.md`:**
   - **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\home\1440x900.png`; `src/scripts/desktop.ts:96-114`, `README.md:5`.
   - **Chi tiết:** `README.md:5` nêu rõ khi chỉ hiển thị cửa sổ Hồ sơ cùng video nổi bật thì cửa sổ Hồ sơ chiếm khoảng 60% để chừa chỗ cho video. Tuy nhiên trong `src/scripts/desktop.ts:99-101`, ở `1440×900`, `width = 1440 - 150 - 24 = 1266px >= 1264px` nên `count` tính ra `2`, biến `shared = count === 1 && withFeature` trở thành `false`, dù thực tế chỉ có **1 cửa sổ Hồ sơ** được mở kèm video nổi bật (`slots` bị cắt còn `1` ở dòng 328). Hệ quả là cửa sổ Hồ sơ bị chia đôi 50%/50% (`621px` mỗi bên), khiến cột văn bản bên phải ảnh chân dung (`sm:grid-cols-[13rem_1fr]`, `src/components/SectionBody.astro:22`) chỉ còn rộng `315px` (~34 ký tự/dòng), văn bản bị kéo dài thành cột hẹp và cắt cụt ở đáy cửa sổ mà không thấy các chip kỹ năng.
4. **Khung Chat trên Desktop (`1440×900`) đè lên thẻ Video nổi bật:**
   - **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\chat-panel\1440x900.png`; `src/components/ChatPanel.astro:126-142`.
   - **Chi tiết:** Khi mở `.chat-panel` (`right: 168px; bottom: 84px; width: 400px; height: 600px`), khung chat đè lên phần nửa dưới bên trái của `.desktop-feature`, cắt ngang dòng chữ `"Đào tạo AI cho cán bộ Agribank"` trong khi nút `"Bật tiếng"` và `"Xem thư viện"` vẫn lộ ra sát mép phải khung chat.
5. **Tấm trượt Mobile (`m-sheet`) giữ lại phần `<header>` thừa sau khi xóa `<h1>`:**
   - **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\overlays\375x812-sheet-san-pham.png`, `overlays\768x1024-sheet-ho-so.png`; `src/scripts/mobile-shell.ts:51-54`.
   - **Chi tiết:** `main.querySelector('h1')?.remove()` chỉ xóa thẻ `<h1>` bên trong `PageHeading.astro`, để lại `<header class="mb-10 sm:mb-14">` chứa dòng eyebrow `02 —— DŨNGTQ` và dòng mô tả phụ lơ lửng ngay dưới thanh tiêu đề của tấm trượt (`m-sheet-head`), gây trùng lặp thông tin và tốn khoảng trắng đầu tấm trượt. Ở mục "Hồ sơ" (`768x1024-sheet-ho-so.png`), người dùng nhìn thấy tiêu đề `Hồ sơ` ở đầu sheet, ngay dưới là `01 —— DŨNGTQ / Mình là ai, đang làm gì`, rồi mới tới `Trịnh Quang Dũng`.
6. **Thanh điều hướng `.site-nav` che khuất mục đang mở trên Mobile (`375×812`) và xuống dòng không cần thiết trên Tablet (`768×1024`):**
   - **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\lien-he\375x812.png`, `bai-viet\375x812.png`, `bai-viet\768x1024.png`; `src/layouts/BaseLayout.astro:92, 165-170`.
   - **Chi tiết:**
     - Ở `375×812`, `mask-image: linear-gradient(90deg, #000 85%, transparent)` làm mờ mục `"Bài viết"` và ẩn hẳn mục `"Liên hệ"` ở bên phải. Khi đang ở trang `/lien-he` hoặc `/bai-viet`, thanh nav không tự cuộn tới mục có `[aria-current="page"]`, khiến người dùng không thấy trạng thái trang hiện tại trên menu.
     - Ở `768×1024`, do dùng breakpoint `lg:` (`1024px`) thay vì `md:` (`768px`), thanh nav có 6 mục ngắn vẫn bị đẩy xuống hàng thứ 2 (`order-last w-full`), làm header cao `129px` thay vì gọn trên 1 hàng `76px`.
7. **Command Palette (`#cmdk`) bị tràn dòng và cắt chữ ở mục Bài viết:**
   - **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\overlays\375x812-cmdk.png`, `overlays\1440x900-cmdk.png`; `src/components/CommandPalette.astro:102-123`.
   - **Chi tiết:** Với các bài viết có tiêu đề dài và `hint` là cả đoạn tóm tắt, `.cmdk-option` xếp tiêu đề và `hint` trên cùng một hàng flex (`align-items: baseline`), khiến tiêu đề bài viết gãy thành 3–4 dòng hẹp bên trái còn `hint` bị cắt cụt ở dòng 1 bên phải; ở `375×812`, dòng thứ 4 của tiêu đề bị cắt ngang ở đáy danh sách.

### 4.2. Lỗi Khả năng tiếp cận (Accessibility: Contrast, Focus, Touch Targets, Keyboard)

1. **Độ tương phản chữ quá thấp (~1.4:1) trên tiêu đề TikTok Facade (`.tiktok-title`):**
   - **Bằng chứng:** `src/styles/global.css:255-284`, `src/components/TikTokPlayer.astro:12-19`.
   - **Chi tiết:** `.tiktok-facade` đặt `color: var(--color-accent-ink)` (`#5e4413`). Bên trong nó, `.tiktok-title` đặt nền tối `background: linear-gradient(transparent, rgb(27 32 48 / 0.72))` nhưng **không đặt `color: #fff`**, khiến chữ màu nâu sẫm `#5e4413` hiển thị trên nền đen xanh `rgb(27 32 48 / 0.72)` với tỷ lệ tương phản ~1.4:1 (thấp hơn nhiều mức tối thiểu 4.5:1).
2. **Nhiều vùng chạm (Touch Targets) nhỏ hơn chuẩn 44×44px:**
   - **Bằng chứng:**
     - `render-check.mjs` cảnh báo trên `lien-he/375x812.png`: 2 liên kết `dungtq.ceo@gmail.com` và `zalo.me/trinhquangdung` trong `src/components/SectionBody.astro:161-170` chỉ cao ~28px (nằm lẻ trong `<dd>` thay vì phủ vùng bấm hoặc có `min-h-11`).
     - `render-check.mjs` cảnh báo trên `article/375x812.png` và liên kết quay lại `← Bài viết` trong `src/pages/bai-viet/[slug].astro:29` chỉ cao ~16px (`font-size: 0.75rem`, không có padding dọc).
     - Các liên kết hành động `GitHub →`, `Bài giới thiệu →` trong `src/components/ItemCard.astro:22-28` chỉ cao ~20px và cách nhau `12px`.
     - Trên desktop/tablet: nút `.desktop-feature-sound` (`min-height: 36px`, `src/components/FeaturedVideo.astro:75`), nút `.desktop-feature-more` ("Xem thư viện", cao ~20px, `FeaturedVideo.astro:109`), nút đóng bóng thoại `.mascot-tip-close` (`24×24px`, `src/components/Mascot.astro:131-132`), và 3 nút đèn cửa sổ `.desktop-light` (`24×24px`, `src/components/DesktopShell.astro:349-350`).
3. **Vòng `:focus-visible` tự kích hoạt gây nhiễu thị giác khi mở trang / mở tấm trượt bằng chuột hoặc chạm:**
   - **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\home\1440x900.png` (vòng tròn nâu quanh nút đỏ đóng cửa sổ Hồ sơ ngay khi tải trang), `overlays\375x812-sheet-san-pham.png` và `overlays\768x1024-sheet-ho-so.png` (vòng tròn lớn quanh nút `×`), `chat-panel\768x1024.png` và `chat-panel\375x812.png` (vòng focus quanh nút `Thử lại`).
   - **Chi tiết:** `src/scripts/desktop.ts:154`, `src/scripts/mobile-shell.ts:74` và `src/scripts/chat-panel.ts:169, 362` gọi `.focus()` trực tiếp vào nút đóng hoặc nút thử lại. Trình duyệt gắn `:focus-visible` khi `.focus()` được gọi từ script lúc tải trang hoặc sau tác vụ bất đồng bộ. Chuyển focus ban đầu về chính phần tử vùng chứa `role="dialog"` (`tabindex="-1"` với `outline: none`) sẽ giữ nguyên khả năng điều hướng bàn phím/screen reader và phím `Escape` mà không vẽ vòng focus giả lên nút `×`.
4. **Chế độ Exposé và Cửa sổ Desktop thiếu hỗ trợ bàn phím đầy đủ:**
   - **Bằng chứng:** `src/scripts/expose.ts:51-68`, `src/scripts/desktop.ts:271`.
   - **Chi tiết:**
     - Khi bật Exposé (`F3` hoặc bấm "Tất cả cửa sổ"), các cửa sổ chỉ nhận sự kiện `click` (`win.addEventListener('click', onPick)`), không có `tabindex="0"` hay xử lý phím `Enter`/`Space` để chọn cửa sổ bằng bàn phím.
     - Trên desktop, khi người dùng nhấn `Tab` di chuyển tiêu điểm vào một cửa sổ đang bị cửa sổ khác che một phần, sự kiện `focusin` không gọi `focusWindow(win)` (hiện chỉ gọi ở `pointerdown` tại `desktop.ts:271`), khiến người dùng bàn phím thao tác trên cửa sổ bị khuất phía sau.

### 4.3. Tính nhất quán Component, Typography & Kỹ thuật

1. **Chữ mồ côi (Orphaned words) trên tiêu đề lớn `.display`:**
   - **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\article\1440x900.png`, `article\768x1024.png` (chữ `"kiện"` đứng lẻ 1 mình ở dòng thứ 3 của `<h1>`); `src/styles/global.css:54-62`.
   - **Chi tiết:** Lớp `.display` và `.prose-article h2, .prose-article h3` chưa có `text-wrap: balance`, còn các đoạn văn `.prose-article p` chưa có `text-wrap: pretty`.
2. **Thẻ bài viết ở `/bai-viet` không bấm được toàn thẻ và không hiển thị nhãn (`tags`):**
   - **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\bai-viet\1440x900.png`; `src/components/SectionBody.astro:111-124`, `src/styles/global.css:96-100`.
   - **Chi tiết:** Khác với các thẻ `.lux-card` là thẻ `<a>` có hiệu ứng nâng nhẹ khi hover, danh sách bài viết dùng `<li class="lux-card p-6">` và chỉ gắn link vào chữ `<h3><a>`. Người dùng bấm vào vùng ngày tháng, tóm tắt hoặc khoảng đệm quanh thẻ đều không mở được bài viết, và các `tags` của bài viết (đã có sẵn trong dữ liệu `articles` từ `listArticles`) bị bỏ trống không hiển thị.
3. **Mục `/video-ai` thiếu tính nhất quán giữa nhánh có `tiktokId` và `ItemCard`:**
   - **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\video-ai\1440x900.png`; `src/components/SectionBody.astro:91-107`.
   - **Chi tiết:** Trong `SectionBody.astro:95-103`, nếu một mục video có `tiktokId`, nó render `<article class="flex flex-col gap-3">` trần (không có `.lux-card`, tiêu đề `<h3>` không dùng `.display`, bỏ qua `item.date` và `item.tags`), lệch hoàn toàn với các mục bên cạnh dùng `<ItemCard />`.
4. **Lỗi 404 Runtime trên Console khi tải video nền (`/media/2026/10/silk-wallpaper.mp4`):**
   - **Bằng chứng:** Báo cáo `render-check.mjs` tại `home/1440x900`: `ERROR runtime-error: Failed to load resource: the server responded with a status of 404 (Not Found) (http://localhost:4321/media/2026/10/silk-wallpaper.mp4)`; `src/scripts/wallpaper.ts:9`, `src/pages/media/[...key].ts`.
   - **Chi tiết:** Khi chạy môi trường dev (hoặc khi R2 chưa có object `2026/10/silk-wallpaper.mp4`), thẻ `<video>` gán thẳng `video.src = '/media/2026/10/silk-wallpaper.mp4'` gây lỗi 404 đỏ trong console trình duyệt, làm `render-check.mjs` đánh trượt (`exit code 1`), dù repo đã có sẵn tệp gốc `src/assets/wallpaper-silk.mp4`.
5. **Xung đột tên thuộc tính `data-mascot` & Cảnh báo `h1.sr-only`:**
   - **Bằng chứng:** `src/components/Mascot.astro:19`, `src/scripts/mascot.ts:191, 200`, `src/pages/index.astro:18`.
   - **Chi tiết:** `document.documentElement.dataset.mascot = 'on'` gắn thuộc tính `data-mascot` lên thẻ `<html>`, trùng tên với thuộc tính `data-mascot` trên `<button class="mascot" data-mascot>`. Đồng thời `h1.sr-only` trên `index.astro` không có `white-space: nowrap` nên bị trình kiểm tra báo cảnh báo `clipped-text` ở viewport hẹp.

---

## 5. Đề xuất nâng cấp (Xếp hạng Must / Should / Could)

Toàn bộ đề xuất dưới đây tuân thủ nghiêm ngặt phạm vi: **chỉ tinh chỉnh thị giác và UX trên hệ thống hiện có, giữ nguyên bảng màu sáng Ivory Atelier, không thêm tính năng mới, không viết lại nội dung.**

---

### Nhóm MUST (Bắt buộc — Sửa lỗi hiển thị, chồng lấp, tương phản, vùng chạm và lỗi runtime)

#### MUST-1: Sửa lỗi tương phản chữ trên `.tiktok-title` (~1.4:1 → > 12:1) và đồng bộ khung thẻ Video AI
- **Bằng chứng:** `src/styles/global.css:255-284`, `src/components/SectionBody.astro:91-107`.
- **Thay đổi cụ thể:**
  1. Trong `src/styles/global.css`, bổ sung `color: var(--color-paper);` (ngà sáng `#faf7f1`, vẫn thuộc bảng màu sẵn có, tương phản > 12:1 trên lớp phủ tối của thumbnail video) cho `.tiktok-title`, kèm hiệu ứng hover nhẹ trên `.tiktok-play`.
  2. Trong `src/components/SectionBody.astro` (nhánh `id === 'video-ai'`), bọc mục có `item.tiktokId` trong `<article class="lux-card flex flex-col gap-3 p-6">`, hiển thị `item.date` (`font-mono text-xs text-muted`), tiêu đề `h3.display.text-2xl`, `item.summary` và danh sách `item.tags` (`.lux-chip`) đồng nhất với `ItemCard.astro`.
- **Tệp tác động:** `src/styles/global.css`, `src/components/SectionBody.astro`.
- **Tiêu chí nghiệm thu (Acceptance check):** Kiểm tra tương phản của `.tiktok-title` đạt ≥ 4.5:1; các thẻ trong `/video-ai` có cùng cấu trúc `.lux-card`, phông chữ `.display` và nhãn `.lux-chip`.

#### MUST-2: Khắc phục nút `.chat-fab` đè lên lưới ứng dụng trên Mobile & Tablet (`375×812`, `768×1024`)
- **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\home\375x812.png`, `home\768x1024.png`; `src/components/ChatPanel.astro:70-87`, `src/components/MobileShell.astro:15-61`.
- **Thay đổi cụ thể:**
  1. Trong `src/components/MobileShell.astro`, bổ sung khoảng đệm dưới cho `.m-home` (`padding-bottom: 4.5rem`) và điều chỉnh khoảng cách để lưới `.m-grid` luôn kết thúc phía trên vùng nổi của `.chat-fab`, không bao giờ để `.chat-fab` che icon hoặc chữ `"Video AI"`.
  2. Khi mở tấm trượt mục (`.m-sheet`) trên mobile, ẩn nhẹ nút `.chat-fab` (`opacity: 0; pointer-events: none` khi `.m-home.is-behind` hoặc `[data-m-sheet]:not([hidden])`) để không chồng chéo lớp phủ.
- **Tệp tác động:** `src/components/MobileShell.astro`, `src/components/ChatPanel.astro`.
- **Tiêu chí nghiệm thu:** Chụp lại `home/375x812.png` và `home/768x1024.png`, xác nhận toàn bộ 6 icon và nhãn trong `.m-grid` (đặc biệt là "Video AI") hiển thị trọn vẹn 100%, khoảng cách từ đáy `.m-grid` tới `.chat-fab` ≥ 16px.

#### MUST-3: Đảm bảo mọi vùng chạm (Touch Targets) đạt tối thiểu 44×44px trên toàn bộ các trang
- **Bằng chứng:** Báo cáo `render-check.mjs` trên `lien-he/375x812.png` và `article/375x812.png`; `src/components/SectionBody.astro:158-172`, `src/pages/bai-viet/[slug].astro:28-32`, `src/components/ItemCard.astro:22-28`, `src/components/FeaturedVideo.astro:68-85, 109-115`, `src/components/Mascot.astro:127-136`.
- **Thay đổi cụ thể:**
  1. **Trang Liên hệ (`SectionBody.astro:158-172`):** Biến liên kết Email và Zalo trong `<dd>` thành vùng bấm đủ chuẩn (`class="inline-flex min-h-11 items-center"` hoặc dùng pseudo-element `after:absolute after:inset-0` trên thẻ `.lux-card.relative` để bấm được cả ô thẻ Email/Zalo).
  2. **Trang Bài viết chi tiết (`src/pages/bai-viet/[slug].astro:29`):** Thêm `inline-flex min-h-11 items-center` cho liên kết `← Bài viết` (và trên các liên kết độc lập).
  3. **Thẻ Sản phẩm (`ItemCard.astro:22-28`):** Thêm `inline-flex min-h-11 items-center` cho các liên kết trong `item.links` (`GitHub →`, `Bài giới thiệu →`) để dễ chạm trên màn hình cảm ứng.
  4. **Video nổi bật & Linh vật (`FeaturedVideo.astro`, `Mascot.astro`, `ChatPanel.astro`):** Nâng `min-height` của `.desktop-feature-sound`, `.desktop-feature-more`, `.chat-zalo`, `.chat-retry` lên `44px` (hoặc mở rộng vùng chạm bằng `::before { content: ''; position: absolute; inset: -10px; }` cho `.mascot-tip-close` và `.desktop-light`).
- **Tệp tác động:** `src/components/SectionBody.astro`, `src/pages/bai-viet/[slug].astro`, `src/components/ItemCard.astro`, `src/components/FeaturedVideo.astro`, `src/components/Mascot.astro`, `src/components/ChatPanel.astro`.
- **Tiêu chí nghiệm thu:** Chạy lại `render-check.mjs` trên tất cả các trang công khai: **0 cảnh báo `small-touch-target`** ở `375×812`.

#### MUST-4: Sửa tỷ lệ chia cột Cửa sổ Hồ sơ + Video nổi bật ở `1440×900` và vị trí Khung Chat trên Desktop
- **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\home\1440x900.png`, `chat-panel\1440x900.png`; `src/scripts/desktop.ts:96-114`, `src/components/SectionBody.astro:22`, `src/components/ChatPanel.astro:126-142`.
- **Thay đổi cụ thể:**
  1. Trong `src/scripts/desktop.ts:99-112`, khi `withFeature` bật và `count <= 2` (tức chỉ mở 1 cửa sổ Hồ sơ bên trái và 1 thẻ Video nổi bật bên phải, xảy ra ở mọi màn hình từ `1280px` đến `2440px`), áp dụng tỷ lệ chia `shared` (**58%–60% cho cửa sổ Hồ sơ**, **40%–42% cho thẻ Video nổi bật**). Ở `1440×900`, cửa sổ Hồ sơ tăng từ `621px` lên `~745px`, giúp cột văn bản bên phải ảnh chân dung rộng `~440px` (đạt chuẩn 50–60ch dễ đọc) và hiển thị được nhiều nội dung hơn mà không bị bóp nghẹt.
  2. Trong `src/components/ChatPanel.astro:126-142`, tinh chỉnh vị trí `.chat-panel` trên desktop (`bottom: 84px; right: 164px; max-height: min(540px, calc(100vh - 150px))`) kết hợp với kích thước mới của `.desktop-feature` (cao `~330px`, kết thúc ở `y ≈ 386px`) để khung chat nằm gọn trong vùng trống phía dưới thẻ video nổi bật hoặc tách biệt rõ ràng, không cắt ngang dòng chú thích video.
- **Tệp tác động:** `src/scripts/desktop.ts`, `src/components/ChatPanel.astro`.
- **Tiêu chí nghiệm thu:** Ở `1440×900`, cửa sổ Hồ sơ rộng `~745px`, tiêu đề `Trịnh Quang Dũng` nằm gọn trên 1 dòng, độ rộng dòng văn bản đạt 45–65ch; khi mở khung chat (`chat-panel/1440x900.png`), khung chat không cắt ngang chữ chú thích của thẻ video nổi bật.

#### MUST-5: Xử lý triệt để lỗi 404 Runtime của Video nền trên môi trường Dev / khi thiếu tệp R2
- **Bằng chứng:** Báo cáo `render-check.mjs` trên `home/1440x900`: `ERROR runtime-error: Failed to load resource: the server responded with a status of 404 (Not Found) (http://localhost:4321/media/2026/10/silk-wallpaper.mp4)`; `src/scripts/wallpaper.ts:9`, `src/pages/media/[...key].ts`.
- **Thay đổi cụ thể:**
  - Trong `src/scripts/wallpaper.ts` (hoặc `src/pages/media/[...key].ts`), dùng bunded asset fallback (`import fallbackUrl from '../assets/wallpaper-silk.mp4?url'`) hoặc kiểm tra phản hồi/fallback sang asset tĩnh khi `/media/2026/10/silk-wallpaper.mp4` chưa có trong local R2, để trình duyệt không bao giờ phát sinh lỗi 404 đỏ trong Console và nền lụa hoạt động ngay cả trên máy dev local.
- **Tệp tác động:** `src/scripts/wallpaper.ts`.
- **Tiêu chí nghiệm thu:** Chạy `render-check.mjs` trên `http://localhost:4321/` đạt **0 errors** (`exit code 0`), video nền chạy mượt trên `1440×900`.

---

### Nhóm SHOULD (Nên làm — Nâng cấp chất lượng UX, điều hướng, bố cục tấm trượt & khả năng tiếp cận bàn phím)

#### SHOULD-1: Loại bỏ phần `<header>` thừa trong Tấm trượt Mobile (`m-sheet`) và ẩn khung điều hướng trùng lặp trên màn hình chính Mobile (`< 1024px`)
- **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\home\375x812.png`, `overlays\375x812-sheet-san-pham.png`, `overlays\768x1024-sheet-ho-so.png`; `src/scripts/mobile-shell.ts:51-55`, `src/pages/index.astro:15-22`.
- **Thay đổi cụ thể:**
  1. Trong `src/scripts/mobile-shell.ts:52`: Thay `main.querySelector('h1')?.remove()` bằng việc xóa toàn bộ khối `<header>` đầu tiên chứa `<h1>` (`main.querySelector('header:has(h1)')?.remove() ?? main.querySelector('h1')?.remove()`), đồng thời bổ sung dòng mô tả ngắn (`s.short`) vào ngay dưới `.m-sheet-title` trên thanh `.m-sheet-head` nếu cần. Nhờ đó nội dung trong tấm trượt bắt đầu ngay lập tức, không còn dòng `01 —— DŨNGTQ` thừa và khoảng trống `mb-10` lãng phí.
  2. Sau khi nạp nội dung vào `m-sheet-body`, gọi hàm khởi tạo facade TikTok nếu trong sheet có `.tiktok-embed` hoặc `.tiktok-facade`.
- **Tệp tác động:** `src/scripts/mobile-shell.ts`, `src/components/MobileShell.astro`.
- **Tiêu chí nghiệm thu:** Mở tấm trượt `Sản phẩm` và `Hồ sơ` ở `375×812` và `768×1024`: không còn khối eyebrow `01/02 —— DŨNGTQ` lặp lại bên dưới thanh tiêu đề của sheet; nội dung hiển thị cao hơn ~110px ngay trong màn hình đầu tiên.

#### SHOULD-2: Cải thiện thanh điều hướng `.site-nav` trên Mobile (`375×812`) và Tablet (`768×1024`)
- **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\lien-he\375x812.png`, `bai-viet\768x1024.png`; `src/layouts/BaseLayout.astro:86-105, 165-170`.
- **Thay đổi cụ thể:**
  1. Trong `src/layouts/BaseLayout.astro:92`, đổi `lg:order-none lg:w-auto` thành `md:order-none md:w-auto` và đổi `@media (width < 64rem)` thành `@media (width < 48rem)` (`768px`). Ở `768×1024`, toàn bộ logo, 6 mục menu và nút `Tìm Ctrl K` nằm gọn trên **1 hàng duy nhất cao 76px**, tiết kiệm 53px chiều cao toàn trang.
  2. Trên màn hình `< 768px`, thêm đoạn script nhỏ hoặc padding cuối danh sách (`pr-6`) và tự động `scrollIntoView({ inline: 'center', block: 'nearest' })` cho mục `.site-nav-link[aria-current="page"]` để khi đang ở `/bai-viet` hoặc `/lien-he`, mục đang chọn luôn nằm rõ trong tầm mắt.
- **Tệp tác động:** `src/layouts/BaseLayout.astro`.
- **Tiêu chí nghiệm thu:** Ở `768×1024`, `.site-header` chỉ cao 1 dòng (`~76px`); ở `375×812` trên trang `/lien-he` và `/bai-viet`, mục menu đang active hiển thị rõ ràng, không bị cắt khuất.

#### SHOULD-3: Loại bỏ vòng `:focus-visible` tự phát khi mở Cửa sổ / Tấm trượt bằng chuột hoặc chạm, đồng thời bổ sung hỗ trợ bàn phím cho Exposé & Cửa sổ
- **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\home\1440x900.png`, `overlays\375x812-sheet-san-pham.png`, `chat-panel\375x812.png`; `src/scripts/desktop.ts:154, 271`, `src/scripts/mobile-shell.ts:74`, `src/scripts/chat-panel.ts:169, 362`, `src/scripts/expose.ts:51-68`.
- **Thay đổi cụ thể:**
  1. Cho `.desktop-window`, `.m-sheet` và `.chat-panel` thuộc tính `tabindex="-1"` kèm `outline: none` khi nhận programmatic focus: khi mở cửa sổ mới lúc khởi tạo trang hoặc mở tấm trượt trên mobile, đặt focus vào chính vùng chứa `dialog` (`win.focus({ preventScroll: true })`, `sheet.focus({ preventScroll: true })`) thay vì nút đóng `[data-close]` / `[data-m-close]`. Khi người dùng nhấn `Tab`, focus sẽ di chuyển tự nhiên vào nút đầu tiên với vòng `:focus-visible` chuẩn xác; phím `Escape` vẫn hoạt động bình thường.
  2. Trong `src/scripts/desktop.ts:271`, thêm `win.addEventListener('focusin', () => focusWindow(win))` để khi người dùng `Tab` vào một cửa sổ nằm dưới, cửa sổ đó tự động được nâng lên trên cùng (`z-index`).
  3. Trong `src/scripts/expose.ts`, khi vào chế độ Exposé, đặt `win.tabIndex = 0` và lắng nghe phím `Enter` / `Space` trên cửa sổ để người dùng bàn phím có thể `Tab` qua các cửa sổ thu nhỏ và nhấn `Enter` để chọn; khi thoát Exposé thì trả lại `tabIndex = -1`.
- **Tệp tác động:** `src/components/DesktopShell.astro`, `src/components/MobileShell.astro`, `src/components/ChatPanel.astro`, `src/scripts/desktop.ts`, `src/scripts/mobile-shell.ts`, `src/scripts/chat-panel.ts`, `src/scripts/expose.ts`.
- **Tiêu chí nghiệm thu:** Mở trang chủ `1440×900` và tấm trượt `375×812` không còn vòng tròn nâu tự phát trên nút đóng; nhấn `Tab` hiển thị vòng focus rõ ràng; trong chế độ Exposé có thể dùng `Tab` + `Enter` để chọn cửa sổ.

#### SHOULD-4: Tinh chỉnh Typography (`text-wrap: balance/pretty`) và Bố cục mục Bài viết trong Command Palette (`#cmdk`)
- **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\article\1440x900.png`, `overlays\375x812-cmdk.png`, `overlays\1440x900-cmdk.png`; `src/styles/global.css:54-62, 142-170`, `src/components/CommandPalette.astro:102-123`.
- **Thay đổi cụ thể:**
  1. Trong `src/styles/global.css`, thêm `text-wrap: balance` cho `.display`, `.prose-article h2`, `.prose-article h3` và `text-wrap: pretty` cho `.prose-article p`. Điều này xóa bỏ chữ mồ côi `"kiện"` ở dòng 3 của tiêu đề bài viết `Viết Pro`.
  2. Trong `src/components/CommandPalette.astro:102-123`, giới hạn tiêu đề trong `.cmdk-option span:first-child` tối đa 1–2 dòng (`display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;`) hoặc xếp dọc tiêu đề + dòng phụ một dòng gọn gàng để không bị vỡ bố cục 4 dòng và cắt chữ ở `375×812`.
- **Tệp tác động:** `src/styles/global.css`, `src/components/CommandPalette.astro`.
- **Tiêu chí nghiệm thu:** Chụp lại `article/1440x900.png` và `overlays/375x812-cmdk.png`: tiêu đề `<h1>` cân đối không còn từ mồ côi; danh sách kết quả trong Command Palette gọn gàng, không bị cắt ngang dòng chữ.

#### SHOULD-5: Mở rộng vùng bấm toàn thẻ cho Danh sách bài viết (`/bai-viet`) và hiển thị nhãn (`tags`)
- **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\bai-viet\1440x900.png`; `src/components/SectionBody.astro:111-125`, `src/styles/global.css:96-100`.
- **Thay đổi cụ thể:**
  1. Trong `src/components/SectionBody.astro:113-121`, thêm `relative` vào `<li class="lux-card relative p-6">`, thêm `after:absolute after:inset-0` vào `<a href={\`/bai-viet/\${a.slug}\`}>` để toàn bộ diện tích thẻ bài viết đều bấm được, và hiển thị danh sách `a.tags` bằng `.lux-chip` ở cuối thẻ (tương tự `ItemCard.astro`).
  2. Trong `src/styles/global.css:96`, mở rộng selector `a.lux-card:hover, .lux-card:has(> h3 > a:hover), .lux-card:has(> dd > a:hover)` để thẻ bài viết và thẻ liên hệ cũng có phản hồi nâng nhẹ (`translateY(-2px)` + `--shadow-lift`) nhất quán khi rê chuột.
- **Tệp tác động:** `src/components/SectionBody.astro`, `src/styles/global.css`.
- **Tiêu chí nghiệm thu:** Trên `/bai-viet`, rê chuột vào bất kỳ vị trí nào của thẻ bài viết đều có hiệu ứng nâng thẻ và bấm mở được bài viết; các tag của bài viết hiển thị dưới phần tóm tắt.

---

### Nhóm COULD (Tùy chọn hoàn thiện thêm — Tinh chỉnh chi tiết nhỏ)

#### COULD-1: Sửa xung đột tên thuộc tính `data-mascot` và cảnh báo `h1.sr-only`
- **Bằng chứng:** `src/components/Mascot.astro:19`, `src/scripts/mascot.ts:45, 191, 200`, `src/pages/index.astro:18`, `src/components/DesktopShell.astro:22`.
- **Thay đổi cụ thể:**
  1. Thêm ` whitespace-nowrap` vào `<h1 class="sr-only whitespace-nowrap">` trong `src/pages/index.astro:18` và `src/components/DesktopShell.astro:22` để `render-check.mjs` không còn báo cảnh báo giả `clipped-text` ở `375×812` và `768×1024`.
  2. Đổi thuộc tính trên nút linh vật trong `Mascot.astro` từ `data-mascot` sang `data-mascot-btn` (hoặc giữ `data-mascot` nhưng ưu tiên chọn `button[data-mascot]`) để tránh trùng với `<html data-mascot="on|off">`.
- **Tệp tác động:** `src/pages/index.astro`, `src/components/DesktopShell.astro`, `src/components/Mascot.astro`, `src/scripts/mascot.ts`.
- **Tiêu chí nghiệm thu:** Chạy `render-check.mjs` trên `/` không còn cảnh báo `clipped-text` cho `h1.sr-only`.

#### COULD-2: Thêm gợi ý cuộn dọc nhẹ cho cửa sổ Desktop khi nội dung dài hơn chiều cao cửa sổ
- **Bằng chứng:** `C:\Users\ABM\.cache\tqd-verify\ui-audit\home\1440x900.png`; `src/components/DesktopShell.astro:386-390`.
- **Thay đổi cụ thể:**
  - Trong `src/components/DesktopShell.astro`, áp dụng bóng cuộn CSS thuần (`background: linear-gradient(var(--color-panel) 30%, transparent), linear-gradient(transparent, var(--color-panel) 70%), radial-gradient(farthest-side at 50% 0, rgb(94 68 19 / 0.12), transparent), radial-gradient(farthest-side at 50% 100%, rgb(94 68 19 / 0.12), transparent)` với `background-attachment: local, local, scroll, scroll`) trên `.desktop-body` để khi cửa sổ Hồ sơ hoặc Sản phẩm còn nội dung phía dưới, mép đáy cửa sổ có bóng mờ ấm báo hiệu còn nội dung có thể cuộn.
- **Tệp tác động:** `src/components/DesktopShell.astro`.
- **Tiêu chí nghiệm thu:** Khi cửa sổ Hồ sơ ở vị trí đầu trang, đáy cửa sổ có vệt bóng ấm tinh tế và tự biến mất khi cuộn tới đáy.

---

## 6. Bảng tổng hợp kế hoạch thực thi cho Checkpoint 2

| Mã hạng mục | Mức ưu tiên | Tệp dự kiến chỉnh sửa | Tác động chính |
|---|:---:|---|---|
| **MUST-1** | Must | `src/styles/global.css`, `src/components/SectionBody.astro` | Sửa tương phản `.tiktok-title` (~1.4:1 → > 12:1) & đồng bộ thẻ `/video-ai` |
| **MUST-2** | Must | `src/components/MobileShell.astro`, `src/components/ChatPanel.astro` | Chấm dứt việc `.chat-fab` đè lên icon "Video AI" trên mobile/tablet |
| **MUST-3** | Must | `src/components/SectionBody.astro`, `src/pages/bai-viet/[slug].astro`, `src/components/ItemCard.astro`, `src/components/FeaturedVideo.astro`, `src/components/Mascot.astro`, `src/components/ChatPanel.astro` | Đảm bảo 100% vùng chạm đạt chuẩn ≥ 44×44px |
| **MUST-4** | Must | `src/scripts/desktop.ts`, `src/components/ChatPanel.astro` | Sửa tỷ lệ 60%/40% cho Cửa sổ Hồ sơ + Video nổi bật ở `1440×900` và tránh chồng lấp khung chat |
| **MUST-5** | Must | `src/scripts/wallpaper.ts` | Xử lý fallback cho `silk-wallpaper.mp4`, xóa lỗi 404 runtime trên Console |
| **SHOULD-1** | Should | `src/scripts/mobile-shell.ts`, `src/components/MobileShell.astro` | Xóa khối `<header>` thừa trong tấm trượt mobile (`m-sheet`) |
| **SHOULD-2** | Should | `src/layouts/BaseLayout.astro` | Gộp `.site-nav` lên 1 dòng ở `768×1024` & tự cuộn mục đang chọn vào tầm nhìn ở `375×812` |
| **SHOULD-3** | Should | `src/components/DesktopShell.astro`, `src/components/MobileShell.astro`, `src/components/ChatPanel.astro`, `src/scripts/desktop.ts`, `src/scripts/mobile-shell.ts`, `src/scripts/chat-panel.ts`, `src/scripts/expose.ts` | Loại bỏ vòng focus giả trên nút đóng & bổ sung điều hướng bàn phím cho Exposé/Cửa sổ |
| **SHOULD-4** | Should | `src/styles/global.css`, `src/components/CommandPalette.astro` | Thêm `text-wrap: balance/pretty` xóa chữ mồ côi & sửa tràn dòng trong `#cmdk` |
| **SHOULD-5** | Should | `src/components/SectionBody.astro`, `src/styles/global.css` | Mở rộng vùng bấm toàn thẻ cho `/bai-viet` & hiển thị tags |
| **COULD-1** | Could | `src/pages/index.astro`, `src/components/DesktopShell.astro`, `src/components/Mascot.astro`, `src/scripts/mascot.ts` | Xóa cảnh báo giả `h1.sr-only` & tách selector `data-mascot-btn` |
| **COULD-2** | Could | `src/components/DesktopShell.astro` | Bóng gợi ý cuộn dọc tinh tế cho `.desktop-body` |
