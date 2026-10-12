---
phase: 1
title: "Khởi tạo dự án và dữ liệu hồ sơ"
status: completed
dependsOn: []
---

# Phase 1 — Khởi tạo dự án và dữ liệu hồ sơ

> Trước khi chạy Verify: đọc mục Constraints trong `plan.md` (hook chặn lệnh shell có chữ chỉ thư mục build; chạy các kiểm tra qua file `scripts/verify/*.mjs`).

Thư mục làm việc: `D:/TQD/TQD-Website` (hiện chỉ có `plans/`). Shell: PowerShell hoặc Git Bash.

## Task 1.1 — Tạo dự án Astro tĩnh

- Goal: dự án Astro 7 tối giản build được.
- Target files: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/pages/index.astro`, `.gitignore`.
- Steps:
  1. Tạo dự án vào thư mục tạm rồi chuyển vào gốc (thư mục gốc không rỗng vì có `plans/`):
     `npm create astro@latest .astro-tmp -- --template minimal --no-install --no-git --skip-houston --yes`
  2. Chuyển toàn bộ nội dung `.astro-tmp/` (kể cả file ẩn) vào `D:/TQD/TQD-Website/`, rồi xoá `.astro-tmp/`.
  3. Trong `package.json`: đặt `"name": "tqd-website"`, `"private": true`.
  4. `npm install`
  5. `npx astro add tailwind --yes` (cài `tailwindcss` + `@tailwindcss/vite`, tạo `src/styles/global.css`).
  6. Sửa `astro.config.mjs` thành:
     ```js
     import { defineConfig } from 'astro/config';
     import tailwindcss from '@tailwindcss/vite';

     export default defineConfig({
       site: 'https://tqd.io.vn',
       output: 'static',
       trailingSlash: 'never',
       build: { format: 'file' },
       vite: { plugins: [tailwindcss()] },
     });
     ```
  7. Thêm vào `.gitignore` (nếu chưa có): `dist/`, `node_modules/`, `.astro/`, `.wrangler/`, `.cache/`, `.env`, `.env.*`, `.dev.vars`.
  8. Sao chép ảnh chân dung: `plans/261012-1604-tqd-personal-website/assets/portrait.jpg` → `src/assets/portrait.jpg` (ảnh JPG 1086×1448, 109 KB, người dùng cung cấp ngày 2026-10-12).
  9. `git init` rồi `git add -A` và `git commit -m "chore: scaffold astro static site"` (chỉ local, KHÔNG push, không thêm remote).
- Success criteria: `dist/index.html` được tạo và `src/assets/portrait.jpg` tồn tại.
- Verify: `npm run build` exit 0 và file `dist/index.html` tồn tại.

## Task 1.2 — Viết dữ liệu hồ sơ `src/data/profile.ts`

- Goal: một nguồn dữ liệu duy nhất, có kiểu, chứa toàn bộ nội dung site.
- Target files: `src/data/profile.ts` (mới).
- Steps:
  1. Tạo file với các type export: `Link { label: string; href: string }`, `Item { title: string; date?: string; summary: string; tags: string[]; links?: Link[] }`, `Stat { label: string; value: string; note?: string }`, `Section { id: SectionId; title: string; short: string; icon: string }`.
  2. `export type SectionId = 'ho-so' | 'san-pham' | 'dao-tao' | 'video-ai' | 'chuyen-mon' | 'so-lieu' | 'lien-he';`
  3. Export các hằng số với ĐÚNG nội dung dưới đây (được phép sửa câu chữ cho mượt, KHÔNG thêm sự kiện, số liệu, tên sản phẩm mới):

     `person`:
     - `name`: "Trịnh Quang Dũng", `handle`: "DũngTQ", `initials`: "TQD"
     - `email`: "dungtq.ceo@gmail.com", `zalo`: "https://zalo.me/trinhquangdung" (người dùng cung cấp)
     - Ảnh: `import portrait from '../assets/portrait.jpg';` và export `person.portrait = portrait` (kiểu `ImageMetadata`), `portraitAlt`: "Chân dung Trịnh Quang Dũng"
     - `role`: "Ứng dụng AI vào vận hành doanh nghiệp · ABM"
     - `intro`: "Mình xây agent, skill và quy trình AI chạy được trong công việc thật, rồi đào tạo lại cho doanh nghiệp. Ba năm trước mình chia sẻ về xuất nhập khẩu Trung Quốc – Việt Nam; giờ mình chia sẻ cách đưa AI vào hoạt động doanh nghiệp."
     - `focus`: ["AI agent và điều phối nhiều model", "Skill cho Claude Code, Codex, Antigravity", "Video làm bằng AI", "Đào tạo AI cho doanh nghiệp"]

     `sections` (thứ tự hiển thị, `icon` là tên icon nội bộ dùng ở Phase 3):
     | id | title | short | icon |
     |---|---|---|---|
     | ho-so | Hồ sơ | Mình là ai, đang làm gì | user |
     | san-pham | Sản phẩm | Skill, agent và công cụ tự xây | box |
     | dao-tao | Đào tạo & sự kiện | Doanh nghiệp và cộng đồng | presentation |
     | video-ai | Video AI | Thử nghiệm video làm bằng AI | film |
     | chuyen-mon | Chuyên môn | Quy trình, mẹo và theo dõi thị trường | book |
     | so-lieu | Số liệu | 3 tháng hoạt động AI | chart |
     | lien-he | Liên hệ | Kết nối với mình | mail |

     `products` (Item[]):
     - "Viết Pro" · 10/10/2026 · "Skill giúp trợ lý AI viết tiếng Việt tự nhiên, chạy trong Claude Code, OpenAI Codex và Google Antigravity. Nhận ra các kiểu câu sáo của AI và sửa lại, giữ nguyên tên, số liệu, ngày và link." · tags ["Skill", "Claude Code", "Codex", "Antigravity"] · links [{ label: "GitHub", href: "https://github.com/abm-dungtq/viet-pro-codex" }]
     - "Điều phối nhiều model" · 02/10/2026 · "Opus 5.5 viết skill từng bước rồi làm quản lý, giám sát Gehihi 3.8 Flash làm việc và tự kiểm lỗi đến khi xong, để giảm token." · tags ["Agent", "Multi-model"]
     - "3 nhân sự số" · 09/08/2026 · "Claude lập kế hoạch, chia việc cho hai agent khác, tự đọc báo cáo và quyết định bàn giao." · tags ["Agent", "Claude"]
     - "Agent tự dựng video" · 25/09–05/10/2026 · "Agent tự dựng video, phát triển từ quy trình làm video tự động (02/08)." · tags ["Agent", "Video"]
     - "Thư viện prompt tạo ảnh" · 24/09/2026 · "Thư viện prompt tạo ảnh cho ChatGPT theo nhiều ngành nghề, kèm prompt tạo video." · tags ["Prompt", "ChatGPT"]
     - "App dọn dẹp và tối ưu macOS" · 03/09/2026 · "Ứng dụng dọn dẹp, tối ưu macOS làm cùng Gehihi 3.8 Flash, có chia sẻ mã nguồn." · tags ["App", "macOS"]

     `trainings` (Item[]):
     - "Đào tạo AI cho EVN Miền Bắc" · 17/09/2026 · "Buổi đầu trong một chuỗi đào tạo ứng dụng AI." · tags ["Doanh nghiệp"]
     - "Xây dựng doanh nghiệp AI tự hành" · 30/08/2026 · "Chương trình miễn phí cho doanh nghiệp." · tags ["Sự kiện"] · links [{ label: "lp.abmedu.vn", href: "https://lp.abmedu.vn" }]
     - "ABM đồng hành cùng doanh nghiệp" · 09/10/2026 · "Hỗ trợ doanh nghiệp đưa AI Agent vào việc hằng ngày." · tags ["ABM"]
     - "Cộng đồng chọn chủ đề" · 28/09/2026 · "Mời cộng đồng chọn chủ đề AI để mình viết bài hoặc chia sẻ skill, prompt, quy trình." · tags ["Cộng đồng"]

     `videos` (Item[]):
     - "Short drama với FLUX 3" · 12/08/2026 · tags ["FLUX 3"]
     - "Video 20 giây từ một prompt" · 12/08/2026 · "73K lượt xem — Reel nhiều lượt xem nhất trong 3 tháng." · tags ["Reel"]
     - "Chuỗi video làm 100% bằng AI" · 14/08/2026 · tags ["Series"]
     - "Thử Omni 1.1" · 28/08/2026 · tags ["Omni"]
     - "Video AI kiểm soát ổn định" · 28/09/2026 · tags ["Workflow"]
     (`summary` của mục không có mô tả ở trên: dùng một câu ngắn chỉ nhắc lại tiêu đề, ví dụ "Thử nghiệm short drama làm bằng FLUX 3.")

     `expertise`:
     - `howTo` (string[]): "Claude CLI lập kế hoạch, chia phase cho Codex", "Gehihi làm worker trong OMP", "Kết hợp Orca và OMP", "Vận hành nhiều CLI bằng Paseo", "Cài Hermes-Agent", "So sánh chi phí và kết quả Pi, Codex, Claude Code", "Chọn model Claude theo việc", "Browser automation cho AI", "ChatGPT hỗ trợ con học".
     - `marketWatch` (string[]): "Claude Opus 5 và 5.5", "GPT 5.6 và GPT-6", "Codex", "Gemini 3.6 Flash", "DeepSeek V4 Flash và V4.1 Flash", "Grok 4.6", "Antigravity", "Omni Flash 1.1".

     `stats`:
     - `period`: "10/07/2026 – 10/10/2026"
     - `headline` (Stat[]): { "Bài về AI", "71" }, { "Tuần liên tục", "13", note "≈ 5 bài/tuần" }, { "Reel về AI", "11" }, { "Reel cao nhất", "73K", note "lượt xem" }
     - `byGroup` ({ label: string; count: number }[]): Sản phẩm & dự án tự xây 9 · Đào tạo & sự kiện 5 · Video làm bằng AI 5 · Hướng dẫn, quy trình & mẹo 17 · Bình luận tin tức AI 35
     - `source`: "Tổng hợp từ bài đăng Facebook cá nhân, thu thập ngày 10/10/2026."

     `links` (Link[]): Email `mailto:dungtq.ceo@gmail.com` · Zalo `https://zalo.me/trinhquangdung` · GitHub `https://github.com/abm-dungtq` · Facebook `https://www.facebook.com/dungtq.ceo87` (đường dẫn trang cá nhân lấy từ trường `url` của dữ liệu nguồn, không phải nội dung bài) · ABM Edu `https://lp.abmedu.vn`
  4. Thêm `export const byGroupTotal = stats.byGroup.reduce((s, g) => s + g.count, 0);` ngay dưới `stats`.
- Success criteria: file biên dịch, tổng `byGroup` = 71.
- Lưu ý: vì file import ảnh, kiểm tra (b) dưới đây có thể lỗi khi `tsx` gặp `.jpg`. Để tránh, tách số liệu sang `src/data/stats.ts` (chứa `stats` và `byGroupTotal`) và để `profile.ts` re-export: `export * from './stats';`. Kiểm tra (b) import từ `./src/data/stats.ts`.
- Verify: (a) `npx astro check` exit 0 và in `0 errors`; (b) `npx --yes tsx -e "import { byGroupTotal } from './src/data/stats.ts'; if (byGroupTotal !== 71) process.exit(1); console.log('OK', byGroupTotal)"` in ra `OK 71` và exit 0.

## Task 1.3 — Commit

- Goal: lưu mốc.
- Steps: `git add -A`; `git commit -m "feat: add curated profile data"`.
- Verify: `git log --oneline -1` chứa `feat: add curated profile data`.

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
