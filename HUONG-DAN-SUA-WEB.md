# Hướng dẫn tự quản lý và phát triển từ khóa cho tqd.me

Tài liệu này giúp bạn tự chỉnh nội dung hiển thị trên `tqd.me`, dùng phòng nghiên cứu từ khóa để tìm chủ đề khách đang gõ trên Google và theo dõi dữ liệu Search Console mà không cần sửa mã nguồn.

## 1. Sửa nội dung trên website

Đăng nhập trang quản trị tại `/admin` bằng email và mật khẩu quản trị. Mọi thay đổi sau khi lưu đều cập nhật ngay ra trang công khai:

- **Hồ sơ (`/admin/ho-so`):** Sửa tên, vai trò, lời giới thiệu, mũi nhọn công việc, ảnh đại diện, email và Zalo.
- **Sản phẩm AI (`/admin/muc/san-pham`):** Thêm mới, sắp thứ tự, ẩn tạm hoặc sửa mô tả sản phẩm.
- **Thư viện và Media (`/admin/thu-vien`, `/admin/media`):** Tải ảnh hoặc video lên Media trước rồi chọn hiển thị trong Thư viện.
- **Bài viết (`/admin/bai-viet`):** Soạn bài nháp, xem trước bố cục và chuyển sang trạng thái đăng.
- **Liên hệ và số liệu (`/admin/lien-he`, `/admin/so-lieu`):** Cập nhật liên kết mạng xã hội và bảng số liệu.

## 2. Tìm từ khóa và lên lịch bài mới (`/admin/seo`)

Thanh menu quản trị có thêm mục **SEO & Từ khóa** (`/admin/seo`). Bạn thao tác theo 4 bước sau:

1. **Gõ chủ đề vào ô Tìm kiếm ở mục 1:** Ví dụ gõ `AI Agent cho doanh nghiệp` rồi bấm **Tìm từ khóa gợi ý**. Hệ thống mở rộng các cụm từ người Việt hay tìm trên Google, phân loại mục đích (tìm hiểu, so sánh hay muốn mua) và đối chiếu với bài viết sẵn có trên `tqd.me`.
2. **Xem nhãn độ phủ:** Cụm nào đã có bài sẽ hiện liên kết tới bài cũ để bạn tối ưu lại. Cụm nào mang nhãn **Cơ hội mới** là chủ đề trang web chưa có bài.
3. **Lưu vào giỏ kế hoạch:** Bấm **+ Lưu vào giỏ** cho từng từ khóa hoặc lưu hàng loạt các cơ hội mới. Bạn cũng có thể bấm **Nạp lộ trình từ khóa AI Agent** ở mục 3 để đưa sẵn bộ từ khóa nền tảng vào danh sách theo dõi.
4. **Chuyển sang viết bài:** Bấm **Viết bài nháp** ngay cạnh từ khóa để mở trang soạn bài đã điền sẵn tiêu đề, đường dẫn gợi ý và dàn ý mở đầu.

## 3. Google Search Console và đồng bộ số liệu

### Trạng thái khi vừa thêm tên miền

Ngày đầu bạn thêm `tqd.me` vào Google Search Console, màn hình cài đặt thường tạm báo *No robots.txt file* và *No data available yet* vì Google cần 1 đến 3 ngày để bot ghé đọc lần đầu. Thực tế hai tệp `https://tqd.me/robots.txt` và `https://tqd.me/sitemap.xml` đều đã mở sẵn ở trạng thái 200 OK.

Để Google lập chỉ mục sớm hơn, bạn mở Google Search Console, chọn mục **Sitemaps** ở cột trái, gõ `sitemap.xml` và bấm **Submit**.

### Kết nối đồng bộ dữ liệu về `/admin/seo`

Bạn có hai cách đưa thống kê tìm kiếm từ Google Search Console về bảng quản trị:

- **Tự động hàng đêm:** Tạo Service Account trên Google Cloud bật Search Console API, thêm email đó vào *Settings → Users and permissions* trong Search Console, rồi lưu tệp JSON qua lệnh `wrangler secret put GSC_SERVICE_ACCOUNT_JSON`. Sau đó trang web tự đồng bộ mỗi đêm, hoặc bạn bấm **Đồng bộ Search Console** ngay trên `/admin/seo`.
- **Chạy từ máy cá nhân:** Đặt tệp khóa Desktop tại `.claude/secrets/google_client_secret.json`, chạy `npm run seo:gsc:auth` một lần để cấp quyền rồi chạy `npm run seo:gsc:sync -- --sync-api` khi cần đẩy số liệu mới.

### Bổ sung lượt tìm và độ khó (tùy chọn)

Mặc định mục tìm từ khóa dùng dữ liệu gợi ý thực tế từ Google Việt Nam và giữ trống cột lượt tìm khi chưa có nguồn đo chính thức, tuyệt đối không tự bịa số liệu. Nếu bạn có khóa API của ReviewWeb.site, gắn biến `REVIEWWEB_API_KEY` để hệ thống tự điền thêm lượt tìm hàng tháng và độ khó cạnh tranh từ 0 đến 100.
