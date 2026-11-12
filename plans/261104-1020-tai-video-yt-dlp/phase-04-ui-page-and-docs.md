---
title: "Phase 4: Frontend Page (/tai-video), Command Palette & Docs"
status: todo
---

# Phase 4: Frontend Page (/tai-video), Command Palette & Docs

## Context Links
- Layout & Styles: [`src/layouts/BaseLayout.astro`](../../../src/layouts/BaseLayout.astro), [`src/styles/global.css`](../../../src/styles/global.css), [`src/components/PageHeading.astro`](../../../src/components/PageHeading.astro)
- Search, Sitemap & Sections: [`src/pages/search.json.ts`](../../../src/pages/search.json.ts), [`src/pages/sitemap.xml.ts`](../../../src/pages/sitemap.xml.ts), [`src/components/SectionBody.astro`](../../../src/components/SectionBody.astro)
- Reference UI Flow: `download-all-main/src/web/public/index.html` & `app.js`

## Overview
- **Priority**: P1
- **Status**: todo
- **Description**: Xây dựng giao diện công cụ tải video tại `/tai-video` (`src/pages/tai-video.astro` + `src/scripts/tai-video.ts`) theo đúng bảng màu Champagne sáng của `tqd.me`, kế thừa trải nghiệm 1-Click `⚡ TẢI NGAY`, 3 preset nhanh, chế độ dán nhiều link, quét Playlist/Profile, và 3 tab (`Tiến độ & Hàng đợi`, `Chọn độ phân giải chi tiết`, `Lịch sử đã tải` lưu trong `localStorage`); tích hợp vào `Ctrl K` (`/search.json`), `/sitemap.xml`, mục `/san-pham`, và viết tài liệu vận hành `docs/video-downloader.md`.

## Key Insights
- Trang `/tai-video` là một trang công khai nên SSR HTML của `src/pages/tai-video.astro` sẽ được lưu vào bộ nhớ đệm Edge (`caches.open('pages')` trong `src/middleware.ts`). Do đó, phần HTML tĩnh render từ server tuyệt đối không phụ thuộc vào phiên đăng nhập của người dùng; việc hiển thị nhãn `"Chế độ Admin (Đã mở khóa 4K & Batch 100)"` hay `"Chế độ Công khai"` được script `src/scripts/tai-video.ts` cập nhật động sau khi gọi `GET /api/dl/status`.
- Không dùng `fetch() -> res.blob()` để tải video về máy vì sẽ làm sập tab trình duyệt trên iOS/Android khi file lớn; khi `GET /api/dl/task/[id]` trả về `streamTicket`, trình duyệt kích hoạt tải gốc bằng thẻ `<a href="/api/dl/stream?ticket=..." download>` (hoặc `iframe` ẩn cho hàng đợi nhiều file).

## Requirements
- [x] Trang `/tai-video` (`src/pages/tai-video.astro`) sử dụng `BaseLayout` và `PageHeading`, thiết kế bằng các lớp chuẩn của `tqd.me` (`.lux-card`, `.lux-chip`, `.btn-gold`, `.gradient-hover`, biến màu `--color-paper`, `--color-panel`, `--color-ink`, `--color-accent`, `--color-champagne`).
- [x] Giao diện đầy đủ các thành phần từ `download-all-main`:
  1. **Thanh trạng thái & quyền hạn:** Hiển thị trạng thái kết nối lõi `yt-dlp`, tốc độ tải gần nhất (`MB/s`), và nhãn chế độ hiện tại (`Công khai · Tối đa 1080p` hoặc `Admin · Mở khóa 4K/Batch`).
  2. **Khu vực nhập Link & CTA chính:**
     - Ô nhập URL đơn kèm huy hiệu nền tảng tự nhảy (`🌐 Tự động`, `📺 YouTube`, `📱 YT Shorts`, `🎵 TikTok`, `📘 FB Reels`, `📷 Instagram`, `📑 N Links`).
     - Các nút thao tác nhanh: `📋 Dán Link` (đọc `navigator.clipboard.readText()`), `🧹 Xóa`, `📑 Tải Nhiều Link` (bật/tắt ô `textarea` dán mỗi dòng 1 link), và nút chính **`⚡ TẢI NGAY`**.
     - Hàng tùy chọn định dạng nhanh: `🌟 Cao nhất (1080p/4K)`, `🎬 HD 720p`, `🎵 Nhạc MP3 320kbps`, `🔍 Chọn độ phân giải...`, kèm checkbox `📂 Quét cả Playlist / Profile` và `Chuẩn hóa H.264 (iPhone/Zalo/CapCut)`.
  3. **3 Tab chức năng:**
     - **Tab 1 — `⚡ Tiến độ & Hàng đợi`:** Thẻ xem trước video đang xử lý (ảnh thu nhỏ, nhãn `[Shorts 9:16]` / `[Video]`, tiêu đề, kênh, thanh tiến độ `%`, tốc độ `MB/s`, `ETA`) + Danh sách Playlist/Batch có checkbox tích chọn từng mục, nút `Chọn tất cả / Bỏ chọn`, nút `Tải các mục đã chọn` và trạng thái từng mục trong hàng đợi.
     - **Tab 2 — `🔍 Chọn độ phân giải`:** Bảng hiển thị mọi mức chất lượng quét được (`2160p`, `1440p`, `1080p`, `720p`, `480p`, `360p`, `MP3 320kbps`), dung lượng dự kiến (`~MB`), thời gian tải ước tính (`~giây`) và nút `💾 Tải ngay` trên từng dòng.
     - **Tab 3 — `📁 Lịch sử đã tải`:** Lưu tối đa 50 mục gần nhất trong `localStorage` của trình duyệt người dùng (tiêu đề, nền tảng, định dạng, thời gian tải, nút mở lại link gốc hoặc tải lại) kèm nút `🗑️ Xóa lịch sử`.
- [x] Thêm lối tắt `/tai-video` vào `/search.json` (để `Ctrl K` / `⌘K` tìm thấy ngay), `/sitemap.xml`, và thẻ giới thiệu nổi bật đầu mục `/san-pham` trong `src/components/SectionBody.astro`.
- [x] Tạo tài liệu `docs/video-downloader.md` và cập nhật bảng liên kết trong `README.md`.

## Related Code Files
- **Create**:
  - `/Volumes/2/TQD-Website/src/pages/tai-video.astro`
  - `/Volumes/2/TQD-Website/src/pages/tai-video.md.ts`
  - `/Volumes/2/TQD-Website/src/scripts/tai-video.ts`
  - `/Volumes/2/TQD-Website/docs/video-downloader.md`
- **Modify**:
  - `/Volumes/2/TQD-Website/src/pages/search.json.ts`
  - `/Volumes/2/TQD-Website/src/pages/sitemap.xml.ts`
  - `/Volumes/2/TQD-Website/src/lib/profile-markdown.ts`
  - `/Volumes/2/TQD-Website/src/components/SectionBody.astro`
  - `/Volumes/2/TQD-Website/scripts/verify/site.mjs`
  - `/Volumes/2/TQD-Website/README.md`

## Tasks & Steps

### Task 4.1 — Xây dựng trang `src/pages/tai-video.astro` và script điều khiển `src/scripts/tai-video.ts`
- **Goal**: Hoàn thiện giao diện và toàn bộ luồng tương tác của trang `/tai-video` trên `tqd.me`.
- **Target files and symbols**:
  - `/Volumes/2/TQD-Website/src/pages/tai-video.astro`
  - `/Volumes/2/TQD-Website/src/scripts/tai-video.ts`
- **Steps**:
  1. Tạo `/Volumes/2/TQD-Website/src/pages/tai-video.astro`:
     - Tải `site = await getSite(env.DB)` và bọc trong `<BaseLayout site={site} title="Tải Video & Nhạc Đa Nền Tảng" description="Công cụ tải video, Shorts, Reels, TikTok, YouTube, Playlist và tách nhạc MP3 chất lượng cao trên tqd.me." path="/tai-video">`.
     - Dựng giao diện bằng hệ thống class `.lux-card`, `.lux-chip`, `.btn-gold`, `.gradient-hover` và bảng màu sáng của `tqd.me` (đảm bảo độ tương phản chữ `>= 4.5:1`, vùng chạm tối thiểu `44x44px` trên di động, tôn trọng `prefers-reduced-motion`).
  2. Tạo `/Volumes/2/TQD-Website/src/scripts/tai-video.ts`:
     - Quản lý `visitorId` (tái sử dụng khóa `localStorage` hoặc sinh UUID v4 lưu tại `tqd_visitor_id`).
     - Khi mở trang, gọi `GET /api/dl/status` để hiển thị trạng thái kết nối Daemon và hạn mức hiện tại (`public` vs `admin`).
     - Tự động nhận diện nền tảng ngay khi gõ/dán vào `#dl-input-url` bằng `detectPlatform` và `extractUrlsFromInput` từ `../lib/dl-platforms`.
     - Xử lý nút `⚡ TẢI NGAY`:
       - Nếu là 1 link video lẻ và chọn preset (`best`, `720p`, `audio`): gọi `POST /api/dl/resolve` -> chọn định dạng khớp preset -> gọi ngay `POST /api/dl/prepare` -> poll `GET /api/dl/task/[id]?ticket=...` mỗi `1000 ms` để cập nhật thanh `%`, `MB/s`, `ETA` -> khi `completed`, tự động kích hoạt tải file qua `/api/dl/stream?ticket=<streamTicket>` và lưu vào lịch sử `localStorage`.
       - Nếu là Playlist / Profile hoặc chế độ Nhiều Link: hiển thị danh sách các video trong bảng hàng đợi kèm checkbox (mặc định chọn tất cả), khi bấm `⚡ Tải các mục đã chọn` sẽ chạy tuần tự từng mục (tối đa 2 mục song song) qua `prepare` -> `task` -> `stream`.
       - Nếu chọn `🔍 Chọn độ phân giải...`: chuyển sang Tab 2, hiển thị bảng chi tiết mọi độ phân giải từ kết quả `resolve` để người dùng bấm `💾 Tải ngay` ở dòng mong muốn.
- **Success criteria**: Trang `/tai-video` và `src/scripts/tai-video.ts` biên dịch sạch, không có lỗi TypeScript hay CSP.
- **Verify**: no verification needed (được kiểm tra ở Task 4.3).

### Task 4.2 — Tích hợp `/tai-video`, `/tai-video.md` vào `search.json.ts`, `sitemap.xml.ts`, `profile-markdown.ts`, `SectionBody.astro` và viết `docs/video-downloader.md`
- **Goal**: Giúp người dùng và AI Agent tìm thấy `/tai-video` từ tìm kiếm nhanh `Ctrl K` / `⌘K`, mục **Sản phẩm** (`/san-pham`), `/sitemap.xml`, `/llms.txt`, `/tai-video.md` (bắt buộc để `scripts/check-no-post-text.mjs` không lỗi 404 khi quét các đường dẫn trong `sitemap.xml`), và có tài liệu vận hành đầy đủ.
- **Target files and symbols**:
  - `/Volumes/2/TQD-Website/src/pages/tai-video.md.ts` (`GET`)
  - `/Volumes/2/TQD-Website/src/pages/search.json.ts` (`GET`)
  - `/Volumes/2/TQD-Website/src/pages/sitemap.xml.ts` (`GET`)
  - `/Volumes/2/TQD-Website/src/lib/profile-markdown.ts` (`llmsText`)
  - `/Volumes/2/TQD-Website/src/components/SectionBody.astro` (`id === 'san-pham'`)
  - `/Volumes/2/TQD-Website/scripts/verify/site.mjs`
  - `/Volumes/2/TQD-Website/docs/video-downloader.md`
  - `/Volumes/2/TQD-Website/README.md`
- **Steps**:
  1. Tạo `/Volumes/2/TQD-Website/src/pages/tai-video.md.ts` dùng `markdownResponse()` từ `../lib/profile-markdown` để trả về bản Markdown giới thiệu công cụ `/tai-video` (200 OK `text/markdown; charset=utf-8`), và đặt `markdownPath="/tai-video.md"` trên `<BaseLayout>` trong `src/pages/tai-video.astro`.
  2. Trong `/Volumes/2/TQD-Website/src/pages/search.json.ts`, thêm mục công cụ trực tuyến vào mảng `entries`:
     ```ts
     { title: 'Tải Video & Nhạc Đa Nền Tảng (yt-dlp)', url: '/tai-video', kind: 'product', hint: 'Công cụ tải YouTube, TikTok, Reels, Playlist, MP3' },
     ```
     (Không đặt trường `id` để khi bấm trong `Ctrl K` trên màn hình chính sẽ mở thẳng `/tai-video`).
  3. Trong `/Volumes/2/TQD-Website/src/pages/sitemap.xml.ts`, thêm `{ loc: `${siteOrigin}/tai-video`, lastmod }` vào mảng `urls`, và thêm liên kết `/tai-video.md` vào hàm `llmsText()` trong `src/lib/profile-markdown.ts`.
  4. Trong `/Volumes/2/TQD-Website/src/components/SectionBody.astro`, tại nhánh `id === 'san-pham'`, thêm thẻ giới thiệu công cụ `Tải Video & Nhạc Đa Nền Tảng` có nút mở `/tai-video`. Cập nhật `scripts/verify/site.mjs` kiểm tra thêm `/tai-video`, `/tai-video.md`, `/api/dl/status` và `POST /api/dl/resolve` khác origin trả `403`.
  5. Tạo `/Volumes/2/TQD-Website/docs/video-downloader.md` mô tả kiến trúc, cách chạy `npm run dl:daemon`, cách cấu hình Cloudflare Tunnel (`dl.tqd.io.vn`), cách đặt secret `DL_API_KEY` cho Worker, và cách cập nhật rule WAF Rate Limiting trên zone `tqd.me`. Cập nhật `README.md` dẫn link tới `docs/video-downloader.md`.
- **Success criteria**: `/tai-video.md`, `/search.json`, `/sitemap.xml`, `/llms.txt`, `/san-pham` và `docs/video-downloader.md` đều có thông tin `/tai-video`.
- **Verify**: no verification needed (được kiểm tra ở Task 4.3).

### Task 4.3 — Kiểm tra tổng thể Type-check, Unit Test, Daemon Verify và Production Build
- **Goal**: Xác nhận toàn bộ dự án build thành công, vượt qua mọi bài test và script kiểm tra.
- **Target files and symbols**:
  - Toàn bộ các file đã tạo/sửa trong Phase 1–4.
- **Steps**:
  1. Chạy `npm test` (`vitest run`).
  2. Chạy `npm run verify:dl` (`node scripts/verify/dl-daemon.mjs`).
  3. Chạy `npm run build` (`astro check && astro build`).
- **Success criteria**: Cả 3 lệnh đều thoát với mã `0`, không có lỗi TypeScript hay lỗi đóng gói Worker.
- **Verify**: `npm test && npm run verify:dl && npm run build` thoát với mã `0` và in `OK dl-daemon` cùng `Complete!`.

## Todo
- [x] Task 4.1: Tạo `src/pages/tai-video.astro` và `src/scripts/tai-video.ts`
- [x] Task 4.2: Cập nhật `search.json.ts`, `sitemap.xml.ts`, `SectionBody.astro`, `README.md` và viết `docs/video-downloader.md`
- [x] Task 4.3: Chạy `npm test && npm run verify:dl && npm run build`

## Success Criteria
- `npm test && npm run verify:dl && npm run build` hoàn tất với mã thoát `0`.

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
