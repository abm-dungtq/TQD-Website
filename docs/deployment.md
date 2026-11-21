# Deploy sau migration EzyPlatform

> Cập nhật 2026-11-21. Worker `tqd-website` **không còn được deploy từ repo này**; nó đang phục vụ `tqd.me` bản cũ và phải giữ nguyên. Mọi lệnh dưới đây chỉ tác động `tqd-tools`, `tqd-next` (preview của tools) và `tqd-edge`.

## Kiến trúc

| Thành phần | Host | Vai trò |
|---|---|---|
| `tqd-edge` (`edge/`) | `stg.tqd.me`, `admin.tqd.me`, workers.dev | Sinh llms/feed/sitemap/`.md`, proxy công cụ, 301 đường dẫn cũ, chuyển tiếp trong suốt sang EzyPlatform |
| EzyPlatform web | `https://tqdweb.103-161-119-32.sslip.io` (biến `ORIGIN_WEB`) | Trang công khai `/`, `/posts/<slug>`, `/thu-vien`… |
| EzyPlatform admin | `https://tqdadmin.103-161-119-32.sslip.io` (biến `ORIGIN_ADMIN`) | Admin, chỉ đi qua `admin.tqd.me`; edge không bao giờ cache HTML admin |
| `tqd-tools` (`src/worker.ts`) | workers.dev, không custom domain | Chat, tải video, Viral Lab, X-ray, `/media/*`, `/api/t` |
| `tqd-next` (`env.preview`) | workers.dev, không route | Bản preview của `tqd-tools` |

Origin EzyPlatform chỉ trả lời khi request có header `X-TQD-Origin-Key`. Secret `ORIGIN_KEY` của `tqd-edge` phải trùng giá trị cấu hình trong Caddy/EzyPlatform trên VPS. Không đặt secret này vào `vars` hay file commit.

## Lệnh deploy

```bash
# 1. Build Astro (sinh cấu hình deploy trong dist/server/wrangler.json)
npm run build

# 2. Worker công cụ — deploy bản build, không dùng main ./src/worker.ts
npx wrangler deploy --config dist/server/wrangler.json                # tqd-tools
CLOUDFLARE_ENV=preview npm run build && \
  npx wrangler deploy --config dist/server/wrangler.json              # tqd-next (preview)

# 3. Edge
npx wrangler deploy --config edge/wrangler.jsonc  # tqd-edge + stg/admin custom domains

# 4. Kiểm tra
curl -s https://tqd-edge.ngulongyquan.workers.dev/__health
curl -s https://tqd-tools.ngulongyquan.workers.dev/api/chat/status
```

Nếu máy không gọi được `npx astro`, dùng `node node_modules/astro/bin/astro.mjs build`; lỗi "Cannot find native binding" nghĩa là thiếu gói rolldown cho đúng nền tảng, cài lại `npm install --no-save --package-lock=false @rolldown/binding-win32-x64-msvc` trên Windows.

## Secret

Đặt trên `tqd-tools` (cùng tên như Worker cũ) bằng `npx wrangler secret put <TÊN>`:

| Secret | Dùng cho |
|---|---|
| `GOCLAW_API_KEY` | Chatbot (`/api/chat*`) |
| `DL_API_KEY` hoặc `DL_HMAC_SECRET` | Ký ticket và gọi Home Daemon tải video |
| `OPENCODE_GO_API_KEY` | Sinh kịch bản Viral Lab |
| `ANALYTICS_SALT` | Băm visitor ID cho `/api/t` (thiếu thì dùng salt mặc định trong code) |
| `CF_ANALYTICS_TOKEN` | Chỉ dùng cho lib rollup thủ công, không còn cron |

Trên `tqd-edge`:

```bash
# Sinh giá trị ngẫu nhiên và đẩy thẳng vào secret, không in ra màn hình.
node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))" \
  | npx wrangler secret put ORIGIN_KEY --config edge/wrangler.jsonc
```

## Giao diện và nội dung EzyPlatform

```bash
node tools/build-assets/build.mjs                                  # asset tqd-* vào api/v1/media/
python tools/build-assets/upload-assets.py --yes --env production  # đẩy asset đổi vào thư viện media
python tools/build-assets/port.py                                  # sinh pages/ và page-fragments/
python tools/build-assets/publish.py --yes --env production        # đẩy trang + fragment
python tools/migrate/migrate.py --env production tags --apply      # meta bài viết: tqd_tags, tqd_cover, tqd_reading_minutes
python tools/migrate/migrate.py --env production verify
```

- Template bài viết đọc meta qua `get_post_meta`; khóa chỉ trả về khi nằm trong setting `ezyarticle_post_metadata_can_be_retrieved`. Lệnh `tags --apply` tự thêm khóa còn thiếu; sau khi setting đổi phải `systemctl restart tqd-web.service` trên VPS (web server cache setting).
- `/shop` dùng nguyên bundle đang chạy trên tqd.me (`tools/build-assets/shop.live.js`, 23 gói, giá hiện hành) và `edge/src/shop-data.json` cùng danh mục đó. `shop.ts`/`shop-catalog.ts` trong `tools/build-assets/site/` là danh mục 30 gói chưa từng lên production; chỉ đổi sang khi chủ site duyệt bảng giá mới.
- Bộ đệm reader của edge (`.md`, llms, feed, sitemap…) khóa theo version Worker, nên mỗi lần deploy edge là reader được dựng lại.

## Đã bỏ khỏi Worker công cụ

- Custom domain `tqd.me`, `www.tqd.me`, `tqd.io.vn`: vẫn thuộc `tqd-website`.
- Cron `0 19 * * *`: backup D1, dọn `rate_limits`, dọn cache viral và đồng bộ GSC không còn chạy trong repo này. Sao lưu chuyển sang plugin `data-backup` của EzyPlatform; dữ liệu cũ trong R2 `backups/` vẫn giữ nguyên.
- `TUVI_DB`: không còn gắn vào Worker này.

## Rollback

```bash
npx wrangler deployments list --name tqd-tools
npx wrangler rollback <version-id> --name tqd-tools
npx wrangler deployments list --name tqd-edge
npx wrangler rollback <version-id> --name tqd-edge
```

`tqd-website` chỉ rollback khi có yêu cầu riêng của chủ site; không dùng repo này để deploy lại nó.
