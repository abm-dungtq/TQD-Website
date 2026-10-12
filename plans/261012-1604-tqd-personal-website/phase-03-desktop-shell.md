---
phase: 3
title: "Lớp giao diện desktop"
status: pending
dependsOn: [2]
---

# Phase 3 — Lớp giao diện "desktop"

> Trước khi chạy Verify: đọc mục Constraints trong `plan.md` (hook chặn lệnh shell có chữ chỉ thư mục build; chạy các kiểm tra qua file `scripts/verify/*.mjs`).

Ý tưởng lấy từ Zuey OS của zuey.me (thanh menu, dock, cửa sổ ứng dụng). Viết mới hoàn toàn bằng Astro + TypeScript thuần (không React), KHÔNG mở hay chép file nào từ repo zuey-me.

Nguyên tắc: lớp desktop là phần tăng cường. Không có JS, hoặc màn hình < 1024px, trang chủ vẫn là bản Phase 2 (hồ sơ + lưới link). Nếu lớp này làm hỏng bất kỳ Verify nào ở Phase 5, có thể tắt bằng cách bỏ `<DesktopShell />` khỏi `index.astro` mà site vẫn đủ nội dung.

## Task 3.1 — Icon nội bộ

- Target files: `src/components/Icon.astro` (mới).
- Steps: nhận `name: 'user'|'box'|'presentation'|'film'|'book'|'chart'|'mail'` và `size` (mặc định 24); trả SVG nét 1.75px, `stroke="currentColor"`, `fill="none"`, `aria-hidden="true"`. Tự vẽ path đơn giản cho 7 icon (hình người, hộp, bảng trình chiếu, cuộn phim, sách mở, biểu đồ cột, phong bì). Không dùng emoji.
- Verify: no verification needed.

## Task 3.2 — Khung desktop (HTML tĩnh, ẩn khi thiếu điều kiện)

- Target files: `src/components/DesktopShell.astro` (mới), `src/pages/index.astro`.
- Steps:
  1. `DesktopShell` render một `<div id="desktop" class="hidden" data-desktop>` gồm:
     - Thanh menu trên cùng cao 32px: trái ảnh chân dung tròn 20px (`<Image src={person.portrait} width={40} height={40} alt="" />`, cắt tròn bằng CSS) + "DũngTQ", phải đồng hồ `<time data-clock>` (giờ Asia/Saigon, HH:mm).
     - Vùng nền: lưới icon dọc bên trái, mỗi mục là `<button data-open="{id}">` có `Icon` + title.
     - Với MỖI mục trong `sections`, một `<section role="dialog" aria-label="{title}" data-window="{id}" hidden>` gồm thanh tiêu đề (3 chấm tròn trang trí, title, nút đóng `<button data-close aria-label="Đóng {title}">`, link "Mở trang riêng" tới `/{id}`) và thân cuộn được chứa `<SectionBody id={id} />`.
     - Dock dưới cùng giữa màn hình: 7 `<button data-open="{id}" aria-label="{title}">` với `Icon`, tooltip CSS hiện title khi hover/focus.
  2. Style: nền `paper` có hoạ tiết chấm mảnh bằng `radial-gradient` (màu `line`), cửa sổ nền `panel`, viền `line`, bo góc 12px, bóng mờ nhẹ; cửa sổ rộng `min(860px, 90vw)`, cao `min(640px, 80vh)`.
  3. Trong `index.astro`: thêm `<DesktopShell />` trước nội dung Phase 2, và bọc nội dung Phase 2 trong `<div data-fallback>`.
- Verify: no verification needed (Task 3.4 kiểm tra).

## Task 3.3 — Script điều khiển cửa sổ

- Target files: `src/scripts/desktop.ts` (mới), import trong `DesktopShell.astro` bằng `<script>import '../scripts/desktop.ts';</script>`.
- Steps:
  1. Bật desktop chỉ khi `matchMedia('(min-width: 1024px)').matches`: bỏ class `hidden` ở `[data-desktop]`, thêm `hidden` vào `[data-fallback]`. Nếu kích thước đổi qua ngưỡng, đảo lại.
  2. `open(id)`: bỏ `hidden` của `[data-window=id]`, đặt `z-index` = bộ đếm tăng dần, focus nút đóng, đặt `location.hash = id` bằng `history.replaceState`.
  3. `close(id)`: thêm `hidden`, trả focus về nút đã mở nó; Escape đóng cửa sổ trên cùng.
  4. Kéo cửa sổ bằng thanh tiêu đề (Pointer Events, giới hạn trong viewport). Khi `prefers-reduced-motion: reduce` thì không có hiệu ứng mở.
  5. Click vào cửa sổ đưa nó lên trên cùng.
  6. Khi tải trang có hash là một `SectionId` hợp lệ: mở cửa sổ đó; không có hash: mở `ho-so`.
  7. Đồng hồ: cập nhật `[data-clock]` mỗi 30 giây bằng `Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Saigon' })`.
  8. Không dùng `any`; dùng `querySelector<HTMLElement>`.
- Verify: `npm run build` exit 0 (gồm `astro check` không lỗi type).

## Task 3.4 — Kiểm tra trên trình duyệt và commit

- Steps:
  1. `npm run preview -- --port 4329` chạy nền (ghi lại PID; dừng ở bước 4).
  2. Dùng công cụ trình duyệt có sẵn (agent-browser hoặc Playwright) mở `http://localhost:4329/` ở 1440×900: chụp ảnh; bấm icon dock "Sản phẩm"; xác nhận phần tử `[data-window="san-pham"]` không còn thuộc tính `hidden` và có chữ `Viết Pro`; nhấn Escape; xác nhận lại có `hidden`.
  3. Mở cùng URL ở 390×844: xác nhận `[data-fallback]` hiển thị và `[data-desktop]` có class `hidden`.
  4. Dừng tiến trình preview đã chạy ở bước 1.
  5. `git add -A`; `git commit -m "feat: add desktop shell for home page"`.
- Verify: cả 3 xác nhận ở bước 2–3 đúng (ghi kết quả từng xác nhận dạng `PASS/FAIL` vào báo cáo phase).

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
