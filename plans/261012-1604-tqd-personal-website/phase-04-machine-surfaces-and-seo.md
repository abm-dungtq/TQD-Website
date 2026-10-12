---
phase: 4
title: "Bề mặt cho máy và SEO"
status: completed
dependsOn: [2]
---

# Phase 4 — Bề mặt cho máy và SEO

> Trước khi chạy Verify: đọc mục Constraints trong `plan.md` (hook chặn lệnh shell có chữ chỉ thư mục build; chạy các kiểm tra qua file `scripts/verify/*.mjs`).

Có thể chạy song song với Phase 3 (không đụng file của nhau). Tất cả nội dung sinh từ `src/data/profile.ts`.

## Task 4.1 — Hàm sinh Markdown dùng chung

- Target files: `src/lib/profile-markdown.ts` (mới).
- Steps:
  1. `export function sectionMarkdown(id: SectionId): string` — trả Markdown cho từng mục, cùng nội dung với `SectionBody` (Phase 2): tiêu đề `## {title}`, item dạng `### {title}` + `{date}` + `{summary}` + tags + links Markdown; số liệu dạng bảng.
  2. `export function profileMarkdown(): string` — `# Trịnh Quang Dũng (DũngTQ)`, role, intro, rồi nối `sectionMarkdown` của 7 mục.
- Verify: no verification needed (Task 4.2 kiểm tra).

## Task 4.2 — Route Markdown và llms.txt

- Target files: `src/pages/index.md.ts`, `src/pages/[section].md.ts`, `src/pages/llms.txt.ts` (mới).
- Steps:
  1. `index.md.ts`: `export const GET = () => new Response(profileMarkdown(), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });`
  2. `[section].md.ts`: `getStaticPaths` theo 7 id; `GET` trả `sectionMarkdown(id)`.
  3. `llms.txt.ts`: theo định dạng llms.txt — `# Trịnh Quang Dũng (DũngTQ)`, dòng `> {role}`, đoạn intro, rồi `## Pages` liệt kê `- [{title}](https://tqd.io.vn/{id}.md): {short}` cho 7 mục, cuối cùng `## Optional` với `- [Toàn bộ hồ sơ](https://tqd.io.vn/index.md)`.
- Verify: `npm run build` exit 0 VÀ các file tồn tại: `dist/index.md`, `dist/llms.txt`, `dist/san-pham.md`. Kiểm tra: `node -e "const f=require('fs');const m=['dist/index.md','dist/llms.txt','dist/san-pham.md'].filter(p=>!f.existsSync(p));if(m.length){console.log(m);process.exit(1)}console.log('OK')"` in `OK`.

## Task 4.3 — Sitemap, robots, 404, ảnh OG, favicon

- Target files: `src/pages/sitemap.xml.ts`, `public/robots.txt`, `src/pages/404.astro`, `public/og.svg` → `public/og.png`, `public/favicon.svg` (mới); `src/layouts/BaseLayout.astro` (thêm meta ảnh).
- Steps:
  1. `sitemap.xml.ts`: XML liệt kê `https://tqd.io.vn/` và 7 URL `https://tqd.io.vn/{id}`, `lastmod` `2026-10-12`. (Không dùng `@astrojs/sitemap` để giữ phụ thuộc tối thiểu.)
  2. `public/robots.txt`: `User-agent: *`, `Allow: /`, `Sitemap: https://tqd.io.vn/sitemap.xml`.
  3. `404.astro`: dùng `BaseLayout`, h1 "Không tìm thấy trang", link về `/` và danh sách 7 mục.
  4. `favicon.svg`: hình vuông bo góc màu `#2563eb`, chữ "T" trắng; thêm `<link rel="icon" href="/favicon.svg" type="image/svg+xml">` vào layout.
  5. Ảnh OG 1200×630: vẽ `public/og.svg` (nền `#0f172a`, chữ trắng "Trịnh Quang Dũng", dòng phụ role, góc dưới "tqd.io.vn"; bên phải ghép ảnh chân dung: trong `scripts/make-og.mjs` dùng `sharp('src/assets/portrait.jpg').resize(420, 560).toBuffer()` rồi `composite` vào vị trí left 720, top 35), rồi chuyển sang PNG: `npm i -D sharp`, tạo `scripts/make-og.mjs` với nội dung `import sharp from 'sharp'; await sharp('public/og.svg').resize(1200, 630).png().toFile('public/og.png');` và chạy `node scripts/make-og.mjs`. Thêm `og:image` = `https://tqd.io.vn/og.png`, `og:image:width` 1200, `og:image:height` 630, `twitter:card=summary_large_image` vào layout. Font chữ trong SVG: dùng `font-family="Arial, sans-serif"` để renderer không phụ thuộc font web.
  6. `git add -A`; `git commit -m "feat: add markdown routes, llms.txt, sitemap and seo assets"`.
- Verify: `npm run build` exit 0 VÀ tồn tại `dist/sitemap.xml`, `dist/robots.txt`, `dist/404.html`, `dist/og.png`, `dist/favicon.svg`; `dist/sitemap.xml` chứa đúng 8 thẻ `<loc>`. Kiểm tra: `node -e "const f=require('fs');for(const p of ['dist/sitemap.xml','dist/robots.txt','dist/404.html','dist/og.png','dist/favicon.svg'])if(!f.existsSync(p)){console.log('MISSING',p);process.exit(1)}const n=(f.readFileSync('dist/sitemap.xml','utf8').match(/<loc>/g)||[]).length;if(n!==8){console.log('LOC',n);process.exit(1)}console.log('OK')"` in `OK`.

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
