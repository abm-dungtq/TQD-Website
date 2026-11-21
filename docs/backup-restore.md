# Sao lưu và khôi phục sau migration

> Cập nhật 2026-11-21. Cron backup `0 19 * * *` của Worker đã bị bỏ cùng phần admin. Worker `tqd-tools` không còn chạy `src/lib/backup.ts` (file đã xoá).

## Sao lưu hiện tại

- Nội dung mới nằm trên EzyPlatform. Dùng plugin **`data-backup`** trong admin EzyPlatform để tạo và tải bản sao lưu.
- D1 `tqd_db` và R2 `tqd-media` vẫn tồn tại vì các công cụ cần dữ liệu cũ (chat, tải video, media), nhưng không còn lịch sao lưu tự động từ repo này. Nếu cần sao lưu D1 thủ công:

  ```bash
  npx wrangler d1 export tqd_db --remote --output .secrets/tqd_db-$(date +%F).sql
  ```

- Bản sao lưu cũ vẫn nằm trong R2 `tqd-media/backups/`. Liệt kê:

  ```bash
  npx wrangler r2 object list tqd-media --prefix backups/
  ```

- Tải một bản cũ:

  ```bash
  npx wrangler r2 object get tqd-media/backups/YYYY-MM-DD.json.gz --remote --file .secrets/backup.json.gz
  gunzip -c .secrets/backup.json.gz | head
  ```

  Bản mã hoá có đuôi `.json.gz.enc`; giải mã bằng `openssl enc -d -aes-256-gcm -pbkdf2 -in <tệp> -out <tệp.gz>` với khoá cũ. Khoá `BACKUP_ENCRYPTION_KEY` của Worker cũ không còn được khai báo trong repo; lấy từ nơi lưu secret của chủ site nếu cần khôi phục.

## Khôi phục D1

Chỉ khôi phục D1 khi thật sự cần dữ liệu cho công cụ (ví dụ bảng `viral_transcripts`, `chat_daily`). Nội dung bài viết/trang không còn đọc từ D1; khôi phục D1 không đưa nội dung trở lại EzyPlatform.

1. Sao lưu D1 hiện tại trước khi ghi đè.
2. Chạy `npx wrangler d1 execute tqd_db --remote --file .secrets/backup.sql` cho bản SQL, hoặc `npx wrangler d1 import` nếu bản export hỗ trợ.
3. Kiểm tra `npx wrangler d1 execute tqd_db --remote --command "SELECT COUNT(*) FROM articles"` (bảng cũ vẫn còn cho tới khi dọn).

Trước đây backup tự động bỏ qua `sessions`, `rate_limits`, `chat_visitors`; các bảng này không có trong bản cũ.
