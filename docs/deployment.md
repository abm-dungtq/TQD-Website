# Deploy

## Đích

| Mục | Giá trị |
|---|---|
| Tài khoản Cloudflare | Xaotiensinh@gmail.com's Account (`b243f38bff984ce1741c379547e97a75`) |
| Worker | `tqd-website` (chỉ static assets, không có mã server) |
| Tên miền | `tqd.io.vn` (custom domain của Worker; zone nằm cùng tài khoản) |
| Cấu hình | [`wrangler.jsonc`](../wrangler.jsonc) |

## Deploy

```bash
npx wrangler login          # chỉ cần một lần; đăng nhập đúng tài khoản ở trên
npm run deploy              # build + check:privacy + wrangler deploy
```

Nếu máy đang đăng nhập Wrangler bằng nhiều tài khoản, đặt `CLOUDFLARE_ACCOUNT_ID=b243f38bff984ce1741c379547e97a75` trước khi chạy. `account_id` cũng đã ghi trong `wrangler.jsonc`.

Kiểm tra sau deploy: `node scripts/verify/live.mjs` phải in `OK live`.

## Vì sao dùng Wrangler thay vì `cf` CLI

Ngày 2026-10-12 đã thử `cf` 1.0.0-beta.14: đăng nhập (`cf auth login`) và `cf migrate` chạy được, nhưng `cf build` / `cf deploy` nhận ra dự án Astro, tự chạy `astro build` rồi dừng với lỗi:

```
Build Output Specification: no root config found at .cloudflare/output/v0/config.json.
```

Astro chỉ tạo định dạng output này khi dùng adapter `@astrojs/cloudflare` (SSR), trái với thiết kế site tĩnh. Vì vậy deploy bằng Wrangler; `wrangler.jsonc` là cấu hình duy nhất. Khi `cf` hỗ trợ site tĩnh dựng sẵn, có thể chạy lại `cf migrate`.

## Tên miền

`routes: [{ "pattern": "tqd.io.vn", "custom_domain": true }]` trong `wrangler.jsonc` để Wrangler tự tạo bản ghi DNS và chứng chỉ. Nếu một lần deploy sau báo lỗi quyền hoặc xung đột bản ghi DNS, gắn tay trong dashboard: Workers & Pages → `tqd-website` → Settings → Domains & Routes → Add → Custom domain → `tqd.io.vn`. Không xoá bản ghi DNS sẵn có khi chưa hỏi chủ tên miền.

## Rollback

```bash
npx wrangler deployments list
npx wrangler rollback <version-id>
```

Hoặc trong dashboard: `tqd-website` → Deployments → chọn bản trước → Rollback.
