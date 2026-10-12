---
title: Plan website ca nhan DungTQ tai tqd.io.vn
date: 2026-10-12
summary: "Brainstorm va lap ke hoach 6 phase cho website ca nhan DungTQ, deploy Cloudflare len tqd.io.vn"
---

# Plan website ca nhan DungTQ tai tqd.io.vn

## What happened
- Brainstorm (`--advice --auto`) cho website cá nhân DũngTQ, lấy cảm hứng từ mrgoonie/zuey-me và dữ liệu hoạt động AI trên Facebook 10/07–10/10/2026.
- zuey-me không có license (`gh repo view` → `licenseInfo: null`) và là nền tảng lớn (Astro SSR + D1, 24 migration), nên chỉ lấy ý tưởng giao diện "OS desktop", llms.txt và route `.md`.
- `dungtq.io.vn` trả NXDOMAIN; người dùng sửa thành `tqd.io.vn`. Zone này đang active trong tài khoản Cloudflare mà Wrangler đã đăng nhập.
- Người dùng quyết định không đăng nội dung bài Facebook nào; bài đăng chỉ là nguồn để tổng hợp hồ sơ.

## Decision
- Astro 7 tĩnh + Tailwind 4, deploy lên Cloudflare Worker static assets, custom domain `tqd.io.vn`.
- Nội dung biên soạn tay trong `src/data/profile.ts`, chỉ lấy từ `portfolio-ai-tom-tat.md`; script kiểm tra quyền riêng tư chặn văn bản bài đăng trong bản build.
- Deploy bằng `cf` CLI (beta, cần `cf auth login` + `cf migrate`) trước, Wrangler là đường dự phòng đã lên kế hoạch.
- Kongming duyệt kế hoạch; áp dụng 7/8 chỉnh sửa. Giữ link trang Facebook cá nhân vì đường dẫn đã kiểm chứng từ trường `url` của dữ liệu nguồn.

## Next steps
- Chạy `/ak:cook plans/261012-1604-tqd-personal-website/plan.md --advice`.
- Bổ sung ảnh chân dung, email/Zalo khi người dùng cung cấp.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
