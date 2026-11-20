# Deploy

## Đích

| Mục | Giá trị |
|---|---|
| Tài khoản Cloudflare | Xaotiensinh@gmail.com's Account (`b243f38bff984ce1741c379547e97a75`) |
| Worker production | `tqd-website`, custom domain `tqd.me` (chính), `www.tqd.me` và `tqd.io.vn` (tên miền cũ) chuyển hướng 301 về `tqd.me`; cron sao lưu `0 19 * * *` |
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
| `CF_ANALYTICS_TOKEN` | secret | Token có quyền đọc Account Analytics để truy vấn WAE SQL và tổng hợp dữ liệu cho `/admin/thong-ke`; xem [analytics-event-spec.md](analytics-event-spec.md) |
| `GA4_MEASUREMENT_ID` | `vars` trong `wrangler.jsonc` | Measurement ID của Google Analytics 4. Production dùng `G-Z9XEQ6BVXJ` (tài khoản GA `TQD`, property `tqd.me`, luồng web `tqd.me web`, mã luồng `16374995327`); `env.preview` để rỗng để bản preview không ghi vào số liệu thật. Để rỗng thì trang không hiện khung hỏi ý kiến và không tải mã Google. Khi có giá trị, GA4 chỉ tải sau khi khách bấm Đồng ý (`src/scripts/consent.ts`); chi tiết sự kiện, CSP và cách kiểm tra ở [measurement-ga4-clarity.md](measurement-ga4-clarity.md) |
| `CLARITY_PROJECT_ID` | `vars` trong `wrangler.jsonc` | Project ID của Microsoft Clarity (heatmap, bản ghi phiên). Production dùng `zgki6l3y68` (project `tqd.me`); `env.preview` để rỗng. Clarity dùng chung khung hỏi ý kiến với GA4 và chỉ tải sau khi khách bấm Đồng ý; xem [measurement-ga4-clarity.md](measurement-ga4-clarity.md) |
| `GOOGLE_SITE_VERIFICATION` | `vars` trong `wrangler.jsonc` | Mã xác minh Google Search Console dạng thẻ HTML cho property tiền tố URL `https://tqd.me/`; để rỗng thì không xuất thẻ `google-site-verification`. Tệp xác minh `/googlec9ec92b28c893b4f.html` do route `src/pages/googlec9ec92b28c893b4f.ts` trả về là phương thức thứ hai; giữ cả hai để quyền sở hữu không bị mất. Đã xác minh bằng cả hai phương thức, đã gửi `sitemap.xml` và đã liên kết với luồng GA4 `tqd.me web` ngày 2026-11-19 |

Đặt hoặc đổi mật khẩu admin (chỉ hash đi qua pipe, không in ra màn hình):

```bash
node scripts/admin-password.mjs --prompt | npx wrangler secret put ADMIN_PASSWORD_HASH --name tqd-website
node scripts/admin-password.mjs --generate .secrets/admin-next.txt | npx wrangler secret put ADMIN_PASSWORD_HASH --name tqd-next
```

`--from <file>` băm mật khẩu đã lưu trong file. Chạy local cần `.dev.vars` chứa `ADMIN_PASSWORD_HASH='<hash>'` (dấu nháy đơn để `$` không bị hiểu là biến); `.dev.vars` và `.secrets/` đã nằm trong `.gitignore`.

Secret cho WAE phải được đặt trên từng Worker cần tổng hợp dữ liệu; bản build không tự đưa secret từ `.dev.vars` lên production. Nếu thiếu `CF_ANALYTICS_TOKEN`, cron bỏ qua bước rollup và nút tổng hợp trong admin trả trạng thái `missing_token`. Đặt token qua đầu vào ẩn của `npx wrangler secret put CF_ANALYTICS_TOKEN --name tqd-website`, rồi tổng hợp lại các ngày còn truy vấn được theo [hướng dẫn quản trị](admin-agent-operations.md#cách-đọc-thống-kê-truy-cập).

Để đọc dữ liệu WAE, Worker production dùng token `tqd-analytics-read` của tài khoản chứa `tqd-website`. Token chỉ có quyền **Account Analytics: Read** và được quản lý tại Cloudflare **My Profile → API Tokens**. Giá trị được lưu mã hóa trong secret `CF_ANALYTICS_TOKEN` của Worker.

Người dùng đã duyệt cấu hình không hết hạn và không giới hạn IP cho production; preview được cấu hình riêng. Khi thay token, cần cập nhật secret của Worker trước, xác minh truy vấn hoạt động rồi mới thu hồi token cũ. Giữ giá trị token ngoài Git, tài liệu và log.

## Deploy

```bash
npx wrangler login          # một lần, đúng tài khoản ở trên
npm run deploy:preview      # build với CLOUDFLARE_ENV=preview rồi deploy tqd-next
npm run deploy              # build rồi deploy tqd-website lên tqd.me
```

Build cần tệp `plans/seo-aeo-queue.json`: `src/lib/seo/queue-seed.ts` nhập tệp này lúc build, nhưng tệp nằm trong `.gitignore`, nên một bản checkout mới (kể cả worktree) sẽ build lỗi `Cannot find module`. Chép tệp từ thư mục gốc dự án sang trước khi build. Deploy từ một worktree sạch, không deploy từ thư mục làm việc còn thay đổi chưa commit, vì `wrangler deploy` đẩy cả phần chưa commit lên production.

Môi trường được chọn **lúc build** (plugin Vite của Cloudflare ghi cấu hình Wrangler vào bản build), nên deploy preview phải qua `npm run deploy:preview`, không chạy `wrangler deploy --env preview` trên bản build production. Nếu máy đăng nhập nhiều tài khoản, đặt `CLOUDFLARE_ACCOUNT_ID=b243f38bff984ce1741c379547e97a75`.

Migration D1: `npx wrangler d1 migrations apply tqd_db --remote` (sao lưu trước, xem [backup-restore.md](backup-restore.md)). Khi migration và code mới đi cùng nhau, deploy code trước hoặc tăng `content_version` thêm một lần sau deploy: cache trang được khoá theo `content_version`, nên nếu migration tăng phiên bản trước khi code mới lên, HTML cũ (trỏ tới JS cũ) có thể bị lưu vào cache dưới phiên bản mới.

## Kiểm tra sau deploy

```bash
node scripts/verify/site.mjs https://tqd.me       # OK site
npm run check:privacy -- https://tqd.me            # OK no post text ...
node scripts/verify/live.mjs                          # OK live
node scripts/verify/cache.mjs https://tqd.me       # OK cache
TQD_ADMIN_PASSWORD=... node scripts/verify/admin.mjs https://tqd-next.ngulongyquan.workers.dev   # OK admin
```

`admin.mjs` sửa tạm hồ sơ rồi trả lại, và cố ý khoá đăng nhập của IP đang chạy 15 phút; chạy xong thì `npx wrangler d1 execute tqd_db --remote --command "DELETE FROM rate_limits"`. Khi chạy với `astro dev`, script nghỉ 200 ms sau các yêu cầu bị từ chối vì proxy của dev server reset kết nối khi Worker trả lời trước khi nhận hết body; Worker thật không bị.

## Cache trang

HTML công khai được lưu trong Cache API với khoá `<đường dẫn>?v=<content_version>&b=<build id>`. Mỗi lần ghi nội dung tăng `content_version`; mỗi lần build có build id mới, nên không cần xoá cache tay. Header `X-Cache: HIT|MISS` và `X-Content-Version` cho biết trạng thái. Cache API không hoạt động trên `workers.dev`, chỉ trên `tqd.me`.

## Giới hạn CPU gói Free

Lưu bài là đường duy nhất dễ chạm giới hạn 10 ms CPU của gói Workers Free, vì lúc đó Worker render Markdown và dò đoạn trùng Facebook. Bài tối đa 100 000 ký tự. Năm 2026-10 đã thử lưu bài 10k, 50k và 100k ký tự trên preview, cả ba đều thành công. Lượt xem bài thì chỉ đọc HTML đã render sẵn. Nếu log xuất hiện lỗi 1102 (`exceededCpu`) khi lưu bài, cân nhắc gói Workers Paid hoặc hạ giới hạn độ dài bài.

## Vì sao dùng Wrangler thay vì `cf` CLI

Ngày 2026-10-12 đã thử `cf` 1.0.0-beta.14: `cf build` / `cf deploy` dừng với lỗi `Build Output Specification: no root config found at .cloudflare/output/v0/config.json.` Vì vậy deploy bằng Wrangler; `wrangler.jsonc` là cấu hình duy nhất.

## Tên miền

Từ 2026-11-02 tên miền chính là `tqd.me`. `routes` trong `wrangler.jsonc` gắn `tqd.me`, `www.tqd.me` và `tqd.io.vn` dạng custom domain để Wrangler tự tạo bản ghi DNS và chứng chỉ. [`src/worker.ts`](../src/worker.ts) chuyển hướng `www.tqd.me` và `tqd.io.vn` về `tqd.me`, giữ nguyên đường dẫn: 301 cho GET/HEAD, 308 cho các phương thức ghi. Máy chủ chatbot vẫn ở `goclaw.tqd.io.vn` (xem [chatbot.md](chatbot.md)), nên chưa bỏ được tên miền cũ. Nếu deploy báo xung đột bản ghi DNS, gắn tay trong dashboard (Workers & Pages → `tqd-website` → Settings → Domains & Routes). Không xoá bản ghi DNS sẵn có khi chưa hỏi chủ tên miền.

## Rollback

```bash
npx wrangler deployments list --name tqd-website
npx wrangler rollback <version-id> --name tqd-website
```

Bản trước khi bật GA4 và xác minh Search Console (2026-11-19): `69bacd6f-d34c-4029-b691-897ca70e9f78`.

Bản v1 (site tĩnh) trước khi chuyển sang SSR: `8ffa1fd5-3bcd-4b4a-acda-50123781dd8d`. Rollback về bản này chỉ đổi mã; dữ liệu D1/R2 giữ nguyên.
