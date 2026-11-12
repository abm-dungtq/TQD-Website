# Journal: Hoàn tất triển khai `/tai-video` (yt-dlp & ffmpeg) trên `tqd.me`

- **Thời gian**: 2026-11-04 17:50 (+07:00)
- **Kế hoạch**: `plans/261104-1020-tai-video-yt-dlp/plan.md` (`TQD-Website/261104-1020`)
- **Chế độ**: `/ak-cook --advice` (giám sát bởi `kongming`)

## 1. Tóm tắt kết quả theo từng Phase

- **Phase 1 — Core Library, SSRF Guard, HMAC Tickets & Unit Tests**:
  - Khai báo biến môi trường `DL_API_KEY`, `DL_BASE_URL`, `DL_DAILY_CAP` trong `src/env.d.ts` và `wrangler.jsonc`.
  - Tạo `src/lib/dl-platforms.ts` (nhận diện 14+ nền tảng, phân biệt Shorts 9:16, Playlist/Profile, lọc tracking params và chặn SSRF nội bộ).
  - Tạo `src/lib/dl.ts` (phân tầng `public` vs `admin`, ký/kiểm vé `HMAC-SHA256` cho `itemTicket`, `taskTicket`, `streamTicket`, giao tiếp Home Daemon và dọn `rate_limits`).
  - Tạo bộ unit test `src/lib/dl.test.ts` (10 bài test) — `npx vitest run` đạt 16/16 file test (`97/97` tests).
- **Phase 2 — Home Daemon (`yt-dlp` + `ffmpeg`) & Local Verification**:
  - Tạo `scripts/ytdlp-daemon.mjs` chạy hàng đợi tối đa 2 tiến trình song song, ép cờ bảo mật `--no-config --no-exec --no-mark-watched`, chuẩn hóa H.264 + AAC (`-S vcodec:h264,res:<maxHeight>,acodec:m4a` và `--ppa "Merger+ffmpeg_o1:-movflags +faststart"`), trả header `Content-Disposition` chuẩn RFC 5987 cho tên file tiếng Việt/emoji, và xóa ngay thư mục tạm `/tmp/tqd-dl/<taskId>` bằng `rmSync` khi luồng stream kết thúc.
  - Tạo `scripts/verify/dl-daemon.mjs` — `npm run verify:dl` trả `OK dl-daemon`.
- **Phase 3 — Cloudflare Worker API Routes & Rate-Limit Cleanup**:
  - Tạo `src/pages/api/dl/status.ts`, `src/pages/api/dl/resolve.ts`, `src/pages/api/dl/prepare.ts`, `src/pages/api/dl/task/[id].ts`, `src/pages/api/dl/stream.ts` và cập nhật `src/worker.ts` (`cleanupDlLimits`).
  - Áp dụng timeout chỉ cho byte đầu tiên trong `stream.ts` để không ngắt kết nối khi tải video dung lượng lớn.
- **Phase 4 — Frontend Page (`/tai-video`), Command Palette & Docs**:
  - Tạo `src/pages/tai-video.astro`, `src/scripts/tai-video.ts` và `src/pages/tai-video.md.ts` đồng bộ giao diện Champagne sáng của `tqd.me`, kích hoạt tải qua `<a download>` để tương thích CSP `frame-src`.
  - Tích hợp vào `src/pages/search.json.ts` (`Ctrl K`), `src/pages/sitemap.xml.ts`, `src/lib/profile-markdown.ts` (`/llms.txt`), `src/components/SectionBody.astro` (`/san-pham`), `scripts/verify/site.mjs`, `docs/video-downloader.md` và `README.md`.

## 2. Bằng chứng kiểm chứng cơ học

- `npm test`: `16 passed (16)`, `97 passed (97)`.
- `npm run verify:dl`: `OK dl-daemon`.
- `npm run build` (`astro check && astro build`): `0 errors, 0 warnings, 0 hints` (145 files) và `[build] Complete!`.
