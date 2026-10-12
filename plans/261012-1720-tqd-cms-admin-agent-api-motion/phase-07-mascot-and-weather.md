---
phase: 7
title: "Linh vật và thời tiết"
status: completed
priority: P3
effort: 8h
dependencies: [6]
---

# Phase 7 — Linh vật và thời tiết

> Đọc mục Constraints trong `plan.md` trước khi bắt đầu. Phase này không được chặn các phase trước: nếu kẹt, các phase 1–6 vẫn là bản phát hành hợp lệ.

## Kết quả (2026-10-12)

- Ảnh linh vật do Codex CLI (gọi qua Paseo) sinh, vì máy không có key Gemini/OpenRouter/MiniMax. Người dùng đã duyệt bộ 6 tư thế. Ảnh gốc nằm trong `.secrets/mascot-raw/` (không commit).
- Production 619eed73: `mascot-weather-check.mjs` và `motion-check.mjs` (trong `C:/Users/ABM/.cache/tqd-verify/`) đều ALL PASS. Lighthouse mobile 2 lần: `/` 0.98/1.00, bài viết 0.99/1.00.
- Khác plan: nhịp "thở" khi đứng yên chạy trên ảnh, không chạy trên nút, để vùng bấm không rung. Mẹo ⌘K ghi `Ctrl K (⌘K trên Mac)`. Kéo cửa sổ chưa bị gắn chỉ bắt đầu sau 4 px.

## Goal

Trên desktop có linh vật DũngTQ đổi tư thế theo hoạt động và thỉnh thoảng đi dạo dọc đáy màn hình; menubar hiện thời tiết Hà Nội và nền có mưa/tuyết bằng canvas khi trời mưa/tuyết. Cả hai tắt được trong menu `Giao diện`, đứng yên khi reduced motion, dừng khi tab ẩn.

## Thông số

| Mục | Thông số |
|---|---|
| Tư thế linh vật | 6: `idle`, `wave`, `think`, `type`, `point`, `sleep`; ảnh `public/mascot/<pose>.webp`, 256×256, nền trong suốt |
| Đổi tư thế | 2 lớp `<img>` chồng nhau, crossfade 200 ms |
| Quy tắc tư thế | tải trang → `wave` 2 s → `idle`; bảng ⌘K mở → `think`; đang kéo cửa sổ → `type`; con trỏ trên dock → `point`; 60 s không tương tác → `sleep`; có tương tác → `idle` |
| Đi dạo | mỗi 14–26 s (ngẫu nhiên) dịch ngang tới vị trí ngẫu nhiên trong khung nhìn, 2.4 s `--os-ease`, lật ảnh theo hướng đi; không đi khi đang `sleep` |
| Thời tiết | Open-Meteo `https://api.open-meteo.com/v1/forecast?latitude=21.0285&longitude=105.8542&current=temperature_2m,weather_code,is_day&timezone=Asia%2FBangkok`, cache `sessionStorage` 30 phút |
| Mã thời tiết | mưa: 51–67, 80–82, 95–99; tuyết: 71–77, 85–86; còn lại: không hiệu ứng |
| Canvas | mưa ≤ 180 hạt, tuyết ≤ 110 hạt; `devicePixelRatio` tối đa 1.5; `requestAnimationFrame`; dừng khi `document.hidden`; `pointer-events: none`; nằm trên hình nền, dưới cửa sổ |
| Thử nghiệm | tham số URL `?weather=rain\|snow\|clear` ghi đè mã thời tiết cho hiệu ứng |

## Files to Create / Modify

- Create: `public/mascot/*.webp` (6 file), `scripts/make-mascot.mjs`, `scripts/verify/mascot-files.mjs`, `src/components/Mascot.astro`, `src/scripts/mascot.ts`, `src/scripts/weather.ts`, `src/lib/weather-code.ts`, `src/lib/weather-code.test.ts`, `C:/Users/ABM/.cache/tqd-verify/mascot-weather-check.mjs`
- Modify: `src/components/DesktopShell.astro`, `src/components/ThemeMenu.astro`, `src/scripts/theme.ts`, `src/scripts/command-palette.ts`, `src/scripts/desktop.ts`, `README.md`

## Task 7.1 — Ảnh linh vật

- Goal: 6 ảnh tư thế nhất quán; nếu không đạt, dùng avatar cách điệu.
- Steps:
  1. Dùng skill `ak:ai-multimodal` (sinh ảnh) với ảnh tham chiếu `src/assets/portrait.jpg`. Prompt tiếng Anh cho từng tư thế, giữ nguyên phần mô tả nhân vật: `Chibi 3D sticker character of the man in the reference photo, same face, hair and glasses if any, navy polo shirt, full body, simple clean shading, transparent background, centered, <pose>`; `<pose>` lần lượt: `standing relaxed smiling` (idle), `waving hand hello` (wave), `hand on chin thinking` (think), `typing on a laptop` (type), `pointing down to the right` (point), `sleeping while standing with closed eyes` (sleep). Lưu ảnh gốc vào `.secrets/mascot-raw/<pose>.png` (thư mục không commit).
  2. `scripts/make-mascot.mjs`: với mỗi file trong `.secrets/mascot-raw/`, `sharp` cắt vùng trong suốt (`trim`), resize vừa 256×256 (`fit: 'contain'`, nền trong suốt), xuất `public/mascot/<pose>.webp` (quality 85, giữ alpha). In `wrote <pose>`.
  3. Cho người dùng xem 6 ảnh (gửi đường dẫn) và hỏi đúng câu: "Anh xem 6 tư thế linh vật trong `public/mascot/`. Dùng bộ này, tạo lại, hay chuyển sang avatar cách điệu (ảnh chân dung tròn + chuyển động CSS)?" Chờ trả lời.
  4. Nhánh dự phòng (người dùng chọn avatar cách điệu, hoặc skill sinh ảnh không có/lỗi 2 lần): `scripts/make-mascot.mjs --fallback` cắt chân dung thành hình tròn 256×256 từ `src/assets/portrait.jpg`, ghi cùng một ảnh cho cả 6 tên; tư thế thể hiện bằng CSS trên phần tử linh vật: `wave` có biểu tượng 👋 lắc, `think` có bong bóng `…`, `type` nhún nhẹ, `point` nghiêng 8°, `sleep` có `z z` và độ sáng 0.8.
- Verify: `node scripts/make-mascot.mjs` (hoặc `--fallback`) in 6 dòng `wrote` VÀ một script kiểm nhỏ `node scripts/verify/mascot-files.mjs` (tự viết: dùng `sharp(...).metadata()`) in `OK mascot` khi đủ 6 file, mỗi file `width === 256`, `height === 256`, `hasAlpha === true`.

## Task 7.2 — Linh vật trên desktop

- Target files: `src/components/Mascot.astro`, `src/scripts/mascot.ts`, `src/components/DesktopShell.astro`, `src/scripts/command-palette.ts`, `src/scripts/desktop.ts`.
- Steps:
  1. `Mascot.astro`: `<button class="mascot" data-pose="idle" aria-label="Linh vật DũngTQ – bấm để xem mẹo">` chứa 2 `<img alt="" width="128" height="128">`; đặt góc dưới phải, trên dock; ẩn dưới 1024px và khi in.
  2. `mascot.ts` (tải động sau sự kiện `load` + `requestIdleCallback`, chỉ desktop): áp quy tắc tư thế và đi dạo ở bảng thông số. Nguồn sự kiện: `command-palette.ts` phát `tqd:palette` (`open`/`close`); `desktop.ts` phát `tqd:drag` (`start`/`end`); `pointerenter`/`pointerleave` của dock. Chỉ tải ảnh `idle` ngay, các ảnh khác tải khi cần lần đầu.
  3. Bấm linh vật → bong bóng thoại (`role="status"`) hiện lần lượt 1 trong 4 mẹo: `Bấm ⌘K để tìm nhanh.`, `Kéo thanh tiêu đề để di chuyển cửa sổ.`, `Bấm Tất cả cửa sổ để xem Exposé.`, `Đọc bài mới ở mục Bài viết.`; tự ẩn sau 4 s.
  4. Reduced motion: không đi dạo, không crossfade (đổi `src` tức thì). `document.hidden` → dừng hẹn giờ; hiện lại → tiếp tục.
  5. Menu `Giao diện` thêm công tắc `Linh vật` (lưu `localStorage` `tqd-mascot`, mặc định bật).
- Verify: `npm run build` exit 0.

## Task 7.3 — Thời tiết Hà Nội

- Target files: `src/lib/weather-code.ts`, `src/lib/weather-code.test.ts`, `src/scripts/weather.ts`, `src/components/DesktopShell.astro`, `src/components/ThemeMenu.astro`.
- Steps:
  1. `weather-code.ts`: `effectFor(code: number): 'rain' | 'snow' | 'none'` và `labelFor(code)` (tiếng Việt: `Trời quang`, `Có mây`, `Sương mù`, `Mưa phùn`, `Mưa`, `Mưa rào`, `Tuyết`, `Dông`). Test: 61 → `rain`, 95 → `rain`, 73 → `snow`, 0 → `none`, 3 → `none`.
  2. `weather.ts` (desktop, tải động sau `load`): đọc cache `sessionStorage` `tqd-weather` (≤ 30 phút) hoặc fetch API ở bảng; lỗi mạng → không hiện gì, không báo lỗi. Menubar: `<span data-weather>` hiện `Hà Nội 31°C · Mưa` (nhiệt độ làm tròn).
  3. Canvas `<canvas data-weather-fx aria-hidden="true">` theo bảng thông số; cập nhật `canvas.dataset.particles` = số hạt đang vẽ (dùng cho kiểm tra). Mưa: vệt nghiêng rơi nhanh; tuyết: chấm trắng rơi chậm, lắc ngang. Resize theo cửa sổ.
  4. Reduced motion hoặc công tắc `Hiệu ứng thời tiết` tắt (`localStorage` `tqd-weather-fx`, mặc định bật) → không tạo canvas; chữ thời tiết vẫn hiện.
- Verify: `npx vitest run src/lib/weather-code.test.ts` exit 0 VÀ `npm run build` exit 0.

## Task 7.4 — Kiểm tra bằng trình duyệt

- Steps:
  1. `C:/Users/ABM/.cache/tqd-verify/mascot-weather-check.mjs <base>` (1440×900), in `PASS`/`FAIL` từng dòng và `ALL PASS`:
     - `mascot-visible`: sau 4 s `.mascot` hiển thị và `data-pose="idle"`.
     - `mascot-think`: `Control+K` → trong 500 ms `data-pose="think"`; `Escape` → về `idle`.
     - `mascot-tip`: bấm `.mascot` → có `[role="status"]` chứa `⌘K` hoặc `cửa sổ` hoặc `Bài viết`.
     - `weather-rain`: mở `/?weather=rain`, sau 1.5 s `canvas[data-weather-fx]` có `data-particles` > 0.
     - `weather-snow`: `/?weather=snow` tương tự.
     - `weather-reduced`: context `reducedMotion: 'reduce'`, `/?weather=rain` → không có `canvas[data-weather-fx]`; `.mascot` không có animation đang chạy sau 5 s.
     - `toggle-off`: tắt `Linh vật` trong menu → `.mascot` ẩn; reload → vẫn ẩn; bật lại.
  2. Chạy local → `npm run deploy:preview` → chạy preview → `npm run deploy` → chạy `https://tqd.io.vn`.
  3. Chạy lại Lighthouse như Task 6.8 bước 2–4.
- Verify: `node C:/Users/ABM/.cache/tqd-verify/mascot-weather-check.mjs https://tqd.io.vn` in `ALL PASS` VÀ `node C:/Users/ABM/.cache/tqd-verify/motion-check.mjs https://tqd.io.vn` in `ALL PASS` VÀ `node scripts/verify/lighthouse.mjs` exit 0.

## Task 7.5 — Hoàn tất

- Steps:
  1. `README.md`: một đoạn ngắn về hiệu ứng (⌘K, cửa sổ, Exposé, giao diện, linh vật, thời tiết) và cách tắt trong menu `Giao diện`.
  2. `npm test` exit 0; `node scripts/verify/site.mjs https://tqd.io.vn` in `OK site`; `npm run check:privacy -- https://tqd.io.vn` in `OK no post text`.
  3. Dừng mọi dev server nền đã mở (kiểm `netstat -ano | findstr :4321` rỗng).
  4. `git add -A`; commit `feat: add mascot and hanoi weather effects`.
- Verify: `git status --porcelain` rỗng.

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
