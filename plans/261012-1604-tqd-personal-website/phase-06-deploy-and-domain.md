---
phase: 6
title: "Deploy và gắn tên miền"
status: completed
dependsOn: [5]
---

# Phase 6 — Deploy và gắn tên miền

> Trước khi chạy Verify: đọc mục Constraints trong `plan.md` (hook chặn lệnh shell có chữ chỉ thư mục build; chạy các kiểm tra qua file `scripts/verify/*.mjs`).

Đích: Worker `tqd-website` (chỉ static assets) trong tài khoản `b243f38bff984ce1741c379547e97a75` ("Xaotiensinh@gmail.com's Account"), tên miền `tqd.io.vn` (zone đã active trong tài khoản này, apex chưa có bản ghi A). Không in token ra log. Không xoá hay sửa bản ghi DNS có sẵn.

Người dùng yêu cầu deploy bằng `cf` CLI. Task 6.2 thử `cf` trước; Task 6.3 là đường dự phòng bằng Wrangler đã được lên kế hoạch sẵn (chuyển sang 6.3 khi 6.2 lỗi KHÔNG phải ứng biến).

## Task 6.1 — Cấu hình Wrangler

- Target files: `wrangler.jsonc` (mới), `package.json`.
- Steps:
  1. `npm install --save-dev wrangler@4`
  2. Tạo `wrangler.jsonc`:
     ```jsonc
     {
       "$schema": "node_modules/wrangler/config-schema.json",
       "name": "tqd-website",
       "account_id": "b243f38bff984ce1741c379547e97a75",
       "compatibility_date": "2026-09-01",
       "assets": {
         "directory": "./dist",
         "not_found_handling": "404-page",
         "html_handling": "drop-trailing-slash"
       },
       "routes": [{ "pattern": "tqd.io.vn", "custom_domain": true }]
     }
     ```
  3. Thêm script `package.json`: `"deploy": "npm run build && npm run check:privacy && wrangler deploy"`.
- Verify: `npm run build` exit 0 VÀ `npx wrangler deploy --dry-run` exit 0 và output chứa `--dry-run: exiting now.`

## Task 6.2 — Deploy bằng `cf` CLI

- Steps:
  1. `npm install --global cf` rồi `cf --version` (kỳ vọng `1.0.0-beta.x`).
  2. Đặt biến môi trường `CLOUDFLARE_ACCOUNT_ID=b243f38bff984ce1741c379547e97a75` cho mọi lệnh `cf` tiếp theo, rồi chạy `cf auth whoami`. Nếu chưa đăng nhập: chạy `cf auth login` (mở trình duyệt; báo người dùng một câu "Anh xác nhận đăng nhập Cloudflare bằng tài khoản Xaotiensinh trên trình duyệt vừa mở" và chờ tối đa 5 phút). `cf` không dùng lại phiên đăng nhập của Wrangler.
  3. `cf migrate` (tạo `cloudflare.config.ts` cạnh `wrangler.jsonc`); mở file đó, xác nhận có `./dist` và `tqd.io.vn`.
  4. `npm run build && npm run check:privacy` rồi `cf deploy`.
- Success criteria: `cf deploy` exit 0.
- Verify: `cf deploy` exit 0. Ghi lại vào báo cáo: phiên bản `cf`, output cuối của `cf deploy` (đã che mọi token).
- Nếu BẤT KỲ bước 1–4 lỗi (cài đặt, đăng nhập quá 5 phút, migrate, deploy): ghi lỗi nguyên văn vào báo cáo, xoá `cloudflare.config.ts` nếu đã tạo, rồi chuyển sang Task 6.3. Nếu 6.2 thành công: bỏ qua 6.3, giữ `cloudflare.config.ts`, và sửa script `deploy` thành `npm run build && npm run check:privacy && cf deploy`.

## Task 6.3 — Dự phòng: deploy bằng Wrangler (chỉ khi 6.2 lỗi)

- Steps:
  1. Đặt `CLOUDFLARE_ACCOUNT_ID=b243f38bff984ce1741c379547e97a75`.
  2. `npm run deploy`.
  3. Nếu lỗi chứa `already has externally managed DNS records` hoặc nói về bản ghi DNS xung đột: STOP, báo người dùng nguyên văn lỗi và hỏi có cho xoá bản ghi đó không. Không tự xoá.
  4. Nếu lỗi về quyền (`Authentication error`, `10000`, `permission`) liên quan tới route/custom domain: xoá khối `routes` khỏi `wrangler.jsonc`, chạy lại `npm run deploy`, ghi URL `*.workers.dev`, rồi STOP và báo người dùng gắn `tqd.io.vn` trong dashboard: Workers & Pages → tqd-website → Settings → Domains & Routes → Add → Custom domain → `tqd.io.vn`.
- Verify: `npm run deploy` exit 0 và output chứa `tqd.io.vn` (hoặc `workers.dev` trong trường hợp bước 4).

## Task 6.4 — Kiểm tra trực tiếp

- Steps: chứng chỉ có thể mất vài phút. Thử tối đa 10 lần, mỗi lần cách 30 giây, cho tới khi `https://tqd.io.vn/` trả 200.
- Verify: lệnh sau in `OK live` và exit 0:
  `node -e "(async()=>{const b='https://tqd.io.vn';const want={'/':200,'/san-pham':200,'/so-lieu':200,'/llms.txt':200,'/index.md':200,'/sitemap.xml':200,'/khong-co-trang-nay':404};let bad=0;for(const[p,c]of Object.entries(want)){const r=await fetch(b+p,{redirect:'follow'});if(r.status!==c){console.log('FAIL',p,r.status);bad++}}const h=await (await fetch(b+'/')).text();if(!h.includes('Trịnh Quang Dũng')){console.log('FAIL content');bad++}console.log(bad?'BAD':'OK live');process.exit(bad?1:0)})()"`

## Task 6.5 — Tài liệu và commit

- Target files: `README.md` (thay README mặc định của Astro), `docs/deployment.md` (mới).
- Steps:
  1. `README.md` (tiếng Việt, ngắn): mục đích site; nguồn nội dung là `src/data/profile.ts` (sửa file này để cập nhật nội dung); lệnh `npm run dev`, `npm run build`, `npm run check:privacy`, `npm run deploy`; nói rõ site KHÔNG chứa văn bản bài Facebook; zuey.me chỉ là nguồn cảm hứng giao diện.
  2. `docs/deployment.md`: tài khoản Cloudflare đích (tên + ID), tên Worker, tên miền, công cụ deploy THỰC SỰ đã dùng (`cf` hoặc Wrangler) và lý do nếu dùng dự phòng, cách đăng nhập (`cf auth login` hoặc `wrangler login`), cách gắn domain trong dashboard nếu cần, cách rollback (`npx wrangler rollback` hoặc chọn bản trước trong dashboard → Deployments).
  3. `git add -A`; `git commit -m "docs: add readme and deployment guide"`.
- Verify: `git status --porcelain` rỗng VÀ `docs/deployment.md` chứa `tqd.io.vn` và `b243f38bff984ce1741c379547e97a75`.

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
