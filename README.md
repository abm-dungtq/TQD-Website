# tqd.me — EzyPlatform + Cloudflare edge

Repo này chứa hai phần hạ tầng còn lại sau khi chuyển website cá nhân của **Trịnh Quang Dũng (DũngTQ)** sang EzyPlatform:

1. **`edge/` — Worker `tqd-edge`**: cửa công khai cho `tqd.me` và `admin.tqd.me`. Sinh các bản máy đọc từ API công khai của EzyPlatform, proxy công cụ sang Worker `tqd-tools`, giữ 301 cho đường dẫn cũ và chuyển tiếp trong suốt mọi request khác về EzyPlatform.
2. **`src/` — Worker `tqd-tools`**: runtime công cụ thuần Astro SSR, gồm chatbot, tải video, Viral Lab, trang X-ray và phục vụ media R2. Không còn nội dung, không còn `/admin`, không còn API đăng bài.

Từ 2026-11-21 site công khai **`tqd.me` do `tqd-edge` + EzyPlatform phục vụ**; Worker `tqd-website` (bản Astro cũ) không còn nhận traffic và không được deploy lại từ repo này. `www.tqd.me`, `tqd.io.vn` và host thử nghiệm cũ `stg.tqd.me` chỉ trả 301 về `tqd.me`.

## Host và thành phần

| Host / route | Xử lý bởi | Ghi chú |
|---|---|---|
| `tqd.me/**` | `tqd-edge` | Trang công khai, reader máy đọc, proxy công cụ; passthrough sang `ORIGIN_WEB` |
| `admin.tqd.me/**` | `tqd-edge` | Chỉ passthrough sang `ORIGIN_ADMIN`; HTML admin không bao giờ cache |
| `/bai-viet/<slug>` | `tqd-edge` | Giữ URL hiển thị, lấy nội dung từ `/posts/<slug>` của origin |
| `/bai-viet` | `tqd-edge` | Passthrough sang `/bai-viet` của origin |
| `/api/chat*`, `/api/dl/*`, `/api/viral/*`, `/api/t`, `/xray/*`, `/media/*` | `tqd-tools` qua service binding `TOOLS` | Không lộ host của Worker công cụ ra ngoài |
| `/dao-tao`, `/chuyen-mon`, `/video`, `/so-lieu` | `tqd-edge` | 301 cố định, giữ query string |
| `www.tqd.me`, `tqd.io.vn`, `stg.tqd.me` | `tqd-edge` | 301 về cùng đường dẫn trên `tqd.me` |

Origin EzyPlatform là các host `sslip.io` của VPS, khai báo trong `edge/wrangler.jsonc`:

- `ORIGIN_WEB` — web công khai.
- `ORIGIN_ADMIN` — admin.
- `ORIGIN_KEY` — secret của `tqd-edge`, gửi kèm header `X-TQD-Origin-Key`; Caddy/EzyPlatform trên VPS chỉ trả lời khi header khớp.

## Bản máy đọc do edge sinh

Mọi endpoint dưới đây đọc API công khai của EzyPlatform (`/api/v1/posts`, `/api/v1/posts/{slug}`) rồi dựng nội dung tại edge, cache bằng Cache API 5–15 phút:

| Endpoint | Nội dung |
|---|---|
| `/llms.txt`, `/.well-known/llms.txt` | Hồ sơ, sản phẩm, mục lục và bài viết dạng Markdown |
| `/llms-full.txt` | Toàn văn hồ sơ + shop + tài liệu tải video + privacy + tối đa 12 bài mới nhất |
| `/index.md`, `/ho-so.md`, `/san-pham.md`, `/thu-vien.md`, `/video-ai.md`, `/bai-viet.md`, `/lien-he.md` | Từng mục |
| `/bai-viet/<slug>.md` | Bài viết đầy đủ (HTML → Markdown) |
| `/shop.md`, `/tai-video.md`, `/quyen-rieng-tu.md` | Trang cố định |
| `/rss.xml`, `/feed.json` | RSS 2.0 và JSON Feed 1.1 của bài viết |
| `/search.json` | Chỉ mục tìm kiếm |
| `/catalog.json` | Danh mục máy đọc cho sản phẩm, video, bài viết, công cụ |
| `/.well-known/agent.json` | A2A agent card |
| `/robots.txt`, `/sitemap.xml` | Robots và sitemap |

Khi origin tạm không trả lời, các mục dùng dữ liệu tĩnh (profile, shop, tài liệu, privacy) vẫn trả 200 kèm `X-Origin-Status: unavailable`; các endpoint cần bài viết trả lỗi 502/404 tương ứng.

## Worker công cụ

`src/` giữ đúng các route runtime:

- `src/pages/api/chat.ts`, `api/chat/status.ts` — chatbot GoClaw.
- `src/pages/api/dl/**` — tải video qua Home Daemon.
- `src/pages/api/viral/**` — bóc băng, sinh kịch bản, chia sẻ X-ray.
- `src/pages/api/t.ts` — beacon thống kê ẩn danh vào Analytics Engine.
- `src/pages/xray/[id].astro` và `.md.ts` — trang báo cáo X-ray.
- `src/pages/media/[...key].ts` — stream media R2, hỗ trợ `Range`.

Không còn trang nội dung, layout, component, admin, API đăng bài hay cron. `src/worker.ts` chỉ chuyển request cho Astro; `src/middleware.ts` chỉ gắn security header.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run build` | `astro check` + build Worker công cụ |
| `node node_modules/astro/bin/astro.mjs build` | Build khi `npx astro` không chạy trên máy Windows thiếu binding |
| `node node_modules/vitest/vitest.mjs run src/lib edge/src` | Unit test các phần còn giữ |
| `npx wrangler deploy --config dist/server/wrangler.json` | Deploy `tqd-tools` từ bản build |
| `CLOUDFLARE_ENV=preview npm run build` rồi `npx wrangler deploy --config dist/server/wrangler.json` | Deploy preview `tqd-next` |
| `npx wrangler deploy --config edge/wrangler.jsonc` | Deploy `tqd-edge` |
| `npx wrangler deploy --dry-run --config edge/wrangler.jsonc` | Kiểm tra bundle edge, không upload |
| `npm run verify:dl` | Kiểm chứng Home Daemon tải video |

Deploy, secret, rollback và lý do không deploy `tqd-website`: [docs/deployment.md](docs/deployment.md).

## Nội dung và quản trị

- Bài viết, trang, hồ sơ, sản phẩm, video, thư viện: **admin EzyPlatform** (`http://127.0.0.1:9090` khi chạy local; `https://admin.tqd.me` khi lên VPS).
- Ảnh/video: media library của EzyPlatform; media cũ vẫn nằm trong R2 và được phục vụ qua `/media/*`.
- Publish và kiểm chứng: dùng các skill `ezy-author`, `ezy-media`, `ezy-publish`, `ezy-verify`; xem [docs/agent-publishing.md](docs/agent-publishing.md).
- Liên hệ: plugin `ezysupport` (Contact-us) + `ezymail`.
- Sao lưu: plugin `data-backup` của EzyPlatform; bản cũ trong R2 vẫn giữ, xem [docs/backup-restore.md](docs/backup-restore.md).

## Tài liệu

- [docs/deployment.md](docs/deployment.md) — deploy edge/tools, secret, rollback.
- [docs/chatbot.md](docs/chatbot.md) — chatbot GoClaw và giới hạn.
- [docs/video-downloader.md](docs/video-downloader.md) — kiến trúc tải video/Viral Lab.
- [docs/agent-publishing.md](docs/agent-publishing.md) — đăng bài qua EzyPlatform.
- [docs/admin-agent-operations.md](docs/admin-agent-operations.md) — việc quản trị đã chuyển đi đâu.
- [docs/analytics-event-spec.md](docs/analytics-event-spec.md) — hợp đồng dữ liệu `/api/t`.
- [REVIEW.md](REVIEW.md) — cổng kiểm duyệt UI/UX/AX/SEO (áp dụng cho giao diện EzyPlatform và edge).
- [plans/261121-ezyplatform-migration/plan.md](plans/261121-ezyplatform-migration/plan.md) — hợp đồng migration.
