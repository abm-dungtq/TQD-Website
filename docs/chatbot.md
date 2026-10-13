# Chatbot "Agent DũngTQ"

Linh vật trên trang chủ (desktop) và nút tròn mặt linh vật ở góc phải dưới (điện thoại) mở khung chat với agent `dungtq-web` chạy trên GoClaw tự host. Agent trả lời bằng nội dung website và nói rõ khi không chắc.

## Đường đi của một tin nhắn

```text
trình duyệt ──POST /api/chat──▶ Worker ──/v1/chat/completions (stream)──▶ https://goclaw.tqd.io.vn ──▶ agent dungtq-web
            ◀──── SSE truyền nguyên trạng ────┘
```

- `POST /api/chat` (`src/pages/api/chat.ts`): body `{ message, visitorId }`. Chỉ nhận JSON cùng origin, tin tối đa 1000 ký tự, `visitorId` là UUID v4. GoClaw nhận user `web:<visitorId>` và giữ lịch sử hội thoại; website không lưu nội dung chat.
- Trước khi tính lượt, Worker hỏi `/health` của GoClaw (cache 60 giây). Máy chủ nhà tắt thì trả 503 `offline` mà không tốn lượt trong ngày.
- Giới hạn (bảng D1 `rate_limits`): 20 tin/giờ mỗi khách, 60 tin/giờ mỗi IP, trần cả ngày là `CHAT_DAILY_CAP`. Vượt giới hạn thì trả 429 kèm `Retry-After` và lời mời nhắn Zalo. Cron hằng đêm xoá các hàng `chat:%` cũ.
- Trước cả Worker, rule rate limiting của Cloudflare (zone `tqd.io.vn`, phase `http_ratelimit`, rule "Chat API: max 15 requests per 10 seconds per IP") chặn 10 giây mọi IP gửi quá 15 yêu cầu tới `/api/chat*` trong 10 giây. Spam bị chặn ở edge nên không tốn lượt Worker và hạn mức ghi D1 (dùng chung với đăng nhập admin). Gói Free chỉ có một rule như vậy, khoảng đếm 10 giây và thời gian chặn 10 giây. Xem hoặc sửa: `cf rulesets entrypoint get http_ratelimit -z tqd.io.vn`, hoặc Security → WAF → Rate limiting rules trên dashboard.
- Mọi lỗi đều có dạng `{ error, message }`: `rate_limited` (429), `offline` / `busy` (503), `forbidden` (403), `unsupported_media_type` (415), `too_large` (413), `invalid` (400).
- `GET /api/chat/status` trả `{ online }`. Khung chat chỉ gọi nó khi được mở.
- Hiển thị (`src/lib/chat-render.ts`): chỉ đoạn văn, danh sách, in đậm và link. Chỉ link `https://tqd.io.vn/...` mới bấm được; URL khác hiện dạng chữ, để câu trả lời bị dụ cũng không gắn được link lạ dưới tên DũngTQ.

## Cấu hình

| Tên | Loại | Ghi chú |
|---|---|---|
| `GOCLAW_BASE_URL` | `vars` | `https://goclaw.tqd.io.vn` |
| `GOCLAW_AGENT` | `vars` | `dungtq-web` |
| `CHAT_DAILY_CAP` | `vars` | Trần tin mỗi ngày cho cả site (mặc định 300) |
| `GOCLAW_API_KEY` | secret | Key ứng dụng GoClaw tên `tqd-website`. Đặt cho cả `tqd-website` và `tqd-next`; không có key thì chat báo offline |

Key do script trên máy GoClaw tạo và đưa thẳng vào `wrangler secret put` qua stdin: `node D:/Goclaw/plans/261013-dungtq-web/create-agent.mjs`. Chạy lại không tạo key mới.

## Sau khi đăng bài mới

Kiến thức của agent là file `CAPABILITIES.md`, sinh từ `https://tqd.io.vn/index.md` và các bài viết. Sau khi đăng bài thì chạy trên máy GoClaw:

```bash
node D:/Goclaw/plans/261013-dungtq-web/sync-context.mjs
node D:/Goclaw/plans/261013-dungtq-web/verify-chat.mjs   # ALL PASS
```

## Thu hồi hoặc đổi key

1. Thu hồi key `tqd-website` trong GoClaw (cách làm ở `D:/Goclaw/docs/application-api.md`). Chat lập tức trả offline.
2. Muốn bật lại thì chạy `create-agent.mjs` để tạo key mới và đặt lại secret cho cả hai Worker.

Tắt hẳn chat mà không thu hồi key: `npx wrangler secret delete GOCLAW_API_KEY --name tqd-website`.

## Kiểm tra

- `npm test`: kiểm tra body, origin, IP băm, GoClaw không tới được và cách hiển thị câu trả lời.
- `node scripts/verify/site.mjs <url>`: có `/api/chat/status` và kiểm tra 403 khi khác origin. Không gửi tin thật.
- Agent phía GoClaw: `verify-chat.mjs` ở trên; tài liệu tại `D:/Goclaw/docs/dungtq-web-agent.md`.
