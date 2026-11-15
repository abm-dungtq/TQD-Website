# Báo cáo kiểm toán SEO, GEO và bề mặt khám phá Agent trên tqd.me

Kiểm tra trực tiếp trên `https://tqd.me`, đối chiếu mã nguồn `src/` và các tệp Lighthouse lưu trữ cho thấy phần hạ tầng đã chạy gồm Astro SSR trên Cloudflare Workers, `robots.txt` mở cho bot AI, đàm phán `Accept: text/markdown`, tách cache theo `content_version` và 3 mục sửa từ brainstorm ngày 04/11/2026. Bốn lỗi và khoảng trống cần xử lý trước gồm `/llms-full.txt` bị rỗng thân bài viết, description chuyên mục quá ngắn, nhảy cấp heading (`heading-order`) và thiếu node JSON-LD trên các trang danh mục.

---

## 1. Bảng chấm điểm tổng quan

| Hạng mục | Điểm (/10) | Hiện trạng xác minh trực tiếp | Điểm cần sửa |
| :--- | :---: | :--- | :--- |
| Crawl, Index & Redirect | **9.0** | `robots.txt` (`200`, `968` B) mở 10 bot AI; `sitemap.xml` (`200`, `3.033` B, `28` URL); `www.tqd.me` và `tqd.io.vn` chuyển hướng `301` về `https://tqd.me/`. | Chưa có bản ghi `/xray/c-*` nào trong `sitemap.xml`; `/video` trả `404` vì route thật là `/video-ai`. |
| Đàm phán Markdown & Workers Cache | **9.0** | `Accept: text/markdown` trả `200`, `text/markdown; charset=utf-8`, `Vary: Accept`, `X-Robots-Tag: noindex`; cache key tách biệt HTML và `.md`. | Thiếu HTTP `Link` header (`rel="alternate"`, `rel="llms-txt"`, `rel="canonical"`); trang `404` nhân đôi hash `sha256` trong CSP. |
| WAF & Bot AI | **9.5** | Cả 6 bot thử nghiệm (`OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`, `ChatGPT-User`, `Claude-SearchBot`, `GPTBot`) đều nhận HTTP `200` (`cf-cache-status: HIT`). | Cloudflare WAF và Bot Fight Mode không chặn hay bật challenge. |
| `llms.txt`, `llms-full.txt` & Feed | **5.5** | `/llms.txt` (`11.298` B) có tóm tắt bài viết và liên kết `.md` sống (`200`); `/search.json` (`11.669` B) trả JSON hợp lệ. | **`/llms-full.txt` mất toàn bộ nội dung thân bài (`bodyMd` rỗng)**; thiếu `/.well-known/llms.txt`, `/rss.xml`, `/feed.json`. |
| Metadata, Heading & Social OG | **6.0** | Ảnh OG theo `coverKey` và `alt={article.title}` đã chạy đúng; `17/19` bài có ảnh bìa `1200x675`. | Sáu chuyên mục có description `16-30` ký tự; trang chủ và `18/19` bài vượt `160` ký tự; lỗi `heading-order` (`0` điểm Lighthouse); `/` có `2` thẻ `<h1>`. |
| JSON-LD `@graph` | **6.5** | `/bai-viet/[slug]` (`Article`) và `/tai-video` (`WebApplication`) xuất đủ schema. | Năm chuyên mục (`/san-pham`, `/video-ai`, `/bai-viet`, `/thu-vien`, `/lien-he`) và `/xray/[id]` thiếu node chuyên biệt; `/` thiếu `ProfilePage`. |
| `PageActions` & Trải nghiệm Agent | **8.0** | `PageActions.astro` có trên trang con và bài viết, dùng `ClipboardItem` `Promise<Blob>` tương thích Safari. | Trang chủ `/` chưa gắn `PageActions`; query URL của Perplexity (`/search/new?q=`) và ChatGPT (`?q=`) chưa theo mẫu mới. |

**Điểm bình quân 7 hạng mục: 7.6 / 10.**

---

## 2. Kết quả quét và kiểm tra trực tiếp trên Production

### 2.1. Công cụ `check-discovery-surfaces.mjs`

Lệnh quét bề mặt khám phá trực tiếp trên domain chính:

```text
node /Users/tqd/.gemini/config/skills/ak-enhance-ux-ax/scripts/check-discovery-surfaces.mjs https://tqd.me --sample 15 --json
```

Công cụ thoát với mã `0` (`0` error, `0` warning), quét `15` mẫu trong tổng số `28` URL của `sitemap.xml`, chỉ ghi nhận `1` thông báo mức `info` tại check `ai-crawlers` (`"no training or user-fetch AI token is blocked site-wide"`).

### 2.2. Ma trận HTTP cho HTML, bản sao `.md` và điểm cuối khám phá

| Đường dẫn | Mã HTTP | `Content-Type` & Kích thước đo trực tiếp | Header & Ghi chú |
| :--- | :---: | :--- | :--- |
| `/` (`Accept: text/html`) | `200` | `text/html`, `178.275` B | `vary: Accept`, `x-cache: HIT`, `cf-cache-status: HIT`, `x-content-version: 105`. |
| `/` (`Accept: text/markdown`) | `200` | `text/markdown; charset=utf-8`, `17.703` B | `vary: Accept`, `x-robots-tag: noindex`, `x-cache: HIT`, `x-content-version: 105`. |
| `/ho-so`, `/san-pham`, `/bai-viet` | `200` | `text/html`: `90.062` B, `95.315` B, `102.193` B | Phục vụ SSR kèm bản twin `.md`. |
| `/thu-vien`, `/video-ai`, `/lien-he` | `200` | `text/html`: `85.410` B, `90.939` B, `85.662` B | Phục vụ SSR kèm bản twin `.md`. |
| `/tai-video`, `/quyen-rieng-tu` | `200` | `text/html`: `129.569` B, `87.666` B | Trang công cụ tải video và chính sách riêng tư có `PageActions`. |
| `3` bài `/bai-viet/<slug>` mẫu | `200` | `116.496` B (`tu-dien-ai-agent`), `115.812` B (`cloudflare`), `106.761` B (`github-co-ban`) | Bài GitHub có ảnh cover PNG nặng `1.451.080` B (`~1,45` MB). |
| `/index.md`, `/ho-so.md` | `200` | `text/markdown; charset=utf-8`: `17.703` B (`15.081` ký tự), `2.054` B (`1.648` ký tự) | `x-robots-tag: noindex`; `/llms.txt` trỏ `/` tới `/index.md` tại `src/lib/profile-markdown.ts:161` (`index.astro:18` truyền `markdownPath` cho `<link rel="alternate">`). |
| `/san-pham.md`, `/thu-vien.md`, `/video-ai.md` | `200` | `text/markdown; charset=utf-8`: `4.776` B (`4.164` ký tự), `773` B (`669` ký tự), `1.906` B (`1.670` ký tự) | `x-robots-tag: noindex`, đầy đủ header bảo mật. |
| `/bai-viet.md`, `/lien-he.md`, `/tai-video.md`, `/quyen-rieng-tu.md` | `200` | `text/markdown; charset=utf-8`: `8.315` B (`6.957` ký tự), `593` B (`566` ký tự), `1.600` B (`1.360` ký tự), `2.077` B (`1.649` ký tự) | `x-robots-tag: noindex`. |
| `/robots.txt` | `200` | `text/plain`, `968` B | Cho phép `*` cùng 10 AI bot; chặn `/admin` và `/api/`; trỏ `Sitemap: https://tqd.me/sitemap.xml`. |
| `/sitemap.xml` | `200` | `3.033` B (`28` URL) | Gồm trang chủ, `6` chuyên mục, `2` trang công cụ/pháp lý, `19` bài viết, `0` `/xray/c-*`. |
| `/llms.txt` | `200` | `11.298` B | Liệt kê chuyên mục, tóm tắt bài viết và link `.md` hoạt động `200`. |
| `/llms-full.txt` | `200` | `33.168` B (`28.024` ký tự) | **Lỗi nghiêm trọng:** Thiếu toàn bộ thân bài Markdown (`bodyMd`), chỉ xuất tiêu đề, tóm tắt ngắn và tags. |
| `/search.json` | `200` | `application/json; charset=utf-8`, `11.669` B | Chỉ mục tìm kiếm client cho `CommandPalette`. |
| `/.well-known/llms.txt`, `/rss.xml`, `/feed.json` | `404` | `text/html` | Các điểm cuối khám phá chuẩn chưa được triển khai. |
| `/video`, `/index.html.md` | `404` | `text/html`, `77.708` B (`/video`) | `/video` chưa redirect `301` về `/video-ai`; `/index.html.md` chưa alias về `/index.md`. |
| `/ho-so/` và route cũ `/chuyen-mon`, `/dao-tao`, `/so-lieu` | `308` / `301` | Redirect đúng đích | `/ho-so/` (`308` -> `/ho-so`); các mục cũ và domain `www.tqd.me`, `tqd.io.vn` chuyển `301` về `https://tqd.me/`. |

### 2.3. Đàm phán Markdown và kiểm toán cache trong `src/middleware.ts`

Kiểm tra thực nghiệm các tổ hợp header `Accept` trên `https://tqd.me/`:
- `Accept: text/markdown` và `Accept: text/x-markdown` trả về `200` với `content-type: text/markdown; charset=utf-8` (`17.703` B), `vary: Accept`, `x-robots-tag: noindex` và `x-cache: HIT`.
- `Accept: text/markdown;q=0` và `Accept: text/markdown;q=0.5, text/html;q=0.8` ưu tiên đúng `text/html`.
- `/bai-viet/non-existent` kèm `Accept: text/markdown` trả `404` dạng `text/plain` thay vì phản hồi HTML hoặc Markdown có cấu trúc.

Kiểm toán `src/middleware.ts:373-431` xác nhận **Workers Cache (`caches.open('pages')`) tách cache key giữa HTML và Markdown**:
- Đoạn kiểm tra `if (mdTwin && prefersMarkdown(context.request.headers.get('Accept')))` (`src/middleware.ts:377-385`) chạy trước khi tra cứu cache HTML (`line 388-400`).
- Khi cần bản Markdown, middleware gọi `context.rewrite(mdTwin)` (`line 378`) để đưa request đi lại qua đầu pipeline với `path` là `/index.md` hoặc `/*.md`. Do vậy, key cache ở `line 399` (`${url.origin}${path}?v=${version}&b=${__BUILD_ID__}`) lưu riêng hai bản `/index.md?v=105&...` và `/?v=105&...`, không trộn dữ liệu.

Hai lỗi ở tầng HTTP header:
1. **Thiếu HTTP `Link` header:** Trang HTML mới khai báo `<link rel="alternate" type="text/markdown">` bên trong `<head>`, chưa xuất HTTP `Link` header (`rel="alternate"; type="text/markdown"` hay `rel="llms-txt"`). Phía ngược lại, hàm `markdownResponse` (`src/lib/profile-markdown.ts:205-207`) chỉ gắn `Content-Type` và `X-Robots-Tag: noindex`, thiếu `Link: <canonical>; rel="canonical"`.
2. **Nhân đôi hash CSP trên trang `404`:** Khi truy cập `/video`, `/rss.xml` hoặc `/feed.json`, header CSP trả về `script-src 'self' 'sha256-0LK7y+2HbD/veIun5R8jAjbiA0LraK4zbWLbUJdDeFk=' 'sha256-0LK7y+2HbD/veIun5R8jAjbiA0LraK4zbWLbUJdDeFk='` do `withHtmlInlineScriptHashes` (`src/middleware.ts:197-243`) thay chuỗi `script-src 'self'` hai lần khi `Astro.rewrite('/404')` chạy qua middleware.

### 2.4. Thử nghiệm User-Agent của bot AI qua Cloudflare WAF

Đã gửi request trực tiếp với `User-Agent` của `OAI-SearchBot/1.0`, `ClaudeBot/1.0`, `PerplexityBot/1.0`, `ChatGPT-User/1.0`, `Claude-SearchBot/1.0` và `GPTBot/1.0` tới `/`, `/bai-viet/tu-dien-ai-agent-cho-nguoi-khong-biet-lap-trinh` và `/llms.txt`:
- Cả 6 bot đều nhận mã HTTP `200`, `cf-cache-status: HIT`.
- Nội dung tải về nguyên vẹn (`178.275` B tại `/`, `116.496` B tại bài viết, `11.298` B tại `/llms.txt`), không xuất hiện `cf-mitigated` hay màn hình thử thách Bot Fight Mode.

---

## 3. Kiểm toán mã nguồn và đối chiếu đề xuất ngày 04/11/2026

### 3.1. Kết quả kiểm tra 3 điểm từng nêu trong brainstorm 04/11/2026

| Vấn đề nêu ngày 04/11/2026 | Hiện trạng | Bằng chứng xác minh |
| :--- | :---: | :--- |
| 1. `/llms.txt` thiếu tóm tắt bài viết (`profile-markdown.ts:64` cũ) | **ĐÃ SỬA** | `src/lib/profile-markdown.ts:154` xuất tiêu đề có biến tóm tắt `a.summary` và link `.md`. Bản `/llms.txt` live đã hiện tóm tắt từng bài. |
| 2. `og:image` chưa lấy theo `coverKey` bài viết (`BaseLayout.astro:24` cũ) | **ĐÃ SỬA** | `BaseLayout.astro:39` dùng `/og.png`; `[section].astro:41` dùng `/og/${s.id}.png`; `tai-video.astro:26`, `quyen-rieng-tu.astro:24`, `xray/[id].astro:66` có OG riêng; `bai-viet/[slug].astro:38-40,53` lấy `coverKey` từ R2 (`1200x675`) và fallback `/og/bai-viet.png` (`1200x630`). Có `17/19` bài dùng ảnh bìa riêng, còn `2` bài cũ (`tqd-clean-your-mac-don-dep-macos-tieng-viet`, `viet-pro-skill-viet-tieng-viet-cho-ai`) dùng ảnh mặc định. |
| 3. Ảnh bìa bài viết thiếu `alt` (`bai-viet/[slug].astro:35` cũ) | **ĐÃ SỬA** | `src/pages/bai-viet/[slug].astro:114` đã đặt `alt={article.title}` trên thẻ `<img class="article-cover">`. |

### 3.2. Lỗi mới phát hiện ở `/llms-full.txt`

Nguyên nhân khiến `/llms-full.txt` mất sạch nội dung chi tiết bài viết nằm ở chuỗi gọi dữ liệu giữa ba tệp:
- `src/pages/llms-full.txt.ts:6-9` gọi `loadSiteData(env.DB)` rồi truyền kết quả vào `llmsFullText(...)`.
- Trong `src/lib/content.ts:257-262`, `loadSiteData` gọi `listArticles(db, { limit: 50 })`.
- `listArticles` truy vấn theo `LIST_COLUMNS` (`src/lib/content.ts:230-231`), vốn gán cứng `'' AS body_md, '' AS body_html` để giảm tải cho trang danh sách.
- Đến `src/lib/profile-markdown.ts:197`, điều kiện `if (a.bodyMd)` luôn sai, làm `/llms-full.txt` dài `33.168` B nhưng hoàn toàn trống phần thân của `19` bài viết.

### 3.3. Độ phủ JSON-LD `@graph` theo mẫu trang

`src/layouts/BaseLayout.astro:72-79` dựng cặp `WebSite` và `WebPage` rồi nối `...jsonLd`. Đối chiếu `src/lib/structured-data.ts` và DOM thực tế cho thấy:

| Mẫu trang | Các `@type` hiện có | Nút schema cần bổ sung (không dùng `FAQPage` / `HowTo`) |
| :--- | :--- | :--- |
| `/` (`index.astro`) | `WebSite`, `WebPage`, `Person` | Thêm `ProfilePage` (hiện chỉ đặt ở `/ho-so`); nối `publisher`/`author` của `WebSite` tới `#person` và cân nhắc `SearchAction`. |
| `/san-pham` (`[section].astro:29-32`) | `WebSite`, `WebPage`, `BreadcrumbList` | Gắn `Person`, `CollectionPage`/`ItemList` và `SoftwareApplication` cho các phần mềm (`Viết Pro`, `TQD KidGuard`, `TQD-Clean Your Mac`). |
| `/video-ai` | `WebSite`, `WebPage`, `BreadcrumbList` | Bổ sung nút tác giả `Person`, danh sách `ItemList` và `VideoObject` cho video. |
| `/bai-viet` | `WebSite`, `WebPage`, `BreadcrumbList` | Chèn thực thể `Person`, `Blog`/`CollectionPage` cùng danh mục `ItemList`. |
| `/thu-vien` và `/lien-he` | `WebSite`, `WebPage`, `BreadcrumbList` | Bổ sung `ImageGallery` cho mục ảnh, `ContactPage` cho trang liên hệ và liên kết `Person`. |
| `/bai-viet/[slug].astro` | `WebSite`, `WebPage`, `Person`, `Article`, `BreadcrumbList` | Đủ node cốt lõi; nên thêm `wordCount` và `articleSection` trong `articleNode` (`src/lib/structured-data.ts:38-58`). |
| `/tai-video.astro` | `WebSite`, `WebPage`, `Person`, `WebApplication`, `BreadcrumbList` | Đủ node `WebApplication` và `BreadcrumbList`. |
| `/xray/[id].astro:67-77` | `WebSite`, `WebPage`, `Person`, `BreadcrumbList` | Trang bật `ogType="article"` ở dòng `64` và cho index bản ghi `c-*`, nhưng thiếu `TechArticle` hoặc `Article` trong `@graph`. |

### 3.4. Metadata, cấu trúc Heading và Lighthouse

1. **Thẻ mô tả chuyên mục quá ngắn:** `src/pages/[section].astro:38` lấy `s.short` làm `description`, khiến `<title>` chỉ đạt `14-17` ký tự và `<meta name="description">` chỉ dài `16-30` ký tự (`/lien-he`: `16`, `/ho-so`: `23`, `/video-ai`: `28`, `/thu-vien` và `/bai-viet`: `29`, `/san-pham`: `30`).
2. **Mô tả trang chủ và bài viết quá dài:** Trang `/` có `<title>` `25` ký tự (`"Trịnh Quang Dũng (DũngTQ)"`) nhưng `description` dài `327` ký tự; `18/19` bài viết có `<meta description>` vượt `160` ký tự (chỉ `bay-tam-chin-3d-game-xuc-xac-webgl` đạt `145` ký tự; các bài ngắn kế tiếp từ `162` ký tự decoded và tối đa `350` ký tự tại `cloudflare-cho-nguoi-moi-vibe-code`), trong khi `<title>` nằm trong khoảng `50-119` ký tự.
3. **Sai thứ tự heading (`heading-order`):**
   - Trên các trang `/san-pham`, `/video-ai`, `/bai-viet`: `PageHeading.astro` xuất `<h1>`, nhưng `SectionBody.astro` / `ItemCard.astro` nhảy xuống `<h3>` (bỏ qua `<h2>`), còn `<h2 id="chat-title" class="chat-title">Agent DũngTQ</h2>` lại nằm ở cuối DOM trong `src/components/ChatPanel.astro:33`. Lỗi này giải thích điểm `0` của audit `heading-order` trong `.lighthouse-san-pham.json`.
   - Trang chủ `/` (`src/pages/index.astro`) xuất đồng thời **2 thẻ `<h1>`** từ `src/components/DesktopShell.astro:26` và `src/components/MobileShell.astro:35`.
4. **Dữ liệu `.lighthouse-*.json` đã cũ (đo ngày `2026-10-12` trên `tqd.io.vn` và `localhost`):**
   - `.lighthouse-home.json` (`tqd.io.vn`): Perf `98`, A11y `100`, LCP `2.0 s`, TBT `0 ms`, CLS `0.02`.
   - `.lighthouse-san-pham.json` (`localhost`): Perf `94`, A11y `98` (rớt `heading-order`), Best Practices `100`, SEO `100`, LCP `2.5 s`.
   - `.lighthouse-article.json` (`tqd.io.vn`): Perf `99`, A11y `100`, LCP `2.0 s`, CLS `0`.
5. **Tài nguyên `/xray/c-*` và định tuyến:** `sitemap.xml` hiện chưa có URL `/xray/c-*` nào, còn regex ở `src/middleware.ts:98` (`/xray/(?:c-)?[a-f0-9]{12,24}`) sẽ chặn bản `.md` nếu sau này tạo slug chữ cho bản ghi `c-*`. Do `robots.txt` chặn `/api/`, mọi endpoint khám phá mới cho bot phải nằm ngoài `/api/`.

### 3.5. `PageActions` và tương tác trợ lý AI

`src/components/PageActions.astro` và `src/scripts/page-actions.ts` xử lý đúng `ClipboardItem` `Promise<Blob>` cho Safari và fallback `navigator.share`. Trang chủ `/` chưa gắn `PageActions` (trong khi `[section].astro:45`, `bai-viet/[slug].astro:103-108`, `tai-video.astro:45-50`, `quyen-rieng-tu.astro:41-46`, `xray/[id].astro:151-156` đã gắn). Link mở nhanh tại `src/components/PageActions.astro:15,17` đang trỏ `https://chatgpt.com/?q=...` và `https://www.perplexity.ai/search/new?q=...`, khác với mẫu gợi ý `?hints=search&prompt=` và `/search?q=`.

---

## 4. Kiến nghị xử lý theo mức độ ưu tiên (Must / Should / Could)

Các đề xuất dưới đây dùng bảng màu `#faf7f1` / `#1b2030` / `#8a6420` (không dùng `#b8935a` cho chữ hoặc focus), giữ CSP `script-src 'self'`, không import `sharp` vào Cloudflare Workers, không dùng emoji làm icon UI và không thêm `FAQPage` / `HowTo` schema.

| Mức độ | Hạng mục & Tệp đích | Bằng chứng & Tác động | Cách xử lý đề xuất |
| :---: | :--- | :--- | :--- |
| **MUST** | **Khôi phục thân bài trong `/llms-full.txt`** (`src/pages/llms-full.txt.ts`, `src/lib/content.ts:230-231,262`) | `listArticles` chọn `'' AS body_md`, làm `/llms-full.txt` (`33.168` B) thiếu sạch nội dung `19` bài viết. | Thêm hàm truy vấn kèm `body_md` (hoặc tùy chọn `includeBody`) dùng riêng cho route `/llms-full.txt` nhằm tránh làm chậm trang danh sách HTML. |
| **MUST** | **Sửa cấu trúc heading trên trang chuyên mục và `/`** (`SectionBody.astro`, `ItemCard.astro`, `ChatPanel.astro:33`, `DesktopShell.astro:26`, `MobileShell.astro:35`) | Lỗi nhảy `h1 -> h3` rồi `h2` khiến `.lighthouse-san-pham.json` rớt `heading-order` (`0` điểm); `/` có `2` thẻ `<h1>`. | Chuyển tiêu đề khối trong `SectionBody`/`ItemCard` thành `<h2>` (card con dùng `<h3>`); đổi `ChatPanel` thành `<p>`; giữ duy nhất `1` thẻ `<h1>` trong DOM tại `/`. |
| **MUST** | **Chuẩn hóa độ dài `<title>` và `<meta description>`** (`src/pages/[section].astro:38`, `src/pages/index.astro`, dữ liệu D1) | Sáu chuyên mục chỉ có description `16-30` ký tự; `/` dài `327` ký tự; `18/19` bài dài trên `160` ký tự. | Thiết kế `seoTitle` (`45-60` ký tự) và `seoDescription` (`130-155` ký tự) riêng cho 6 chuyên mục; rút ngắn snippet của `/` và bài viết về `140-158` ký tự mà không cắt nội dung hiển thị trên trang. |
| **MUST** | **Mở rộng JSON-LD `@graph` cho chuyên mục, `/` và `/xray/[id]`** (`src/lib/structured-data.ts`, `src/pages/[section].astro`, `index.astro`, `xray/[id].astro`) | Năm trang danh mục thiếu schema chuyên biệt; `/xray/[id]` thiếu node `Article`; `/` thiếu `ProfilePage`. | Thêm `ProfilePage` ở `/`; gắn `CollectionPage` + `ItemList` kèm `SoftwareApplication`, `VideoObject`, `Blog`, `ImageGallery`, `ContactPage` theo từng mục; thêm `TechArticle` ở `/xray/[id]`. |
| **SHOULD** | **Phát HTTP `Link` header cho HTML và `.md`** (`src/middleware.ts`, `src/lib/profile-markdown.ts:205-207`) | Cả HTML lẫn `.md` đều chưa xuất HTTP `Link` header hỗ trợ agent khám phá từ phản hồi HEAD/GET. | Xuất `Link: <https://tqd.me/path.md>; rel="alternate"; type="text/markdown", <https://tqd.me/llms.txt>; rel="llms-txt"` trên HTML và `Link: <https://tqd.me/path>; rel="canonical"` trên `.md`. |
| **SHOULD** | **Mở `/.well-known/llms.txt`, `/rss.xml`, `/feed.json` và vá CSP `404`** (`src/pages/`, `BaseLayout.astro`, `src/middleware.ts:197-243`) | Ba URL chuẩn trả `404` HTML; trang `404` nhân đôi `sha256` trong `script-src`; `Accept: text/markdown` `404` trả `text/plain`. | Đặt `/.well-known/llms.txt`, `/rss.xml`, `/feed.json` ở đường dẫn gốc (ngoài `/api/` do `robots.txt` đang chặn `/api/`); tránh chèn trùng `sha256` khi `Astro.rewrite('/404')`. |
| **SHOULD** | **Gắn `PageActions` trên `/` và kiểm tra query URL AI** (`src/pages/index.astro`, `src/components/PageActions.astro:15,17`) | `/` chưa có `PageActions`; link ChatGPT/Perplexity chưa theo `?hints=search&prompt=` và `/search?q=`. | Đặt `PageActions` gọn trên `/` (vùng chạm `>= 44px`, đúng chuẩn `DESIGN.md`); cập nhật tham số URL mở ChatGPT và Perplexity. |
| **COULD** | **Nén ảnh bìa bài viết và bổ sung `coverKey` cho 2 bài cũ** (R2 `tqd-media` và D1) | Ảnh bài `github-co-ban-cho-nguoi-moi-dung-agent-ai` nặng `1,45` MB; `2/19` bài dùng OG fallback. | Xử lý ảnh offline (không dùng `sharp` trong Workers) về định dạng WebP/JPEG `1200x675` dưới `300` KB cho bài GitHub cùng 2 bài Mac/Viết Pro. |
| **COULD** | **Khai thác `/xray/c-*`, alias `/video` và đo lại Lighthouse** (`src/middleware.ts:98`, D1, `.lighthouse-*.json`) | `sitemap.xml` có `0` URL `/xray/c-*`; `/video` trả `404`; báo cáo Lighthouse đo từ `10/12` trên domain cũ. | Tạo `1-2` bản ghi `/xray/c-*` mẫu để kích hoạt index; nới regex `middleware.ts:98` nếu dùng slug chữ; thêm redirect `301` `/video` -> `/video-ai` và chạy lại Lighthouse trên `https://tqd.me`. |
