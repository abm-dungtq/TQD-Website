---
phase: 1
title: "Nền SSR, D1, R2, dữ liệu gốc, Worker preview"
status: completed
priority: P1
effort: 6h
dependencies: []
---

# Phase 1 — Nền SSR, D1, R2, dữ liệu gốc, Worker preview

> Đọc mục Constraints trong `plan.md` trước khi bắt đầu (hook chặn chữ `dist`/`node_modules` trong lệnh shell; luôn đặt `CLOUDFLARE_ACCOUNT_ID`; không in secret).

## Goal

Dự án chạy Astro SSR trên adapter Cloudflare, có D1 `tqd_db` (schema + dữ liệu gốc từ `src/data/profile.ts`) và R2 `tqd-media`, deploy được lên Worker preview `tqd-next` mà `tqd.io.vn` vẫn chạy bản tĩnh cũ.

## Files to Create / Modify

- Modify: `package.json`, `astro.config.mjs`, `wrangler.jsonc`, `.gitignore`, `tsconfig.json` (chỉ khi thiếu `include`)
- Create: `src/worker.ts`, `migrations/0001_init.sql`, `migrations/0002_seed.sql`, `scripts/make-portrait.mjs`, `public/img/portrait-240.webp`, `public/img/portrait-480.webp`, `scripts/verify/seed.mjs`, `worker-configuration.d.ts` (sinh ra)
- Không đổi trong phase này: `src/pages/**`, `src/components/**` (phase 2 mới đổi)

## Task 1.1 — Cài adapter và cấu hình Astro SSR

- Goal: `npx astro build` chạy với adapter Cloudflare.
- Target files: `package.json`, `astro.config.mjs`, `.gitignore`.
- Steps:
  1. `npm install @astrojs/cloudflare@^14.3.4`
  2. `npm install --save-dev vitest@^4`
  3. Ghi `astro.config.mjs`:
     ```js
     // @ts-check
     import { defineConfig } from 'astro/config';
     import cloudflare from '@astrojs/cloudflare';
     import tailwindcss from '@tailwindcss/vite';

     export default defineConfig({
       site: 'https://tqd.io.vn',
       output: 'server',
       adapter: cloudflare({ imageService: 'passthrough' }),
       session: false,
       trailingSlash: 'never',
       build: { format: 'file' },
       vite: { plugins: [tailwindcss()] },
     });
     ```
  4. Thêm vào `.gitignore` (dùng Edit tool, không dùng heredoc), dưới dòng `.dev.vars`:
     ```
     .secrets/
     worker-configuration.d.ts.bak
     ```
  5. Trong `package.json` `scripts`: đổi `"build"` thành `"astro check && astro build"` (giữ nguyên), thêm `"cf-typegen": "wrangler types"`, `"test": "vitest run"`. Chưa sửa `deploy` (Task 1.5).
- Success criteria: config hợp lệ, không còn `output: 'static'`.
- Verify: no verification needed (Task 1.5 build sẽ kiểm).

## Task 1.2 — Ảnh chân dung tĩnh

- Goal: chân dung phục vụ dưới dạng file tĩnh (adapter dùng `passthrough`, không tối ưu ảnh lúc chạy).
- Target files: `scripts/make-portrait.mjs` (mới), `public/img/portrait-240.webp`, `public/img/portrait-480.webp`.
- Steps:
  1. Tạo `scripts/make-portrait.mjs`: dùng `sharp` đọc `src/assets/portrait.jpg`, xuất 2 file webp chiều rộng 240 và 480 (quality 80) vào `public/img/`. Mẫu:
     ```js
     // Generates the static portrait variants served from /img.
     import sharp from 'sharp';
     for (const w of [240, 480]) {
       await sharp('src/assets/portrait.jpg').resize({ width: w }).webp({ quality: 80 }).toFile(`public/img/portrait-${w}.webp`);
       console.log('wrote', w);
     }
     ```
  2. Tạo thư mục `public/img` nếu chưa có, chạy `node scripts/make-portrait.mjs`.
- Success criteria: hai file webp tồn tại.
- Verify: `node scripts/make-portrait.mjs` in `wrote 240` và `wrote 480`, exit 0; `ls public/img` liệt kê `portrait-240.webp` và `portrait-480.webp`.

## Task 1.3 — Tạo D1 và R2

- Goal: có database `tqd_db` và bucket `tqd-media` trong tài khoản đích.
- Steps (PowerShell: `$env:CLOUDFLARE_ACCOUNT_ID='b243f38bff984ce1741c379547e97a75'` trước):
  1. `npx wrangler d1 create tqd_db --location apac`. Ghi lại `database_id` (UUID) từ output; đây không phải secret.
  2. `npx wrangler r2 bucket create tqd-media --location apac`.
  3. Nếu bước 2 báo cần bật R2 (`Please enable R2 through the Cloudflare Dashboard` hoặc mã `10042`): STOP, báo người dùng "Anh vào dashboard Cloudflare → R2 → bật R2 (gói Free) rồi báo em", chờ, rồi chạy lại bước 2.
  4. Nếu bước 1 báo `already exists`: chạy `npx wrangler d1 list --json`, lấy `uuid` của `tqd_db`.
- Success criteria: có UUID của `tqd_db`; bucket tồn tại.
- Verify: `npx wrangler d1 list --json` có phần tử `"name": "tqd_db"` VÀ `npx wrangler r2 bucket list` có dòng `tqd-media`.

## Task 1.4 — Wrangler config, entry Worker, schema

- Goal: Worker có entry riêng (fetch + scheduled), binding `DB`, `MEDIA`, cron; schema D1 áp dụng được ở local.
- Target files: `wrangler.jsonc`, `src/worker.ts`, `migrations/0001_init.sql`, `tsconfig.json`.
- Steps:
  1. Ghi `wrangler.jsonc` (thay `<D1_UUID>` bằng UUID ở Task 1.3):
     ```jsonc
     {
       "$schema": "node_modules/wrangler/config-schema.json",
       "name": "tqd-next",
       "account_id": "b243f38bff984ce1741c379547e97a75",
       "main": "./src/worker.ts",
       "compatibility_date": "2026-09-01",
       "compatibility_flags": ["nodejs_compat"],
       "workers_dev": true,
       "observability": { "enabled": true },
       "d1_databases": [
         { "binding": "DB", "database_name": "tqd_db", "database_id": "<D1_UUID>", "migrations_dir": "migrations" }
       ],
       "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "tqd-media" }],
       "triggers": { "crons": ["0 19 * * *"] }
     }
     ```
     Không thêm khối `assets` (adapter tự thêm binding `ASSETS`). Không thêm `routes` (chỉ thêm ở Task 3.7).
  2. Tạo `src/worker.ts`:
     ```ts
     // Worker entry: Astro handles HTTP; the cron trigger runs the nightly D1 backup.
     import { handle } from '@astrojs/cloudflare/handler';

     export default {
       fetch: handle,
       async scheduled(_controller, env, ctx) {
         const { runBackup } = await import('./lib/backup');
         ctx.waitUntil(runBackup(env));
       },
     } satisfies ExportedHandler<Env>;
     ```
     Tạo tạm `src/lib/backup.ts` với `export async function runBackup(_env: Env): Promise<void> {}` (phase 3 viết thật).
  3. Tạo `migrations/0001_init.sql` đúng nội dung:
     ```sql
     CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
     CREATE TABLE items (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       kind TEXT NOT NULL CHECK (kind IN ('product','training','video')),
       title TEXT NOT NULL,
       date TEXT,
       summary TEXT NOT NULL DEFAULT '',
       tags TEXT NOT NULL DEFAULT '[]',
       links TEXT NOT NULL DEFAULT '[]',
       tiktok_id TEXT,
       cover_key TEXT,
       sort INTEGER NOT NULL DEFAULT 0,
       visible INTEGER NOT NULL DEFAULT 1,
       updated_at TEXT NOT NULL DEFAULT (datetime('now'))
     );
     CREATE INDEX items_kind_sort ON items(kind, sort);
     CREATE TABLE articles (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       slug TEXT NOT NULL UNIQUE,
       title TEXT NOT NULL,
       summary TEXT NOT NULL DEFAULT '',
       body_md TEXT NOT NULL,
       body_html TEXT NOT NULL,
       cover_key TEXT,
       tags TEXT NOT NULL DEFAULT '[]',
       status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
       source TEXT NOT NULL DEFAULT 'admin',
       fb_overlap INTEGER NOT NULL DEFAULT 0,
       version INTEGER NOT NULL DEFAULT 1,
       published_at TEXT,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       updated_at TEXT NOT NULL DEFAULT (datetime('now'))
     );
     CREATE INDEX articles_status_published ON articles(status, published_at DESC);
     CREATE TABLE media (
       key TEXT PRIMARY KEY,
       content_type TEXT NOT NULL,
       size INTEGER NOT NULL,
       alt TEXT NOT NULL DEFAULT '',
       source TEXT NOT NULL DEFAULT 'admin',
       created_at TEXT NOT NULL DEFAULT (datetime('now'))
     );
     CREATE TABLE api_keys (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       prefix TEXT NOT NULL,
       hash TEXT NOT NULL UNIQUE,
       scopes TEXT NOT NULL,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       last_used_at TEXT,
       revoked_at TEXT
     );
     CREATE TABLE sessions (id_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
     CREATE TABLE rate_limits (bucket TEXT PRIMARY KEY, window_start INTEGER NOT NULL, count INTEGER NOT NULL);
     ```
  4. `npm run cf-typegen` (sinh `worker-configuration.d.ts` có `interface Env { DB: D1Database; MEDIA: R2Bucket; ... }`).
  5. Không thêm `types` vào `tsconfig.json` (`include` đã gồm `worker-configuration.d.ts`; mảng `types` sẽ tắt việc tự nạp `@types/*`). Chỉ kiểm `tsconfig.json` có `include` phủ thư mục gốc; nếu không có, thêm `"worker-configuration.d.ts"` vào `include`.
  6. `npx wrangler d1 migrations apply tqd_db --local`
- Success criteria: migration local áp dụng; `Env` có `DB` và `MEDIA`.
- Verify: `npx wrangler d1 execute tqd_db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" --json` có đủ `api_keys`, `articles`, `items`, `media`, `rate_limits`, `sessions`, `settings` VÀ `worker-configuration.d.ts` chứa `DB: D1Database` và `MEDIA: R2Bucket`.

## Task 1.5 — Dữ liệu gốc (seed)

- Goal: D1 chứa toàn bộ nội dung hiện có của `src/data/profile.ts` và `src/data/stats.ts`.
- Target files: `migrations/0002_seed.sql`, `scripts/verify/seed.mjs`.
- Steps:
  1. Mở `src/data/profile.ts` và `src/data/stats.ts`. Viết `migrations/0002_seed.sql` gồm:
     - `INSERT INTO settings(key,value) VALUES ('content_version','1');`
     - `settings.person`: JSON của object `person` **bỏ** trường `portrait`, thêm `"portrait": "/img/portrait-480.webp"`, `"portraitSmall": "/img/portrait-240.webp"`.
     - `settings.stats`: JSON của object `stats` (giữ nguyên tên trường, số và chú thích).
     - `settings.links`: JSON của mảng `links`.
     - `settings.topics`: JSON `{"howTo": [...], "marketWatch": [...]}` lấy từ `expertise`.
     - `settings.sections`: JSON của mảng `sections` nhưng phần tử `chuyen-mon` đổi thành `{"id":"bai-viet","title":"Bài viết","short":"Viết hằng ngày về AI ứng dụng","icon":"book"}`.
     - Bảng `items`: 6 dòng `kind='product'`, 4 dòng `kind='training'`, 5 dòng `kind='video'`, đúng thứ tự trong file, `sort` = 10, 20, 30… `tags`/`links` là chuỗi JSON. Giữ nguyên chữ (tiếng Việt có dấu, NFC).
     - Escape dấu nháy đơn trong SQL bằng `''`.
  2. Tạo `scripts/verify/seed.mjs` chạy `npx wrangler d1 execute tqd_db <--local|--remote> --command "<SQL>" --json` qua `child_process.execFileSync` (shell: true trên Windows) và kiểm:
     - số dòng theo kind: product 6, training 4, video 5;
     - mọi tiêu đề sau có mặt: `Viết Pro`, `Điều phối nhiều model`, `3 nhân sự số`, `Agent tự dựng video`, `Thư viện prompt tạo ảnh`, `App dọn dẹp và tối ưu macOS`, `Đào tạo AI cho EVN Miền Bắc`, `Xây dựng doanh nghiệp AI tự hành`, `ABM đồng hành cùng doanh nghiệp`, `Cộng đồng chọn chủ đề`, `Short drama với FLUX 3`, `Video 20 giây từ một prompt`, `Chuỗi video làm 100% bằng AI`, `Thử Omni 1.1`, `Video AI kiểm soát ổn định`;
     - `settings.stats` parse được và chứa các giá trị `71`, `13`, `11`, `73K` và phân bổ `9,5,5,17,35`;
     - `settings.person` có `email` = `dungtq.ceo@gmail.com`, `zalo` = `https://zalo.me/trinhquangdung`;
     - `settings.sections` có id `bai-viet`, không có `chuyen-mon`.
     In `OK seed` khi đạt, ngược lại in từng dòng `FAIL ...` và exit 1. Tham số dòng lệnh: `--remote` (mặc định local).
  3. `npx wrangler d1 migrations apply tqd_db --local`
- Success criteria: dữ liệu đủ, khớp nguồn.
- Verify: `node scripts/verify/seed.mjs` in `OK seed`, exit 0.

## Task 1.6 — Build, chạy local, deploy preview

- Goal: Worker `tqd-next` chạy trên `*.workers.dev` với D1/R2 thật; trang chủ hiện (trang vẫn đọc dữ liệu tĩnh ở phase này).
- Target files: `package.json` (script `deploy`).
- Steps:
  1. `npm run build`. Nếu `astro check` báo lỗi type ở `src/components/SectionBody.astro` do `Image`/`person.portrait`, giữ nguyên code (phase 2 thay) và chỉ sửa lỗi type tối thiểu nếu chặn build; ghi lại lỗi trong báo cáo.
  2. Đổi script trong `package.json`: `"deploy": "npm run build && wrangler deploy"` (check privacy chuyển sang chạy với URL ở phase 2).
  3. Áp migration lên D1 thật: `npx wrangler d1 migrations apply tqd_db --remote` (trả lời `y` nếu được hỏi; chỉ thêm bảng mới vào DB mới tạo, không phá dữ liệu).
  4. Thử `cf` đúng 1 lần: `cf deploy`. Nếu exit khác 0 (dự kiến lỗi `Build Output Specification`), ghi nguyên văn dòng lỗi vào báo cáo, xoá mọi file `cf` vừa tạo (`cloudflare.config.ts`, `wrangler.config.ts` nếu có) rồi sang bước 5. Không thử lại `cf`.
  5. `npx wrangler deploy`. Ghi URL `https://tqd-next.<subdomain>.workers.dev` từ output.
- Success criteria: URL preview trả 200, `tqd.io.vn` không đổi.
- Verify (cả ba phải đạt):
  - `node scripts/verify/seed.mjs --remote` in `OK seed`.
  - `node scripts/verify/live.mjs https://tqd-next.<subdomain>.workers.dev` in `OK live`.
  - `node scripts/verify/live.mjs` (mặc định `https://tqd.io.vn`) in `OK live`.

## Task 1.7 — Commit

- Steps: `git add -A` rồi `git status --porcelain`; nếu có dòng chứa `.dev.vars`, `.secrets` hoặc `.wrangler` thì STOP (gitignore sai). Sau đó commit `feat: move site to astro ssr on cloudflare with d1 and r2`.
- Verify: `git status --porcelain` rỗng.

## Failure Protocol
If any Verify step does not meet its stated pass condition, STOP this phase.
Do not improvise a fix, retry blindly, or reason around the failure.
Spawn the `kongming` subagent for next-step counsel and pass:
- the phase and task id,
- what you attempted (the steps you ran),
- the exact command and its full output,
- the pass condition it failed to meet.
Apply kongming's guidance, then re-run the Verify step.
If `kongming` cannot be spawned in this environment, STOP and report the same
failure evidence to the user. Never continue by self-reasoning.
