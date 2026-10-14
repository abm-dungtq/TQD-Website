# Báo cáo triển khai cải thiện UI/UX (Checkpoint 2) — TQD-Website

- **Ngày thực hiện:** 2026-10-14 (Múi giờ `Asia/Saigon`)
- **Thư mục làm việc:** `D:\TQD\TQD-Website`
- **Báo cáo đề xuất gốc (Checkpoint 1):** `D:\TQD\TQD-Website\plans\reports\frontend-design-261014-1442-ui-audit-proposal.md`
- **Thư mục ảnh chụp đối chiếu:**
  - Trước khi sửa (`before`): `C:\Users\ABM\.cache\tqd-verify\ui-audit\before\`
  - Sau khi sửa (`after`): `C:\Users\ABM\.cache\tqd-verify\ui-audit\after\`

---

## 1. Tổng hợp quyết định từ Advisor: Hạng mục triển khai vs. Hạng mục từ chối

### 1.1. Các hạng mục ĐÃ TRIỂN KHAI (Approved)

| Mã hạng mục | Nội dung triển khai | Ghi chú điều chỉnh theo Advisor |
|---|---|---|
| **MUST-1** | Fix độ tương phản `.tiktok-title` trên nền scrim tối (`color: var(--color-paper)`) và đồng bộ cấu trúc thẻ của nhánh có `tiktokId` trên `/video-ai` với `ItemCard` (`.lux-card`, `date`, `.display`, `summary`, `.lux-chip`). | Giữ nguyên hệ màu token sẵn có, không thêm màu mới. |
| **MUST-2** | Dịch lưới `.m-home` trên mobile/tablet (`padding-bottom: calc(6.25rem + env(safe-area-inset-bottom))`, giảm nhịp dọc `.m-status` / `.m-feature` / `.m-profile` / `.m-app`) để nút nổi `.chat-fab` không đè lên ô `Video AI` hoặc nhãn ở `375×812` và `768×1024`. | Đã kiểm chứng thêm: khi mở `.m-sheet` (`z-index: 1100`, nền `var(--color-panel)` đặc) hoặc `.chat-panel`, `mobile-shell.ts` đã gán `chatButton.inert = true` và sheet che hoàn toàn `.chat-fab` (`z-index: 1000`). |
| **MUST-3** | Nâng diện tích vùng chạm (touch target) đạt tối thiểu `44×44px` trên cảm ứng và `≥ 40px` trên desktop cho: thẻ Email/Zalo (`SectionBody.astro`), link phụ trên `ItemCard.astro`, link `← Tất cả bài viết` (`[slug].astro`), nút `.desktop-feature-sound` / `.desktop-feature-more` (`FeaturedVideo.astro`), nút `.chat-icon-btn` / `.chat-zalo` / `.chat-retry` (`ChatPanel.astro`), và mở rộng vùng bấm vô hình bằng `::after` cho `.mascot-tip-close` (`Mascot.astro`) cùng 3 nút đèn giao thông `.desktop-light` (`DesktopShell.astro`). | Giữ nguyên kích thước hiển thị (visual size) của `.desktop-light` (`13×13px`) và `.mascot-tip-close` (`28×28px`), chỉ mở rộng hit-area qua pseudo-element `::after` có `inset` âm + nâng `gap` của `.desktop-lights` lên `0.5rem`. |
| **SHOULD-1** | Gỡ toàn bộ khối `<header>` chứa `<h1>` bên trong `.m-sheet` (`(h1?.closest('header') ?? h1)?.remove()`) để tránh lặp tiêu đề Mục + số thứ tự (`01 — DŨNGTQ`...) ngay dưới thanh tiêu đề sheet. | Không thêm trường `s.short` vào `site.json`. Đã kiểm chứng `tiktok.ts` dùng event delegation ở cấp `document` (`document.addEventListener('click', ...)`), nên các facade `.tiktok-facade[data-tiktok-id]` nạp động vào `.m-sheet` hoạt động ngay không cần hàm init riêng. |
| **SHOULD-2** | Đưa `.site-nav` lên cùng một hàng với logo và nút `Tìm Ctrl K` từ breakpoint `md:` (`768px`) trở lên (`md:order-none md:w-auto`, `gap-x-6 lg:gap-x-8`); thêm đệm cuối và tự động cuộn ngang mục `[aria-current="page"]` vào vùng nhìn trên màn hình `< 768px`. | Tiết kiệm `52px` chiều cao header ở `768×1024` (giảm từ `129px` xuống `77px`) mà không tràn ngang. |
| **SHOULD-3** | Gỡ viền `:focus-visible` tự bật trên nút Đóng (`×`) / `Thử lại` khi vừa mở `.desktop-window`, `.m-sheet`, `.chat-panel` bằng cách thêm `tabindex="-1"` và `outline: none` lên phần tử `role="dialog"` và chuyển `.focus()` ban đầu về container; bổ sung nâng cửa sổ (`raise`) khi `focusin` bên trong `.desktop-window` và điều hướng bàn phím (`Tab` / `Enter` / `Space` + `inert` cho nội dung con) trong chế độ Exposé (`expose.ts`). | Giữ nguyên vòng `:focus-visible` rõ nét khi người dùng thực sự nhấn phím `Tab`. |
| **SHOULD-4** | Bổ sung `text-wrap: balance` cho `.display`, `.prose-article h2`, `.prose-article h3` và `text-wrap: pretty` cho `.prose-article`; giới hạn `.cmdk-option span:first-child` tối đa 2 dòng (`-webkit-line-clamp: 2`) và tăng nhẹ `max-height: min(560px, 82vh)` cho `.cmdk`. | Khắc phục triệt để chữ mồôi `"kiện"` trên bài viết Viết Pro và dòng bị cắt nửa ở đáy hộp thoại `⌘K`. |
| **SHOULD-5** | Mở rộng vùng bấm toàn thẻ (`.lux-card relative`) trên danh sách `/bai-viet` bằng stretched link (`after:absolute after:inset-0`), đổi tag sang `.lux-chip` đồng bộ với `/san-pham` và `/video-ai`, đồng thời áp dụng hiệu ứng nổi nhẹ khi hover cho cả thẻ dùng stretched link (`src/styles/global.css`). | Giữ đúng 1 phần tử `<a>` duy nhất mỗi thẻ bài viết để trình đọc màn hình không đọc lặp liên kết. |
| **COULD-2** | Thêm bóng cuộn ấm (warm scroll-shadow) thuần CSS bằng `background-attachment: local, local, scroll, scroll` trên `.desktop-body` (`DesktopShell.astro`). | Chỉ sử dụng hai biến màu hiện có `var(--color-panel)` và `var(--color-champagne)`. |

### 1.2. Các hạng mục TỪ CHỐI / KHÔNG TRIỂN KHAI (Rejected by Advisor)

| Mã hạng mục | Quyết định của Advisor & Lý do |
|---|---|
| **MUST-4** | **Từ chối cả 2 phần:** (1) Giữ nguyên bố cục chia đôi 50/50 giữa cửa sổ `Hồ sơ` và khung video nổi bật ở `≥ 1440px` vì đây là chủ đích thiết kế của trang chủ desktop; (2) Giữ nguyên vị trí `.chat-panel` trên desktop vì đây là lớp phủ tạm thời (transient overlay) do người dùng chủ động bật và có thể kéo/đóng bất kỳ lúc nào. |
| **MUST-5** | **Từ chối sửa `src/scripts/wallpaper.ts`:** Không sửa mã nguồn `wallpaper.ts` vì bài kiểm thử đơn vị `tests/wallpaper.test.ts` kiểm tra hành vi gắn `src` trực tiếp. Thay vào đó, nạp tệp `silk-wallpaper.mp4` vào R2 cục bộ (`wrangler r2 object put ... --local`) để môi trường dev trả về HTTP `200 OK`. |
| **COULD-1** | **Từ chối:** Không đụng vào `h1.sr-only` hay thuộc tính `data-mascot` (tránh xung đột selector giữa `<html data-mascot="on|off">` và `<button data-mascot>`). |
| **Finding 4.1.2** | **Từ chối:** Giữ nguyên `.site-header` và `.site-footer` bao quanh `.m-home` trên mobile để bảo toàn khả năng điều hướng khi tắt JavaScript (no-JS) và cấu trúc liên kết nội bộ cho SEO. |
| **Astro Dev Toolbar** | **Bỏ qua:** Thanh công cụ tối màu ở đáy ảnh chụp chỉ xuất hiện trong môi trường `astro dev`, không tồn tại trên bản build production. |

---

## 2. Danh sách tệp mã nguồn đã chỉnh sửa (15 tệp)

1. **[src/styles/global.css](file:///D:/TQD/TQD-Website/src/styles/global.css)**
   - **Dòng `66–70`:** Bổ sung `text-wrap: balance` cho `.display`.
   - **Dòng `88–94`:** Mở rộng selector hover của `.lux-card` (`a.lux-card:hover, .lux-card:has(> h3 > a:hover), .lux-card:has(> dd > a:hover)`) để các thẻ dùng stretched link trên `/bai-viet` và `/lien-he` có cùng hiệu ứng nâng nhẹ và đổi viền champagne.
   - **Dòng `128–137`:** Thêm `text-wrap: pretty` cho `.prose-article` và `text-wrap: balance` cho `.prose-article h2, .prose-article h3`.
   - **Dòng `159–166`:** Đổi màu `.tiktok-title` bên trong `.tiktok-meta` (trên nền gradient tối) thành `color: var(--color-paper)`.

2. **[src/components/SectionBody.astro](file:///D:/TQD/TQD-Website/src/components/SectionBody.astro)**
   - **Dòng `67–87`:** Đồng bộ nhánh `v.tiktokId` của mục `video-ai` sang cấu trúc `.lux-card flex flex-col gap-3 p-5` gồm ngày tháng, tiêu đề `.display text-xl`, mô tả `summary`, trình phát `TikTokPlayer` và danh sách tag `.lux-chip`.
   - **Dòng `95–121`:** Thêm `relative` lên `li.lux-card`, `after:absolute after:inset-0` lên liên kết tiêu đề bài viết và chuyển tag sang `.lux-chip` cho mục `bai-viet`.
   - **Dòng `132–158`:** Thêm `relative` lên thẻ Email/Zalo và `inline-flex min-h-11 items-center after:absolute after:inset-0` lên liên kết bên trong mục `lien-he`.

3. **[src/components/ItemCard.astro](file:///D:/TQD/TQD-Website/src/components/ItemCard.astro)**
   - **Dòng `36–51`:** Nâng vùng chạm các liên kết hành động (`GitHub →`, `Bài giới thiệu →`, `Xem video →`) với `inline-flex min-h-11 items-center lg:min-h-10`.

4. **[src/pages/bai-viet/[slug].astro](file:///D:/TQD/TQD-Website/src/pages/bai-viet/[slug].astro)**
   - **Dòng `35–42`:** Nâng vùng chạm liên kết quay lại `← Tất cả bài viết` với `-ml-2 inline-flex min-h-11 items-center px-2 lg:min-h-10`.

5. **[src/components/FeaturedVideo.astro](file:///D:/TQD/TQD-Website/src/components/FeaturedVideo.astro)**
   - **Dòng `79–96`:** Thêm `min-height: 2.5rem` (`40px`) cho `.desktop-feature-sound` và `inline-flex; align-items: center; min-height: 2.5rem` cho `.desktop-feature-more`.

6. **[src/components/Mascot.astro](file:///D:/TQD/TQD-Website/src/components/Mascot.astro)**
   - **Dòng `128–143`:** Giữ nguyên kích thước hiển thị `1.75rem × 1.75rem` (`28×28px`) của `.mascot-tip-close`, thêm `position: relative` và `.mascot-tip-close::after { content: ''; position: absolute; inset: -0.375rem; }` để vùng chạm thực tế đạt `40×40px`.

7. **[src/components/ChatPanel.astro](file:///D:/TQD/TQD-Website/src/components/ChatPanel.astro)**
   - **Dòng `16`:** Thêm `tabindex="-1"` cho `<section id="chat-panel" ...>`.
   - **Dòng `71–85`:** Thêm `outline: none` cho `.chat-panel`.
   - **Dòng `148–160`:** Tăng `.chat-icon-btn` lên `width: 2.75rem; height: 2.75rem` (`44×44px`) trên cảm ứng và `2.5rem × 2.5rem` (`40×40px`) ở `@media (width >= 64rem)`.
   - **Dòng `298–313`:** Thêm `display: inline-flex; align-items: center; justify-content: center; min-height: 2.75rem` (và `2.5rem` ở `>= 64rem`) cho `.chat-zalo, .chat-retry`.

8. **[src/scripts/chat-panel.ts](file:///D:/TQD/TQD-Website/src/scripts/chat-panel.ts)**
   - **Dòng `119–130`:** Khi agent đang ngoại tuyến (`offline`), chuyển focus về `panel.focus({ preventScroll: true })` thay vì `retryBtn?.focus(...)`.

9. **[src/components/MobileShell.astro](file:///D:/TQD/TQD-Website/src/components/MobileShell.astro)**
   - **Dòng `64`:** Thêm `tabindex="-1"` cho `<section class="m-sheet" ...>`.
   - **Dòng `82–158`:** Tăng đệm đáy `.m-home` lên `calc(6.25rem + env(safe-area-inset-bottom))` (và `5.75rem` trên tablet `>= 48rem`), tinh chỉnh khoảng cách dọc `.m-status`, `.m-feature`, `.m-profile`, `.m-app` để toàn bộ 6 biểu tượng ứng dụng nằm gọn phía trên `.chat-fab`.
   - **Dòng `176–191`:** Thêm `outline: none` cho `.m-sheet`.

10. **[src/scripts/mobile-shell.ts](file:///D:/TQD/TQD-Website/src/scripts/mobile-shell.ts)**
    - **Dòng `42–53`:** Thay `doc.querySelector('main h1')?.remove()` bằng `const h1 = doc.querySelector('main h1'); (h1?.closest('header') ?? h1)?.remove();` để gỡ trọn khối `<header>` lặp tiêu đề.
    - **Dòng `74`:** Chuyển focus khi mở sheet sang `sheet.focus({ preventScroll: true })` thay vì `closeBtn.focus(...)`.

11. **[src/layouts/BaseLayout.astro](file:///D:/TQD/TQD-Website/src/layouts/BaseLayout.astro)**
    - **Dòng `67–76`:** Cập nhật `<nav class="site-nav -mx-1 order-3 flex w-full items-center gap-x-6 overflow-x-auto px-1 text-sm whitespace-nowrap md:order-none md:mx-0 md:w-auto md:overflow-visible md:px-0 lg:gap-x-8">`.
    - **Dòng `114–129`:** Thêm script tự động cuộn mục `[aria-current="page"]` vào giữa thanh `.site-nav` trên màn hình `< 768px` và quy tắc `@media (width < 48rem)` thêm đệm phải `1.5rem` cho mục cuối.

12. **[src/components/DesktopShell.astro](file:///D:/TQD/TQD-Website/src/components/DesktopShell.astro)**
    - **Dòng `60–67`:** Thêm `tabindex="-1"` cho `.desktop-window`.
    - **Dòng `189–202`:** Thêm `outline: none` cho `.desktop-window`.
    - **Dòng `236–263`:** Tăng `gap` của `.desktop-lights` lên `0.5rem`, giữ kích thước hiển thị `.desktop-light` ở `0.8125rem` (`13px`) và mở rộng vùng bấm bằng `.desktop-light::after { content: ''; position: absolute; inset: -0.625rem; }`.
    - **Dòng `278–299`:** Bổ sung hiệu ứng bóng cuộn ấm (warm scroll-shadow) thuần CSS trên `.desktop-body` bằng `var(--color-panel)` và `var(--color-champagne)`.
    - **Dòng `432–441`:** Thêm kiểu hiển thị `:focus-visible` màu `var(--color-champagne)` cho `.desktop-window` khi duyệt bằng bàn phím trong chế độ Exposé.

13. **[src/scripts/desktop.ts](file:///D:/TQD/TQD-Website/src/scripts/desktop.ts)**
    - **Dòng `141–164`:** Khi mở cửa sổ, gọi `win.focus({ preventScroll: true })` thay vì focus vào nút `.desktop-light.is-close`.
    - **Dòng `242–245`:** Thêm sự kiện `win.addEventListener('focusin', () => raise(win))` để tự động đưa cửa sổ lên trên cùng khi người dùng `Tab` vào phần tử bên trong.

14. **[src/scripts/expose.ts](file:///D:/TQD/TQD-Website/src/scripts/expose.ts)**
    - **Dòng `42–69`:** Khi bật Exposé, đặt `tabIndex = 0` cho các cửa sổ đang mở, tạm khóa `inert = true` trên các phần tử con trong cửa sổ để phím `Tab` di chuyển trực tiếp giữa các thẻ cửa sổ, focus vào cửa sổ đầu tiên và khôi phục nguyên trạng khi thoát Exposé.
    - **Dòng `71–85`:** Hỗ trợ phím `Enter` và `Space` trên cửa sổ đang được focus trong Exposé để chọn cửa sổ đó và đóng Exposé.

15. **[src/components/CommandPalette.astro](file:///D:/TQD/TQD-Website/src/components/CommandPalette.astro)**
    - **Dòng `75–89`:** Tăng nhẹ `max-height: min(560px, 82vh)` và điều chỉnh `margin: 10vh auto auto` cho `.cmdk`.
    - **Dòng `133–149`:** Giới hạn `.cmdk-option span:first-child` tối đa 2 dòng (`display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden`) để không có dòng nào bị cắt nửa chữ ở đáy danh sách.

---

## 3. Đối chiếu trực quan Trước / Sau (`before` vs. `after`)

1. **Trang chủ Mobile & Tablet (`home/375x812.png`, `home/768x1024.png`):**
   - **Trước (`before\home\375x812.png`):** Nút nổi `.chat-fab` ở góc dưới phải đè trực tiếp lên nhãn `Video AI` của lưới biểu tượng `.m-grid`; ở `768×1024`, thanh `.site-nav` rớt xuống dòng thứ 2 làm `.site-header` cao `129px`.
   - **Sau (`after\home\375x812.png`, `after\home\768x1024.png`):** Toàn bộ 6 biểu tượng ứng dụng (`.m-grid`) nằm cao hơn hẳn `.chat-fab`, không còn bất kỳ giao cắt nào. Ở `768×1024`, `.site-header` gọn trên 1 hàng duy nhất (`77px`).
2. **Trang chủ Desktop (`home/1440x900.png`):**
   - **Trước (`before\home\1440x900.png`):** Nút đỏ Đóng cửa sổ (`.desktop-light.is-close`) tự bật vòng `:focus-visible` và dấu `×` ngay khi vào trang; đáy cửa sổ `Hồ sơ` cắt ngang chữ không có gợi ý còn nội dung bên dưới; video nền báo lỗi `404` trên môi trường dev.
   - **Sau (`after\home\1440x900.png`):** Ba nút đèn giao thông ở góc trái trên hiển thị sạch sẽ, không còn vòng focus tự bật; cạnh dưới `.desktop-body` có lớp bóng cuộn ấm nhẹ bằng màu champagne; video nền `silk-wallpaper.mp4` đã được nạp vào R2 cục bộ (`HTTP 200`).
3. **Trang Video AI (`video-ai/375x812.png`, `video-ai/1440x900.png`):**
   - **Trước (`before\video-ai\375x812.png`):** Trên màn hình `375px`, thanh `.site-nav` luôn cuộn ở đầu khiến mục đang xem (`Video AI`) và các mục cuối (`Bài viết`, `Liên hệ`) bị khuất.
   - **Sau (`after\video-ai\375x812.png`):** Thanh `.site-nav` tự động cuộn ngang đưa mục đang kích hoạt (`Video AI`) vào giữa tầm nhìn, hiển thị rõ cả `Bài viết` và `Liên hệ`. Khi có mục gắn `tiktokId`, thẻ hiển thị đầy đủ cấu trúc `.lux-card` và chữ `.tiktok-title` sáng rõ (`var(--color-paper)`) trên nền scrim tối.
4. **Trang Danh sách & Chi tiết Bài viết (`bai-viet/1440x900.png`, `article/1440x900.png`):**
   - **Trước (`before\bai-viet\1440x900.png`, `before\article\1440x900.png`):** Thẻ bài viết trên `/bai-viet` chỉ bấm được vào dòng tiêu đề, tag hiển thị dạng `#tag` rời rạc; tiêu đề `<h1>` bài Viết Pro bị rớt chữ mồ côi `"kiện"` sang dòng thứ 4.
   - **Sau (`after\bai-viet\1440x900.png`, `after\article\1440x900.png`):** Toàn bộ thẻ bài viết trên `/bai-viet` đều bấm được và nổi nhẹ khi hover, các tag hiển thị dạng pill `.lux-chip` đồng bộ; tiêu đề `<h1>` bài Viết Pro cân đối gọn trong 3 dòng nhờ `text-wrap: balance`, không còn chữ mồ côi.
5. **Trang Liên hệ (`lien-he/375x812.png`, `lien-he/1440x900.png`):**
   - **Sau (`after\lien-he\1440x900.png`):** Toàn bộ diện tích hai thẻ lớn `Email` và `Zalo` đều nhận tương tác click/tap (`≥ 44px` chiều cao liên kết + stretched link `after:inset-0`).
6. **Các lớp phủ Overlays & Chat Panel (`overlays/*`, `chat-panel/*`):**
   - **Mobile Sheet (`after\overlays\375x812-sheet-san-pham.png`, `after\overlays\768x1024-sheet-ho-so.png`):** Không còn khối tiêu đề lặp (`02 — DŨNGTQ / Sản phẩm`, `01 — DŨNGTQ / Hồ sơ`) bên trong thân sheet; nội dung đi thẳng vào thẻ `Viết Pro` hoặc ảnh chân dung `Trịnh Quang Dũng`; nút `×` không còn vòng focus tự bật.
   - **Command Palette (`after\overlays\1440x900-cmdk.png`, `after\overlays\375x812-cmdk.png`):** Toàn bộ 6 mục điều hướng và 2 bài viết hiển thị trọn vẹn trong khung, không còn dòng chữ nào bị cắt ngang ở mép dưới.
   - **Exposé (`after\overlays\1440x900-expose.png`):** Các cửa sổ đang mở nhận `tabIndex = 0`, hỗ trợ duyệt bằng `Tab` và chọn bằng `Enter`/`Space`.
   - **Chat Panel (`after\chat-panel\375x812.png`, `768x1024.png`, `1440x900.png`):** Nút đóng/tạo mới đạt chuẩn `44×44px` trên cảm ứng (`40×40px` trên desktop), nút `Nhắn Zalo` / `Thử lại` cao `44px`, và nút `Thử lại` không còn tự bật vòng focus khi mở panel ở trạng thái ngoại tuyến.

---

## 4. Kết quả kiểm tra tự động (`astro check`, `vitest`, `render-check.mjs`)

- **`npx astro check`:** `0 errors, 0 warnings, 0 hints` (trên tổng số 133 tệp).
- **`npx vitest run`:** `15 passed (15)` tệp kiểm thử, `83 passed (83)` bài kiểm thử đơn vị (`chat.test.ts`, `tiktok.test.ts`, `chat-render.test.ts`, `content.test.ts`, `articles.test.ts`, `media.test.ts`, v.v.).
- **`render-check.mjs` trên toàn bộ 8 đường dẫn × 3 viewport (`375×812`, `768×1024`, `1440×900`):**
  - `/` (`home`): `0 errors, 0 warnings`
  - `/ho-so`: `0 errors, 0 warnings`
  - `/san-pham`: `0 errors, 0 warnings`
  - `/thu-vien`: `0 errors, 0 warnings`
  - `/video-ai`: `0 errors, 0 warnings`
  - `/bai-viet`: `0 errors, 0 warnings`
  - `/bai-viet/viet-pro-skill-viet-tieng-viet-cho-ai` (`article`): `0 errors, 0 warnings`
  - `/lien-he`: `0 errors, 0 warnings`
- **Trạng thái máy chủ dev (`npx astro dev status`):** Đã dừng hoàn toàn sau khi kiểm tra xong.

---

## 5. Các hạng mục tồn đọng / Hoãn lại (Deferred Items)

- Không có hạng mục nào bị hoãn ngoài các đề xuất đã được Advisor chủ động từ chối để bảo toàn thiết kế gốc (`MUST-4`, `MUST-5` giữ nguyên mã nguồn chỉ nạp R2 cục bộ, `COULD-1`, và `Finding 4.1.2`).
