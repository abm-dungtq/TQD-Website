# Đo lường có xin phép với GA4, Microsoft Clarity và quy ước UTM

Tài liệu này mô tả lớp đo lường bên thứ ba của tqd.me. Lớp thống kê nội bộ không cookie (Workers Analytics Engine) nằm ở [analytics-event-spec.md](analytics-event-spec.md) và luôn chạy, không phụ thuộc lựa chọn của khách.

## Cách hoạt động

- Mã nguồn: [`src/scripts/consent.ts`](../src/scripts/consent.ts) điều khiển khung hỏi ý kiến, [`src/lib/consent-track.ts`](../src/lib/consent-track.ts) chứa phần phân loại liên kết, vùng trang và cookie, có test ở [`src/lib/consent-track.test.ts`](../src/lib/consent-track.test.ts).
- Cấu hình: biến `GA4_MEASUREMENT_ID` và `CLARITY_PROJECT_ID` trong `wrangler.jsonc` (xem [deployment.md](deployment.md)). [`BaseLayout.astro`](../src/layouts/BaseLayout.astro) đưa hai mã này vào `data-ga4`, `data-clarity` trên thẻ `<html>`. Thiếu cả hai thì không có khung hỏi ý kiến, không có liên kết "Tùy chọn đo lường".
- Trước khi khách bấm Đồng ý, trình duyệt không gọi `googletagmanager.com` hay `clarity.ms` và không có cookie `_ga`, `_clck`.
- Lựa chọn lưu ở `localStorage`, khóa `tqd_consent` (`granted` hoặc `denied`). `tqd_notrack=1` tắt mọi lớp đo lường và khóa luôn khung hỏi ý kiến.
- Không hiện khung hỏi ý kiến khi trình duyệt là trình tự động (`navigator.webdriver`) hoặc bật Global Privacy Control. Khách vẫn đồng ý được qua liên kết "Tùy chọn đo lường" ở footer. Khách đã lưu `granted` từ trước vẫn được đo dù sau đó bật GPC, vì lựa chọn rõ ràng được ưu tiên.
- Đồng ý: GA4 chạy ở chế độ chỉ phân tích (quảng cáo bị từ chối, Google Signals tắt); Clarity nhận `consentv2` với `analytics_Storage: granted`, `ad_Storage: denied`.
- Từ chối sau khi đã đồng ý: tắt GA4, gửi `consentv2` từ chối và `stop` cho Clarity để ngừng ghi ngay trên trang đang mở, xóa cookie `_ga*`, `_gid`, `_gat*`, `_clck`, `_clsk` trên tên miền hiện tại và mọi tên miền cha. Cookie Clarity đặt trên tên miền Microsoft (`MUID`, `CLID`, `ANONCHK`, `SM`) không xóa được từ tqd.me.
- Bản ghi Clarity che khung trò chuyện AI (`[data-chat]`) và khu vực công cụ `/tai-video` bằng `data-clarity-mask="true"`. Phần tử mới hiển thị lại chữ khách gõ phải gắn thuộc tính này.
- CSP công khai trong [`src/middleware.ts`](../src/middleware.ts) mở `www.googletagmanager.com`, `www.clarity.ms`, `scripts.clarity.ms` cho `script-src` và `*.google-analytics.com`, `*.analytics.google.com`, `*.clarity.ms`, `c.bing.com` cho `connect-src`. Trang admin không mở host nào trong số này.

## Sự kiện

Mỗi sự kiện GA4 kèm `placement` và `link_page`. `placement` là `header` trong `.site-header`, `footer` trong `.site-footer`, `hero` trong `.hero` hoặc `[data-placement="hero"]` (hiện chưa trang nào dùng), còn lại là `content`. Liên kết ngoài gửi thêm `link_url` đã bỏ query và fragment. Liên kết Zalo và Messenger chỉ gửi tên miền, vì đường dẫn của chúng là số điện thoại hoặc tài khoản cá nhân. Số điện thoại và email không bao giờ được gửi. Clarity nhận sự kiện tùy chỉnh cùng tên để lọc bản ghi phiên và heatmap.

| Hành động | Sự kiện | `method` |
| --- | --- | --- |
| Bấm `tel:` | `click_call` | `phone` |
| Bấm `mailto:` | `click_email` | `email` |
| Bấm `zalo.me`, `chat.zalo.me` | `click_zalo` | `zalo` |
| Bấm `m.me`, `messenger.com` | `click_messenger` | `messenger` |
| Bấm Google Maps (`google.<tld>/maps`, `maps.google.<tld>`, `maps.app.goo.gl`, `goo.gl/maps`) | `click_directions` | |
| Bấm Facebook, YouTube, TikTok | `click_social` | `facebook`, `youtube`, `tiktok` |
| Lần đầu phát mỗi `<audio>` nằm trong `[data-track-audio]` (hiện site chưa có `<audio>`, gắn thuộc tính khi thêm) | `audio_play` | |

Với điện thoại, email và Zalo, script gửi thêm `generate_lead` (tham số `method`) như trước để chuỗi báo cáo cũ không bị đứt. GA4 Enhanced Measurement "Lượt nhấp ra ngoài" tự gửi sự kiện `click` kèm URL đầy đủ, ngoài tầm kiểm soát của script. Vì vậy liên kết Zalo trong dữ liệu site (`person.zalo`) phải là tên tài khoản, không phải số điện thoại; nếu buộc dùng số, tắt "Lượt nhấp ra ngoài" trong luồng web GA4.

Muốn các sự kiện `click_*` hiện trong báo cáo Sự kiện chính, khai báo chúng trong GA4: Quản trị → Hiển thị dữ liệu → Sự kiện → Tạo sự kiện → đánh dấu là sự kiện chính, không đặt giá trị mặc định.

Clarity project `tqd.me` có ID `zgki6l3y68` (tài khoản Clarity của chủ site, ngành Technology & Telecommunications, masking mặc định).

## Quy ước UTM

GA4 tự đọc UTM; lớp nội bộ gom `utm_source` vào cột `utm` (xem [analytics-event-spec.md](analytics-event-spec.md)). Mọi liên kết về tqd.me đặt ở kênh ngoài gắn ba tham số, viết thường, không dấu, nối bằng gạch ngang. Không gắn UTM cho liên kết nội bộ, vì UTM ghi đè nguồn thật của phiên.

| Tham số | Ý nghĩa | Giá trị dùng chung |
| --- | --- | --- |
| `utm_source` | Nền tảng | `facebook`, `youtube`, `zalo`, `tiktok`, `google`, `email` |
| `utm_medium` | Loại lưu lượng | `social` (bài tự nhiên), `paid-social` (quảng cáo), `video`, `chat` (tin nhắn), `profile` (tiểu sử, nút trên trang), `newsletter` |
| `utm_campaign` | Chuỗi nội dung hoặc đợt chạy | theo chủ đề, ví dụ `bai-viet`, `shop`, `tai-video`, `ho-so` |
| `utm_content` | Tùy chọn: bài hoặc nút cụ thể | `bai-08`, `ep06`, `nut-mua` |

Ví dụ:

- Tiểu sử TikTok: `https://tqd.me/?utm_source=tiktok&utm_medium=profile&utm_campaign=ho-so`
- Bài Facebook dẫn về một bài viết: `https://tqd.me/bai-viet/<slug>?utm_source=facebook&utm_medium=social&utm_campaign=bai-viet`
- Tin nhắn Zalo gửi link shop: `https://tqd.me/shop?utm_source=zalo&utm_medium=chat&utm_campaign=shop`

Canonical của mọi trang trỏ về URL không tham số, nên liên kết có UTM không tạo trang trùng lặp.

## Kiểm tra sau khi deploy

Mở tqd.me ở cửa sổ ẩn danh, DevTools → Network:

1. Chưa bấm gì: thấy khung hỏi ý kiến, không có yêu cầu tới `googletagmanager.com` hay `clarity.ms`, không có cookie `_ga`, `_clck`.
2. Bấm Đồng ý: tải `gtag/js?id=G-Z9XEQ6BVXJ` và `www.clarity.ms/tag/zgki6l3y68`, có yêu cầu `*.clarity.ms/collect`, có cookie `_ga`, `_clck`, `_clsk`. Console không có lỗi CSP.
3. Bấm một liên kết Zalo hoặc mạng xã hội: GA4 → Báo cáo → Thời gian thực hiện sự kiện sau vài giây.
4. Bấm "Tùy chọn đo lường" ở footer, chọn Từ chối: các cookie trên biến mất.

Clarity hiện phiên đầu tiên sau khoảng 30 phút đến 2 giờ.
