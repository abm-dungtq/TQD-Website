# Brainstorm: phần trống bên phải desktop (2026-10-13)

## Bối cảnh và bằng chứng

- Ảnh người dùng ở màn ~2000px CSS: một cửa sổ "Hồ sơ" ~860×640 ở góc trái trên, ~55% bên phải là hình nền trống.
- Nguyên nhân: kích thước cửa sổ cố định `width: min(860px, 90vw); height: min(640px, 80vh)` (`src/components/DesktopShell.astro:242-243`), lúc tải chỉ mở một cửa sổ, cascade từ left 150 (`src/scripts/desktop.ts:82-90`).
- So sánh zuey.me (chỉ xem trực quan, repo không có license, không chép code). Ảnh chụp: `C:/Users/ABM/.cache/tqd-verify/space/zuey-{2540,1440}.png`, `tqd-{2540,1440}.png`. zuey.me mở sẵn 3 cửa sổ trải ~60% bề ngang, cao gần hết màn hình, có chữ ký lớn "zuey" mờ ở góc phải dưới hình nền. Ở 1440px, 2 cửa sổ phủ kín bề ngang.

## Contract

- **Outcome:** Trên màn rộng (≥1440px), desktop lúc tải phủ kín bằng nội dung thật và có một điểm nhấn thương hiệu ở hình nền; không còn mảng trống lớn bên phải.
- **Constraints:** Không màu tối; champagne chỉ để trang trí; không dữ liệu giả; Lighthouse mobile ≥0.95 (hiện 0.98); tôn trọng `prefers-reduced-motion`; link có `#mục` vẫn chỉ mở đúng một cửa sổ; không chép code zuey-me; điện thoại dùng MobileShell, không đổi.
- **Non-goals:** Cột widget (phương án C); họa tiết đường nét/chòm sao; hình nền ảnh; đổi MobileShell hoặc các trang `/{mục}`.
- **Acceptance criteria:**
  - Ở 1440+, phần hình nền trống bên phải cửa sổ cuối ≤25% bề ngang; ở 1280 ≤35%.
  - 1280: 1 cửa sổ; 1440–~2440: 2 cửa sổ (Hồ sơ, Sản phẩm); rộng hơn: 3 (thêm Số liệu). Hồ sơ nằm trên cùng, URL là `#ho-so`.
  - `/#lien-he` chỉ mở Liên hệ.
  - Phóng to, snap, Exposé, kéo thả vẫn đúng; render-check 0 lỗi ở 1280/1440/1920/2560 và 1920 zoom 125%.
  - `motion-check.mjs` và `mascot-weather-check.mjs` ALL PASS (cập nhật nếu giả định một cửa sổ lúc tải); Lighthouse 2 lần ≥0.95.

## Trade-offs

| Phương án | Phụ thuộc vào | Hỏng trước khi |
|---|---|---|
| A. Kích thước theo viewport + mở 1–3 cửa sổ | Nội dung Hồ sơ/Sản phẩm vẫn đẹp ở cửa sổ ~620px | Tên hoặc thẻ bị vỡ dòng ở 1440 → nâng ngưỡng 2 cửa sổ lên ~1575px |
| B. Chữ ký "DũngTQ" mờ trên hình nền | `person.handle` ngắn (≤8 ký tự) | Handle dài → dùng `person.initials` |
| C. Cột widget bên phải | Có nội dung mà cửa sổ chưa hiển thị | Ngay bây giờ: trùng số liệu/sản phẩm, mục Bài viết đang trống |

Better approaches: none. Hướng được chọn là A + B (người dùng chọn 2026-10-13, Kongming đồng ý sau khi đối chiếu `desktop.ts`, `expose.ts`, `Mascot.astro`).

## Hướng đã chốt: A + B

1. **Một nguồn kích thước.** `.desktop-window` dùng `width: var(--win-w, min(860px, 90vw)); height: var(--win-h, min(640px, 80vh))`. Quy tắc phóng to/snap dùng `!important` vẫn thắng.
2. **Tính bố cục** (`desktop.ts`, lúc khởi động và khi resize; không sắp lại cửa sổ khi resize, để `clampWindow` giữ chúng trong màn hình):
   - `W = innerWidth - 174`, `H = innerHeight - 148`
   - `n = W < 1264 ? 1 : W < 2268 ? 2 : 3`
   - `--win-w = min(980, (W - 24*(n-1)) / n)`, `--win-h = min(880, max(560, H))`
3. **Mở lúc khởi động** (chỉ khi không có hash): `[ho-so, san-pham, so-lieu].slice(0, n)`, lọc theo các mục đang hiển thị, đặt ở `left = 150 + i*(w+24)`, cùng `top`. Mở từ phải sang trái để Hồ sơ nằm trên cùng. Có hash thì giữ hành vi cũ, với kích thước mới. Các lần mở sau vẫn dùng cascade cũ.
4. **Chữ ký hình nền.** Một pseudo-element trên desktop, chữ `person.handle` bằng Cormorant 600 (font đã tải sẵn), `clamp(160px, 18vw, 420px)`, màu champagne với opacity 0.10–0.14, nằm góc phải dưới, `pointer-events: none`, ẩn khi Exposé.
5. **LCP.** Nếu ảnh chân dung trong cửa sổ Hồ sơ thành phần tử LCP, truyền `eager` cho phần thân Hồ sơ trên desktop.

## Rủi ro

- `motion-check.mjs` (ngoài repo) có thể giả định chỉ một cửa sổ mở lúc tải; kiểm tra và cập nhật, không xoá case.
- Không mở Video AI (nhiều ảnh bìa) hoặc Bài viết (đang trống) lúc khởi động.
- Linh vật đi khắp bề ngang và nằm trên cửa sổ; không cần chừa chỗ.

## Handoff

Bước tiếp theo: `/ak:cook --advice` với report này (thay đổi nhỏ, 2 file chính: `DesktopShell.astro`, `desktop.ts`; có thể thêm `index.astro` cho `eager`).

## Câu hỏi còn mở

- Không có câu hỏi chặn.
