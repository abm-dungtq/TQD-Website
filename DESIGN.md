# DESIGN.md — TQD.me Ivory Atelier Design System

Tài liệu đặc tả hệ thống thị giác, màu sắc, kiểu chữ, chuyển động, biểu tượng và thành phần giao diện của **tqd.me** (Trịnh Quang Dũng — AI Automation & Đào tạo AI Doanh nghiệp).

> **Chế độ màu cố định:** Light-only (`color-scheme: light`). Không thêm biến thể dark mode tự phát; mọi thành phần mới bắt buộc sử dụng bảng token Ivory Atelier bên dưới.

---

## 1. Bảng màu & Tương phản WCAG 2.2 AA (`src/styles/global.css`)

| Token CSS | Mã Hex | Vai trò sử dụng | Tương phản trên `#faf7f1` / `#ffffff` | Quy tắc bắt buộc |
| --- | --- | --- | --- | --- |
| `--color-paper` | `#faf7f1` | Nền trang chính (Warm Ivory) | — | Nền mặc định toàn trang công khai |
| `--color-panel` | `#ffffff` | Nền thẻ `.lux-card`, cửa sổ OS, hộp thoại | — | Luôn đi kèm viền `--color-line` |
| `--color-tint` | `#f6f0e4` | Nền phụ, chip `.lux-chip`, hộp nhấn B2B, fallback ảnh | — | Không lạm dụng làm chữ |
| `--color-ink` | `#1b2030` | Chữ chính, tiêu đề serif, biểu tượng mặc định | `~15.1:1` (AAA) | Mặc định cho nội dung đọc dài |
| `--color-muted` | `#6a6253` | Chữ phụ, nhãn metadata, ngày đăng, chú thích | `~5.4:1` (AA) | Đạt chuẩn cho cả chữ nhỏ `12px` |
| `--color-accent` | `#8a6420` | Nút chính `.btn-gold`, vòng focus `:focus-visible`, trạng thái active | `~5.15:1` (AA) | Tương phản chữ `#ffffff` trên nền `#8a6420` đạt `~5.35:1` |
| `--color-accent-ink` | `#5e4413` | Liên kết văn bản, nhãn nhấn trên nền sáng/tint | `~8.4:1` (AAA) | Dùng cho chữ màu vàng đồng cần độ sắc nét cao |
| `--color-champagne` | `#b8935a` | **Chỉ dùng trang trí:** đường kẻ mảnh, viền hover nhẹ, chấm trang trí | `~2.68:1` (KHÔNG ĐẠT chữ/UI) | **CẤM** dùng cho chữ, số thứ tự, đường viền `:focus-visible` hoặc ranh giới thành phần tương tác duy nhất |
| `--color-line` | `#ece3d3` | Đường chia khối, viền thẻ `.lux-card` | — | Dùng kết hợp đổ bóng nhẹ `--shadow-card` |

---

## 2. Hệ thống Kiểu chữ (Typography)

1. **Display Serif (`--font-serif` — `'Cormorant Garamond'`):**
   - Áp dụng qua lớp `.display` cho tiêu đề trang (`h1`), tiêu đề mục (`h2`, `h3`) và lời dẫn thương hiệu.
   - Trọng lượng chuẩn: `font-weight: 600`, `line-height: 1.15`, `letter-spacing: -0.01em`, bật bắt buộc `font-variant-numeric: lining-nums` để chữ số tiếng Việt không bị lệch dòng baseline.
2. **Body Sans (`--font-sans` — `'Be Vietnam Pro'`):**
   - Chữ giao diện, đoạn văn `.prose-article`, nút bấm, nhãn điều hướng.
   - Bật `font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11'` giúp dấu thanh tiếng Việt thoáng và rõ trên cả macOS lẫn iOS/Android.
   - Chiều rộng dòng đọc tối ưu cho bài viết dài: `max-width: 68ch` (`max-w-3xl`), `line-height: 1.78`.
3. **Monospace (`--font-mono` — `'JetBrains Mono'` kèm fallback `'Be Vietnam Pro'`):**
   - Chỉ dùng cho chữ số thứ tự (`01`), ngày giờ (`14/10/2026`, `11:00`), mốc thời gian `[mm:ss]`, phím tắt `⌘K`, khối mã `.prose-article pre` và đường dẫn URL/ `.md`.
   - **Không gắn `font-mono` hay `.eyebrow-index` lên nhãn từ ngữ tiếng Việt** (vì `JetBrains Mono` tự host chỉ chứa dải ký tự `latin`); các nhãn phụ chữ in hoa tiếng Việt luôn dùng `--font-sans` (`font-semibold uppercase tracking-wider`).

---

## 3. Ngôn ngữ Biểu tượng (Iconography — Zero Emoji UI)

- **Chuẩn duy nhất:** Vector SVG nét mảnh thông qua `src/components/Icon.astro` (`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `aria-hidden="true"`).
- **Cấm dùng Emoji làm icon giao diện:** Không chèn `⚡`, `🧬`, `📋`, `🧹`, `🎬`, `✨`, `🪄`, `🔗`… vào nút bấm, tab, chip trạng thái, thẻ sản phẩm hay thanh công cụ. Nếu dữ liệu đầu vào có sẵn emoji ở đầu nhãn, dùng hàm lọc ký tự đầu trước khi hiển thị UI.

---

## 4. Kiến trúc Khung Giao diện & Bố cục Đáp ứng (Responsive Shells)

1. **Trang chủ `/` (Dual-Shell Architecture):**
   - `< 1024px` (`lg:hidden`): Hiển thị `src/components/MobileShell.astro` — bố cục iOS Springboard gọn gàng kết hợp thẻ định vị giá trị B2B + CTA Zalo trực diện ngay màn hình đầu tiên, lưới ứng dụng 8 ô và thanh dock cố định dưới đáy (tôn trọng `env(safe-area-inset-bottom)`).
   - `>= 1024px` (`hidden lg:block`): Hiển thị `src/components/DesktopShell.astro` — không gian làm việc macOS Ivory Atelier với cửa sổ trung tâm (`.desktop-window`, **không** gắn `role="dialog"` vì không khóa focus), thanh Dock 7 chuyên mục thống nhất có tooltip nổi GPU (`transform` + `opacity`, không đổi `width` gây reflow), và cụm 4 lối tắt tác vụ nhanh bên trái (`.desktop-launcher`).
2. **Các trang con (`/[section]`, `/bai-viet/[slug]`, `/tai-video`, `/xray/[id]`, `/quyen-rieng-tu`):**
   - Hiển thị thanh điều hướng dính `.site-nav` ở đầu trang.
   - Từ `768px`–`1023px` (`md`), dải liên kết điều hướng giữ riêng hàng thứ hai (`w-full order-3`) với mặt nạ mờ hai đầu theo vị trí cuộn ngang (`data-scroll-pos="start|mid|end"`). Từ `1024px` (`lg`) trở lên mới gộp chung một hàng (`lg:order-none lg:w-auto`).
3. **Mục tiêu Chạm & Tương tác (`44×44px` Touch Targets):**
   - Mọi nút bấm, liên kết điều hướng, ô radio `.dl-preset-pill`, ô kiểm checkbox, nút đóng/mở menu và liên kết danh sách trên di động (`< 768px`) bắt buộc đạt diện tích chạm tối thiểu `44×44px` (`min-h-11` / `2.75rem`).
   - Với `<input type="checkbox">` và `<input type="radio">`, phủ thẻ `<input>` vô hình (`opacity: 0; inset: 0; width: 100%; height: 100%`) lên toàn bộ vùng chạm `>=44×44px` và hiển thị vòng `:focus-visible` bằng `:has(input:focus-visible)` hoặc `peer-focus-visible`.

---

## 5. Chuẩn Chuyển động & Bề mặt Đa phương tiện (`src/styles/motion.css`)

- **Thời lượng tương tác vi mô (Micro-interactions):** `150ms – 250ms` với đường cong `var(--os-ease)` (`cubic-bezier(0.22, 1, 0.36, 1)`). Không đặt `transition` trên hover nút hoặc thẻ vượt quá `300ms`.
- **Chỉ biến đổi thuộc tính GPU:** Ưu tiên `transform` và `opacity`; tránh hoạt ảnh trên `width`, `height`, `top`, `left` gây tính toán lại bố cục.
- **Tôn trọng `prefers-reduced-motion: reduce`:** Mọi hiệu ứng hạt nền, con trỏ hào quang, mở cửa sổ và chuyển trang tự động tắt hoặc giảm về tức thời khi người dùng bật giảm chuyển động trên hệ điều hành hoặc trong menu **Hiệu ứng**.
- **Xử lý Media R2 an toàn (Zero Broken Image):** Các thành phần hiển thị ảnh/video từ R2 (`ItemCard`, `SectionBody`, `DesktopShell`, `MobileShell`, `bai-viet/[slug]`) kiểm tra `env.MEDIA.head(key)` ngay lúc SSR để hiển thị khung `.media-fallback` tinh tế khi thiếu tệp cục bộ, kết hợp bộ lắng nghe lỗi ảnh giai đoạn capture trong `src/scripts/analytics-beacon.ts` (không dùng thuộc tính inline `onerror=`).
