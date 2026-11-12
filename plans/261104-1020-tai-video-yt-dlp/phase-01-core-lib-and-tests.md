---
title: "Phase 1: Core Library, SSRF Guard, HMAC Tickets & Unit Tests"
status: todo
---

# Phase 1: Core Library, SSRF Guard, HMAC Tickets & Unit Tests

## Context Links
- Brainstorm & Advise Report: [`plans/reports/brainstorm-261104-1708-tai-video-yt-dlp.md`](../../reports/brainstorm-261104-1708-tai-video-yt-dlp.md)
- Existing Chat Gateway Pattern: [`src/lib/chat.ts`](../../../src/lib/chat.ts), [`src/lib/chat.test.ts`](../../../src/lib/chat.test.ts)
- Existing Auth & Rate-Limit Helpers: [`src/lib/auth.ts`](../../../src/lib/auth.ts), [`src/lib/api-key.ts`](../../../src/lib/api-key.ts), [`src/lib/rate-limit.ts`](../../../src/lib/rate-limit.ts)

## Overview
- **Priority**: P1
- **Status**: todo
- **Description**: Xây dựng thư viện nền tảng cho tính năng tải video gồm: nhận diện 14+ nền tảng & làm sạch URL (`src/lib/dl-platforms.ts`), bộ kiểm tra chống SSRF (chặn IP nội bộ, localhost, giao thức ngoài `http/https`), cơ chế ký/xác thực vé tải `HMAC-SHA256` (`itemTicket` và `streamTicket`), cấu hình hạn mức 2 tầng (`public` vs `admin`), khai báo biến môi trường trong `wrangler.jsonc` / `src/env.d.ts`, và bộ unit test đầy đủ (`src/lib/dl.test.ts`).

## Key Insights
- Các file trong `src/lib/*.ts` nếu được import bởi cả Worker và script Node `.mjs` thì không dùng `enum` hoặc `namespace`, và dùng Web Crypto API (`crypto.subtle`) vốn có sẵn trên cả Cloudflare Workers lẫn Node >= 22.
- Không cho phép client truyền đường dẫn file (`infoJsonPath` hay `outDir`) như trong repo cũ; thay vào đó, Worker ký một vé `HMAC-SHA256` (`<payloadBase64url>.<sigBase64url>`) bằng khóa `DL_API_KEY` chứa `{ kind, url, tier, maxHeight, maxBytes, exp }` (cho `itemTicket`) hoặc `{ kind: 'stream', taskId, filename, exp }` (cho `streamTicket`).

## Requirements
- [x] Nhận diện chính xác nền tảng (YouTube, YT Shorts, YT Music, TikTok, Douyin, Facebook, FB Reels, Instagram Reels, X/Twitter, Threads, Reddit, Twitch, Vimeo, Bilibili, SoundCloud, Dailymotion, Pinterest), nhận diện link Playlist/Profile (`/@user`, `/playlist`, `?list=`), xóa tracking params (`fbclid`, `si`, `utm_*`, `igshid`) và tách nhiều URL từ đoạn văn bản.
- [x] Chặn tuyệt đối các URL không hợp lệ hoặc trỏ về nội bộ (SSRF): `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, `0.0.0.0`, `[::1]`, `[fc00::]/7`, `[fe80::]/10`, tên miền `.local` / `.internal`, hoặc URL chứa thông tin đăng nhập `user:pass@host`.
- [x] Ký và kiểm tra vé `HMAC-SHA256` (`signDlTicket`, `verifyDlTicket`) chống giả mạo và kiểm tra hạn sử dụng (`exp`).
- [x] Định nghĩa rõ 2 tầng hạn mức (`PUBLIC_LIMITS` vs `ADMIN_LIMITS`) và hàm xác định tầng truy cập từ cookie phiên Admin hoặc header `Authorization: Bearer tqd_...`.

## Related Code Files
- **Create**:
  - `/Volumes/2/TQD-Website/src/lib/dl-platforms.ts`
  - `/Volumes/2/TQD-Website/src/lib/dl.ts`
  - `/Volumes/2/TQD-Website/src/lib/dl.test.ts`
- **Modify**:
  - `/Volumes/2/TQD-Website/src/env.d.ts`
  - `/Volumes/2/TQD-Website/wrangler.jsonc`

## Tasks & Steps

### Task 1.1 — Khai báo biến môi trường Downloader trong `src/env.d.ts` và `wrangler.jsonc`
- **Goal**: Bổ sung kiểu dữ liệu và biến cấu hình `DL_BASE_URL`, `DL_DAILY_CAP`, `DL_API_KEY` cho Worker production và preview.
- **Target files and symbols**:
  - `/Volumes/2/TQD-Website/src/env.d.ts` (`interface Env` trong `namespace Cloudflare`)
  - `/Volumes/2/TQD-Website/wrangler.jsonc` (`vars` ở gốc và `env.preview.vars`)
- **Steps**:
  1. Mở `/Volumes/2/TQD-Website/src/env.d.ts`, trong `declare namespace Cloudflare { interface Env { ... } }`, thêm:
     - `DL_API_KEY?: string;`
     - `DL_BASE_URL?: string;`
     - `DL_DAILY_CAP?: string;`
  2. Mở `/Volumes/2/TQD-Website/wrangler.jsonc`, thêm `"DL_BASE_URL": "https://dl.tqd.io.vn"` và `"DL_DAILY_CAP": "150"` vào đối tượng `vars` ở cả cấp gốc (dòng 16) và `env.preview.vars` (dòng 29).
- **Success criteria**: `src/env.d.ts` và `wrangler.jsonc` có đủ `DL_BASE_URL`, `DL_DAILY_CAP`, `DL_API_KEY` mà không làm hỏng JSONC.
- **Verify**: no verification needed (được kiểm tra bởi `npx vitest run` và `npx astro check` ở Task 1.4).

### Task 1.2 — Tạo module nhận diện nền tảng, làm sạch URL và chống SSRF tại `src/lib/dl-platforms.ts`
- **Goal**: Cung cấp các hàm thuần (pure functions) để nhận diện nền tảng, phân loại Shorts/Playlist/Profile, tách danh sách URL và chặn SSRF.
- **Target files and symbols**:
  - `/Volumes/2/TQD-Website/src/lib/dl-platforms.ts` (`Platform`, `detectPlatform`, `isShortsOrReelsUrl`, `isPlaylistOrProfileUrl`, `normalizeMediaUrl`, `extractUrlsFromInput`, `validateSafeMediaUrl`)
- **Steps**:
  1. Tạo `/Volumes/2/TQD-Website/src/lib/dl-platforms.ts` kế thừa danh sách `PLATFORMS` từ `download-all-main/src/lib/platforms.ts`.
  2. Viết hàm `validateSafeMediaUrl(raw: string): { ok: true; url: string } | { ok: false; error: string }`:
     - Chỉ chấp nhận giao thức `http:` hoặc `https:`, từ chối nếu có `u.username` hoặc `u.password`, hoặc độ dài `> 2048` ký tự.
     - Từ chối hostname là `localhost`, kết thúc bằng `.localhost`, `.local`, `.internal`, `.lan`, hoặc không có dấu chấm `.`.
     - Nếu hostname là IPv4 (`^\d+\.\d+\.\d+\.\d+$`) hoặc IPv6 (`[...]`), chặn toàn bộ dải loopback/private/link-local (`127.*`, `10.*`, `172.16-31.*`, `192.168.*`, `169.254.*`, `0.*`, `100.64-127.*`, `[::1]`, `[fe80:...]`, `[fc00:...]`, `[fd00:...]`).
     - Trả về `{ ok: true, url: normalizeMediaUrl(u.toString()) }` khi hợp lệ, hoặc thông báo lỗi tiếng Việt khi không hợp lệ.
  3. Viết hàm `isPlaylistOrProfileUrl(url: string): boolean`:
     - Trả `true` cho URL có `/playlist`, `/sets/`, tham số `list=` (khi không phải link xem 1 video lẻ trừ khi bật `allowPlaylist`), đường dẫn kênh YouTube (`/@[^/]+(/videos|/shorts|/streams)?$`, `/channel/`, `/c/`), hoặc trang hồ sơ TikTok (`tiktok.com/@[^/]+/?$` không chứa `/video/`).
  4. Viết hàm `extractUrlsFromInput(raw: string): string[]` tách các URL `https?://...`, lọc qua `validateSafeMediaUrl` và khử trùng lặp.
- **Success criteria**: File `src/lib/dl-platforms.ts` biên dịch sạch, không phụ thuộc thư viện ngoài.
- **Verify**: no verification needed (được kiểm tra trực tiếp bởi Task 1.4).

### Task 1.3 — Tạo module phân tầng hạn mức, ký vé HMAC và giao tiếp Daemon tại `src/lib/dl.ts`
- **Goal**: Cung cấp hàm kiểm tra quyền `public`/`admin`, hạn mức D1, ký/xác thực vé HMAC (`itemTicket` và `streamTicket`), kiểm tra `/health` của Daemon và dọn dẹp `rate_limits`.
- **Target files and symbols**:
  - `/Volumes/2/TQD-Website/src/lib/dl.ts` (`DlTier`, `TierLimits`, `TIER_LIMITS`, `PUBLIC_VISITOR_PER_HOUR`, `PUBLIC_IP_PER_HOUR`, `DEFAULT_DL_DAILY_CAP`, `resolveDlTier`, `signDlTicket`, `verifyDlTicket`, `dlIpBucket`, `daemonOnline`, `callDaemon`, `cleanupDlLimits`, `parseResolveBody`, `parsePrepareBody`)
- **Steps**:
  1. Tạo `/Volumes/2/TQD-Website/src/lib/dl.ts` với hằng số hạn mức:
     - `PUBLIC_VISITOR_PER_HOUR = 15`, `PUBLIC_IP_PER_HOUR = 30`, `DEFAULT_DL_DAILY_CAP = 150`.
     - `TIER_LIMITS`:
       - `public`: `{ maxHeight: 1080, maxFilesizeMB: 200, maxBatchItems: 25, allowCookies: false }`
       - `admin`: `{ maxHeight: 2160, maxFilesizeMB: 2000, maxBatchItems: 100, allowCookies: true }`
  2. Viết hàm `resolveDlTier(db: D1Database, sessionCookie: string | undefined, authHeader: string | null): Promise<DlTier>`:
     - Kiểm tra `await readSession(db, sessionCookie)` hoặc `await authenticate(db, authHeader)`. Nếu một trong hai hợp lệ thì trả `'admin'`, ngược lại trả `'public'`.
  3. Viết hàm `signDlTicket<T extends Record<string, unknown>>(payload: T, secret: string): Promise<string>` và `verifyDlTicket<T>(ticket: string, secret: string): Promise<T | null>` bằng Web Crypto `HMAC` (`SHA-256`), mã hóa base64url, kiểm tra trường `exp` (epoch seconds) `> Math.floor(Date.now() / 1000)`.
  4. Viết hàm `parseResolveBody(text: string, tier: DlTier)` và `parsePrepareBody(text: string)`:
     - Kiểm tra `visitorId` (UUID v4 khi `tier === 'public'`), kiểm tra danh sách URL qua `extractUrlsFromInput` + `validateSafeMediaUrl`, cắt số lượng URL tối đa theo `TIER_LIMITS[tier].maxBatchItems`.
  5. Viết hàm `daemonOnline(baseUrl: string)` (cache 30 giây, gọi `${baseUrl}/health` với timeout 4 giây), `callDaemon(baseUrl: string, apiKey: string, path: string, init?: RequestInit, timeoutMs = 25_000)` và `cleanupDlLimits(db: D1Database)` (`DELETE FROM rate_limits WHERE bucket LIKE 'dl:%' AND window_start < ?1`).
- **Success criteria**: `src/lib/dl.ts` xuất đầy đủ các hàm với kiểu TypeScript chặt chẽ.
- **Verify**: no verification needed (được kiểm tra ở Task 1.4).

### Task 1.4 — Viết bộ Unit Test `src/lib/dl.test.ts` và chạy kiểm thử
- **Goal**: Kiểm chứng tự động toàn bộ logic nhận diện nền tảng, chặn SSRF, ký/kiểm vé HMAC, hết hạn vé, và kiểm tra body request.
- **Target files and symbols**:
  - `/Volumes/2/TQD-Website/src/lib/dl.test.ts`
- **Steps**:
  1. Tạo `/Volumes/2/TQD-Website/src/lib/dl.test.ts` sử dụng `vitest` (`describe`, `it`, `expect`).
  2. Viết các bài test cho:
     - `detectPlatform`, `isShortsOrReelsUrl`, `isPlaylistOrProfileUrl` (YouTube Watch, Shorts, Playlist, `@channel`, TikTok video, TikTok `@profile`, Facebook Reel, SoundCloud).
     - `normalizeMediaUrl` và `extractUrlsFromInput` (loại bỏ `fbclid`, `si`, `utm_source`; bóc nhiều link từ chuỗi nhiều dòng).
     - `validateSafeMediaUrl` (chặn `http://127.0.0.1:4000`, `http://localhost/test`, `http://192.168.1.1`, `http://169.254.169.254/latest/meta-data`, `file:///etc/passwd`, `http://[::1]/`; cho qua `https://www.youtube.com/watch?v=dQw4w9WgXcQ`).
     - `signDlTicket` & `verifyDlTicket` (ký và giải mã đúng payload; từ chối vé bị sửa 1 ký tự; từ chối vé sai secret; từ chối vé đã quá hạn `exp`).
     - `parseResolveBody` (từ chối body rỗng hoặc chứa link nội bộ; giới hạn số lượng link theo tier `public` vs `admin`).
  3. Chạy `npx vitest run src/lib/dl.test.ts`.
- **Success criteria**: Mọi test trong `src/lib/dl.test.ts` đều xanh.
- **Verify**: `npx vitest run src/lib/dl.test.ts` thoát với mã `0` và in `passed`.

## Todo
- [x] Task 1.1: Cập nhật `src/env.d.ts` và `wrangler.jsonc`
- [x] Task 1.2: Tạo `src/lib/dl-platforms.ts`
- [x] Task 1.3: Tạo `src/lib/dl.ts`
- [x] Task 1.4: Tạo `src/lib/dl.test.ts` và chạy `npx vitest run src/lib/dl.test.ts`

## Success Criteria
- `npx vitest run` chạy toàn bộ test trong repo đạt 100% pass.

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
