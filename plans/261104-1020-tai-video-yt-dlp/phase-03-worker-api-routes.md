---
title: "Phase 3: Cloudflare Worker API Routes & Rate-Limit Cleanup"
status: todo
---

# Phase 3: Cloudflare Worker API Routes & Rate-Limit Cleanup

## Context Links
- Existing Chat API Pattern: [`src/pages/api/chat.ts`](../../../src/pages/api/chat.ts), [`src/pages/api/chat/status.ts`](../../../src/pages/api/chat/status.ts)
- Worker Entry & Cron: [`src/worker.ts`](../../../src/worker.ts)
- Core Downloader Library: [`src/lib/dl.ts`](../../../src/lib/dl.ts)

## Overview
- **Priority**: P1
- **Status**: todo
- **Description**: Xây dựng các endpoint `/api/dl/*` trên Cloudflare Worker để làm cổng bảo mật, kiểm tra same-origin, phân tầng hạn mức `public` vs `admin` (qua D1 `rate_limits`), cấp/kiểm vé `HMAC-SHA256`, và proxy sang Home Daemon; đồng thời tích hợp dọn dẹp `rate_limits` của `dl:%` vào cron hằng đêm trong `src/worker.ts`.

## Key Insights
- Middleware `src/middleware.ts` đã tự động gắn `Cache-Control: no-store` và `X-Robots-Tag: noindex` cho mọi đường dẫn bắt đầu bằng `/api/`.
- Khi khách Public chỉ mới dán link để xem thông tin (`POST /api/dl/resolve`), dùng bộ đếm `dl:resolve:*` hào phóng hơn (ví dụ 30 lần/giờ mỗi khách); chỉ khi bấm tải thật (`POST /api/dl/prepare`) mới trừ vào hạn mức tải (`dl:v:<visitorId>` 15 lượt/giờ, `dl:ip:<hash>` 30 lượt/giờ, `dl:day` 150 lượt/ngày). Với tầng `admin` (đã đăng nhập `/admin` hoặc gửi Bearer API key `tqd_...`), bỏ qua hạn mức khách.

## Requirements
- [x] `GET /api/dl/status`: Trả về `{ online, tier: 'admin' | 'public', limits: TIER_LIMITS[tier] }`.
- [x] `POST /api/dl/resolve`: Kiểm tra `sameOrigin`, kiểm tra Daemon online, xác định `tier`, kiểm tra rate-limit quét link (nếu `public`), gọi Daemon `/resolve`, và gắn `itemTicket` (ký HMAC bằng `DL_API_KEY`, hạn 15 phút) vào từng mục video trả về.
- [x] `POST /api/dl/prepare`: Kiểm tra `sameOrigin`, xác thực `itemTicket`, trừ hạn mức tải D1 (nếu `public`), gọi Daemon `/prepare`, và trả về `{ taskId, taskTicket }` (ký HMAC cho `taskId`, hạn 15 phút).
- [x] `GET /api/dl/task/[id]`: Kiểm tra tham số `?ticket=<taskTicket>`, gọi Daemon `/task/:id`, nếu trạng thái là `completed` thì đính kèm `streamTicket` (hạn 10 phút) để trình duyệt bắt đầu tải file.
- [x] `GET /api/dl/stream`: Kiểm tra `?ticket=<streamTicket>`, gọi Daemon `/stream/:taskId` và truyền nguyên trạng `ReadableStream` (`res.body`) kèm `Content-Disposition`, `Content-Type`, `Content-Length` về trình duyệt (0 ms xử lý CPU trên Worker).
- [x] Cập nhật `src/worker.ts` gọi `cleanupDlLimits(env.DB)` trong `scheduled()`.

## Related Code Files
- **Create**:
  - `/Volumes/2/TQD-Website/src/pages/api/dl/status.ts`
  - `/Volumes/2/TQD-Website/src/pages/api/dl/resolve.ts`
  - `/Volumes/2/TQD-Website/src/pages/api/dl/prepare.ts`
  - `/Volumes/2/TQD-Website/src/pages/api/dl/task/[id].ts`
  - `/Volumes/2/TQD-Website/src/pages/api/dl/stream.ts`
- **Modify**:
  - `/Volumes/2/TQD-Website/src/worker.ts`
  - `/Volumes/2/TQD-Website/src/lib/dl.test.ts` (bổ sung test cho `cleanupDlLimits` và luồng xác thực vé `taskTicket` / `streamTicket`)

## Tasks & Steps

### Task 3.1 — Tạo `src/pages/api/dl/status.ts` và `src/pages/api/dl/resolve.ts`
- **Goal**: Cho phép giao diện `/tai-video` kiểm tra trạng thái hoạt động của Home Daemon, nhận diện tầng quyền (`public` / `admin`), và phân tích link đơn / playlist / nhiều link kèm vé `itemTicket`.
- **Target files and symbols**:
  - `/Volumes/2/TQD-Website/src/pages/api/dl/status.ts` (`GET`)
  - `/Volumes/2/TQD-Website/src/pages/api/dl/resolve.ts` (`POST`)
- **Steps**:
  1. Tạo `/Volumes/2/TQD-Website/src/pages/api/dl/status.ts`:
     - Đọc `COOKIE` từ `cookies.get(COOKIE)?.value` và `request.headers.get('Authorization')`, gọi `resolveDlTier(env.DB, sessionToken, authHeader)`.
     - Kiểm tra `Boolean(env.DL_API_KEY && env.DL_BASE_URL) && (await daemonOnline(env.DL_BASE_URL!))`.
     - Trả về `jsonResponse({ online, tier, limits: TIER_LIMITS[tier] })`.
  2. Tạo `/Volumes/2/TQD-Website/src/pages/api/dl/resolve.ts`:
     - Kiểm tra `sameOrigin(request, url.origin)` (hoặc cho qua khi có `Authorization: Bearer tqd_...` hợp lệ).
     - Đọc body bằng `readBodyCapped(request, 16 * 1024)`.
     - Xác định `tier = await resolveDlTier(...)`, phân tích body bằng `parseResolveBody(text, tier)`.
     - Kiểm tra Daemon online trước khi tính lượt; nếu offline trả `503` `{ error: 'offline', message: 'Máy chủ tải video đang tạm nghỉ. Bạn thử lại sau nhé.' }`.
     - Nếu `tier === 'public'`, kiểm tra `hit(env.DB, 'dl:res:v:' + body.visitorId, 30, 3600)` và `hit(env.DB, 'dl:res:ip:' + await dlIpBucket(ip), 60, 3600)`.
     - Gọi Daemon `POST /resolve`, sau đó ký `itemTicket` (`signDlTicket({ kind: 'item', url: itemUrl, tier, maxHeight: limits.maxHeight, maxFilesizeMB: limits.maxFilesizeMB, exp: now + 900 }, env.DL_API_KEY)`) cho video hoặc từng mục trong danh sách `entries` trước khi trả JSON về trình duyệt.
- **Success criteria**: Hai route `status.ts` và `resolve.ts` biên dịch không lỗi TypeScript.
- **Verify**: no verification needed (được kiểm tra bởi `npx astro check` ở Task 3.3).

### Task 3.2 — Tạo `src/pages/api/dl/prepare.ts`, `src/pages/api/dl/task/[id].ts` và `src/pages/api/dl/stream.ts`
- **Goal**: Thực hiện pha ghép file (`prepare`), theo dõi tiến độ (`task/[id]`) và truyền file trực tiếp (`stream`) về máy người dùng.
- **Target files and symbols**:
  - `/Volumes/2/TQD-Website/src/pages/api/dl/prepare.ts` (`POST`)
  - `/Volumes/2/TQD-Website/src/pages/api/dl/task/[id].ts` (`GET`)
  - `/Volumes/2/TQD-Website/src/pages/api/dl/stream.ts` (`GET`)
- **Steps**:
  1. Tạo `/Volumes/2/TQD-Website/src/pages/api/dl/prepare.ts`:
     - Kiểm tra `sameOrigin`, đọc body `parsePrepareBody(text)`, xác thực `itemTicket` bằng `verifyDlTicket(body.itemTicket, env.DL_API_KEY)`.
     - Nếu `ticket.tier === 'public'`, kiểm tra hạn mức tải trong D1: `dl:v:<visitorId>` (`PUBLIC_VISITOR_PER_HOUR`), `dl:ip:<hash>` (`PUBLIC_IP_PER_HOUR`), và `dl:day` (`Number(env.DL_DAILY_CAP) || DEFAULT_DL_DAILY_CAP`).
     - Gọi Daemon `POST /prepare` với `{ url: ticket.url, title: body.title, formatId: body.formatId, kind: body.kind, maxHeight: ticket.maxHeight, maxFilesizeMB: ticket.maxFilesizeMB, compatibilityMode: body.compatibilityMode }`.
     - Ký `taskTicket` (`{ kind: 'task', taskId: daemonRes.taskId, exp: now + 900 }`) và trả `{ taskId, taskTicket }`.
  2. Tạo `/Volumes/2/TQD-Website/src/pages/api/dl/task/[id].ts`:
     - Xác thực `ticket` trên query string (`?ticket=...`) khớp với `params.id` và `kind === 'task'`.
     - Gọi Daemon `GET /task/${params.id}`. Nếu `status === 'completed'`, ký thêm `streamTicket` (`{ kind: 'stream', taskId: params.id, exp: now + 600 }`) và trả kèm trong JSON.
  3. Tạo `/Volumes/2/TQD-Website/src/pages/api/dl/stream.ts`:
     - Xác thực `ticket` trên query string (`?ticket=...`) có `kind === 'stream'`.
     - Gọi `fetch(`${env.DL_BASE_URL}/stream/${encodeURIComponent(ticket.taskId)}`, { headers: { Authorization: `Bearer ${env.DL_API_KEY}` } })`.
     - Truyền thẳng `upstream.body` về trình duyệt kèm các header `Content-Type`, `Content-Disposition`, `Content-Length`, `Cache-Control: no-store`.
- **Success criteria**: Ba route `prepare.ts`, `task/[id].ts` và `stream.ts` xử lý trọn vẹn luồng tải mà không đọc toàn bộ video vào RAM của Worker.
- **Verify**: no verification needed (được kiểm tra ở Task 3.3).

### Task 3.3 — Thêm `cleanupDlLimits` vào `src/worker.ts` và kiểm tra TypeScript + Unit Test
- **Goal**: Dọn dẹp các dòng `dl:%` cũ trong bảng `rate_limits` hằng đêm và xác nhận toàn bộ các route mới vượt qua `astro check` và `vitest`.
- **Target files and symbols**:
  - `/Volumes/2/TQD-Website/src/worker.ts` (`scheduled`)
- **Steps**:
  1. Mở `/Volumes/2/TQD-Website/src/worker.ts`, trong hàm `scheduled(_controller, env, ctx)`, thêm:
     ```ts
     const { cleanupDlLimits } = await import('./lib/dl');
     ctx.waitUntil(cleanupDlLimits(env.DB));
     ```
  2. Chạy `npx astro check` và `npx vitest run`.
- **Success criteria**: `npx astro check` báo `0 errors` và `npx vitest run` pass toàn bộ test.
- **Verify**: `npx astro check && npx vitest run` thoát với mã `0` và in `0 errors`.

## Todo
- [x] Task 3.1: Tạo `src/pages/api/dl/status.ts` và `src/pages/api/dl/resolve.ts`
- [x] Task 3.2: Tạo `src/pages/api/dl/prepare.ts`, `src/pages/api/dl/task/[id].ts` và `src/pages/api/dl/stream.ts`
- [x] Task 3.3: Cập nhật `src/worker.ts` và chạy `npx astro check && npx vitest run`

## Success Criteria
- Toàn bộ 5 route `/api/dl/*` và `src/worker.ts` vượt qua `npx astro check` (0 lỗi) và `npx vitest run`.

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
