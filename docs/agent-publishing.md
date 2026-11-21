# Đăng bài: chuyển sang admin EzyPlatform

> **Đã bỏ từ 2026-11-21.** API đăng bài `/api/v1`, trang `/admin` và skill `skills/tqd-publish` đã bị xoá khỏi repo này. Nội dung giờ nằm trong EzyPlatform và được sửa trực tiếp tại admin.

## Cách đăng bài hiện tại

1. Mở admin EzyPlatform:
   - Local: `http://127.0.0.1:9090`
   - VPS (qua edge): `https://admin.tqd.me`
2. Vào **Posts**, tạo hoặc sửa bài, rồi **Publish**.
3. Ảnh và video tải lên qua **Media** của EzyPlatform; media EzyPlatform trả URL dạng `/api/v1/media/<tên-tệp>`.

Bài đã publish xuất hiện ở `https://tqd.me/bai-viet/<slug>` (edge chuyển tiếp sang `/posts/<slug>` của EzyPlatform) và trong các bản máy đọc do edge sinh: `/llms.txt`, `/llms-full.txt`, `/bai-viet/<slug>.md`, `/rss.xml`, `/feed.json`, `/catalog.json`, `/sitemap.xml`.

## Dành cho agent

Dùng các skill EzyPlatform thay cho skill cũ:

- `ezy-author` — tạo/sửa page, post và page fragment.
- `ezy-media` — kiểm tra, tải lên, thay thế media.
- `ezy-publish` / `ezy-verify` — publish và kiểm chứng trên site.
- `ezy-guide` — quy tắc chung và các lỗi thường gặp của nền tảng.

Không còn API key `tqd_...`, không còn `If-Match`/`ETag`, không còn script `scripts/tqd-publish.mjs`.
