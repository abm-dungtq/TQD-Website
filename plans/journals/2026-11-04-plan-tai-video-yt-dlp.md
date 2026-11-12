---
title: "Plan: tính năng tải video, nhạc, playlist & profile tại /tai-video trên tqd.me"
date: 2026-11-04
summary: "Lập plan --advice 4 phase xây dựng trang /tai-video dựa trên kiến trúc Hybrid Cloudflare Worker + Home Daemon (yt-dlp & ffmpeg) và lõi UX từ repo download-all-main"
---

# Plan: tính năng tải video, nhạc, playlist & profile tại `/tai-video` trên `tqd.me`

## What happened
Lập plan `plans/261104-1020-tai-video-yt-dlp/` (4 phase, hợp đồng `--advice`) sau khi hoàn tất `/ak-brainstorm --advice` và `/ak-advise` đối chiếu mã nguồn `tqd.me` cùng repo tham khảo `download-all-main`. Đã chạy `ak plan reindex --apply`, `ak plan validate ./plans/261104-1020-tai-video-yt-dlp` (valid, 0 errors) và ghim active plan `TQD-Website/261104-1020`.

## Decision
- Kế thừa từ `download-all-main`: bộ nhận diện 14+ nền tảng & làm sạch tracking URL (`dl-platforms.ts`), nhận diện video dọc 9:16 theo cạnh ngắn (`shortEdge`), sắp xếp codec H.264/AAC (`-S vcodec:h264,res,acodec:m4a`), `--progress-template` thời gian thực (`%`, `MB/s`, `ETA`), và bố cục 1-Click `⚡ TẢI NGAY` + 3 Preset + 3 Tab (khoác giao diện Champagne sáng của `tqd.me`).
- Loại bỏ các hàm chỉ dành cho máy local của `download-all-main` (`readClipboard()` phía server, `--load-info-json` từ đường dẫn client, `/api/system/*`, lịch sử chung trên server, `win98.css` / `security-guard.ts`).
- Tách pha `POST /api/dl/prepare` (ghép `ffmpeg -movflags +faststart` vào `/tmp/tqd-dl/<taskId>`) khỏi `GET /api/dl/stream?ticket=...` (truyền file tức thì `<50 ms` TTFB và xóa ngay file tạm khi đóng luồng) theo khuyến nghị của `kongming`.
- Phân quyền 2 tầng: khách Public giới hạn qua D1 `rate_limits` (`1080p` / `200 MB` / `25` mục, không dùng cookie cá nhân); Admin (`readSession`) hoặc API key (`authenticate`) mở khóa `4K` / `2 GB` / `100` mục.

## Next steps
Chạy `/ak-cook plans/261104-1020-tai-video-yt-dlp/plan.md --advice` để thực thi lần lượt 4 phase.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
