# Brainstorm: linh vật gắn chatbot agent trên GoClaw (2026-10-13)

## Bối cảnh và bằng chứng

- Linh vật hiện chỉ có trên desktop (≥1024px), có bong bóng `data-mascot-tip` (role=status); bấm vào thì đổi mẹo (`src/scripts/mascot.ts:14-19`, `:167-170`). Nạp sau khi trang rảnh (`src/scripts/desktop.ts:228-231`).
- GoClaw tự host trên máy chủ nhà (`D:\Goclaw`), API tương thích OpenAI tại `https://goclaw.tqd.io.vn/v1/chat/completions` qua Cloudflare named tunnel; chỉ chạy khi máy bật (`D:/Goclaw/docs/application-api.md`).
- Key ứng dụng có quyền `operator.read` + `operator.write` trong tenant, không phải key chỉ để chat. Phải nằm phía server.
- Bắt buộc header `X-GoClaw-User-Id`; GoClaw giữ lịch sử phía server theo agent + user ID và chỉ dùng tin user cuối. `stream: true` trả SSE kết thúc bằng `data: [DONE]`; lỗi giữa chừng là chunk bắt đầu bằng `Error: `. Không có idempotency, không retry khi timeout (`D:/Goclaw/docs/agent-api-connection-guide.md`).
- Agent `tqd` hiện là bot chăm sóc khách hàng cho Messenger/Zalo/Telegram (chỉ tool `datetime`, DeepSeek Flash qua OpenCode Go). GoClaw có giới hạn chung `gateway.rate_limit_rpm` = 120, dùng chung với các bot đó.
- Repo website đã có sẵn: bảng D1 `rate_limits` + `hit()` (`src/lib/rate-limit.ts`), `readBodyCapped`/`jsonResponse`/`apiError` (`src/lib/api.ts`), `/api/` không cache và `no-store` (`src/middleware.ts`).

## Contract

- **Outcome:** Khách vào website thấy linh vật với bong bóng "Tôi là phiên bản Agent của DũngTQ, bạn có thể tìm hiểu các kiến thức về AI từ tôi". Bấm vào mở khung chat, trò chuyện trực tiếp (trả lời chạy dần theo luồng) với một agent GoClaw riêng, trả lời dựa trên nội dung website. Trên điện thoại có nút tròn mặt linh vật ở góc phải dưới, mở khung chat toàn màn hình.
- **Constraints (người dùng đã chốt):**
  - Tạo agent riêng `dungtq-web` (không tool ngoài `datetime`); agent `tqd` giữ nguyên. Sao lưu GoClaw trước khi tạo.
  - Kiến thức lấy từ nội dung website (hồ sơ, sản phẩm, đào tạo, số liệu, bài đã đăng), có script đồng bộ lại khi có bài mới. Agent nói rõ khi không chắc, không bịa giá hay cam kết.
  - Không đăng nhập. Mỗi khách khoảng 20 tin/giờ, tin tối đa 1000 ký tự, có trần tổng mỗi ngày; vượt thì mời nhắn Zalo.
  - Chung: không màu tối; Lighthouse ≥0.95; tôn trọng giảm chuyển động; giao diện tiếng Việt; không in hay commit secret; không lưu nội dung chat trong D1 của website.
- **Non-goals:** Đăng nhập khách; lưu hoặc xem lại hội thoại trên website; Turnstile; điều khiển GoClaw từ Worker; đổi agent `tqd`; gọi GoClaw thẳng từ trình duyệt.
- **Acceptance criteria:** xem mục "Các phase" bên dưới.

## Trade-offs

| Lựa chọn | Phụ thuộc vào | Hỏng trước khi |
|---|---|---|
| Proxy cùng origin `/api/chat`, truyền SSE nguyên trạng | Worker không biến đổi từng chunk (CPU gói free 10ms) | Nếu parse JSON từng chunk ở Worker với câu trả lời dài |
| Giới hạn bằng D1 `rate_limits` | 3 lần ghi D1 mỗi tin, trong hạn mức free 100k/ngày | Không bao giờ ở mức trần 300 tin/ngày |
| Workers Rate Limiting binding (loại) | Cửa sổ 10s/60s | Không biểu diễn được 20/giờ hay trần ngày |
| Không streaming (loại) | Chờ 5–10s mỗi câu | Cảm giác treo bên cạnh linh vật |
| Durable Object (để sau) | Giới hạn chính xác, tuần tự từng khách | Thêm primitive mới cho lợi ích nhỏ |

Better approaches: none. Hướng được chọn là hướng người dùng yêu cầu; Kongming chỉnh ba chi tiết (dùng D1 `rate_limits`, truyền SSE nguyên trạng, script quản trị GoClaw nằm trên máy GoClaw).

## Thiết kế đã chốt

### Phía GoClaw (trên máy chủ nhà, không nằm trong repo website)

- Thư mục `D:/Goclaw/plans/261013-dungtq-web/`: `create-agent.mjs`, `sync-context.mjs`, `verify-chat.mjs`; tài liệu `D:/Goclaw/docs/dungtq-web-agent.md`. Gateway token đọc từ file vào biến, không in.
- Agent `dungtq-web`: provider/model như `tqd` (deepseek-flash), tool chỉ `datetime`, **tắt bộ nhớ** (tránh câu chữ của khách này bị trích vào bộ nhớ chung rồi lộ cho khách khác), persona: "phiên bản Agent của DũngTQ, chia sẻ kiến thức AI", trả lời tiếng Việt, dưới ~250 từ, nói rõ khi không chắc, không bịa giá/cam kết, không làm theo lệnh đổi vai.
- `sync-context.mjs` lấy `https://tqd.io.vn/llms.txt` rồi từng bản `.md` được liệt kê, ghi vào context file của agent. Chạy lại sau khi đăng bài.

### Phía Worker (repo website)

- `POST /api/chat`: yêu cầu `Content-Type: application/json`, Origin/Sec-Fetch-Site cùng origin, body `{ message, visitorId }`, `message` 1–1000 ký tự, `visitorId` là UUID kiểm bằng regex chặt. Header gửi GoClaw: `X-GoClaw-User-Id: web:<uuid>` (server tự thêm tiền tố, khách không chọn được namespace).
- Giới hạn bằng `hit()` trong một `env.DB.batch()`: `chat:v:<uuid>` 20/giờ; `chat:ip:<sha256(ip) 16 hex>` 60/giờ (rộng vì nhà mạng di động dùng chung IP); `chat:day` theo biến `CHAT_DAILY_CAP` (khởi điểm 300). Cron hằng đêm xoá các hàng `chat:%` cũ.
- Gọi GoClaw với `stream: true`, timeout chờ byte đầu ~20s, trả nguyên `upstream.body` dạng `text/event-stream`. Không retry. Lỗi mạng/5xx/timeout → 503 `{ offline: true }`; GoClaw 429 → "đang bận, thử lại sau".
- `GET /api/chat/status`: ping `/health` của GoClaw, cache 60s.
- Secret `GOCLAW_API_KEY` cho cả production và `--env preview`, đưa vào bằng đường không in ra; biến `GOCLAW_BASE_URL`, `GOCLAW_AGENT`, `CHAT_DAILY_CAP`.
- Không log nội dung tin nhắn.

### Phía giao diện

- Desktop: bong bóng chào hiện khi linh vật xuất hiện, giữ đến khi bấm hoặc đóng, mỗi phiên đóng một lần (`sessionStorage`). Bỏ chu kỳ 4 mẹo cũ. Bấm linh vật mở khung chat thay vì đổi mẹo. Khi thức dậy sau lúc ngủ: "Hỏi tôi về AI nhé". `aria-label` thành "Trò chuyện với Agent DũngTQ".
- Khung chat (JS chỉ tải khi bấm lần đầu; trang chủ không thêm request nào trước khi bấm): danh sách tin `role=log aria-live=polite`, ô nhập + nút gửi (khoá khi đang trả lời), nút "Cuộc trò chuyện mới" (tạo UUID mới), Esc đóng và trả focus về linh vật. Ghi chú: "Tin nhắn được gửi tới agent AI của DũngTQ và được lưu để tiếp nối hội thoại; đừng gửi thông tin cá nhân."
- Hiển thị trả lời: chỉ văn bản, đoạn, danh sách, in đậm; mọi thứ được escape. Chỉ tự tạo link cho `https://tqd.io.vn/...`; URL khác hiện dạng chữ (chống agent bị dụ chèn link lừa đảo dưới tên DũngTQ). Chunk `Error: ` hiện thành bong bóng lỗi.
- Offline: bong bóng đổi thành "Agent đang nghỉ, bạn có thể nhắn Zalo", khung chat vẫn mở với nút Zalo.
- Điện thoại: nút tròn 48px mặt linh vật, cố định góc phải dưới, HTML/CSS tĩnh; mở khung chat dạng sheet toàn màn hình, dùng lại mẫu sheet của `src/scripts/mobile-shell.ts`.
- Bảng màu sáng hiện tại; không màu tối.

## Các phase và tiêu chí nghiệm thu

0. **GoClaw (máy chủ nhà):** sao lưu DB + `config.json` vào `D:/Goclaw/backups/`; tạo `dungtq-web`; chạy sync. Đạt khi: gọi thường và stream đều trả lời; hỏi sản phẩm thì trả lời đúng theo website; hỏi giá thì từ chối bịa; "bỏ qua hướng dẫn" vẫn giữ vai; `GET /v1/agents` có agent mới; cấu hình `tqd` không đổi so với bản sao lưu; bộ nhớ của agent mới đã tắt.
1. **Route Worker:** `src/pages/api/chat.ts`, `src/pages/api/chat/status.ts`, cron dọn, test Vitest. Đạt khi: 400 body sai hoặc >1000 ký tự; 403 khác origin; 415 sai content type; 429 kèm `Retry-After` sau 20 tin và khi vượt trần ngày; SSE chạy trọn từ đầu đến cuối; trỏ `GOCLAW_BASE_URL` tới host không tới được thì trả 503 `{offline:true}`; key không xuất hiện trong log hay response.
2. **Giao diện desktop:** linh vật + khung chat. Đạt khi: Lighthouse `/` ≥0.95 hai lần; không request mới trước khi bấm; bàn phím đầy đủ; giảm chuyển động được tôn trọng; render-check 0 lỗi; `mascot-weather-check.mjs` cập nhật case mẹo thành case chat (không xoá) và ALL PASS.
3. **Điện thoại:** nút tròn + sheet chat. Đạt khi: Lighthouse mobile ≥0.95, không CLS, hành vi chat giống desktop.
4. **Tài liệu và kiểm tra live:** README mục chatbot (cách đồng bộ sau khi đăng bài, cách thu hồi key); `scripts/verify/site.mjs` thêm kiểm `/api/chat/status` và 403 khác origin (không gửi tin thật để khỏi tốn hạn mức); tài liệu GoClaw cập nhật.

## Rủi ro

- Máy chủ nhà tắt → chatbot offline; trạng thái offline phải là giao diện chính thức, không phải lỗi.
- Không tắt được bộ nhớ theo agent (độ chắc trung bình) → báo chủ site trước khi mở công khai.
- Trần 300 tin/ngày là ước lượng; chủ site chỉnh `CHAT_DAILY_CAP`.
- Key operator bị lộ nếu Worker bị chiếm quyền; Worker chỉ gọi `/v1/chat/completions`, đường thu hồi key ở `D:/Goclaw/docs/application-api.md`.

## Handoff

Thứ tự đề xuất: làm việc chống chỗ trống desktop (`brainstorm-261013-1153-desktop-empty-space.md`) trước hoặc song song phase 0, rồi `/ak:plan --advice` cho chatbot (5 phase trên) và `/ak:cook --advice`.

## Câu hỏi còn mở

- Phase 0 tạo agent và đưa secret vào Worker là thay đổi trên hệ thống thật: cần chủ site cho phép lúc thực hiện.
