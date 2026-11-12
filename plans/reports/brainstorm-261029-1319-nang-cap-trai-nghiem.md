# Brainstorm: nâng cấp trải nghiệm tqd.io.vn

Ngày 29/10/2026. Chế độ `--advice`, có kongming phản biện.

## Bằng chứng

- Thống kê chat (`chat_daily` đếm mọi yêu cầu, kể cả bị giới hạn, agent nghỉ và lỗi): 14/10 có 7 lượt trả lời từ 6 người, 15/10 có 1 lượt, sau đó 14 ngày không có yêu cầu nào. `/api/chat/status` báo online, nên chat không hỏng: không ai bấm.
- Chat và linh vật chỉ có ở trang chủ (`src/pages/index.astro`). Trang bài viết kết thúc ngay sau nội dung: không có tác giả, lời mời liên hệ hay bài liên quan. Các trang mục riêng cũng vậy.
- Site chưa có số liệu truy cập nào ngoài chat. Phiên này chưa lấy được analytics của Cloudflare qua CLI.

## Kết luận

Site đẹp nhưng "cụt" và chưa đo được. Thêm hiệu ứng cho giao diện desktop kiểu macOS không còn đáng giá. Không có lượt chat nào nhiều khả năng do ít người truy cập, sau đó mới tới chuyện khó tìm thấy chat.

## Contract

- **Outcome:** website thành đường dẫn khách hàng cho đào tạo và tư vấn AI, và đo được hiệu quả.
- **Constraints:** luxury + công nghệ, chỉ màu sáng, tiếng Việt; Cloudflare gói Free; tuân thủ Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 và Nghị định 356/2025/NĐ-CP (hiệu lực 01/01/2026, thay Nghị định 13/2023; theo kongming, chưa đọc văn bản gốc); chỉ dùng dữ kiện chủ site cung cấp.
- **Non-goals:** thêm tính năng cho giao diện desktop, dark mode, hiệu ứng mới, newsletter.
- **Acceptance (sau 30 ngày):** Web Analytics có lượt xem theo trang và nguồn, trong đó có Facebook/Zalo; số lượt bấm Zalo ở trang bài viết lớn hơn 0; ít nhất một cuộc trò chuyện Zalo đến từ website.

## Thứ tự đề xuất (đã chỉnh theo kongming)

1. **A1, không code:** chủ site xem Workers → tqd-website → Metrics và Analytics của zone trên dashboard Cloudflare để biết lượt truy cập theo ngày và trang.
2. **Lát 1, khoảng 1 ngày:** khối cuối bài viết (thời gian đọc, giới thiệu tác giả ngắn, lời mời "Cần đào tạo hoặc triển khai AI cho đội của bạn? Nhắn Zalo", 2 bài khác, link theo dõi), cộng beacon Cloudflare Web Analytics (không cookie). Chỉ render phía server, không cần migration.
3. **G, không code:** mỗi bài đăng kèm link thường `https://tqd.io.vn/bai-viet/<slug>` lên Facebook/Zalo/TikTok. Không dùng `?utm_...`, vì URL có query sẽ bỏ qua cache của Worker.
4. **A2:** bộ đếm hành động gộp theo ngày (bấm Zalo/email, mở chat, đọc hết bài), không lưu định danh, hiện trong `/admin`. Thêm trang "Quyền riêng tư" và một dòng nhắc trong khung chat.
5. **C:** mục "Hợp tác" với 2–3 gói rõ ràng (đào tạo in-house, tư vấn triển khai AI Agent), đối tác đã đào tạo dạng chữ, thư viện ảnh làm bằng chứng, một lời mời chính. Trước khi ước lượng cần kiểm tra cách thêm mục mới trong settings D1.
6. **B2 + D, khi số liệu cho thấy cần:** chat trên mọi trang và 3 câu hỏi gợi ý trong khung chat. Ngữ cảnh bài viết, nếu có, chỉ truyền slug đã kiểm tra phía server, không truyền chữ do khách nhập.
7. **F/E còn lại** (mục lục bài, nút chia sẻ, newsletter): chỉ làm nếu số liệu biện minh.

## Trade-offs

- **Đo trước rồi mới sửa:** dựa vào giả định lượng truy cập thấp. Nếu dashboard cho thấy hàng trăm lượt người thật mỗi ngày, chat trên mọi trang (B2) được đưa lên trước.
- **Chat trên mọi trang ngay:** dựa vào giả định khách muốn chat. Hướng này yếu ngay: tổng cộng mới có 8 lượt trả lời, và agent chỉ biết bài mới sau khi chạy script đồng bộ bằng tay.

## Better approaches

Kênh phân phối (G) quan trọng hơn mọi thay đổi trên site: không có khách thì không có thay đổi nào đo được.

## Câu hỏi còn mở

- Lượt truy cập thật mỗi ngày là bao nhiêu (A1)?
- Chủ site có đăng bài đều đặn lên Facebook/Zalo không?
- Nội dung các gói "Hợp tác": tên gói, đối tượng, hình thức và có công khai giá hay không.
