# Deploy

## Đích

| Mục | Giá trị |
|---|---|
| Tài khoản Cloudflare | Xaotiensinh@gmail.com's Account (`b243f38bff984ce1741c379547e97a75`) |
| Worker production | `tqd-website`, custom domain `tqd.io.vn`, cron sao lưu `0 19 * * *` |
| Worker preview | `tqd-next` (`env.preview`), https://tqd-next.ngulongyquan.workers.dev, không cron |
| Mã chạy | Astro SSR qua `@astrojs/cloudflare`; entry [`src/worker.ts`](../src/worker.ts) (fetch + scheduled) |
| Cấu hình | [`wrangler.jsonc`](../wrangler.jsonc) |

Production và preview dùng **chung dữ liệu**: binding `DB` → D1 `tqd_db`, `MEDIA` → R2 `tqd-media`. Sửa nội dung trên preview là sửa luôn site thật.

## Biến và secret

| Tên | Loại | Ghi chú |
|---|---|---|
| `ADMIN_EMAIL` | `vars` trong `wrangler.jsonc` | Email đăng nhập `/admin` (khai báo ở cả gốc và `env.preview`) |
| `ADMIN_PASSWORD_HASH` | secret | Chuỗi `pbkdf2-sha256$<vòng>$<salt>$<hash>`; không bao giờ lưu mật khẩu gốc |
| `GOCLAW_BASE_URL`, `GOCLAW_AGENT`, `CHAT_DAILY_CAP`, `GOCLAW_API_KEY` | `vars` + secret | Chatbot; xem [chatbot.md](chatbot.md) |

Đặt hoặc đổi mật khẩu admin (chỉ hash đi qua pipe, không in ra màn hình):

```bash
node scripts/admin-password.mjs --prompt | npx wrangler secret put ADMIN_PASSWORD_HASH --name tqd-website
node scripts/admin-password.mjs --generate .secrets/admin-next.txt | npx wrangler secret put ADMIN_PASSWORD_HASH --name tqd-next
```

`--from <file>` băm mật khẩu đã lưu trong file. Chạy local cần `.dev.vars` chứa `ADMIN_PASSWORD_HASH='<hash>'` (dấu nháy đơn để `$` không bị hiểu là biến); `.dev.vars` và `.secrets/` đã nằm trong `.gitignore`.

## Deploy

```bash
npx wrangler login          # một lần, đúng tài khoản ở trên
npm run deploy:preview      # build với CLOUDFLARE_ENV=preview rồi deploy tqd-next
npm run deploy              # build rồi deploy tqd-website lên tqd.io.vn
```

Môi trường được chọn **lúc build** (plugin Vite của Cloudflare ghi cấu hình Wrangler vào bản build), nên deploy preview phải qua `npm run deploy:preview`, không chạy `wrangler deploy --env preview` trên bản build production. Nếu máy đăng nhập nhiều tài khoản, đặt `CLOUDFLARE_ACCOUNT_ID=b243f38bff984ce1741c379547e97a75`.

Migration D1: `npx wrangler d1 migrations apply tqd_db --remote` (sao lưu trước, xem [backup-restore.md](backup-restore.md)). Khi migration và code mới đi cùng nhau, deploy code trước hoặc tăng `content_version` thêm một lần sau deploy: cache trang được khoá theo `content_version`, nên nếu migration tăng phiên bản trước khi code mới lên, HTML cũ (trỏ tới JS cũ) có thể bị lưu vào cache dưới phiên bản mới.

## Kiểm tra sau deploy

```bash
node scripts/verify/site.mjs https://tqd.io.vn       # OK site
npm run check:privacy -- https://tqd.io.vn            # OK no post text ...
node scripts/verify/live.mjs                          # OK live
node scripts/verify/cache.mjs https://tqd.io.vn       # OK cache
TQD_ADMIN_PASSWORD=... node scripts/verify/admin.mjs https://tqd-next.ngulongyquan.workers.dev   # OK admin
```

`admin.mjs` sửa tạm hồ sơ rồi trả lại, và cố ý khoá đăng nhập của IP đang chạy 15 phút; chạy xong thì `npx wrangler d1 execute tqd_db --remote --command "DELETE FROM rate_limits"`. Khi chạy với `astro dev`, script nghỉ 200 ms sau các yêu cầu bị từ chối vì proxy của dev server reset kết nối khi Worker trả lời trước khi nhận hết body; Worker thật không bị.

## Cache trang

HTML công khai được lưu trong Cache API với khoá `<đường dẫn>?v=<content_version>&b=<build id>`. Mỗi lần ghi nội dung tăng `content_version`; mỗi lần build có build id mới, nên không cần xoá cache tay. Header `X-Cache: HIT|MISS` và `X-Content-Version` cho biết trạng thái. Cache API không hoạt động trên `workers.dev`, chỉ trên `tqd.io.vn`.

## Giới hạn CPU gói Free

Lưu bài là đường duy nhất dễ chạm giới hạn 10 ms CPU của gói Workers Free, vì lúc đó Worker render Markdown và dò đoạn trùng Facebook. Bài tối đa 100 000 ký tự. Năm 2026-10 đã thử lưu bài 10k, 50k và 100k ký tự trên preview, cả ba đều thành công. Lượt xem bài thì chỉ đọc HTML đã render sẵn. Nếu log xuất hiện lỗi 1102 (`exceededCpu`) khi lưu bài, cân nhắc gói Workers Paid hoặc hạ giới hạn độ dài bài.

## Vì sao dùng Wrangler thay vì `cf` CLI

Ngày 2026-10-12 đã thử `cf` 1.0.0-beta.14: `cf build` / `cf deploy` dừng với lỗi `Build Output Specification: no root config found at .cloudflare/output/v0/config.json.` Vì vậy deploy bằng Wrangler; `wrangler.jsonc` là cấu hình duy nhất.

## Tên miền

`routes: [{ "pattern": "tqd.io.vn", "custom_domain": true }]` để Wrangler tự tạo bản ghi DNS và chứng chỉ. Nếu deploy báo xung đột bản ghi DNS, gắn tay trong dashboard (Workers & Pages → `tqd-website` → Settings → Domains & Routes). Không xoá bản ghi DNS sẵn có khi chưa hỏi chủ tên miền.

## Rollback

```bash
npx wrangler deployments list --name tqd-website
npx wrangler rollback <version-id> --name tqd-website
```

Bản v1 (site tĩnh) trước khi chuyển sang SSR: `8ffa1fd5-3bcd-4b4a-acda-50123781dd8d`. Rollback về bản này chỉ đổi mã; dữ liệu D1/R2 giữ nguyên.
