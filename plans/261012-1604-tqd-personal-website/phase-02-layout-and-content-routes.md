---
phase: 2
title: "Layout và các route nội dung"
status: completed
dependsOn: [1]
---

# Phase 2 — Layout và các route nội dung

> Trước khi chạy Verify: đọc mục Constraints trong `plan.md` (hook chặn lệnh shell có chữ chỉ thư mục build; chạy các kiểm tra qua file `scripts/verify/*.mjs`).

Mục tiêu: 7 trang tĩnh, đọc được khi tắt JavaScript, dùng chung một layout. Toàn bộ nội dung lấy từ `src/data/profile.ts`; KHÔNG viết cứng nội dung trong file `.astro`.

## Design tokens (dùng đúng, không tự chọn màu khác)

Khai báo trong `src/styles/global.css` bằng `@theme` của Tailwind 4:

```css
@import "tailwindcss";
@theme {
  --color-ink: #0f172a;      /* chữ chính */
  --color-muted: #64748b;    /* chữ phụ */
  --color-paper: #f8fafc;    /* nền trang */
  --color-panel: #ffffff;    /* nền cửa sổ/thẻ */
  --color-line: #e2e8f0;     /* viền mảnh */
  --color-accent: #2563eb;   /* nhấn, link */
  --color-accent-ink: #1e3a8a;
  --font-sans: "Be Vietnam Pro", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
html { color-scheme: light; }
body { background: var(--color-paper); color: var(--color-ink); font-family: var(--font-sans); }
```

Font: tải "Be Vietnam Pro" (400, 600, 700) và "JetBrains Mono" (500) từ Google Fonts bằng `<link rel="preconnect">` + `<link rel="stylesheet" ... &display=swap>` trong layout.

## Task 2.1 — Layout chung

- Goal: một layout có `<head>` chuẩn SEO, header, footer.
- Target files: `src/layouts/BaseLayout.astro` (mới).
- Steps:
  1. Props: `title: string`, `description: string`, `path: string`.
  2. `<html lang="vi">`; `og:image` mặc định do Phase 4 thêm; `<meta charset>`, viewport, `<title>{title} · DũngTQ</title>` (trang chủ: `Trịnh Quang Dũng (DũngTQ)`), `<meta name="description">`, `<link rel="canonical" href={new URL(path, Astro.site)}>`, Open Graph (`og:title`, `og:description`, `og:url`, `og:type=website`, `og:locale=vi_VN`), `<link rel="alternate" type="text/markdown" href="/index.md">`, import `../styles/global.css`.
  3. Header: chữ "DũngTQ" link về `/`, nav liệt kê `sections` (title → `/{id}`), có `aria-current="page"` cho trang hiện tại. Trên màn hình < 768px nav xuống dòng/cuộn ngang, không cần menu JS.
  4. `<main id="main">` + link "Bỏ qua tới nội dung" ẩn, hiện khi focus.
  5. Footer: `stats.source`, các `links`, năm 2026.
- Success criteria: layout render được.
- Verify: no verification needed (Task 2.3 kiểm tra).

## Task 2.2 — Thành phần dùng lại

- Target files: `src/components/ItemCard.astro`, `src/components/StatGrid.astro`, `src/components/SectionBody.astro` (mới).
- Steps:
  1. `ItemCard`: nhận `item: Item`; hiện title (h3), date (mono, muted), summary, tags (chip), links (mở tab mới, `rel="noopener"`).
  2. `StatGrid`: nhận `stats`; hiện 4 `headline` dạng ô số lớn (mỗi giá trị nằm riêng trong `<span class="stat-value">{value}</span>`, không khoảng trắng thừa), và bảng `byGroup` dạng thanh ngang bằng CSS (độ rộng = count / 35 * 100%), có số đếm bên cạnh, cộng tổng `byGroupTotal`.
  3. `SectionBody`: nhận `id: SectionId`; dùng `switch` render đúng nội dung từng mục:
     - `ho-so`: ảnh chân dung dùng `<Image src={person.portrait} alt={person.portraitAlt} widths={[240, 480]} sizes="240px" loading="eager" class="rounded-2xl object-cover aspect-[3/4]" />` từ `astro:assets`, rồi name, role, intro, danh sách `focus`.
     - `san-pham`: lưới `ItemCard` từ `products`.
     - `dao-tao`: lưới `ItemCard` từ `trainings`.
     - `video-ai`: lưới `ItemCard` từ `videos`.
     - `chuyen-mon`: 2 cột "Hướng dẫn & quy trình" (`expertise.howTo`) và "Theo dõi thị trường" (`expertise.marketWatch`), kèm dòng "17 bài hướng dẫn · 35 bài bình luận tin tức".
     - `so-lieu`: `StatGrid` + dòng `stats.period`.
     - `lien-he`: các `links` dạng nút lớn; hiện rõ chữ `dungtq.ceo@gmail.com` và `zalo.me/trinhquangdung` (người xem chép được).
     `SectionBody` KHÔNG chứa layout trang, để Phase 3 nhúng lại trong cửa sổ.
- Verify: no verification needed (Task 2.3 kiểm tra).

## Task 2.3 — Route từng mục

- Target files: `src/pages/[section].astro` (mới).
- Steps:
  1. `getStaticPaths()` trả `sections.map(s => ({ params: { section: s.id }, props: { s } }))`.
  2. Render `BaseLayout` (title = `s.title`, description = `s.short`, path = `/${s.id}`) với `<h1>{s.title}</h1>` và `<SectionBody id={s.id} />`.
- Success criteria: 7 file HTML.
- Verify: `npm run build` exit 0, và 7 file tồn tại: `dist/ho-so.html`, `dist/san-pham.html`, `dist/dao-tao.html`, `dist/video-ai.html`, `dist/chuyen-mon.html`, `dist/so-lieu.html`, `dist/lien-he.html`. Lệnh kiểm tra: `node -e "const f=require('fs');const ids=['ho-so','san-pham','dao-tao','video-ai','chuyen-mon','so-lieu','lien-he'];const miss=ids.filter(i=>!f.existsSync('dist/'+i+'.html'));if(miss.length){console.log('MISSING',miss);process.exit(1)}console.log('OK 7')"` in `OK 7`.

## Task 2.4 — Trang chủ tạm (không JS) và commit

- Target files: `src/pages/index.astro`.
- Steps:
  1. Render `BaseLayout` (path `/`), phần đầu là nội dung mục `ho-so` (`<SectionBody id="ho-so" />`), dưới là lưới thẻ link tới 7 mục (title + short). Phase 3 sẽ bọc thêm lớp desktop; phần này là fallback khi không có JS và trên mobile.
  2. `git add -A`; `git commit -m "feat: add layout and section pages"`.
- Verify: `npm run build` exit 0 VÀ `dist/index.html` chứa chuỗi `Trịnh Quang Dũng` (kiểm tra: `node -e "process.exit(require('fs').readFileSync('dist/index.html','utf8').includes('Trịnh Quang Dũng')?0:1)"` exit 0).

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
