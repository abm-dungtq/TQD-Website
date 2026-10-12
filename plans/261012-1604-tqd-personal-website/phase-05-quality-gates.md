---
phase: 5
title: "Kiểm tra chất lượng"
status: completed
dependsOn: [3, 4]
---

# Phase 5 — Kiểm tra chất lượng

> Trước khi chạy Verify: đọc mục Constraints trong `plan.md` (hook chặn lệnh shell có chữ chỉ thư mục build; chạy các kiểm tra qua file `scripts/verify/*.mjs`).

## Task 5.1 — Script chặn văn bản bài Facebook

- Goal: chứng minh `dist/` không chứa văn bản bài Facebook nào.
- Target files: `scripts/check-no-post-text.mjs` (mới), `package.json` (script `check:privacy`).
- Steps:
  1. Script nhận 1 tham số: đường dẫn file JSON nguồn. Mặc định `D:/TQD/tqd-browser/automation_data/portfolio/portfolio-ai-3-thang.json`. Nếu file không tồn tại: in `SOURCE_MISSING <path>` và exit 2.
  2. Chuẩn hoá chuỗi: `normalize('NFC')`, chữ thường, gộp mọi khoảng trắng thành một dấu cách, bỏ thẻ HTML (`/<[^>]+>/g` → dấu cách) và giải mã `&amp; &lt; &gt; &quot; &#39;`.
  3. Đọc mọi file `.html`, `.md`, `.txt`, `.xml`, `.js` trong `dist/` (đệ quy), chuẩn hoá, nối thành một chuỗi lớn.
  4. Với mỗi mục trong JSON (cả 81 mục, gồm 10 mục "Cần anh xác nhận"), chuẩn hoá `text`. Nếu độ dài ≥ 60: trượt cửa sổ 60 ký tự bước 20; nếu độ dài 30–59: dùng nguyên chuỗi. Chuỗi ngắn hơn 30 bỏ qua.
  5. Mỗi cửa sổ khớp trong dist: in `LEAK <date> <url> "<cửa sổ>"`. Có ít nhất một LEAK thì exit 1; không có thì in `OK no post text (<số mục đã kiểm>)` và exit 0.
  6. Thêm vào `package.json`: `"check:privacy": "node scripts/check-no-post-text.mjs"`.
- Success criteria: script chạy và báo kết quả rõ ràng.
- Verify: `npm run build` rồi `npm run check:privacy` exit 0 và in dòng bắt đầu bằng `OK no post text`.
- Xử lý khi có LEAK (đây là cách sửa được phép, không phải tự ứng biến): sửa đúng câu bị báo trong `src/data/profile.ts` bằng cách diễn đạt lại, giữ nguyên ý và số liệu, rồi build và chạy lại. Nếu sau 2 lần vẫn LEAK, áp dụng Failure Protocol.

## Task 5.2 — Kiểm tra số liệu hiển thị

- Điều kiện: `StatGrid` (Phase 2) phải đặt mỗi giá trị `headline` trong một phần tử riêng không có khoảng trắng thừa, ví dụ `<span class="stat-value">71</span>`.

- Verify: lệnh sau exit 0 và in `OK stats`:
  `node -e "const t=require('fs').readFileSync('dist/so-lieu.html','utf8');const need=['>71<','>13<','>11<','73K','10/07/2026'];const miss=need.filter(s=>!t.includes(s));if(miss.length){console.log('MISSING',miss);process.exit(1)}console.log('OK stats')"`

## Task 5.2b — Kiểm tra liên hệ và ảnh

- Verify: tạo `scripts/verify/contact.mjs` với nội dung dưới, chạy `node scripts/verify/contact.mjs`; đạt khi in `OK contact` và exit 0.
  ```js
  import fs from 'node:fs';
  const t = fs.readFileSync('dist/lien-he.html', 'utf8');
  const h = fs.readFileSync('dist/ho-so.html', 'utf8');
  const ok = t.includes('dungtq.ceo@gmail.com')
    && t.includes('zalo.me/trinhquangdung')
    && h.includes('alt="Chân dung Trịnh Quang Dũng"');
  console.log(ok ? 'OK contact' : 'FAIL contact');
  process.exit(ok ? 0 : 1);
  ```

## Task 5.3 — Kiểm tra không JS

- Steps: với mỗi file `dist/{id}.html` của 7 mục, xác nhận có `<h1>` và ít nhất 200 ký tự chữ sau khi bỏ thẻ `<script>` và mọi thẻ HTML.
- Verify: lệnh sau in `OK nojs 7` và exit 0:
  `node -e "const f=require('fs');const ids=['ho-so','san-pham','dao-tao','video-ai','chuyen-mon','so-lieu','lien-he'];let ok=0;for(const i of ids){const h=f.readFileSync('dist/'+i+'.html','utf8');const txt=h.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');if(h.includes('<h1')&&txt.length>=200)ok++;else console.log('FAIL',i)}console.log('OK nojs',ok);process.exit(ok===7?0:1)"`

## Task 5.4 — Lighthouse trên bản preview

- Steps:
  1. `npm run preview -- --port 4329` chạy nền, ghi PID.
  2. Nếu Lighthouse báo `No Chrome installations found`: ghi lại vào báo cáo và bỏ qua Task 5.4 (không coi là Failure).
  3. `npx --yes lighthouse http://localhost:4329/ "--only-categories=performance,accessibility" --form-factor=mobile --screenEmulation.mobile --chrome-flags="--headless=new" --output=json --output-path=./.lighthouse-home.json --quiet`
  4. Lặp lại cho `http://localhost:4329/san-pham` với `--output-path=./.lighthouse-san-pham.json`.
  5. Dừng tiến trình preview. Thêm `.lighthouse-*.json` vào `.gitignore`.
- Verify: lệnh sau exit 0 và in hai dòng `OK`:
  `node -e "for(const p of ['.lighthouse-home.json','.lighthouse-san-pham.json']){const r=require('./'+p);const s=['performance','accessibility'].map(k=>r.categories[k].score);console.log(s.every(x=>x>=0.9)?'OK':'LOW',p,s);if(!s.every(x=>x>=0.9))process.exitCode=1}"`

## Task 5.5 — Commit

- Steps: `git add -A`; `git commit -m "test: add privacy and quality checks"`.
- Verify: `git status --porcelain` in ra rỗng.

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
