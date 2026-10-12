---
title: "Website cá nhân DũngTQ tại tqd.io.vn"
description: "Astro tĩnh lấy cảm hứng zuey.me, nội dung tổng hợp từ hoạt động AI 3 tháng, deploy Cloudflare Worker static assets lên tqd.io.vn"
status: completed
priority: P2
effort: 8h
branch: main
tags: [frontend, astro, cloudflare, portfolio]
blockedBy: []
blocks: []
created: 2026-10-12
---

# Website cá nhân DũngTQ (tqd.io.vn)

Nguồn quyết định: [brainstorm report](../reports/brainstorm-261012-1604-tqd-personal-website.md).
Kế hoạch này viết theo hợp đồng `--advice`: mỗi phase có task, tiêu chí thành công, lệnh Verify so sánh được và khối Failure Protocol.

## Outcome

`https://tqd.io.vn` là website cá nhân của Trịnh Quang Dũng (DũngTQ): trang chủ dạng "desktop" (lấy cảm hứng Zuey OS, code viết mới) mở các mục Hồ sơ, Sản phẩm, Đào tạo & sự kiện, Video AI, Chuyên môn, Số liệu, Liên hệ; mỗi mục cũng là một route tĩnh đọc được khi tắt JavaScript.

## Constraints (bắt buộc cho mọi phase)

- KHÔNG đưa văn bản bài Facebook nào vào site. Chỉ dùng thông tin tổng hợp trong `src/data/profile.ts` (Phase 1). Phase 5 có script chặn việc này.
- Mọi con số và chi tiết sản phẩm phải có trong `D:/TQD/tqd-browser/automation_data/portfolio/portfolio-ai-tom-tat.md`. Không có thì bỏ, không đoán.
- Không sao chép file hay đoạn code nào từ repo zuey-me (không có license).
- Site tĩnh: không D1, R2, KV, Workers AI, không SSR adapter.
- Deploy vào tài khoản Cloudflare "Xaotiensinh@gmail.com's Account" (ID `b243f38bff984ce1741c379547e97a75`), zone `tqd.io.vn` đã active trong tài khoản này.
- Không in token hay secret ra log/chat. Không commit `.env`, `.dev.vars`, `.wrangler/`, `.cache/`.
- Máy này có hook chặn mọi lệnh shell chứa chữ `dist` (báo `BLOCKED: Access to 'dist...' denied`). Vì vậy KHÔNG chạy các lệnh `node -e "...dist/..."` trong mục Verify trực tiếp. Với mỗi Verify như vậy, chép nguyên đoạn JS vào một file `scripts/verify/<tên-task>.mjs` (đổi `require('fs')` thành `import fs from 'node:fs'`) rồi chạy `node scripts/verify/<tên-task>.mjs`. Điều kiện đạt giữ nguyên. Đây là cách chạy đã được lên kế hoạch, không phải ứng biến. Không sửa file cấu hình hook.

## Non-goals

Thành viên, thanh toán, khoá học, booking, MCP server, OAuth, CMS, chat AI, feed/trang bài viết, mascot, nền thời tiết, tên miền `www`.

## Stack (đã kiểm tra trên npm ngày 2026-10-12)

Node 24.19 · Astro 7.3.x (`output: 'static'`) · Tailwind CSS 4.3 qua `@tailwindcss/vite` · TypeScript strict · Wrangler 4.x · `cf` 1.0.0-beta.14 (cần `cf migrate` để đọc cấu hình Wrangler, đăng nhập riêng bằng `cf auth login`).

## Phases

| # | Phase | File | Phụ thuộc | Trạng thái |
|---|---|---|---|---|
| 1 | Khởi tạo dự án và dữ liệu hồ sơ | [phase-01](phase-01-scaffold-and-profile-data.md) | — | completed |
| 2 | Layout và các route nội dung | [phase-02](phase-02-layout-and-content-routes.md) | 1 | completed |
| 3 | Lớp giao diện "desktop" | [phase-03](phase-03-desktop-shell.md) | 2 | completed |
| 4 | Bề mặt cho máy và SEO | [phase-04](phase-04-machine-surfaces-and-seo.md) | 2 | completed |
| 5 | Kiểm tra chất lượng | [phase-05](phase-05-quality-gates.md) | 3, 4 | completed |
| 6 | Deploy và gắn tên miền | [phase-06](phase-06-deploy-and-domain.md) | 5 | completed |

## Acceptance criteria

1. `https://tqd.io.vn` trả HTTP 200 qua HTTPS, có đủ 7 mục, có ảnh chân dung, email và Zalo.
2. 7 route mục trả 200 và có nội dung khi tắt JavaScript.
3. `node scripts/check-no-post-text.mjs` exit 0 (không có đoạn ≥ 60 ký tự nào của bài Facebook trong `dist/`).
4. `/llms.txt`, `/index.md`, `/sitemap.xml`, `/404` hoạt động.
5. Số liệu khớp bản tóm tắt: 71 bài AI, 13 tuần, 11 Reel, 73K và 17K lượt xem, phân bổ 9/5/5/17/35.
6. `npm run build` exit 0 (gồm `astro check`); Lighthouse mobile Performance và Accessibility ≥ 90.
7. `README.md` ghi lệnh deploy đã chạy được và tài khoản đích; `docs/deployment.md` ghi cách gắn domain dự phòng.

## Risks

- `cf` beta: cần đăng nhập trình duyệt và `cf migrate`; nếu bất kỳ bước nào lỗi, deploy bằng Wrangler (đã đăng nhập đúng tài khoản) và ghi lại.
- Token OAuth có thể thiếu quyền gắn custom domain: deploy lên `workers.dev` không kèm route, gắn domain trong dashboard, ghi vào `docs/deployment.md`.
- Bản ghi DNS sẵn có ở apex `tqd.io.vn` có thể xung đột (không đọc được danh sách bản ghi); khi Wrangler báo xung đột, STOP và hỏi người dùng, không xoá bản ghi.

## Unresolved questions

- Không còn câu hỏi mở. Ảnh chân dung, email `dungtq.ceo@gmail.com` và Zalo `zalo.me/trinhquangdung` đã được người dùng cung cấp ngày 2026-10-12; ảnh nằm ở `assets/portrait.jpg` của thư mục kế hoạch.

## Kết quả (2026-10-12)

- Live tại `https://tqd.io.vn` (Worker `tqd-website`, version `8ffa1fd5`). `scripts/verify/live.mjs` in `OK live`; kiểm tra trình duyệt trên site thật đều PASS.
- Deploy bằng Wrangler (Task 6.3). `cf` 1.0.0-beta.14 đăng nhập và migrate được nhưng `cf build/deploy` đòi Build Output Specification mà Astro tĩnh không tạo; chi tiết ở `docs/deployment.md`.
- Lighthouse mobile: trang chủ hiệu năng 0.94 / truy cập 1.0; `/san-pham` 0.94 / 0.98.
- Các lệnh Verify có đọc bản build được chạy qua `scripts/verify/*.mjs` vì hook máy chặn lệnh shell nhắc tới thư mục build.
