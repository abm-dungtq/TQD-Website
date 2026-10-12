---
title: "Plan v2: admin, agent API, TikTok, motion"
date: 2026-10-12
summary: "Lập plan --advice 7 phase chuyển tqd.io.vn sang Astro SSR + D1/R2 với admin, API agent, TikTok và hiệu ứng"
---

# Plan v2: admin, agent API, TikTok, motion

## What happened
Lập plan `plans/261012-1720-tqd-cms-admin-agent-api-motion/` (7 phase, hợp đồng --advice) từ brainstorm v2. Kiểm tra gói thật trước khi viết: @astrojs/cloudflare 14.3.4 dùng @cloudflare/vite-plugin, binding qua `cloudflare:workers`, cho phép `main` riêng, tự đòi KV SESSION trừ khi `session: false`, và KHÔNG tạo Build Output Specification nên `cf deploy` nhiều khả năng vẫn lỗi.

## Decision
- Worker preview `tqd-next` (sau cutover là `env.preview`), dùng chung D1/R2 với production.
- PBKDF2 tối đa 100k vòng (giới hạn Workers), số vòng nằm trong chuỗi hash, hạ xuống 20k nếu vượt 10 ms CPU của gói Free.
- Bảng D1 `rate_limits` thay cho Rate Limiting binding (binding chỉ hỗ trợ chu kỳ 10/60 s).
- Kiểm trùng Facebook dùng hash cyrb53 của cửa sổ 60 ký tự, chỉ cảnh báo.
- kongming chặn 3 lỗi: xoá media có thể xoá bản sao lưu, CPU Free plan, upload FixedLengthStream bị treo. Đã sửa tất cả.

## Next steps
Người dùng chạy `/ak:cook --advice` với plan. Cần hỏi người dùng link TikTok ở Task 4.9 và để người dùng duyệt ảnh linh vật ở Task 7.1.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
