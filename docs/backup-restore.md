# Sao lưu và khôi phục

## Sao lưu tự động

- Cron của Worker `tqd-website`: `0 19 * * *` (19:00 UTC = 02:00 giờ Việt Nam). Môi trường preview `tqd-next` không chạy cron.
- Mỗi lần chạy, [`src/lib/backup.ts`](../src/lib/backup.ts) ghi các bảng `settings`, `items`, `articles`, `media`, `api_keys`, `chat_daily` (số lượt chat theo ngày) vào R2 bucket `tqd-media` tại `backups/YYYY-MM-DD.json` (ngày theo giờ Việt Nam) và giữ 30 bản mới nhất. Bảng `sessions`, `rate_limits` và `chat_visitors` không được sao lưu.
- Sao lưu tay: `/admin/sao-luu` → **Sao lưu ngay**. Trang này cũng liệt kê các bản hiện có.

## Tải một bản sao lưu

```bash
npx wrangler r2 object get tqd-media/backups/YYYY-MM-DD.json --remote --file .secrets/backup.json
```

## Khôi phục từ bản sao lưu

Lệnh sau **xoá rồi ghi lại** toàn bộ 6 bảng trên (bản sao lưu cũ chưa có `chat_daily` thì bảng này giữ nguyên). Sao lưu bản hiện tại trước khi chạy.

```bash
node scripts/restore-backup.mjs .secrets/backup.json .secrets/restore.sql
npx wrangler d1 execute tqd_db --remote --file .secrets/restore.sql
```

Sau khi khôi phục, tăng `content_version` để trang công khai bỏ cache cũ (bản sao lưu đã chứa `content_version`; nếu nó nhỏ hơn bản đang chạy thì trang cache cũ có thể còn hiện):

```bash
npx wrangler d1 execute tqd_db --remote --command "UPDATE settings SET value = CAST(value AS INTEGER) + 1000 WHERE key = 'content_version'"
```

## D1 Time Travel

D1 tự giữ lịch sử 30 ngày, khôi phục được tới từng phút:

```bash
npx wrangler d1 time-travel info tqd_db
npx wrangler d1 time-travel restore tqd_db --timestamp <ISO-8601>
```

Đặt `CLOUDFLARE_ACCOUNT_ID=b243f38bff984ce1741c379547e97a75` trước các lệnh `wrangler` nếu máy đăng nhập nhiều tài khoản.
