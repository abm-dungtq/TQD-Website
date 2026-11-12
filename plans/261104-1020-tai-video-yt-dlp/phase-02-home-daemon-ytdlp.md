---
title: "Phase 2: Home Daemon (yt-dlp + ffmpeg) & Local Verification"
status: todo
---

# Phase 2: Home Daemon (yt-dlp + ffmpeg) & Local Verification

## Context Links
- Phase 1 Core Library: [`src/lib/dl-platforms.ts`](../../../src/lib/dl-platforms.ts), [`src/lib/dl.ts`](../../../src/lib/dl.ts)
- Reference `download-all-main` Engine: `src/lib/ytdlp.ts` (`probe`, `buildChoices`, `detectIsVerticalVideo`, `download`, `--progress-template`, `-S vcodec:h264,res,acodec:m4a`)

## Overview
- **Priority**: P1
- **Status**: todo
- **Description**: Xây dựng dịch vụ nền nhẹ `scripts/ytdlp-daemon.mjs` chạy trên máy chủ nhà (nối qua Cloudflare Tunnel giống GoClaw) để thực thi `yt-dlp` và `ffmpeg` an toàn, quản lý hàng đợi tải song song (`maxConcurrent = 2`), lưu file tạm vào `/tmp/tqd-dl` với cơ chế tự xóa ngay sau khi stream về trình duyệt người dùng (hoặc tự dọn sau 10 phút), kèm script kiểm tra tự động `scripts/verify/dl-daemon.mjs`.

## Key Insights
- `ffmpeg` khi ghép luồng hình + tiếng sang `.mp4` với `-movflags +faststart` cần ghi `moov` atom ở cuối quá trình muxing nên bắt buộc phải ghi ra file tạm trong `/tmp/tqd-dl/<taskId>/` trước, sau đó `GET /stream/:taskId` mới truyền file từ ổ đĩa về trình duyệt với độ trễ byte đầu tiên `<50 ms` kèm `Content-Length` và `Content-Disposition: attachment; filename*=UTF-8''...`.
- Tuyệt đối không dùng shell (`spawn(ytdlpBin, args, { stdio: ... })` với mảng tham số và cờ `--` đứng trước URL), luôn bật `--no-config`, `--no-exec`, `--no-mark-watched`, `--downloader-args "ffmpeg:-protocol_whitelist https,tls,tcp,crypto"`.

## Requirements
- [x] Tự động tìm `yt-dlp` và `ffmpeg` trong `PATH` (`/Users/tqd/.local/bin/yt-dlp`, `/opt/homebrew/bin/ffmpeg` hoặc cấu hình qua biến môi trường `YTDLP_BIN`, `FFMPEG_BIN`).
- [x] Xác thực mọi request (trừ `GET /health`) bằng header `Authorization: Bearer <DL_API_KEY>` (so sánh an toàn chống timing attack).
- [x] Cung cấp 5 endpoint HTTP JSON/Stream:
  1. `GET /health` -> `{ ok: true, version, activeTasks, queuedTasks }`
  2. `POST /resolve` -> nhận `{ urls, allowPlaylist, maxItems, maxHeight, cookiesBrowser }`, chạy `yt-dlp -J` (có `--flat-playlist --playlist-end <maxItems>` khi là playlist/profile), trả về thông tin video, nhãn Shorts 9:16, danh sách độ phân giải (`buildChoices`) đã lọc theo `maxHeight`, hoặc danh sách các mục trong playlist/profile.
  3. `POST /prepare` -> nhận `{ url, title, formatId, kind, maxHeight, maxFilesizeMB, compatibilityMode }`, tạo tác vụ trong hàng đợi (`maxConcurrent = 2`), chạy `yt-dlp` với `--progress-template` và `-S vcodec:h264,res,acodec:m4a` + `--ppa "Merger+ffmpeg_o1:-movflags +faststart"`, trả về `{ taskId, status }`.
  4. `GET /task/:id` -> trả về `{ id, status, progress: { downloadedBytes, totalBytes, speed, eta, percent }, filename, sizeBytes, error }` để trình duyệt hiển thị thanh tiến độ `%`, `MB/s`, `ETA` thời gian thực.
  5. `GET /stream/:id` -> truyền trực tiếp file đã ghép xong với `Content-Type` (`video/mp4` hoặc `audio/mpeg`), `Content-Length` và `Content-Disposition: attachment; filename*=UTF-8''...`; ngay khi response kết thúc (`res.on('close')`), xóa ngay thư mục tạm `/tmp/tqd-dl/<id>`.
- [x] Bộ dọn rác định kỳ mỗi 60 giây xóa mọi thư mục con trong `/tmp/tqd-dl` quá 10 phút hoặc khi tổng dung lượng vượt 3 GB.

## Related Code Files
- **Create**:
  - `/Volumes/2/TQD-Website/scripts/ytdlp-daemon.mjs`
  - `/Volumes/2/TQD-Website/scripts/verify/dl-daemon.mjs`
- **Modify**:
  - `/Volumes/2/TQD-Website/package.json` (thêm script `"dl:daemon": "node scripts/ytdlp-daemon.mjs"` và `"verify:dl": "node scripts/verify/dl-daemon.mjs"`)

## Tasks & Steps

### Task 2.1 — Tạo Home Daemon `scripts/ytdlp-daemon.mjs`
- **Goal**: Xây dựng HTTP server Node.js độc lập điều phối `yt-dlp` và `ffmpeg` với hàng đợi, phân tích tiến độ thời gian thực, chuẩn hóa H.264 và tự xóa file tạm.
- **Target files and symbols**:
  - `/Volumes/2/TQD-Website/scripts/ytdlp-daemon.mjs` (`startDlDaemon`, `buildChoices`, `detectIsVerticalVideo`, `probeOneUrl`, `runDownloadTask`)
  - `/Volumes/2/TQD-Website/package.json` (`scripts`)
- **Steps**:
  1. Tạo `/Volumes/2/TQD-Website/scripts/ytdlp-daemon.mjs` chỉ dùng các module chuẩn của Node (`node:http`, `node:child_process`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `node:crypto`) và import `validateSafeMediaUrl`, `detectPlatform`, `isPlaylistOrProfileUrl` từ `../src/lib/dl-platforms.ts`.
  2. Kế thừa hàm `detectIsVerticalVideo(info, url)` và `buildChoices(info, maxHeight)` từ `download-all-main/src/lib/ytdlp.ts`:
     - Phân biệt video dọc 9:16 (`Shorts 9:16`) theo `shortEdge = Math.min(height, width)`.
     - Lọc các mức độ phân giải vượt quá `maxHeight` (ví dụ khách Public chỉ nhận tới `1080p`, Admin nhận tới `2160p 4K`).
     - Luôn có các lựa chọn chuẩn: các mức độ phân giải video `.mp4` (`best`, `1080p`, `720p`, `480p`, `360p`...) và `Audio MP3 (320kbps) · mp3`.
  3. Cài đặt `POST /resolve`:
     - Nếu nhận nhiều URL (`urls.length > 1`), trả về chế độ `batch` gồm danh sách các mục đã kiểm tra qua `validateSafeMediaUrl` và nhãn nền tảng từ `detectPlatform`.
     - Nếu nhận 1 URL: kiểm tra `validateSafeMediaUrl`, gọi `yt-dlp -J --no-warnings --no-config --no-exec` (kèm `--yes-playlist --flat-playlist --playlist-end <maxItems>` nếu `allowPlaylist || isPlaylistOrProfileUrl(url)`, ngược lại `--no-playlist`) và `--` trước `url`.
  4. Cài đặt `POST /prepare`, `GET /task/:id` và `GET /stream/:id`:
     - Lưu tác vụ trong `Map`, giới hạn tối đa `MAX_CONCURRENT = 2` tiến trình `yt-dlp` chạy cùng lúc.
     - Mỗi tác vụ tạo thư mục riêng `/tmp/tqd-dl/<taskId>`, chạy `yt-dlp` với `--progress-template download:DLMEDIA|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s`, `-S vcodec:h264,res,acodec:m4a` (khi tải video), `--max-filesize <maxFilesizeMB>M`, `--no-playlist`, `--no-config`, `--no-exec`, `--ppa "Merger+ffmpeg_o1:-movflags +faststart"`, `--print after_move:filepath`, `-o /tmp/tqd-dl/<taskId>/%(title).80B [%(id).16B].%(ext)s`, `--`, `url`.
     - Khi `GET /stream/:id` được gọi trên một tác vụ đã `completed`, gửi header `Content-Disposition: attachment; filename="..."; filename*=UTF-8''...`, `Content-Length`, pipe `fs.createReadStream(filepath)` vào `res`, và trong sự kiện `res.on('close')` gọi `fs.rm(taskDir, { recursive: true, force: true })`.
  5. Thêm chế độ giả lập kiểm thử (`DL_MOCK_ENGINE=1`) trong `scripts/ytdlp-daemon.mjs` để script kiểm tra tự động có thể test toàn bộ luồng `/resolve` -> `/prepare` -> `/task/:id` -> `/stream/:id` và xóa file tạm trong `/tmp/tqd-dl` mà không phụ thuộc mạng ngoài.
  6. Thêm `"dl:daemon": "node scripts/ytdlp-daemon.mjs"` và `"verify:dl": "node scripts/verify/dl-daemon.mjs"` vào `/Volumes/2/TQD-Website/package.json`.
- **Success criteria**: `scripts/ytdlp-daemon.mjs` khởi chạy sạch và xuất hàm `startDlDaemon`.
- **Verify**: no verification needed (được kiểm tra cơ học ở Task 2.2).

### Task 2.2 — Viết và chạy script kiểm chứng Daemon `scripts/verify/dl-daemon.mjs`
- **Goal**: Kiểm chứng cơ học toàn bộ vòng đời của `scripts/ytdlp-daemon.mjs` (xác thực Bearer key, chặn SSRF, `/resolve`, `/prepare`, `/task/:id`, `/stream/:id` và tự động xóa sạch thư mục tạm `/tmp/tqd-dl/<taskId>`).
- **Target files and symbols**:
  - `/Volumes/2/TQD-Website/scripts/verify/dl-daemon.mjs`
- **Steps**:
  1. Tạo `/Volumes/2/TQD-Website/scripts/verify/dl-daemon.mjs` khởi động `startDlDaemon({ port: 0, apiKey: 'test-secret-key', mockEngine: true })` trên một cổng ngẫu nhiên.
  2. Kiểm tra:
     - `GET /health` trả `200` và `ok: true`.
     - `POST /resolve` không có header `Authorization` trả `401`.
     - `POST /resolve` với URL nội bộ `http://127.0.0.1:8080/video.mp4` trả `400`.
     - `POST /resolve` với URL hợp lệ `https://www.youtube.com/watch?v=dQw4w9WgXcQ` trả danh sách `choices` có cả `video` và `audio`.
     - `POST /prepare` -> đợi `GET /task/:id` chuyển sang `completed` -> gọi `GET /stream/:id` nhận đúng nội dung file kèm header `Content-Disposition: attachment` -> xác nhận thư mục tạm `/tmp/tqd-dl/<taskId>` đã bị xóa hoàn toàn khỏi ổ đĩa (`fs.existsSync` trả `false`).
  3. Đóng server và in `OK dl-daemon`.
- **Success criteria**: Script chạy xong, đóng cổng sạch sẽ và in `OK dl-daemon`.
- **Verify**: `node scripts/verify/dl-daemon.mjs` thoát với mã `0` và in `OK dl-daemon`.

## Todo
- [x] Task 2.1: Tạo `scripts/ytdlp-daemon.mjs` và cập nhật `package.json`
- [x] Task 2.2: Tạo và chạy `scripts/verify/dl-daemon.mjs`

## Success Criteria
- `node scripts/verify/dl-daemon.mjs` in `OK dl-daemon` và thoát `0`.

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
