# Công cụ Tải Video Đa Nền Tảng & Xưởng Mổ Xẻ Kịch Bản Viral AI (`/tai-video`)

Trang `/tai-video` cung cấp 2 nhóm năng lực trên cùng một giao diện Champagne sáng của `tqd.me`:
1. **Tải Video & Nhạc 14+ Nền Tảng**: Tải video `.mp4` chuẩn H.264 + AAC (`faststart`), Shorts/Reels dọc 9:16, Playlist, `@profile`, nhiều link hàng loạt và tách nhạc `.mp3` 320kbps qua `yt-dlp` + `ffmpeg`.
2. **TQD Viral Lab (`🧬 Mổ Xẻ Viral & Kịch Bản AI`)**: Bóc băng lời thoại có mốc thời gian (`Transcript` + xuất `.srt`), giải phẫu X-Quang yếu tố triệu view và nhân bản kịch bản đa kênh ("Đổi Ngành Giữ Khung" & "Việt Hóa Trend Ngoại") bằng **`opencode-go` (`deepseek-v4.1-flash`)** kết hợp bộ quy chuẩn chống văn mẫu AI **`viet-pro`**.

## 1. Đường đi của một lượt tải file

```text
trình duyệt (/tai-video)
  ├── 1. POST /api/dl/resolve ──▶ Worker (SSRF + Rate-limit + HMAC itemTicket) ──▶ VPS Daemon (/resolve: yt-dlp -J)
  ├── 2. POST /api/dl/prepare ──▶ Worker (Verify itemTicket + D1 Quota)       ──▶ VPS Daemon (/prepare: yt-dlp + ffmpeg -> /tmp/tqd-dl/<id>)
  ├── 3. GET  /api/dl/task/:id ─▶ Worker (Verify taskTicket + Sign streamTicket) ▶ VPS Daemon (/task/:id: % / MB/s / ETA)
  └── 4. GET  /api/dl/stream  ──▶ Worker (Zero-buffer ReadableStream proxy)   ──▶ VPS Daemon (/stream/:id -> xóa ngay /tmp/tqd-dl/<id>)
```

## 2. Đường đi của Xưởng Mổ Xẻ Kịch Bản Viral (`/api/viral/*` & `/xray/[id]`)

```text
trình duyệt (/tai-video Tab 2)
  ├── 1. POST /api/viral/transcribe
  │       ├── Tra cứu D1 `viral_transcripts` (Canonical Hash 30 ngày) ──▶ HIT (<80ms, 0 Neuron)
  │       └── MISS ──▶ VPS Daemon (/transcribe):
  │                     ├─ Tầng 1: yt-dlp --write-subs / --write-auto-subs (0 Neuron, ~1.5s)
  │                     └─ Tầng 2 (TikTok/Reels/Douyin hardsub): ffmpeg tách MP3 mono 32kbps 16kHz (~240KB/phút),
  │                                xóa ngay thư mục tạm trong `finally`, trả base64 ──▶ Worker gọi `env.AI` (`@cf/openai/whisper-large-v3-turbo`)
  │
  ├── 2. POST /api/viral/generate (SSE `ReadableStream` passthrough, Worker CPU <2ms)
  │       └── Gọi OpenCode Go (`deepseek-v4.1-flash`, `x-opencode-session: ses_<videoHash>`) kèm thẻ cách ly `<untrusted_video_transcript>`
  │           + quy tắc `viet-pro` (Bảng kịch bản 3 cột, Facebook kể chuyện, Chuỗi Threads 5 bài, YouTube dài, LinkedIn)
  │           + kiểm định tất định 21 quy tắc `src/lib/viet-pro-lint.ts` ngay trên trình duyệt (0ms CPU server) & nút Khử văn mẫu 1-Click.
  │
  └── 3. POST /api/viral/share ──▶ Lưu vào D1 `viral_shares` ──▶ Trang công khai `GET /xray/[id]` (`X-Robots-Tag: noindex, follow`)
```

## 3. Phân tầng hạn mức (2-Tier Access)

| Tầng | Độ phân giải / Dung lượng tải | Thời lượng Mổ Xẻ Viral | Hạn mức bảo vệ D1 (`rate_limits`) |
|---|---|---|---|
| **Public** (Khách) | `1080p Full HD` · `200 MB` · Batch `25` | Tối đa `5 phút` (`300s`) | Tải: 15/giờ/visitor · Bóc băng mới: 8/giờ/visitor (trần ngày `VIRAL_DAILY_CAP` = 150; Cache Hit không tính lượt) · Sinh kịch bản: 20/giờ/visitor |
| **Admin** (Chủ web / API Key) | `2160p 4K Ultra HD` · `2000 MB` · Batch `100` | Tối đa `30 phút` (`1800s`) | Mở khóa toàn bộ hạn mức khách vãng lai |

Cron hằng đêm trong `src/worker.ts` gọi `cleanupDlLimits(env.DB)` và `cleanupViralCache(env.DB)` để dọn các dòng `rate_limits` cũ hơn 2 ngày cùng dữ liệu đệm `viral_transcripts`, `viral_shares` cũ hơn 30 ngày.

## 4. Cấu hình biến môi trường & Bindings

| Tên | Loại | Giá trị / Ghi chú |
|---|---|---|
| `AI` | Binding (`wrangler.jsonc`) | Cloudflare Workers AI (`@cf/openai/whisper-large-v3-turbo` — miễn phí 10.000 Neurons/ngày ≈ 214 phút âm thanh/ngày) |
| `DL_BASE_URL` | `vars` (`wrangler.jsonc`) | `https://chatbot.abmedu.vn/_tqd_dl` (VPS Ubuntu 24/7 chạy `tqd-dl-daemon.service`) |
| `DL_DAILY_CAP` / `VIRAL_DAILY_CAP` | `vars` (`wrangler.jsonc`) | `150` |
| `OPENCODE_GO_BASE_URL` | `vars` (`wrangler.jsonc`) | `https://opencode.ai/zen/go/v1` |
| `OPENCODE_GO_MODEL` | `vars` (`wrangler.jsonc`) | `deepseek-v4.1-flash` |
| `DL_API_KEY` | `secret` | Khóa xác thực Bearer & ký HMAC-SHA256 giữa Worker và VPS Daemon |
| `OPENCODE_GO_API_KEY` | `secret` | Khóa API OpenCode Go cho `deepseek-v4.1-flash` |

## 5. Kiểm tra tự động

- `npm test`: Chạy toàn bộ 21 bộ unit test bao gồm `src/lib/dl.test.ts` và `src/lib/viral.test.ts` (chuẩn hóa URL đa nền tảng, parser phụ đề VTT/SRT, mock daemon `/transcribe`, bộ kiểm định 21 luật `viet-pro`, xuất `.srt`/CapCut và chống Prompt Injection).
- `npm run verify:dl`: Kiểm thử vòng đời daemon cô lập và xác nhận thư mục tạm trong `/tmp/tqd-dl` tự xóa 100%.
