# REVIEW.md — Hợp đồng Kiểm duyệt Chất lượng UI / UX / AX / SEO & Bảo mật (tqd.me)

Mọi thay đổi giao diện, tuyến trang (routes), nội dung và bề mặt khám phá AI trên **tqd.me** phải vượt qua đầy đủ các cổng kiểm định dưới đây trước khi hợp nhất hoặc triển khai lên Cloudflare Workers.

---

## 1. Danh mục Kiểm duyệt Bắt buộc (Pre-Merge Checklist)

### A. Tương phản Màu sắc, Bàn phím & Khả năng Tiếp cận (WCAG 2.2 AA)
- [ ] **Cấm dùng `--color-champagne` (`#b8935a`) cho chữ hoặc vòng focus:** Mọi văn bản nhỏ phải đạt tương phản `>= 4.5:1` (`--color-ink`, `--color-muted`, `--color-accent-ink`). Vòng focus `:focus-visible` bắt buộc dùng `2px solid var(--color-accent)` (`#8a6420`).
- [ ] **Diện tích chạm di động `>= 44×44px`:** Trên màn hình `< 768px`, mọi nút bấm, tab, chip lọc, radio/checkbox và liên kết điều hướng không nằm trong đoạn văn xuôi đều đạt kích thước tối thiểu `44×44px` (không có cảnh báo `small-touch-target` từ `render-check.mjs`).
- [ ] **Ngữ nghĩa WAI-ARIA chuẩn xác:**
  - Hộp thoại thực sự khóa tiêu điểm (`CommandPalette`, `ChatPanel` mobile) mới gắn `role="dialog" aria-modal="true"`. Không gắn `role="dialog"` cho khung nội dung chính `.desktop-window`.
  - Thanh tab (`[role="tablist"]` trên `/tai-video`) hỗ trợ đầy đủ `tabindex="0/-1"` luân phiên cùng phím `ArrowRight`, `ArrowLeft`, `Home`, `End`.
  - Nút bật/tắt menu phải cập nhật `aria-expanded="true|false"` và đóng khi nhấn `Escape` hoặc nhấp ra ngoài.

### B. CSP Thực thi & Không Mã Inline (`script-src 'self'`)
- [ ] **Không có `<script is:inline>` thực thi JavaScript:** Ngoại lệ duy nhất được phép là `<script type="application/ld+json" is:inline>` chứa dữ liệu có cấu trúc tĩnh đã thoát ký tự `<`.
- [ ] **Không có thuộc tính sự kiện HTML inline:** Tuyệt đối không dùng `onclick=`, `onerror=`, `onload=` trong `.astro` hoặc HTML render từ Markdown. Mọi logic phía trình duyệt phải nằm trong các module TypeScript được Astro đóng gói tại `src/scripts/*.ts`.
- [ ] **Tương thích TypeScript 6 + `@cloudflare/workers-types`:** Trong `src/scripts/*.ts`, ưu tiên `HTMLElement` cụ thể (tránh `ParentNode` xung đột với `HTMLRewriter`) và dùng `.appendChild(...)` thay vì `.append(...)`.

### C. Bề mặt AI / Agent Experience (AX) & SEO / GEO
- [ ] **Bản song sinh Markdown 1:1 (`.md` Twins):** Mọi tuyến trang công khai có nội dung cố định đều có đường dẫn `.md` tương ứng và khai báo `<link rel="alternate" type="text/markdown">` trong `<head>` (riêng trang `404` **không** phát thẻ này):
  - `/` -> `/llms.txt` (kèm bản đầy đủ `/llms-full.txt`)
  - `/[section]` -> `/[section].md` (kiểm tra `VALID_SECTIONS` trước khi truy vấn D1)
  - `/bai-viet/[slug]` -> `/bai-viet/[slug].md`
  - `/tai-video` -> `/tai-video.md`
  - `/quyen-rieng-tu` -> `/quyen-rieng-tu.md`
  - `/xray/[id]` -> `/xray/[id].md`
- [ ] **Thanh công cụ `PageActions.astro`:** Hiển thị nhất quán trên các trang nội dung công khai, hỗ trợ **Sao chép Markdown** (tương thích Safari qua `ClipboardItem` chứa `Promise<Blob>`), **Xem `.md`**, **Gửi tới AI** (ChatGPT, Claude, Perplexity; Gemini dùng cơ chế sao chép ngữ cảnh vào bộ nhớ tạm vì không nhận prompt qua query URL) và **Chia sẻ**.
- [ ] **Đồ thị JSON-LD liên kết chặt chẽ (`@graph`):**
  - Mọi khóa `@id` tham chiếu chéo (`#person`, `#website`, `#webpage`, `#breadcrumb`, `#webapp`) phải phân giải được ngay trong cùng đồ thị hoặc về thực thể gốc xác định.
  - Mọi mốc ngày giờ (`datePublished`, `dateModified`, `<lastmod>`) phải xuất ở chuẩn **ISO 8601 có múi giờ đầy đủ** (`toIsoUtc`).
- [ ] **Thẻ OpenGraph riêng theo chuyên mục (`1200×630`):** Tạo tĩnh qua `node scripts/make-og.mjs` vào `public/og/*.png` (tuyệt đối không `import 'sharp'` vào code chạy trên Cloudflare Workers runtime).

### D. Chính sách Bảo mật Nội dung & Định vị Thương hiệu
- [ ] **Định danh chính chủ thống nhất:** Luôn dùng **Trịnh Quang Dũng** (`site.person.name`), CTA tư vấn B2B chính trỏ về `https://zalo.me/trinhquangdung`. Không để sót tên nhầm lẫn trong bất kỳ tệp giao diện hay kiểm thử nào.
- [ ] **Chính sách Hybrid cho `/xray/[id]`:**
  - Bản ghi do Admin tạo (`shareId` bắt đầu bằng `c-`): gắn `X-Robots-Tag: index, follow`, đưa vào `sitemap.xml`, cho phép giữ liên kết ngoài (`{ allowExternalLinks: true }`).
  - Bản ghi do khách tạo công khai: gắn `X-Robots-Tag: noindex, nofollow`, loại khỏi `sitemap.xml`, và tước bỏ liên kết ngoài (`{ allowExternalLinks: false }`) trên cả trang HTML lẫn bản `.md` để chống lạm dụng phát tán link độc hại.
- [ ] **Chuẩn ngôn ngữ Viết Pro:** Tiếng Việt tự nhiên, trực diện, không sáo ngữ dịch máy ("trong bối cảnh…", "không chỉ… mà còn…"), không dùng emoji làm biểu tượng giao diện.

---

## 2. Bộ lệnh Kiểm chứng Tự động (Verification Commands)

Chạy tuần tự các lệnh sau trước khi bàn giao:

```bash
# 1. Kiểm tra kiểu dữ liệu Astro & TypeScript (yêu cầu: 0 errors, 0 warnings)
npx astro check

# 2. Chạy toàn bộ kiểm thử đơn vị & bảo mật quyền riêng tư
npm test
npm run check:privacy

# 3. Dựng bản phân phối Cloudflare Workers
npm run build

# 4. Quét bề mặt khám phá SEO / GEO / AX (khi dev server đang chạy ở cổng 4321)
node /Users/tqd/.gemini/config/skills/ak-enhance-ux-ax/scripts/check-discovery-surfaces.mjs \
  http://localhost:4321 \
  --site-origin https://tqd.me

# 5. Kiểm tra bố cục, tràn ngang, mục tiêu chạm 44px và lỗi tài nguyên trên trình duyệt thật
node /Users/tqd/.gemini/config/skills/ak-frontend-design/scripts/render-check.mjs \
  http://localhost:4321
node /Users/tqd/.gemini/config/skills/ak-frontend-design/scripts/render-check.mjs \
  http://localhost:4321/tai-video
node /Users/tqd/.gemini/config/skills/ak-frontend-design/scripts/render-check.mjs \
  http://localhost:4321/ho-so
```
