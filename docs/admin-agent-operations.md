# Vận hành nội dung: chuyển sang admin EzyPlatform

> **Đã bỏ từ 2026-11-21.** Toàn bộ trang `/admin/**`, API `/api/v1/**` và các form ghi nội dung của Worker cũ đã bị xoá. Tài liệu này chỉ còn để giải thích nơi thao tác mới.

## Việc nằm ở đâu bây giờ

| Việc | Nơi thực hiện |
|---|---|
| Bài viết | EzyPlatform admin → **Posts** |
| Trang, hồ sơ, sản phẩm, video, thư viện, liên hệ | EzyPlatform admin → **Pages** / page fragments |
| Ảnh, video | EzyPlatform admin → **Media** |
| SEO, từ khóa, Google Search Console | Plugin `ezyseo` trong admin EzyPlatform |
| Liên hệ | Plugin `ezysupport` (Contact-us) và `ezymail` |
| Sao lưu dữ liệu | Plugin `data-backup` của EzyPlatform |
| Chat, tải video, Viral Lab, X-ray, media cũ | Worker công cụ `tqd-tools` (không có giao diện quản trị) |

## Cách làm cho agent

Đọc và dùng các skill EzyPlatform: `ezy-guide`, `ezy-author`, `ezy-media`, `ezy-publish`, `ezy-verify`, `ezy-sync`, `ezy-i18n`. Quy trình publish chuẩn nằm trong `ezy-publish/SKILL.md`.

Các trang cũ như `/admin/ho-so`, `/admin/so-lieu`, `/admin/thu-vien`, `/admin/bai-viet`, `/admin/media`, `/admin/sao-luu`, `/admin/api-keys`, `/admin/chat`, `/admin/thong-ke`, `/admin/seo` không còn tồn tại trên site mới. Đừng gọi chúng.
