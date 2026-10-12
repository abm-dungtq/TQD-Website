---
phase: 6
title: "Hiệu ứng: ⌘K, mobile, cửa sổ/dock/Exposé, hình nền và giao diện"
status: completed
priority: P2
effort: 12h
dependencies: [4]
---

# Phase 6 — Hiệu ứng: ⌘K, mobile, cửa sổ/dock/Exposé, hình nền và giao diện

> Đọc mục Constraints trong `plan.md` trước khi bắt đầu. KHÔNG mở hay chép file từ repo zuey-me; mọi thông số cần dùng đã ghi trong phase này.

## Kết quả (2026-10-12)

- Production 40e133d6: Lighthouse mobile 2 lần — `/` 0.98/1.00, `/bai-viet/{slug}` (ảnh bìa WebP ~22 KB) 0.99–1.00/1.00.
- Lần đo đầu chỉ đạt 0.87/0.86 vì Google Fonts chặn render. Đã chuyển sang font tự host bằng Astro Fonts API, inline CSS và thêm `fetchpriority` cho ảnh bìa.
- Kiểm tra hiệu ứng: `C:/Users/ABM/.cache/tqd-verify/motion-check.mjs <base-url>` (nằm ngoài repo) in ALL PASS trên local, preview và production.
- Khác plan: màu nhấn sáng emerald `#047857`, amber `#b45309` để chữ link đạt tương phản 4.5:1.
- Việc sau: chuyển hiệu ứng aurora từ `background-position` sang `transform`.

## Goal

Trang chủ có cảm giác hệ điều hành: bảng tìm nhanh ⌘K trên mọi trang; màn hình icon + sheet kéo đóng trên điện thoại; cửa sổ bung từ icon, đóng, thu nhỏ về dock, phóng to/snap, Exposé; dock phóng to theo chuột; hình nền aurora; sáng/tối và màu nhấn với View Transitions. Mọi chuyển động tắt khi `prefers-reduced-motion: reduce`; không JS vẫn đọc được mọi trang.

## Thông số chuyển động (nguồn duy nhất)

| Hiệu ứng | Thông số |
|---|---|
| Easing chung | `--os-ease: cubic-bezier(.2,.8,.2,1)`; bật nảy `--os-spring: cubic-bezier(.2,1.15,.3,1)` |
| Mở cửa sổ | WAAPI, từ tâm icon đã bấm: `translate(dx,dy) scale(.16)`, opacity 0 → `none`, opacity 1; 440 ms `--os-spring` |
| Đóng cửa sổ | `scale(.96)` + opacity → 0; 170 ms `ease-in` |
| Thu nhỏ (genie) | 480 ms `--os-ease`, 3 keyframe: `none` → (offset .5) dịch nửa đường tới icon dock, `scale(.6, .5)` → dịch tới tâm icon dock, `scale(.08, .04)`, opacity .2 |
| Phóng to / snap | FLIP: đo rect cũ/mới, animate `transform` 260 ms `--os-ease` |
| Exposé | `transform` transition 400 ms `--os-ease`; nhãn tiêu đề dưới mỗi cửa sổ (nhãn luôn hiện, kể cả reduced motion) |
| Dock phóng đại | `scale = 1 + 0.55 * cos(d / 150 * π/2)` khi `d < 150` px (d = khoảng cách ngang con trỏ → tâm icon), ngược lại 1; `translateY(-(scale-1) * 20px)`; cập nhật trong `requestAnimationFrame`; rời dock → về 1 trong 200 ms |
| Hình nền aurora | 3–4 `radial-gradient` màu nhấn nhạt, `background-size: 200% 200%`, animate `background-position` 28 s `ease-in-out infinite alternate` |
| Đổi giao diện | `document.startViewTransition`, crossfade 350 ms |
| Bảng ⌘K | `<dialog>`: opacity 0 → 1 và `scale(.96)` → 1 trong 280 ms `--os-ease`; backdrop `blur(8px)` + nền tối 40 % |
| Sheet mobile | trượt lên `translateY(100%)` → 0 trong 380 ms `--os-spring`; màn hình chính lùi lại `scale(.94)`, opacity .45, `blur(2px)`; kéo xuống > 110 px hoặc vận tốc > 0.5 px/ms thì đóng, ngược lại bật về |
| Chuyển trang | `@view-transition { navigation: auto; }`, fade 250 ms |
| Reduced motion | Không transform/scale/blur động; chỉ đổi trạng thái tức thì; aurora đứng yên; dock không phóng đại |

## Files to Create / Modify

- Create: `src/styles/motion.css`, `src/scripts/motion.ts`, `src/components/CommandPalette.astro`, `src/scripts/command-palette.ts`, `src/pages/search.json.ts`, `src/components/MobileShell.astro`, `src/scripts/mobile-shell.ts`, `src/scripts/window-motion.ts`, `src/scripts/expose.ts`, `src/scripts/dock.ts`, `src/scripts/theme.ts`, `src/components/ThemeMenu.astro`, `src/lib/search-text.ts`, `src/lib/search-text.test.ts`, `C:/Users/ABM/.cache/tqd-verify/motion-check.mjs`
- Modify: `src/styles/global.css`, `src/layouts/BaseLayout.astro`, `src/components/DesktopShell.astro`, `src/scripts/desktop.ts`, `src/pages/index.astro`, `scripts/verify/lighthouse.mjs`

## Task 6.1 — Nền tảng chuyển động và giao diện sáng/tối

- Target files: `src/styles/motion.css`, `src/scripts/motion.ts`, `src/styles/global.css`, `src/layouts/BaseLayout.astro`, `src/scripts/theme.ts`, `src/components/ThemeMenu.astro`.
- Steps:
  1. `motion.css`: biến `--os-ease`, `--os-spring`; `@view-transition { navigation: auto; }`; `::view-transition-old(root), ::view-transition-new(root) { animation-duration: 250ms; }`; khối `@media (prefers-reduced-motion: reduce)` đặt `animation: none !important; transition: none !important;` cho `*`, `::view-transition-*`. Import trong `global.css`.
  2. `motion.ts`: `reducedMotion()` (đọc `matchMedia('(prefers-reduced-motion: reduce)')` mỗi lần gọi); `play(el, keyframes, options): Promise<void>` → nếu reduced thì không animate, resolve ngay; ngược lại `el.animate(...).finished` (bắt lỗi `AbortError`).
  3. `global.css`: khối `[data-theme="dark"]` ghi đè `--color-ink: #e2e8f0; --color-muted: #94a3b8; --color-paper: #0b1120; --color-panel: #111827; --color-line: #1f2937;` và `--color-accent-ink: #bfdbfe`. `--color-accent` đổi theo thuộc tính `data-accent` với 5 giá trị: `blue #2563eb`, `violet #7c3aed`, `emerald #059669`, `amber #d97706`, `rose #e11d48`.
  4. `BaseLayout.astro`: trong `<head>`, trước CSS, một `<script is:inline>` nhỏ đọc `localStorage` `tqd-theme` (`light|dark|auto`, mặc định `auto`) và `tqd-accent`; `auto` theo `prefers-color-scheme`; đặt `data-theme`, `data-accent` lên `<html>` (tránh nháy màu).
  5. `ThemeMenu.astro` + `theme.ts`: nút `Giao diện` (có `aria-expanded`) mở menu: 3 lựa chọn Sáng/Tối/Tự động (radio), 5 ô màu nhấn (radio có `aria-label` tên màu). Chọn → lưu `localStorage`, áp dụng trong `document.startViewTransition` nếu có. Menu đặt ở menubar (desktop) và đầu trang (mobile/trang thường).
- Verify: `npm run build` exit 0.

## Task 6.2 — Bảng tìm nhanh ⌘K

- Target files: `src/pages/search.json.ts`, `src/lib/search-text.ts`, `src/lib/search-text.test.ts`, `src/components/CommandPalette.astro`, `src/scripts/command-palette.ts`, `src/layouts/BaseLayout.astro`.
- Steps:
  1. `search.json.ts`: `GET` trả `[{ title, url, kind, hint }]` gồm 7 mục (kind `section`), bài có `status = 'published'` (`article`, url `/bai-viet/{slug}`), sản phẩm, đào tạo, video có `visible = 1` (kind tương ứng, url của mục chứa nó). Không bao giờ đưa bài nháp hay mục ẩn vào. Được middleware cache theo `content_version`.
  2. `search-text.ts`: `fold(text)` = NFD, bỏ dấu, `đ`→`d`, chữ thường; `matches(query, title)` = mọi từ của `fold(query)` có trong `fold(title)`. Test: `matches('viet pro', 'Viết Pro')` true; `matches('dao tao', 'Đào tạo & sự kiện')` true; `matches('xyz', 'Viết Pro')` false.
  3. `CommandPalette.astro`: `<dialog id="cmdk" aria-label="Tìm nhanh">` chứa `<input role="combobox" aria-controls="cmdk-list" aria-expanded="true" aria-autocomplete="list">` và `<ul id="cmdk-list" role="listbox">`. Thêm vào `BaseLayout` (mọi trang công khai) và một nút `Tìm (⌘K)` ở menubar/đầu trang.
  4. `command-palette.ts`: mở bằng `Ctrl+K`/`⌘K`, phím `/` khi focus không ở ô nhập, hoặc nút. Lần mở đầu tải `/search.json`. Lọc bằng `matches`, tối đa 8 kết quả, nhóm theo `kind`. `↑`/`↓` đổi `aria-activedescendant`, `Enter` mở: nếu đang ở trang chủ desktop và kết quả là section → mở cửa sổ đó (`window.dispatchEvent(new CustomEvent('tqd:open', { detail: id }))`); còn lại → `location.href = url`. `Esc` đóng (mặc định của `<dialog>`), trả focus về phần tử đã mở. Không kết quả → `Không tìm thấy`.
  5. CSS theo bảng thông số; reduced motion: không scale.
- Verify: `npx vitest run src/lib/search-text.test.ts` exit 0 VÀ `npm run build` exit 0.

## Task 6.3 — Màn hình icon và sheet trên điện thoại

- Target files: `src/components/MobileShell.astro`, `src/scripts/mobile-shell.ts`, `src/pages/index.astro`.
- Steps:
  1. `MobileShell.astro` (chỉ hiện `< 1024px` bằng CSS): đầu trang có ảnh chân dung nhỏ, tên, đồng hồ; lưới icon 4 cột cho 7 mục (icon từ `Icon.astro`, nhãn dưới icon). Mỗi icon là `<a href="/{id}">` (không JS vẫn chạy).
  2. `mobile-shell.ts` (chỉ chạy khi `matchMedia('(max-width: 1023px)')`): bấm icon → chặn chuyển trang, mở sheet (`role="dialog"`, `aria-modal="true"`, `aria-labelledby` tiêu đề), nội dung lấy bằng `fetch('/{id}')` rồi `DOMParser` lấy phần `main#main` (hiện `Đang tải…` trong lúc chờ; lỗi → chuyển trang thường `location.href`). `history.pushState({ sheet: id }, '', '#' + id)`; `popstate` đóng sheet. Nút đóng và `Esc` đóng sheet; trả focus về icon.
  3. Kéo đóng: pointer events trên vùng tay nắm (thanh 40×4 px đầu sheet) và tiêu đề; sheet đi theo ngón tay (chỉ chiều xuống); thả ra áp quy tắc 110 px / 0.5 px/ms ở bảng thông số.
  4. Màn hình chính lùi lại khi sheet mở theo bảng thông số; reduced motion: không lùi, không trượt.
- Verify: `npm run build` exit 0.

## Task 6.4 — Cửa sổ: mở, đóng, thu nhỏ, phóng to, snap

- Target files: `src/scripts/window-motion.ts`, `src/scripts/desktop.ts`, `src/components/DesktopShell.astro`.
- Steps:
  1. Titlebar mỗi cửa sổ có 3 nút trái (đỏ đóng `aria-label="Đóng"`, vàng thu nhỏ `aria-label="Thu nhỏ"`, xanh phóng to `aria-label="Phóng to"`), giữ link `Mở trang riêng`.
  2. `window-motion.ts` export `animateOpen(win, fromRect)`, `animateClose(win)`, `animateMinimize(win, dockRect)`, `animateRestore(win, dockRect)` (ngược của minimize), `flip(win, applyChange)`; tất cả dùng `play()` của `motion.ts` và thông số trong bảng.
  3. `desktop.ts`: `open(id, launcher)` gọi `animateOpen` từ `launcher.getBoundingClientRect()`; `close` chờ `animateClose` rồi `hidden = true`; thu nhỏ → `animateMinimize` tới icon dock tương ứng, đặt `data-minimized`, icon dock có chấm chỉ báo (`.is-open`); bấm icon dock của cửa sổ đã thu nhỏ → `animateRestore`. Lắng nghe sự kiện `tqd:open` (Task 6.2). Dynamic `import('./window-motion')` chỉ khi màn hình ≥ 1024px.
  4. Phóng to: nút xanh hoặc double-click titlebar → toggle `data-maximized` (vùng dưới menubar, trên dock, lề 8 px) bằng `flip`.
  5. Snap: khi kéo, con trỏ cách mép trái/phải < 24 px → hiện khung xem trước bán trong suốt nửa màn hình; thả → cửa sổ chiếm nửa đó bằng `flip`. Kéo ra khỏi trạng thái snap/maximized → về kích thước trước.
  6. Bàn phím: `Esc` vẫn đóng cửa sổ trên cùng; focus vẫn chuyển như v1.
- Verify: `npm run build` exit 0.

## Task 6.5 — Exposé và dock phóng đại

- Target files: `src/scripts/expose.ts`, `src/scripts/dock.ts`, `src/components/DesktopShell.astro`.
- Steps:
  1. Exposé: nút menubar `Tất cả cửa sổ` (và phím `F3`, `Ctrl+↑`). Các cửa sổ đang mở, không thu nhỏ, xếp lưới `cols = ceil(sqrt(n))`; mỗi cửa sổ `transform` thu nhỏ vừa ô (giữ tỉ lệ, lề 24 px); lớp phủ mờ; nhãn tiêu đề dưới mỗi cửa sổ. Bấm cửa sổ → thoát Exposé và đưa cửa sổ đó lên trên; `Esc` thoát. Thêm class `is-expose` lên `#desktop` khi đang bật. 0 cửa sổ → không làm gì.
  2. Dock: công thức ở bảng; chỉ bật khi `matchMedia('(pointer: fine)')` và không reduced motion. Không thay đổi kích thước layout (chỉ `transform`), tooltip `data-tip` vẫn hoạt động.
- Verify: `npm run build` exit 0.

## Task 6.6 — Hình nền aurora

- Target files: `src/components/DesktopShell.astro`, `src/styles/global.css`.
- Steps: thay nền chấm của `.desktop` bằng lớp aurora (gradient dùng `--color-accent` pha nhạt, nền theo `--color-paper`) với animation ở bảng thông số; vẫn giữ lớp chấm mờ phía trên nếu đẹp. Reduced motion: `animation: none`. Animation chạy trên `background-position` của một pseudo-element `::before` có `will-change: background-position`.
- Verify: `npm run build` exit 0.

## Task 6.7 — Kiểm tra bằng trình duyệt

- Goal: script `C:/Users/ABM/.cache/tqd-verify/motion-check.mjs <base>` (dùng `playwright-core` + Chrome hệ thống như `desktop-check.mjs` cùng thư mục) in từng dòng `PASS <tên>`/`FAIL <tên>` và dòng cuối `ALL PASS` khi đạt hết.
- Steps:
  1. Viết các kiểm tra:
     - `desktop-open-animates` (1440×900): bấm icon dock `Sản phẩm` → trong 100 ms `win.getAnimations().length > 0`; sau 600 ms cửa sổ hiện, chứa `Viết Pro`.
     - `minimize-restore`: bấm `Thu nhỏ` → sau 700 ms cửa sổ không hiển thị, icon dock có `.is-open`; bấm icon → hiện lại.
     - `maximize`: double-click titlebar → `data-maximized` có mặt.
     - `expose`: bấm `Tất cả cửa sổ` → `#desktop.is-expose`; `Escape` → hết class.
     - `cmdk`: `Control+K` → `dialog#cmdk[open]`; gõ `viet pro` → listbox có `Viết Pro`; `Escape` đóng.
     - `theme`: chọn Tối → `html[data-theme="dark"]`; reload → vẫn `dark`.
     - `reduced-motion` (context `reducedMotion: 'reduce'`): mở cửa sổ → `getAnimations().length === 0`; `getComputedStyle(.desktop, '::before').animationName === 'none'`.
     - `mobile-sheet` (390×844, `hasTouch`): bấm icon `Sản phẩm` → sheet hiện chứa `Viết Pro`; kéo tay nắm xuống 200 px → sheet đóng; mở lại rồi `page.goBack()` → sheet đóng.
     - `no-js` (context `javaScriptEnabled: false`): `/san-pham` chứa `Viết Pro`.
  2. Chạy với dev server local, sửa đến khi `ALL PASS`, rồi `npm run deploy:preview` và chạy với base preview.
- Verify: `node C:/Users/ABM/.cache/tqd-verify/motion-check.mjs <base>` in `ALL PASS` trên local và preview.

## Task 6.8 — Lighthouse, deploy, commit

- Steps:
  1. `npm run deploy` (production).
  2. Chọn một bài đã đăng trên `https://tqd.io.vn/bai-viet`. Nếu chưa có bài nào: tạo bài tạm bằng `scripts/api-key.mjs` + skill `tqd-publish` (như Task 5.6, slug `lighthouse-test-<ts>`), xoá sau bước 3.
  3. `npx --yes lighthouse@latest https://tqd.io.vn/ --only-categories=performance,accessibility --output=json --output-path=.lighthouse-home.json --chrome-flags="--headless=new" --quiet` và tương tự cho trang bài viết → `.lighthouse-article.json`.
  4. Sửa `scripts/verify/lighthouse.mjs` nhận danh sách file qua tham số (mặc định `.lighthouse-home.json .lighthouse-article.json`).
  5. `node C:/Users/ABM/.cache/tqd-verify/motion-check.mjs https://tqd.io.vn`.
  6. `git add -A`; commit `feat: add os-style motion, command palette and mobile sheets`.
- Verify: `node scripts/verify/lighthouse.mjs` in 2 dòng `OK`, exit 0 VÀ bước 5 in `ALL PASS` VÀ `git status --porcelain` rỗng.

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
