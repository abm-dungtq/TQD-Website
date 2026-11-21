# Chatbot "Agent DũngTQ"

Khung chat nằm trong giao diện EzyPlatform (page fragment). Trình duyệt gọi `/api/chat*` trên `tqd.me`; edge chuyển tiếp nguyên request sang Worker công cụ `tqd-tools`, rồi Worker gọi agent `dungtq-web` trên GoClaw tự host.

## Đường đi của một tin nhắn

```text
trình duyệt (tqd.me) ──POST /api/chat──▶ tqd-edge ──service binding──▶ tqd-tools ──/v1/chat/completions (stream)──▶ https://goclaw.tqd.io.vn
                                            ◀──────────── SSE truyền nguyên trạng ────────────┘
```

- `POST /api/chat` (`src/pages/api/chat.ts`): body `{ message, visitorId }`. Chỉ nhận JSON cùng origin, tin tối đa 1000 ký tự, `visitorId` là UUID v4. GoClaw nhận user `web:<visitorId>` và giữ lịch sử hội thoại; website không lưu nội dung chat.
- Trước khi tính lượt, Worker hỏi `/health` của GoClaw (cache 60 giây). Máy chủ nhà tắt thì trả 503 `offline` mà không tốn lượt trong ngày.
- Giới hạn (bảng D1 `rate_limits`): 20 tin/giờ mỗi khách, 60 tin/giờ mỗi IP, trần cả ngày là `CHAT_DAILY_CAP`. Vượt giới hạn thì trả 429 kèm `Retry-After` và lời mời nhắn Zalo.
- Thống kê (`src/lib/chat-stats.ts`): mỗi yêu cầu chat hợp lệ được cộng vào bảng D1 `chat_daily` theo ngày giờ Việt Nam, chia thành trả lời, bị giới hạn, agent nghỉ và lỗi. Bảng `chat_visitors` ghi SHA-256 rút gọn của `visitorId` để đếm số người mỗi ngày. Chỉ đếm, không lưu nội dung tin. Ghi số đếm chạy sau khi đã trả lời (`waitUntil`), lỗi ghi không ảnh hưởng khách.
- **Không còn cron dọn dẹp** kể từ khi bỏ trigger của Worker. Hàng `chat:%` trong `rate_limits` và `chat_visitors` cũ hơn 90 ngày cần dọn thủ công nếu chạm hạn mức D1:

  ```bash
  npx wrangler d1 execute tqd_db --remote --command "DELETE FROM chat_visitors WHERE day < date('now','-90 day')"
  npx wrangler d1 execute tqd_db --remote --command "DELETE FROM rate_limits WHERE bucket LIKE 'chat:%' AND window_start < strftime('%s','now') - 172800"
  ```

- Mọi lỗi đều có dạng `{ error, message }`: `rate_limited` (429), `offline` / `busy` (503), `forbidden` (403), `unsupported_media_type` (415), `too_large` (413), `invalid` (400).
- `GET /api/chat/status` trả `{ online }`. Khung chat chỉ gọi nó khi được mở.
- Hiển thị (`src/lib/chat-render.ts`): chỉ đoạn văn, danh sách, in đậm và link. Chỉ link `https://tqd.me/...` mới bấm được; URL khác hiện dạng chữ, để câu trả lời bị dụ cũng không gắn link lạ dưới tên DũngTQ.

## Cấu hình

| Tên | Loại | Ghi chú |
|---|---|---|
| `GOCLAW_BASE_URL` | `vars` | `https://goclaw.tqd.io.vn` |
| `GOCLAW_AGENT` | `vars` | `dungtq-web` |
| `CHAT_DAILY_CAP` | `vars` | Trần tin mỗi ngày cho cả site (mặc định 300) |
| `GOCLAW_API_KEY` | secret của `tqd-tools` | Key ứng dụng GoClaw tên `tqd-website`; không có key thì chat báo offline |

Secret phải đặt trên `tqd-tools` bằng `npx wrangler secret put GOCLAW_API_KEY`. Key do script trên máy GoClaw tạo và đưa thẳng vào stdin: `node D:/Goclaw/plans/261013-dungtq-web/create-agent.mjs`. Chạy lại không tạo key mới.

## Sau khi đăng bài mới

Kiến thức của agent là file `CAPABILITIES.md`, sinh từ nội dung công khai. Sau khi publish bài trên EzyPlatform, đồng bộ trên máy GoClaw:

```bash
node D:/Goclaw/plans/261013-dungtq-web/sync-context.mjs
node D:/Goclaw/plans/261013-dungtq-web/verify-chat.mjs   # ALL PASS
```

## Thu hồi hoặc đổi key

1. Thu hồi key `tqd-website` trong GoClaw (cách làm ở `D:/Goclaw/docs/application-api.md`). Chat lập tức trả offline.
2. Muốn bật lại thì chạy `create-agent.mjs` để tạo key mới và đặt lại secret cho `tqd-tools` (và `tqd-next` nếu đang kiểm thử preview).

Tắt hẳn chat mà không thu hồi key: `npx wrangler secret delete GOCLAW_API_KEY --name tqd-tools`.

## Kiểm tra

- `node node_modules/vitest/vitest.mjs run src/lib/chat.test.ts src/lib/chat-render.test.ts src/lib/chat-stats.test.mjs`.
- `curl -s https://tqd-tools.ngulongyquan.workers.dev/api/chat/status`.
- Agent phía GoClaw: `verify-chat.mjs` ở trên; tài liệu tại `D:/Goclaw/docs/dungtq-web-agent.md`.
