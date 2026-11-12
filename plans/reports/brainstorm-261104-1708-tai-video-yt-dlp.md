# Brainstorm & Advise: tính năng tải video, playlist, profile trên `tqd.me` dựa trên `yt-dlp` & `download-all`

Ngày 04/11/2026. Chế độ `--advice` + `/ak-advise`, đã đối chiếu mã nguồn `tqd.me` và repo tham khảo `download-all-main`.

## 1. Bằng chứng khảo sát từ `tqd.me` và `download-all-main`

### Từ `tqd.me` (`/Volumes/2/TQD-Website`)
- **Edge Runtime (`wrangler.jsonc`, `src/worker.ts`):** Chạy Astro 7 SSR trên Cloudflare Workers Free (giới hạn 10 ms CPU/request, V8 isolate) — không thể chạy Python/`yt-dlp`/`ffmpeg` trực tiếp trên Worker.
- **Mẫu Hybrid Edge + Home Server (`src/pages/api/chat.ts`, `src/lib/chat.ts`):** Worker kiểm tra cùng origin, probe `/health` (cache 60s), kiểm tra hạn mức D1 (`src/lib/rate-limit.ts`), rồi proxy qua Cloudflare Tunnel về máy chủ nhà.
- **Xác thực & Cache (`src/middleware.ts`, `src/lib/auth.ts`, `src/lib/api-key.ts`):** HTML các trang công khai được lưu trong `caches.open('pages')`. Quyền Admin (`readSession`) và API Key (`authenticate`) có sẵn để mở khóa hạn mức cao trên các route `/api/dl/*` (`Cache-Control: no-store`).
- **Môi trường máy chủ nhà (macOS):** Đã có sẵn `yt-dlp` (`2026.10.26`), `ffmpeg` (`/opt/homebrew/bin/ffmpeg`) và `cloudflared` (`/opt/homebrew/bin/cloudflared`).

### Từ repo tham khảo `download-all-main`
- **Những phần cốt lõi rất tốt cần tái sử dụng (`src/lib/platforms.ts`, `src/lib/ytdlp.ts`, `src/web/state.ts`):**
  1. **Nhận diện nền tảng & làm sạch URL (`src/lib/platforms.ts`):** Tự động nhận diện 14+ nền tảng (YouTube, YT Shorts, YT Music, TikTok, Douyin, Facebook, FB Reels, Instagram Reels, X/Twitter, Threads, Reddit, Twitch, Vimeo, Bilibili, SoundCloud, Dailymotion, Pinterest), tự xóa tham số tracking (`si`, `fbclid`, `utm_*`, `igshid`...) qua `normalizeMediaUrl()`, và tách nhiều link từ văn bản qua `extractUrlsFromInput()`.
  2. **Nhận diện Video Dọc 9:16 vs. Ngang 16:9 (`detectIsVerticalVideo` & `getQualityBadge` trong `src/lib/ytdlp.ts`):** Tính độ phân giải theo cạnh ngắn (`Math.min(width, height)`) để video Shorts/TikTok `1080x1920` hiển thị đúng là `1080p Full HD (Shorts 9:16)` thay vì bị ghi nhầm thành `1920p`.
  3. **Tối ưu tương thích thiết bị (`-S vcodec:h264,res,acodec:m4a`):** Ưu tiên luồng H.264 + AAC ghép vào `.mp4` để video tải về mở được ngay trên iPhone, Windows, Zalo, CapCut, Premiere mà không lỗi màn hình đen.
  4. **Luồng "⚡ TẢI NGAY" 1-Click + 3 Preset nhanh + Bảng chọn chi tiết:** Cho phép bấm tải ngay lập tức với 3 preset (`Best 4K/1080p`, `HD 720p`, `Audio MP3 320kbps`) hoặc chuyển sang tab `Chọn chất lượng chi tiết` để xem từng độ phân giải kèm dung lượng (`~MB`) và thời gian tải dự kiến (`~sec`).
  5. **Đọc tiến độ thời gian thực (`--progress-template`):** Bóc tách chính xác `downloaded_bytes`, `total_bytes`, `speed` (`MB/s`), `eta` và trạng thái ghép file `[Merger]` / `[ExtractAudio]`.
- **Những phần chỉ dành cho bản Desktop Local phải loại bỏ khi đưa lên Web `tqd.me`:**
  1. **Lưu file vào `~/Downloads` của máy chủ & mở Explorer (`/api/system/open-folder`):** Trên nền tảng web `tqd.me`, người dùng truy cập từ điện thoại/máy tính của họ. Sau khi Daemon ghép xong file vào thư mục tạm `/tmp/tqd-dl/`, phải truyền file qua HTTP (`GET /api/dl/stream?ticket=...` kèm `Content-Disposition: attachment`) về thẳng trình duyệt của người dùng rồi xóa ngay file tạm trên server.
  2. **Đọc Clipboard của máy chủ (`readClipboard()` trong `/api/system/status`):** Tuyệt đối không đọc clipboard của hệ điều hành máy chủ (sẽ làm lộ dữ liệu cá nhân trên máy Mac của DũngTQ cho khách truy cập web). Nút `📋 Dán Link` chỉ đọc `navigator.clipboard.readText()` trên trình duyệt của chính khách.
  3. **Các API điều khiển hệ thống nội bộ (`/api/system/shutdown`, `/api/settings` ghi đè thư mục/cookie, `/api/sound/kimochi`, `security-guard.ts`, `pixelThief.js`, giao diện `win98.css`):** Loại bỏ hoàn toàn; thay bằng giao diện Champagne sáng (`#faf7f1`, `#1b2030`, `#8a6420`) của `tqd.me` và lưu lịch sử tải của từng khách trong `localStorage` trình duyệt.

## 2. Reframed Contract & Quyết định đã khóa

- **Problem (reframed):** Xây dựng công cụ tải video/nhạc đa nền tảng tại `tqd.me/tai-video` kết hợp trải nghiệm 1-Click mượt mà của `download-all-main` với kiến trúc bảo mật 2 tầng (Cloudflare Worker + Home Daemon qua Cloudflare Tunnel) của `tqd.me`, đảm bảo file được truyền thẳng về thiết bị của người dùng cuối mà không làm lộ thông tin máy chủ nhà hay vượt giới hạn gói Cloudflare Free.
- **Exact requirements:**
  1. Trang `/tai-video` dùng bảng màu Champagne sáng của `tqd.me`, có mặt trong mục **Sản phẩm** và `CommandPalette` (`Ctrl K`), gồm:
     - Ô nhập URL tự gắn nhãn nền tảng (`📺 YouTube`, `📱 YT Shorts`, `🎵 TikTok`, `📘 FB Reels`, `📑 N Links`) + nút `📋 Dán Link` (từ clipboard trình duyệt) + chế độ mở rộng `📑 Tải Nhiều Link` (textarea mỗi dòng 1 link).
     - Thanh chọn nhanh: `🌟 Cao nhất (1080p/4K)`, `🎬 HD 720p`, `🎵 Nhạc MP3 (320kbps)`, `🔍 Chọn chi tiết...`, kèm tùy chọn `📂 Quét cả Playlist/Profile` và `Chuẩn hóa H.264 (iPhone/Zalo/CapCut)`.
     - 3 Tab hiển thị: **Tiến độ & Hàng đợi** (thanh phần trăm, `MB/s`, `ETA`, danh sách video trong Playlist/Batch có checkbox chọn lọc), **Chọn độ phân giải chi tiết** (bảng các mức `2160p` -> `360p` + `MP3` kèm dung lượng dự kiến), và **Lịch sử đã tải** (lưu tại `localStorage` của trình duyệt người dùng).
  2. Phân quyền 2 tầng tại `/api/dl/*`:
     - **Khách Public:** Giới hạn qua D1 `rate_limits` (ví dụ: 15 lượt tải/giờ mỗi khách, 30 lượt/giờ mỗi IP, 150 lượt/ngày toàn site), độ phân giải tối đa `1080p`, dung lượng tối đa `200 MB`/file, tối đa `25` mục mỗi lần quét playlist/batch, **không dùng cookie cá nhân**.
     - **Admin / API Key (`readSession` hoặc `authenticate`):** Mở khóa `4K/2160p`, tối đa `2 GB`/file, `100` mục/lần, và cho phép tùy chọn dùng profile cookie phụ đã cấu hình riêng trên Daemon (nếu cần tải bài giới hạn độ tuổi/nhóm).
  3. Luồng dữ liệu 3 bước chống đơ trình duyệt và chống tràn RAM:
     - `POST /api/dl/resolve`: Phân tích 1 link, Playlist/Profile (`--flat-playlist`) hoặc danh sách nhiều link -> trả về thông tin video, danh sách độ phân giải (`buildChoices`) và vé HMAC (`itemTicket`, TTL 15 phút).
     - `POST /api/dl/prepare`: Gửi `itemTicket` + định dạng chọn -> Daemon tải & ghép `ffmpeg` (`-movflags +faststart`, `-S vcodec:h264,res,acodec:m4a`) vào `/tmp/tqd-dl/<jobId>` -> khách xem tiến độ `%`, `MB/s`, `ETA` -> khi xong trả về `streamTicket`.
     - `GET /api/dl/stream?ticket=<streamTicket>`: Trình duyệt tự kích hoạt tải file gốc (`Content-Disposition: attachment; filename*=UTF-8''...`) với TTFB `<50 ms`; Daemon xóa ngay file tạm sau khi truyền xong (kèm cron dọn rác `/tmp/tqd-dl` sau 10 phút, trần ổ cứng tạm 3 GB, tối đa 2 tiến trình đồng thời).
- **Done means:**
  - Truy cập `/tai-video` trên cả Desktop và Mobile hiển thị đúng giao diện Champagne của `tqd.me`, có trong `Ctrl K` và `/san-pham`.
  - Dán link lẻ (YT/TikTok/FB/IG...), link Playlist/Profile hoặc nhiều link hoạt động trọn vẹn từ lúc bấm `⚡ TẢI NGAY` đến khi file `.mp4`/`.mp3` nằm trong máy người dùng và file tạm trong `/tmp/tqd-dl` được xóa sạch.
  - Khi tắt Home Daemon, `GET /api/dl/status` trả `{ online: false }` và giao diện báo trạng thái tạm nghỉ mà không trừ lượt D1.
  - `npm test` và `npm run build` đạt 100% PASS (bao gồm unit test cho `platforms.ts`, `ytdlp-choices.ts`, SSRF guard, HMAC ticket, và rate-limit `dl:%`).
- **Non-goals:**
  - Không bê giao diện Windows 98 (`win98.css`), `pixelThief.js`, `security-guard.ts` hay các API điều khiển máy tính local (`/api/system/*`) của `download-all-main` lên `tqd.me`.
  - Không nén `.zip` trên server và không lưu video khách tải vào R2 `tqd-media`.
