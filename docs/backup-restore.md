# Sao lưu và khôi phục

## Sao lưu tự động

- Cron của Worker `tqd-website`: `0 19 * * *` (19:00 UTC = 02:00 giờ Việt Nam). Môi trường preview `tqd-next` không chạy cron.
- Mỗi lần chạy, Worker ghi các bảng trong `BACKUP_TABLES` của [`src/lib/backup.ts`](../src/lib/backup.ts) vào R2 bucket `tqd-media` và giữ 30 bản mới nhất. Tệp có tên `backups/YYYY-MM-DD.json.gz`, hoặc `backups/YYYY-MM-DD.json.gz.enc` khi đặt `BACKUP_ENCRYPTION_KEY`; ngày tính theo giờ Việt Nam. Bảng `sessions`, `rate_limits` và `chat_visitors` không được sao lưu.
- Sao lưu tay: `/admin/sao-luu` → **Sao lưu ngay**. Trang này cũng liệt kê các bản hiện có.

## Tải một bản sao lưu

Trang `/admin/sao-luu` liệt kê tên từng bản sao lưu. Chép đúng tên tệp và thay ngày tương ứng trong lệnh tải. Với bản gzip không mã hóa:

```bash
mkdir -p .secrets
npx wrangler r2 object get tqd-media/backups/YYYY-MM-DD.json.gz --remote --file .secrets/backup.json.gz
```

Với bản mã hóa, tải tệp có đuôi `.json.gz.enc`:

```bash
mkdir -p .secrets
npx wrangler r2 object get tqd-media/backups/YYYY-MM-DD.json.gz.enc --remote --file .secrets/backup.json.gz.enc
```

## Khôi phục từ bản sao lưu

Script [`restore-backup.mjs`](../scripts/restore-backup.mjs) tạo SQL **xóa rồi ghi lại** các bảng được hỗ trợ có mặt trong bản sao lưu; bảng vắng mặt được giữ nguyên. Danh sách do `TABLES` trong script quản lý. Sao lưu bản hiện tại trước khi chạy. Với bản gzip không mã hóa:

```bash
node scripts/restore-backup.mjs .secrets/backup.json.gz .secrets/restore.sql
npx wrangler d1 execute tqd_db --remote --file .secrets/restore.sql
```

Bản mã hóa cần đúng khóa đã dùng khi tạo tệp. Nhập khóa qua đầu vào ẩn, sau đó chạy script tạo SQL. Cách nhập này giữ giá trị khóa khỏi lịch sử lệnh:

```bash
read -rs BACKUP_ENCRYPTION_KEY
export BACKUP_ENCRYPTION_KEY
node scripts/restore-backup.mjs .secrets/backup.json.gz.enc .secrets/restore.sql
unset BACKUP_ENCRYPTION_KEY
```

Chỉ khi script tạo SQL thành công mới chạy lệnh `wrangler d1 execute` ở trên. Bản `.json` cũ vẫn đọc được. Tệp tải về và SQL có thể chứa dữ liệu riêng; giữ trong `.secrets/` và xóa sau khi hoàn tất.

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
