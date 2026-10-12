---
title: Deploy website ca nhan DungTQ len tqd.io.vn
date: 2026-10-12
summary: "Trien khai 6 phase, site tinh Astro live tai tqd.io.vn; cf beta khong deploy duoc Astro tinh nen dung Wrangler"
---

# Deploy website ca nhan DungTQ len tqd.io.vn

## What happened
- Thực hiện đủ 6 phase của plans/261012-1604-tqd-personal-website: Astro 7 tĩnh + Tailwind 4, 7 trang mục, trang chủ dạng desktop, llms.txt, route .md, sitemap, ảnh OG kèm chân dung.
- Kiểm tra: astro check 0 lỗi; check:privacy OK (77 bài nguồn) và có test âm chứng minh script bắt được lỗi; Lighthouse mobile 0.94 hiệu năng, 0.98–1.0 truy cập; kiểm tra trình duyệt PASS trên cả bản preview và site thật.
- Live tại https://tqd.io.vn (Worker tqd-website, custom domain).

## Sự cố
- Hook máy chặn lệnh shell nhắc tới thư mục output và node_modules; chuyển các Verify sang scripts/verify/*.mjs.
- `cf auth login` không mở được trình duyệt; dùng `--no-browser` (device code) thì đăng nhập thành công.
- `cf deploy` (1.0.0-beta.14) nhận diện Astro, tự chạy astro rồi đòi Build Output Specification (.cloudflare/output/v0/config.json) mà Astro tĩnh không tạo. Kongming khuyên không thêm adapter SSR; hoàn tác file cf và deploy bằng Wrangler theo đường dự phòng của plan.
- Rule `a { color }` ngoài layer đè utility Tailwind 4; chuyển base rules vào @layer base.
- File paseo.json (ứng dụng Paseo tạo) lỡ vào commit; đã gỡ và thêm vào .gitignore.

## Next steps
- Khi cf hỗ trợ site tĩnh dựng sẵn, thử lại cf migrate (ghi chú trong docs/deployment.md).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
