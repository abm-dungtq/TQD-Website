# Kế hoạch phát triển Website theo hướng Agent Experience (AX) cho tqd.me

Tài liệu này là đặc tả kỹ thuật về trải nghiệm tác nhân AI (Agent Experience, viết tắt là AX) cho hệ thống `https://tqd.me`, hướng tới 3 lớp tác nhân đang tương tác thực tế với website gồm bot thu thập và truy xuất HTTP, hệ thống khám phá có cấu trúc kèm liên tác nhân (A2A) cùng tác nhân chạy trực tiếp trong trình duyệt (WebMCP, Playwright, Computer-Use).

Mọi hạng mục trong kế hoạch tuân thủ tuyệt đối kiến trúc hiện hữu của `tqd.me` (Astro `^7.3.8` SSR trên Cloudflare Workers, Tailwind CSS v4, TypeScript 6, D1 `tqd_db`, R2 `tqd-media`) cùng hai bộ quy chuẩn nội bộ tại [REVIEW.md](file:///Volumes/2/TQD-Website/REVIEW.md) và [DESIGN.md](file:///Volumes/2/TQD-Website/DESIGN.md). Không đề xuất xây lại từ đầu, không tạo công cụ ngoài phạm vi thương hiệu chính chủ **Trịnh Quang Dũng (DũngTQ)**, giữ kênh chuyển tiếp B2B tại `https://zalo.me/trinhquangdung`, tuân thủ CSP `script-src 'self'` (băm SHA-256 tự động tại middleware, cấm `<script is:inline>` chạy JS và cấm handler nội tuyến `onclick=`/`onload=`/`onerror=`), không dùng `sharp` trong Workers runtime và giữ nguyên quy tắc phân tách bản curated `c-*` với bản khách trên `/xray/[id]`.

---

## 1. Đánh giá hiện trạng AX trên 3 lớp tác nhân AI

Website `tqd.me` đã đi trước mặt bằng chung ở hạ tầng thu thập Markdown và chính sách bot. Tuy nhiên, khi đi sâu từ đọc thô sang hiểu cấu trúc, gọi API khám phá và thao tác trên giao diện desktop trong trình duyệt, ba lớp tác nhân vẫn vấp phải những khoảng trống cụ thể.

| Lớp tác nhân AI | Điểm đã có sẵn trong codebase (giữ nguyên và kế thừa) | Khoảng trống và rủi ro thực tế | Mức ưu tiên |
| :--- | :--- | :--- | :--- |
| **Lớp 1** - HTTP, Retrieval và Feed Agents (`GPTBot`, `OAI-SearchBot`, `ClaudeBot`, `PerplexityBot`, trình cào RAG) | `public/robots.txt` đã mở cho `*` và 10 AI bots (`Disallow: /admin`, `/api/`). `src/middleware.ts` đã đàm phán `Accept: text/markdown` kèm `Vary: Accept` và Edge cache theo `content_version` + `__BUILD_ID__`. Đã có `/llms.txt` (kèm `a.summary`), `/llms-full.txt`, các bản `.md` twin, `PageActions.astro` và `og:image` riêng cho bài viết. | Bản `.md` dùng trích dẫn tiếng Việt thay vì YAML frontmatter chuẩn; `/index.md`, `/tai-video.md`, `/quyen-rieng-tu.md` thiếu mốc `updated`; `lastModified()` cắt cụt còn `YYYY-MM-DD`. `/llms.txt` bỏ sót danh mục sản phẩm, video AI và endpoint JSON; `/llms-full.txt` nối nguyên văn tới 50 bài dễ tràn token. Chưa có HTTP `Link` header và tuyến `/.well-known/llms.txt`. | **Giai đoạn 1** (1-2 ngày) |
| **Lớp 2** - Khám phá có cấu trúc, Feeds và A2A (`RSS`, `JSON Feed`, Catalog, Agent Card) | Đã có `/sitemap.xml` (`sitemap.xml.ts` có truy vấn hỗ trợ bản curated `/xray/c-*`, hiện live ghi nhận `0` trang `c-*`) và `/search.json` phục vụ tìm kiếm `⌘K`. | Chưa có `/rss.xml` và `/feed.json` để bot theo dõi bài mới theo mốc thời gian. `/search.json` là mảng phẳng `Entry[]` gắn chặt vào `command-palette.ts`, thiếu metadata phong phú (`summary`, `tags`, `publishedAt`, `updatedAt`, `markdownUrl`). Chưa có `/.well-known/agent.json` mô tả năng lực Agent DũngTQ, hạn mức thực tế và đặc tả công cụ `/tai-video`. | **Giai đoạn 2** (3-5 ngày) |
| **Lớp 3** - Tác nhân trong trình duyệt (WebMCP, Playwright, Computer-Use GUI Agents) | Giao diện `/` có `DesktopShell.astro` và `MobileShell.astro`; `/tai-video` có tab `role="tablist"` và `#dl-alert` `role="status"`. `ChatPanel` stream SSE từ GoClaw qua `/api/chat`. | Chưa có module đăng ký công cụ qua `document.modelContext` (WebMCP). Trên `/`, `BOOT_WINDOWS` mở chồng 3 cửa sổ và `silk-wallpaper.mp4`, canvas mưa tuyết, linh vật không tự tạm dừng theo `navigator.webdriver`. `chat-panel.ts` đặt `aria-hidden="true"` lên bong bóng `pending` suốt lúc stream. `/tai-video` thiếu `role="progressbar"` và nhiều vùng `aria-live="polite"`. | **Giai đoạn 3** (1-2 tuần) |

### Bốn bẫy kiến trúc cần khóa chặt trước khi triển khai

1. **Bẫy chặn đường dẫn API trong `robots.txt`**: Tệp [public/robots.txt](file:///Volumes/2/TQD-Website/public/robots.txt) chặn hai nhánh `/admin`, `/api/` trên toàn bộ 11 nhóm bot; đồng thời `src/middleware.ts` gán `isPrivate = isAdmin || lower.startsWith('/api/')` khiến mọi tuyến dưới tiền tố `/api/` đều nhận `Cache-Control: no-store` và `X-Robots-Tag: noindex`. Vì vậy, `/rss.xml`, `/feed.json`, `/catalog.json`, `/.well-known/llms.txt` và `/.well-known/agent.json` bắt buộc đặt ở gốc domain hoặc `/.well-known/`, tuyệt đối không đặt dưới tiền tố quản trị hay API.
2. **Bẫy gãy tương thích `/search.json`**: Module `src/scripts/command-palette.ts` kỳ vọng `/search.json` trả về mảng JSON cấp một `Entry[]` và chỉ lọc theo `e.title`. Nếu đổi sang object lồng nhau hoặc thay đổi kiểu trả về của `/search.json`, hộp thoại tìm kiếm `⌘K` sẽ gãy ngay trên production. Giải pháp an toàn là giữ ổn định hợp đồng `/search.json` cho UI và mở riêng `/catalog.json` làm danh mục máy đọc công khai đầy đủ.
3. **Bẫy dữ liệu cấu trúc JSON-LD đã lỗi thời**: Tuyệt đối không chèn `FAQPage` hay `HowTo` cho mục tiêu hiển thị rich results tìm kiếm, cũng không tạo `@id` tham chiếu ngược mà thiếu nút khai báo trong `@graph` vì `scripts/verify/site.mjs` sẽ báo lỗi `dangling JSON-LD @id reference`.
4. **Bẫy chuẩn WebMCP cũ và ngân sách ngữ cảnh**: Theo chuẩn WebMCP mới nhất (và ghi nhận `navigator.modelContext` đã bị đánh dấu deprecated từ Chromium 150 trở đi), entrypoint chính phải kiểm tra `document.modelContext`. Toàn bộ phần đăng ký tool phải giữ gọn trong ngưỡng 5-6 công cụ mỗi trang, tuân thủ giới hạn độ dài chuỗi của Chrome và không phơi nội dung người dùng gửi ở `/xray/[id]` bản khách vào kênh hướng dẫn tin cậy của agent.

---

## 2. Giai đoạn 1 - Lớp HTTP, Retrieval và Feed Agents (1-2 ngày)

Mục tiêu của giai đoạn đầu là giúp mọi bot tìm kiếm AI và trình cào dữ liệu đọc đúng ngữ cảnh, biết chính xác ngày cập nhật và phát hiện bản Markdown ngay từ HTTP response headers mà không phải phân tích toàn bộ DOM.

### 2.1. Chuẩn hóa YAML frontmatter và dấu thời gian cho mọi bản `.md` twin

Hiện trạng tại `src/lib/profile-markdown.ts` đang xuất phần đầu dưới dạng blockquote tiếng Việt (`> Nguồn: ...`, `> Tác giả: ...`). Nhiều bộ tách RAG (như LangChain, LlamaIndex, Firecrawl hoặc Jina Reader) nhận diện metadata chuẩn xác hơn khi tệp mở đầu bằng khối YAML frontmatter `---`. Ngoài ra, `/index.md`, `/tai-video.md` và `/quyen-rieng-tu.md` hiện chưa có dòng `updated`, còn `lastModified()` trong `src/lib/content.ts` cắt chuỗi về 10 ký tự `YYYY-MM-DD` thay vì mốc ISO 8601 UTC đầy đủ.

**Tệp cần sửa**

- `src/lib/content.ts` (giữ `lastModified()` hoặc bổ sung `lastModifiedIso(data)` tái sử dụng `toIsoUtc` từ `src/lib/structured-data.ts`).
- `src/lib/profile-markdown.ts` (bổ sung helper `renderFrontmatter(...)` và truyền `lastmod` vào `profileMarkdown`, `sectionMarkdown`, `taiVideoMarkdown`, `privacyMarkdown`).
- `src/pages/index.md.ts`, `src/pages/[section].md.ts`, `src/pages/bai-viet/[slug].md.ts`, `src/pages/tai-video.md.ts`, `src/pages/quyen-rieng-tu.md.ts`, `src/pages/xray/[id].md.ts`.
- `src/scripts/page-actions.ts` và `src/lib/profile-markdown.test.ts`.

**Thiết kế dữ liệu và giao diện lập trình**

Định nghĩa khối YAML frontmatter thống nhất ở đầu mọi phản hồi `text/markdown` (dùng JSON string escape an toàn qua `JSON.stringify` để tránh vỡ cú pháp YAML khi tiêu đề hoặc tóm tắt chứa dấu `:`, `#`, ngoặc kép hoặc ký tự xuống dòng):

```yaml
---
source: "https://tqd.me/bai-viet/quy-trinh-ai-van-hanh"
title: "Quy trình AI vận hành cho doanh nghiệp nhỏ"
author: "Trịnh Quang Dũng (DũngTQ)"
updated: "2026-11-12T03:24:00.000Z"
summary: "Cách tách quy trình lặp lại thành prompt chuẩn và kiểm chứng đầu ra."
tags:
  - "AI Workflow"
  - "Vận hành"
---
```

Với các route đặc thù, bổ sung trường nhẹ mà không lộ thông tin nhạy cảm:

- `index.md.ts` và `[section].md.ts`: truyền `updated` từ `lastModifiedIso(data)`; `tags` lấy theo nhóm chuyên mục thực tế của trang.
- `tai-video.md.ts`: đặt `title`, `summary`, `updated` (mốc build hoặc `lastModifiedIso(data)`), `tags: ["Tai Video", "Viral Video Lab", "Viet Pro"]`.
- `quyen-rieng-tu.md.ts`: truyền `updated` từ `lastModifiedIso(data)`.
- `xray/[id].md.ts`:
  - Bản curated `c-*`: ghi rõ `curated: true`, `robots: "index, follow"` (lưu ý HTTP header của `.md` twin vẫn đi qua `markdownResponse()` để giữ `X-Robots-Tag: noindex` tách biệt với trang HTML canon nếu cần; riêng trang HTML `c-*` được index).
  - Bản khách công khai (không có tiền tố `c-`): ghi rõ `curated: false`, `robots: "noindex, nofollow"`, tiếp tục tước toàn bộ link ngoài khỏi thân bài và giữ `summary` an toàn theo chính sách `REVIEW.md`.

```typescript
// Đề xuất bổ sung vào src/lib/profile-markdown.ts
export interface MarkdownFrontmatter {
  source: string;
  title: string;
  author?: string;
  updated?: string;
  summary?: string;
  tags?: string[];
  robots?: string;
}

export function renderFrontmatter(meta: MarkdownFrontmatter): string {
  const lines = [
    '---',
    `source: ${JSON.stringify(meta.source)}`,
    `title: ${JSON.stringify(meta.title)}`,
  ];
  if (meta.author) lines.push(`author: ${JSON.stringify(meta.author)}`);
  if (meta.updated) lines.push(`updated: ${JSON.stringify(meta.updated)}`);
  if (meta.summary) lines.push(`summary: ${JSON.stringify(meta.summary)}`);
  if (meta.tags?.length) {
    lines.push('tags:');
    for (const t of meta.tags) lines.push(`  - ${JSON.stringify(t)}`);
  }
  if (meta.robots) lines.push(`robots: ${JSON.stringify(meta.robots)}`);
  lines.push('---', '');
  return lines.join('\n');
}
```

**Rủi ro tương thích và cách xử lý**

- **Tương thích nút "Sao chép Markdown" (`PageActions.astro`)**: Module `src/scripts/page-actions.ts` đang fetch trực tiếp đường dẫn `.md` để copy vào clipboard. Khi người dùng dán vào ChatGPT/Claude/Notion, khối YAML frontmatter sạch hoàn toàn có ích vì AI giữ được URL nguồn và tên tác giả. Tuy nhiên, nếu giữ lại cả blockquote `> Nguồn:` cũ ngay dưới frontmatter sẽ bị lặp thông tin tốn token; cần bỏ dòng `> Nguồn:` trùng lặp trong thân bài sau khi đã có YAML frontmatter, giữ tiêu đề `# H1` ngay sau `---`.
- **Tương thích test hiện hữu**: Kiểm tra kỹ `src/lib/profile-markdown.test.ts` để cập nhật assertion từ kiểm tra chuỗi blockquote sang kiểm tra khối YAML mở đầu bằng `---` và chứa đầy đủ `source`, `title`, `author`, `updated`.

### 2.2. Tối ưu mật độ token của `/llms.txt` và `/llms-full.txt`

Qua kiểm tra hàm `llmsText()` và `llmsFullText()` trong `src/lib/profile-markdown.ts`, `/llms.txt` hiện đã xuất khá gọn danh sách trang chính, `/tai-video.md`, `/quyen-rieng-tu.md` cùng các bài viết kèm `a.summary`, nhưng vẫn thiếu:

1. Danh sách sản phẩm AI (`data.products`) và video AI (`data.videos`) khiến tác nhân tìm hiểu giải pháp của DũngTQ phải tải thêm `/san-pham.md` mới thấy tên công cụ như Viết Pro.
2. Liên kết tới các bề mặt máy đọc mới ở Giai đoạn 2 (`/catalog.json`, `/rss.xml`, `/feed.json`, `/.well-known/agent.json`).
3. Cơ chế chống phình token ở `llmsFullText()`: hàm hiện tại ghép toàn bộ `profileMarkdown`, `taiVideoMarkdown`, `privacyMarkdown` và nối nguyên văn toàn bộ `bodyMd` của tối đa 50 bài viết từ `loadSiteData`. Khi kho bài viết vượt mốc 30-50 bài dài, tệp `/llms-full.txt` có thể vượt 100.000 token và bị trình cào cắt ngang giữa chừng.

**Tệp cần sửa**

- `src/lib/content.ts` (bổ sung `listRecentArticlesWithBody(db, limit = 12)` để truy vấn `body_md` riêng cho nhóm bài gần nhất thay vì phụ thuộc vào `listArticles()` vốn lược bỏ `body_md` ở truy vấn danh sách)
- `src/lib/profile-markdown.ts`
- `src/pages/llms.txt.ts`
- `src/pages/llms-full.txt.ts`
- `src/lib/profile-markdown.test.ts`

**Thiết kế tối ưu mật độ token**

- **Đối với `/llms.txt`**:
  - Giữ tổng dung lượng dưới 2.500-3.500 từ (khoảng 3.500-5.000 token), không nhúng đoạn văn dài.
  - Thêm mục `## Sản phẩm AI nổi bật` liệt kê tối đa 8 sản phẩm `visible` kèm 1 dòng tóm tắt ngắn (`<= 120` ký tự) và liên kết về `/san-pham.md` (kèm mục `/tai-video.md`).
  - Thêm mục `## Danh mục máy đọc (Machine Discovery)` trỏ tới `/.well-known/agent.json`, `/catalog.json`, `/rss.xml`, `/feed.json`, `/sitemap.xml`.
  - Giữ `## Bài viết mới nhất` liệt kê tối đa 20 bài gần nhất kèm `a.summary`; các bài cũ hơn dẫn về `/catalog.json` hoặc `/bai-viet.md`.
- **Đối với `/llms-full.txt`**:
  - Thêm phần mục lục neo (Table of Contents) ngay đầu tệp cùng trường `generated_at` và tổng số mục.
  - Dùng `listRecentArticlesWithBody(env.DB, 12)` trong `src/pages/llms-full.txt.ts` để bảo đảm phần thân bài thực sự có dữ liệu `bodyMd` khi xuất, tránh tình trạng nối danh sách rỗng `bodyMd` từ `loadSiteData()`.
  - Đặt ngưỡng an toàn theo ký tự/số bài cho phần nguyên văn: chỉ xuất nguyên văn `bodyMd` cho **tối đa 12 bài viết mới nhất** (hoặc dừng nối `bodyMd` khi tổng độ dài vượt `120_000` ký tự, tương đương ~30.000-40.000 token tiếng Việt), các bài còn lại xuất gọn dạng mục lục `Tiêu đề + Updated + Summary + URL .md` để bot chủ động fetch từng bài khi cần.
  - Hỗ trợ tùy chọn `?scope=recent` / `?scope=all` (chú ý xử lý cache tách biệt hoặc mặc định luôn dùng bản cân bằng token tại `/llms-full.txt` để không phải phá cơ chế cache không query string của Workers). Khuyến nghị giữ nguyên URL sạch `/llms-full.txt` không query params làm bản tối ưu chuẩn token.

### 2.3. Bổ sung HTTP `Link` headers và tối ưu tách cache trong `src/middleware.ts`

Nhiều retrieval agent gửi `HEAD` hoặc kiểm tra HTTP response header trước khi quyết định parse HTML. Hiện tại `withSecurityHeaders()` trong `src/middleware.ts` mới gắn `Vary: Accept` (`varyAccept: true`) chứ chưa gắn HTTP `Link` header theo chuẩn RFC 8288.

**Tệp cần sửa**

- `src/middleware.ts`
- `src/layouts/BaseLayout.astro`
- `scripts/verify/site.mjs`

**Thiết kế chi tiết**

1. Trong `withSecurityHeaders(res, opts)` (khoảng dòng 171-191 của `src/middleware.ts`), bổ sung tùy chọn `linkHeaders?: string[]` và dùng `headers.append('Link', value)` (tránh ghi đè bằng `.set()` nếu có nhiều giá trị):
   - Với mọi phản hồi public HTML (`!isPrivate` và không phải `/admin`, `/api/`, `/media/`):
     - Luôn append `</llms.txt>; rel="llms-txt"` (tương thích chuẩn khám phá llms.txt qua header).
     - Append `</rss.xml>; rel="alternate"; type="application/rss+xml"; title="RSS Feed"` và `</feed.json>; rel="alternate"; type="application/feed+json"; title="JSON Feed"`.
   - Khi tuyến hiện tại có bản Markdown twin (`mdTwin !== null`, áp dụng cho cả phản hồi `text/html` lẫn `HEAD`):
     - Append `<https://tqd.me${mdTwin}>; rel="alternate"; type="text/markdown"`.
2. Kiểm tra nhánh `Accept: text/markdown` và Edge Cache trong `src/middleware.ts`:
   - Hiện tại `prefersMarkdown` chạy ở dòng 373-385 (trước khối `caches.open('pages')` ở dòng 398-430) nên phản hồi Markdown không ghi đè vào cache HTML; đồng thời `HEAD` bỏ qua `caches.open('pages')` nhờ điều kiện `cacheable = method === 'GET'`.
   - Khi mở rộng `withSecurityHeaders` để đính kèm `Link` headers, cần bảo đảm hàm gắn `Link` chạy trước khi `cache.put(...)` lưu bản HTML vào Workers Cache (`out = withSecurityHeaders(out, ...)`), nhờ đó cả lượt cache HIT lẫn lượt `HEAD` đều mang đủ HTTP `Link` headers nhất quán.
3. Trong `BaseLayout.astro` (khoảng dòng 94, cạnh `<link rel="alternate" type="text/markdown">`):
   - Thêm `<link rel="llms-txt" href="/llms.txt" />`.
   - Thêm `<link rel="alternate" type="application/rss+xml" title="Trịnh Quang Dũng RSS Feed" href="/rss.xml" />`.
   - Thêm `<link rel="alternate" type="application/feed+json" title="Trịnh Quang Dũng JSON Feed" href="/feed.json" />`.

**Rủi ro tương thích**

- Không gắn `Link: <...md>; rel="alternate"; type="text/markdown"` trên trang `404` (`markdownTwinPath('/404')` đã trả về `null`) để vượt qua kiểm tra khắt khe của `scripts/verify/site.mjs` dòng 20-22.
- Kiểm tra kích thước tổng các header không vượt quá giới hạn thông thường (dưới 1 KB), dùng đường dẫn tương đối `</llms.txt>` hoặc URL chuẩn `https://tqd.me/...` nhất quán với `SITE_URL` (`astro.config.mjs`).

### 2.4. Mở tuyến `/.well-known/llms.txt` và hoàn thiện JSON-LD, SEO kỹ thuật

Một số công cụ AI kiểm tra chuẩn well-known URI tại `/.well-known/llms.txt` song song với `/llms.txt`. Bên cạnh đó, đồ thị JSON-LD trong `BaseLayout.astro` và `src/lib/structured-data.ts` còn thiếu vài thuộc tính liên kết ngữ nghĩa quan trọng.

**Phạm vi mã nguồn áp dụng**

- Tạo mới `src/pages/.well-known/llms.txt.ts`.
- Sửa `src/lib/structured-data.ts`, `src/layouts/BaseLayout.astro`, `src/pages/[section].astro`, `src/pages/tai-video.astro`.
- Sửa `scripts/verify/site.mjs` (thêm kiểm tra `/.well-known/llms.txt` và các trang danh mục mới).

**Thiết kế `/.well-known/llms.txt.ts` và JSON-LD**

- `src/pages/.well-known/llms.txt.ts`: Gọi thẳng `loadSiteData(env.DB)` + `llmsText(data)` và trả về status `200` (`Content-Type: text/markdown; charset=utf-8`), kèm HTTP header `Link: <https://tqd.me/llms.txt>; rel="canonical"` để không bắt crawler đi qua một vòng redirect nếu client tắt `followRedirect`. Đồng thời giữ `src/lib/analytics/normalize.ts` không tính tuyến `/.well-known/*` vào lượt xem trang (hàm hiện tại đã trả về `null` cho path ngoài allowlist).
- Cải tiến JSON-LD an toàn (giữ nguyên nguyên tắc không dùng `FAQPage` hay `HowTo`):
  - Trong `BaseLayout.astro`:
    - Chèn nút `Person` tối giản (`personNode` rút gọn hoặc truyền đủ `personNode` vào `@graph` ở các trang sử dụng `#person`) để khi `WebSite` trỏ `author: { '@id': '#person' }` và `publisher: { '@id': '#person' }` thì nút `#person` luôn tồn tại trong `@graph` của mọi trang công khai, không bao giờ vi phạm kiểm tra dangling `@id` trong `scripts/verify/site.mjs` dòng 103-107!
    - Thêm `description` và `inLanguage: 'vi-VN'` vào nút `WebSite`.
    - Thêm `dateModified` (nhận từ `lastModified` / `article.updatedAt`) và `mainEntity` vào `WebPage`.
  - Trong `src/lib/structured-data.ts` và `src/pages/[section].astro`:
    - Bổ sung helper `collectionPageNode(...)` tạo `CollectionPage` + `ItemList` (`ListItem` theo vị trí `position`, `url`, `name`) cho `/san-pham`, `/bai-viet`, `/video-ai` để máy tìm kiếm AI bóc tách danh sách sản phẩm và bài viết có thứ tự rõ ràng.
    - Bổ sung `ContactPage` (trỏ `mainEntity: { '@id': '#person' }`) cho `/lien-he`.
  - Trong `src/lib/structured-data.ts` (hàm `webAppNode`, hiện đặt `operatingSystem: 'All'` và được gọi tại `src/pages/tai-video.astro`): bổ sung mảng `featureList` cùng `operatingSystem: 'Web'` rõ ràng (giữ `isAccessibleForFree: true`, `offers.price: '0'`), không tạo schema `HowTo`.

---

## 3. Giai đoạn 2 - Lớp Structured Discovery, Feeds và Public Read-Only Catalog (3-5 ngày)

Giai đoạn hai tạo ra các nguồn dữ liệu cấu trúc chuẩn hóa giúp bot tổng hợp, công cụ theo dõi nội dung mới và tác nhân điều phối (A2A orchestrator) hiểu toàn bộ tài nguyên của `tqd.me` chỉ bằng một lần đọc JSON hoặc XML.

### 3.1. Thiết kế `/rss.xml` (RSS 2.0) và `/feed.json` (JSON Feed 1.1)

**Thành phần cần tạo và sửa**

- Tạo `src/lib/feeds.ts` (hàm thuần dựng chuỗi XML/JSON, dễ viết unit test Vitest không cần Workers runtime).
- Tạo `src/pages/rss.xml.ts` và `src/pages/feed.json.ts`.
- Tạo `src/lib/feeds.test.ts`.
- Sửa `public/robots.txt` (thêm tùy chọn `Allow: /rss.xml`, `Allow: /feed.json` minh bạch dù mặc định đã mở), `src/layouts/BaseLayout.astro` (khai báo link feed ở `<head>`).

**Thiết kế dữ liệu**

- `src/pages/rss.xml.ts`:
  - `Content-Type: application/rss+xml; charset=utf-8` (hoặc `application/xml; charset=utf-8`), kèm `Cache-Control` qua `src/middleware.ts` để hưởng chung cơ chế cache theo `content_version`.
  - Phần tử `<channel>` khai báo `xmlns:atom="http://www.w3.org/2005/Atom"`, `<atom:link href="https://tqd.me/rss.xml" rel="self" type="application/rss+xml" />`, `<title>Trịnh Quang Dũng (DũngTQ) - Bài viết và Sản phẩm AI</title>`, `<language>vi</language>`, `<lastBuildDate>` theo định dạng RFC 822 UTC.
  - Mỗi `<item>` ánh xạ từ danh sách bài viết `published` (và cân nhắc chèn cập nhật sản phẩm mới nếu muốn, ưu tiên bài viết để giữ độ sạch cho feed blog): `<title>`, `<link>`, `<guid isPermaLink="true">`, `<pubDate>`, `<description>` (escape thực thể XML `&`, `<`, `>`, `"`, `'`), các thẻ `<category>` theo `tags` kèm `<enclosure>` ảnh bìa `/media/${coverKey}` khi có.
- `src/pages/feed.json.ts` (theo chuẩn JSON Feed 1.1):

```json
{
  "version": "https://jsonfeed.org/version/1.1",
  "title": "Trịnh Quang Dũng (DũngTQ) - tqd.me",
  "home_page_url": "https://tqd.me/",
  "feed_url": "https://tqd.me/feed.json",
  "language": "vi-VN",
  "authors": [
    {
      "name": "Trịnh Quang Dũng (DũngTQ)",
      "url": "https://tqd.me/ho-so"
    }
  ],
  "items": [
    {
      "id": "https://tqd.me/bai-viet/slug-bai-viet",
      "url": "https://tqd.me/bai-viet/slug-bai-viet",
      "title": "Tiêu đề bài viết",
      "summary": "Tóm tắt súc tích bài viết.",
      "content_text": "Nội dung Markdown hoặc bản rút gọn an toàn.",
      "image": "https://tqd.me/media/2026/11/cover.webp",
      "date_published": "2026-11-10T08:00:00.000Z",
      "date_modified": "2026-11-12T03:24:00.000Z",
      "tags": ["AI", "Vận hành"],
      "_tqd": {
        "kind": "article",
        "markdown_url": "https://tqd.me/bai-viet/slug-bai-viet.md"
      }
    }
  ]
}
```

**Rủi ro tương thích**

- Bảo đảm mọi URL ảnh `coverKey` đi qua hàm kiểm tra hợp lệ như trong `bai-viet/[slug].astro`, tuyệt đối không lấy chuỗi nhúng thô từ D1 chưa escape đưa vào XML.
- Tuân thủ `scripts/check-no-post-text.mjs`: chỉ phục vụ nội dung công khai đã duyệt xuất bản, tuyệt đối không xuất bảng thống kê hay phiên bản `/xray/[id]` chưa được gắn nhãn `c-*`.

### 3.2. Thiết kế Public Read-Only Catalog `/catalog.json` và giữ tương thích `/search.json`

Hiện trạng `src/pages/search.json.ts` trả về một mảng JSON tối giản chỉ có 5 trường `{ title, url, kind, hint, id? }` cho thanh lệnh `⌘K` (`src/scripts/command-palette.ts`). Để phục vụ cả UI nội bộ lẫn hệ thống agent đọc danh mục từ bên ngoài mà không gây hồi quy cho `⌘K`, tách rạch ròi hai đường dẫn:

- **Giữ nguyên hợp đồng `/search.json`**: Trả về mảng phẳng `Entry[]` để `command-palette.ts` hoạt động ổn định, chỉ bổ sung tối đa trường `tags?: string[]` (optional) nếu muốn mở rộng tìm theo thẻ bên client mà không đổi cấu trúc gốc.
- **Tạo mới `/catalog.json`**: Danh mục máy đọc công khai duy nhất cho toàn bộ tài nguyên công khai của `tqd.me` (đặt tại root `/catalog.json`, nằm ngoài vùng cấm `Disallow: /api/` của `robots.txt` và `isPrivate` của `src/middleware.ts`).

**Danh sách tệp triển khai**

- Tạo `src/lib/catalog.ts` và `src/lib/catalog.test.ts`.
- Tạo `src/pages/catalog.json.ts`.
- Sửa `src/lib/analytics/normalize.ts` (xác nhận đuôi `.json` đã nằm trong quy tắc loại trừ, không tính là HTML view) và `scripts/verify/site.mjs`.

**Schema chuẩn của `/catalog.json`**

```typescript
export type CatalogItemType = 'article' | 'product' | 'video' | 'tool' | 'showcase';

export interface CatalogItem {
  id: string;
  type: CatalogItemType;
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  publishedAt: string | null;
  updatedAt: string | null;
  htmlUrl: string;
  markdownUrl: string | null;
  imageUrl?: string;
  links?: { label: string; url: string }[];
}

export interface PublicCatalog {
  schemaVersion: '1.0';
  site: string;
  contentVersion: number;
  generatedAt: string;
  author: {
    name: string;
    alias: string;
    role: string;
    profileUrl: string;
    zaloUrl: string;
    email: string;
  };
  sections: {
    id: string;
    title: string;
    htmlUrl: string;
    markdownUrl: string;
  }[];
  machineEndpoints: {
    llmsTxt: string;
    wellKnownLlmsTxt: string;
    llmsFullTxt: string;
    agentCard: string;
    rssXml: string;
    feedJson: string;
    sitemapXml: string;
  };
  items: CatalogItem[];
}
```

Cần lưu ý: mọi `links[]` lấy từ D1 phải lọc bỏ `javascript:`/`data:`, chỉ cho phép `https:`/`http:` và khi đưa `/tai-video` vào `items` dưới dạng `type: 'tool'`, gắn `htmlUrl: "https://tqd.me/tai-video"` cùng `markdownUrl: "https://tqd.me/tai-video.md"`. Đặt `Access-Control-Allow-Origin: *` ở chế độ chỉ đọc (`GET`, `HEAD`, `OPTIONS`) để các agent hoặc công cụ nghiên cứu trên trình duyệt khác đọc được `/catalog.json`, `/rss.xml`, `/feed.json` và `/.well-known/agent.json` bình thường, nhưng tuyệt đối không mở CORS cho bất kỳ route nào dưới `/api/` hay `/admin`.

### 3.3. Thiết kế `/.well-known/agent.json` (A2A Agent Card)

`/.well-known/agent.json` công bố danh tính chính thức của tác nhân web `dungtq-web` gắn với **Trịnh Quang Dũng (DũngTQ)**, nêu rõ ranh giới tri thức, giới hạn tốc độ thực tế của các API phía sau, kênh chuyển tiếp con người và đặc tả máy đọc cho bộ công cụ `/tai-video` + Viral Video Lab.

**Các tệp cần bổ sung**

- Tạo `src/lib/agent-card.ts` (đọc trực tiếp hằng số từ `src/lib/chat.ts`, `src/lib/dl.ts`, `src/lib/viral.ts` và danh mục sản phẩm thật từ `loadSiteData(env.DB)` trong `src/lib/content.ts` để danh sách sản phẩm cùng thông số trên Agent Card tự cập nhật theo D1, không viết cứng thủ công).
- Tạo `src/pages/.well-known/agent.json.ts`.
- Tạo `src/lib/agent-card.test.ts`.

**Cấu trúc A2A Agent Card (`/.well-known/agent.json`)**

```json
{
  "schemaVersion": "1.0",
  "name": "DũngTQ Web Agent",
  "description": "Tác nhân đại diện cho Trịnh Quang Dũng (DũngTQ) trên tqd.me, hỗ trợ tra cứu hồ sơ, sản phẩm AI, bài viết và công cụ tải video / phân tích kịch bản.",
  "url": "https://tqd.me",
  "documentationUrl": "https://tqd.me/llms.txt",
  "version": "1.0.0",
  "provider": {
    "organization": "Trịnh Quang Dũng (DũngTQ)",
    "url": "https://tqd.me/ho-so"
  },
  "defaultInputModes": ["text/plain", "application/json"],
  "defaultOutputModes": ["text/markdown", "application/json", "text/event-stream"],
  "capabilities": {
    "streaming": true,
    "pushNotifications": false,
    "stateTransitionHistory": false
  },
  "knowledgeScope": {
    "topics": [
      "Hồ sơ và kinh nghiệm triển khai AI của Trịnh Quang Dũng (DũngTQ)",
      "Hệ sản phẩm và phần mềm sinh động từ D1 qua src/lib/agent-card.ts (hiện có Viết Pro, TQD-Clean Your Mac, TQD KidGuard & TV Launcher, Wizard Chess 3D, Kim Cương (LumiGem), Website Ngự Long Y Quán, Tử Vi Đầu Số Thiên Kỷ, Bảy Tám Chín 3D và /tai-video)",
      "Bài viết hướng dẫn ứng dụng AI vào vận hành doanh nghiệp",
      "Công cụ Tải Video đa nền tảng và Viral Video Lab (/tai-video)"
    ],
    "readSurfaces": {
      "llmsTxt": "https://tqd.me/llms.txt",
      "catalogJson": "https://tqd.me/catalog.json",
      "feedJson": "https://tqd.me/feed.json",
      "rssXml": "https://tqd.me/rss.xml",
      "markdownNegotiation": "Gửi header Accept: text/markdown tới các trang HTML công khai."
    }
  },
  "authentication": {
    "schemes": ["same-origin-browser"],
    "note": "Các điểm đọc công khai không cần khóa; tác vụ /api/chat, /api/dl/* và /api/viral/* yêu cầu same-origin từ trình duyệt trên tqd.me."
  },
  "rateLimits": {
    "chat": {
      "visitorPerHour": 20,
      "ipPerHour": 60,
      "dailySiteCap": 300,
      "maxMessageChars": 1000
    },
    "videoDownloader": {
      "resolveVisitorPerHour": 30,
      "resolveIpPerHour": 60,
      "prepareVisitorPerHour": 15,
      "prepareIpPerHour": 30,
      "dailySiteCap": 150,
      "publicTier": {
        "maxHeight": 1080,
        "maxFilesizeMB": 200,
        "maxBatchItems": 25,
        "allowCookies": false
      }
    },
    "viralVideoLab": {
      "transcribeVisitorPerHour": 8,
      "transcribeIpPerHour": 16,
      "generateVisitorPerHour": 20,
      "generateIpPerHour": 40,
      "shareVisitorPerHour": 15,
      "shareIpPerHour": 30,
      "dailySiteCap": 150,
      "publicMaxDurationSec": 300
    }
  },
  "escalation": {
    "humanHandoffChannel": "Zalo B2B",
    "zaloUrl": "https://zalo.me/trinhquangdung",
    "email": "dungtq.ceo@gmail.com",
    "contactPage": "https://tqd.me/lien-he",
    "whenToEscalate": [
      "Khi nhu cầu tư vấn B2B vượt phạm vi hỏi đáp thông tin công khai",
      "Khi dịch vụ GoClaw (/api/chat/status) trả về online: false hoặc HTTP 503",
      "Khi hết hạn mức trong ngày (HTTP 429)"
    ]
  },
  "skills": [
    {
      "id": "tqd-knowledge-lookup",
      "name": "Tra cứu tri thức và tài nguyên tqd.me",
      "description": "Đọc thông tin sản phẩm AI, bài viết và hồ sơ DũngTQ qua /catalog.json và các bản .md twin.",
      "tags": ["knowledge", "markdown", "catalog"],
      "examples": ["Liệt kê các sản phẩm AI của DũngTQ", "Đọc bài viết mới nhất dưới dạng Markdown"]
    },
    {
      "id": "tai-video-and-viral-lab",
      "name": "Đặc tả công cụ Tải Video và Viral Video Lab",
      "description": "Phân tích liên kết video trên 14 nền tảng qua yt-dlp home daemon, bóc băng lời thoại (subtitles hoặc Whisper) và viết lại kịch bản theo 5 định dạng Viết Pro.",
      "tags": ["video-downloader", "transcript", "viral-script"],
      "toolUrl": "https://tqd.me/tai-video",
      "markdownSpecUrl": "https://tqd.me/tai-video.md",
      "formats": ["tiktok-script", "fb-story", "threads-chain", "youtube-outline", "linkedin-expert"],
      "actions": ["xray", "rewrite", "polish"],
      "webOnlyExecution": true
    }
  ]
}
```

**Rủi ro bảo mật và kiểm soát theo `REVIEW.md`**

- Tuyệt đối không đưa bất kỳ secret, token, IP máy chủ nhà (`GOCLAW_BASE_URL`, `DL_BASE_URL`) hay quyền `admin` vào Agent Card; trường `rateLimits.videoDownloader` chỉ công bố mức `publicTier`, không liệt kê thông số hay đường dẫn vượt rào của `admin`.
- Đánh dấu rõ `webOnlyExecution: true` cho cụm API tương tác để tác nhân bên ngoài không spam trực tiếp vào `/api/chat` hoặc `/api/dl/resolve` (vốn đã khóa `sameOrigin()` trả về `403 forbidden`), mà biết chuyển hướng sang `/catalog.json`, `.md` twins hoặc kênh Zalo B2B.

---

## 4. Giai đoạn 3 - Lớp In-Browser WebMCP và Ergonomics cho Browser/GUI Agents (1-2 tuần)

Giai đoạn ba biến `tqd.me` thành trang web có thể hợp tác trực tiếp với tác nhân trình duyệt qua WebMCP (kênh có cấu trúc, tiết kiệm token hơn chụp ảnh màn hình), đồng thời khắc phục các điểm nghẽn DOM, CPU và Accessibility cho Playwright hoặc Computer-Use Agents.

### 4.1. Thiết kế module `src/scripts/webmcp.ts` và tích hợp CSP an toàn

Theo quy định nghiêm ngặt trong `REVIEW.md`, toàn bộ JavaScript phía client phải đóng gói thành module TypeScript trong `src/scripts/*.ts` để Astro/Vite xuất file tĩnh phục vụ cho `script-src 'self'`. Không dùng `<script is:inline>`, không viết handler nội tuyến.

**Tệp mã nguồn liên quan**

- Tạo `src/lib/webmcp-tools.ts` (chứa hằng số schema, hàm kiểm tra an toàn đường dẫn, hàm cắt ngưỡng ký tự `<= 1500` và dựng payload thuần để unit test độc lập bằng Vitest).
- Tạo `src/scripts/webmcp.ts` (entry trình duyệt thực hiện feature detection, đăng ký `ModelContext`, quản lý `AbortController`, tương tác DOM trên `/` desktop và `/tai-video`).
- Tạo `src/lib/webmcp-tools.test.ts`.
- Sửa `src/layouts/BaseLayout.astro` (thêm `<script>import '../scripts/webmcp';</script>`).
- Kiểm tra `src/middleware.ts`: xác nhận `Origin-Agent-Cluster` không bị ép về `?0` (mã nguồn không sử dụng `document.domain`), giữ `PERMISSIONS_POLICY` hiện tại và chỉ thêm `tools=(self)` khi trình duyệt đích hỗ trợ ổn định mà không cảnh báo console.

**Cơ chế phát hiện tính năng và vòng đời đăng ký**

```typescript
// Trích đoạn kiến trúc src/scripts/webmcp.ts
type ModelContextHandle = {
  registerTool: (tool: WebMcpToolDefinition, opts?: { signal?: AbortSignal }) => void;
};

function getModelContext(): ModelContextHandle | null {
  // Tuân thủ chuẩn W3C WebMCP: chỉ kiểm tra document.modelContext (không phát tên API cũ đã deprecated từ Chromium 150).
  const docCtx = (document as Document & { modelContext?: ModelContextHandle }).modelContext;
  if (docCtx && typeof docCtx.registerTool === 'function') return docCtx;
  return null;
}
```

**Danh sách 5-6 công cụ WebMCP gọn nhẹ và ngân sách ký tự Chrome**

Để không làm tràn ngân sách context của trình duyệt AI, mỗi trang chỉ duy trì 4 công cụ nền tảng và tối đa 1-2 công cụ theo ngữ cảnh tuyến đường (tổng công cụ hoạt động cùng lúc tối đa 5 công cụ). Theo đặc tả W3C WebMCP (`ak-webmcp`), `ToolAnnotations` chỉ dùng đúng ba cờ `readOnlyHint`, `untrustedContentHint` và `consequentialHint`.

| Tên công cụ (`<=30` ký tự) | Độ dài tên | Phạm vi đăng ký | Mục đích & Giới hạn đầu vào | Annotations (`ToolAnnotations`) | Ngân sách đầu ra (`<=1500` ký tự) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| `search_tqd_knowledge` | 20 | Mọi trang công khai | Tìm không dấu qua `/catalog.json` (cache phiên + lọc `type`: `all\|article\|product\|video\|tool`, `limit` 1-5). | `readOnlyHint: true`, `untrustedContentHint: false`, `consequentialHint: false` | Tối đa 5 mục gồm `title`, `type`, `summary` rút gọn, `htmlUrl`, `markdownUrl`. |
| `read_markdown_page` | 18 | Trang công khai (toàn site) | Fetch bản `.md` twin theo danh sách trắng đường dẫn nội bộ trên `tqd.me`; từ chối `/admin`, `/api/`, URL ngoài origin và `/xray/` bản khách; gắn `untrustedContentHint: true` vì còn mở cho curated `/xray/c-*` chứa metadata video bên thứ ba (nếu muốn tách hoàn toàn khỏi nội dung bên thứ ba thì loại `/xray/` khỏi allowlist). | `readOnlyHint: true`, `untrustedContentHint: true`, `consequentialHint: false` | Trả về từng đoạn `<= 1400` ký tự qua tham số `offset` kèm `nextOffset` và `truncated`. |
| `list_ai_products` | 16 | Toàn hệ thống trang công khai | Liệt kê danh mục sản phẩm AI của DũngTQ từ `/catalog.json`, hỗ trợ lọc theo `tag` (`<= 40` ký tự). | `readOnlyHint: true`, `untrustedContentHint: false`, `consequentialHint: false` | Tối đa 8 sản phẩm kèm tên, tags, tóm tắt 1 dòng và link. |
| `get_contact_info` | 16 | Mọi trang không phải `/admin` | Trả về thông tin liên hệ chính chủ Trịnh Quang Dũng (DũngTQ), link Zalo B2B, email và `/lien-he`. | `readOnlyHint: true`, `untrustedContentHint: false`, `consequentialHint: false` | JSON/text cố định dưới 450 ký tự. |
| `open_desktop_section` | 20 | Chỉ trên `/` khi `min-width: 1024px` | Mở và đưa cửa sổ `[data-window="<section>"]` lên trước; tự hủy qua `AbortController` nếu thu màn hình dưới `1024px`. | `readOnlyHint: false`, `untrustedContentHint: false`, `consequentialHint: false` | Trạng thái cửa sổ đã mở (`window`, `visible`, `fallbackUrl`). |
| `prefill_tai_video` | 17 | Chỉ trên `/tai-video` | Kiểm tra hợp lệ link `https://`, điền `#dl-input` hoặc chuyển tab `dl`/`viral` kèm mã `format`; không tự gửi API tốn quota. | `readOnlyHint: false`, `untrustedContentHint: false`, `consequentialHint: false` | Trạng thái biểu mẫu và danh sách bước tiếp theo để người dùng bấm. |

**Mẫu định nghĩa một tool chuẩn khớp `validate_webmcp.mjs --strict`**

```typescript
const SAFE_PATH_RE = /^\/(?:|index\.md|(?:ho-so|san-pham|thu-vien|video-ai|bai-viet|lien-he|tai-video|quyen-rieng-tu)(?:\.md)?|bai-viet\/[a-z0-9-]+(?:\.md)?|xray\/c-[a-f0-9]{12,24}(?:\.md)?)$/;

const READ_MARKDOWN_TOOL = {
  name: 'read_markdown_page',
  description: 'Read a public tqd.me page as structured Markdown from the local origin allowlist in 1400-character chunks.',
  annotations: {
    readOnlyHint: true,
    untrustedContentHint: true,
    consequentialHint: false,
  },
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: {
        type: 'string',
        description: 'Public path on tqd.me such as /, /san-pham, or /bai-viet/slug.',
      },
      offset: {
        type: 'integer',
        minimum: 0,
        description: 'Zero-based character offset for reading long documents in chunks.',
      },
    },
    required: ['path'],
  },
  async execute(input: { path?: unknown; offset?: unknown }) {
    try {
      const rawPath = typeof input?.path === 'string' ? input.path.trim() : '';
      const cleanPath = rawPath.split('#')[0].split('?')[0];
      if (!SAFE_PATH_RE.test(cleanPath)) {
        return JSON.stringify({ ok: false, error: 'Đường dẫn không nằm trong danh sách trang công khai cho phép.' });
      }
      const mdPath = cleanPath === '/' ? '/index.md' : cleanPath.endsWith('.md') ? cleanPath : `${cleanPath}.md`;
      const res = await fetch(`${location.origin}${mdPath}`, { credentials: 'omit' });
      if (!res.ok) return JSON.stringify({ ok: false, error: `HTTP ${res.status}` });
      const text = await res.text();
      const offset = typeof input?.offset === 'number' && input.offset >= 0 ? Math.floor(input.offset) : 0;
      const chunk = text.slice(offset, offset + 1200);
      const truncated = offset + 1200 < text.length;
      return JSON.stringify({
        ok: true,
        sourcePath: mdPath,
        untrustedContent: cleanPath.startsWith('/xray/'),
        content: chunk,
        nextOffset: truncated ? offset + 1200 : null,
      });
    } catch {
      return JSON.stringify({ ok: false, error: 'Không thể đọc bản Markdown lúc này.' });
    }
  },
};
```

**Biện pháp chống Indirect Prompt Injection và rò rỉ dữ liệu**

1. `SAFE_PATH_RE` trên `read_markdown_page` chỉ cho phép tuyến nội dung của chính chủ DũngTQ và các bản curated `/xray/c-*`, chặn hoàn toàn `/xray/<non-curated>` (nơi chứa nội dung video từ bên thứ ba do khách tự bóc băng), `/admin`, `/api/` và mọi chuỗi có thể ép mở cross-origin SSRF.
2. Mọi lệnh `fetch` bên trong tool dùng `credentials: 'omit'` để tuyệt đối không gửi kèm cookie phiên đăng nhập `admin` dù quản trị viên đang dùng chung trình duyệt.
3. Kết quả từ bài viết hoặc `/xray/c-*` luôn được bọc trong JSON dạng dữ liệu (`{ ok, content }`), lọc bỏ ký tự điều khiển ẩn và không bao giờ dùng để nối thẳng vào hàm thực thi hành động nhạy cảm.
4. Hàm `execute` luôn có khối `try/catch`, luôn trả về chuỗi JSON hợp lệ ngắn hơn `1500` ký tự, không bao giờ ném ngoại lệ hoặc trả về `undefined`. Nếu sau này bổ sung công cụ tự động gọi `/api/dl/resolve` hoặc `/api/chat`, bắt buộc đặt `consequentialHint: true` và yêu cầu hộp thoại xác nhận phía trình duyệt trước khi tiêu tốn quota D1.

### 4.2. Kiểm toán và cải thiện Ergonomics cho Playwright và Computer-Use GUI Agents

Qua rà soát mã nguồn `DesktopShell.astro`, `desktop.ts`, `wallpaper.ts`, `featured-video.ts`, `mascot.ts`, `weather.ts`, `tai-video.astro`, `tai-video.ts`, `ChatPanel.astro` và `chat-panel.ts`, phát hiện bốn nhóm cản trở trực tiếp tác nhân GUI:

**Nhóm 1 - Cửa sổ chồng lấp, thứ tự `z-index` và deep-link trên `/` Desktop**

- **Hiện trạng verified**: `BOOT_WINDOWS = ['ho-so', 'san-pham', 'bai-viet']` trong `src/scripts/desktop.ts` mở sẵn 3 cửa sổ cùng lúc trên màn hình rộng (`>= 1264px` trong desktop container), gây chồng chéo vùng hiển thị với tác nhân thị giác. Giá trị `zTop` của cửa sổ bắt đầu từ `10`, trong khi thanh menu và dock giữ `z-index: 1000` còn linh vật (`Mascot.astro`) giữ `z-index: 950`, dễ che góc cửa sổ nếu không kéo ra chỗ khác. Mặt khác, truy cập trực tiếp `/san-pham` sẽ mở trang đơn `[section].astro` chứ không mở Desktop Shell `/`.
- **Tệp cần sửa**: `src/components/DesktopShell.astro`, `src/scripts/desktop.ts`.
- **Thiết kế khắc phục**:
  - Hỗ trợ query `/?window=<section>` (ví dụ `/?window=san-pham`) và `/?layout=focus` trên Desktop Shell: khi phát hiện tham số `window` hoặc `navigator.webdriver === true` ở chế độ tự động (nếu không truyền cờ giữ nguyên), ưu tiên mở 1 cửa sổ mục tiêu thay vì xếp chồng 3 cửa sổ, tránh che khuất vùng click.
  - Chuẩn hóa tương quan lớp: đặt giới hạn tối đa cho `zTop` hợp lý dưới Menubar/Dock (`< 900` hoặc đặt Mascot ở `z-index: 20` và đẩy xuống dưới cửa sổ đang active khi `window` được focus) để cửa sổ đang thao tác luôn nằm trên linh vật.
  - Bổ sung `aria-label` rõ ràng cho ba nút `.desktop-light` (Ví dụ `Đóng cửa sổ Hồ sơ`, `Thu nhỏ cửa sổ Hồ sơ`, `Phóng to cửa sổ Hồ sơ`). Giữ đúng quy tắc `REVIEW.md`: **tuyệt đối không** thêm `role="dialog" aria-modal="true"` vào `.desktop-window` vì chúng không khóa focus kiểu modal.

**Nhóm 2 - Tải CPU liên tục từ `silk-wallpaper.mp4`, canvas thời tiết và linh vật**

- **Hiện trạng verified**: `wallpaper.ts` (`silk-wallpaper.mp4`), `featured-video.ts`, `mascot.ts` và `weather.ts` (vẽ `requestAnimationFrame` lên tới 180 hạt mưa/tuyết) hiện kiểm tra `reducedMotion()` (và `wallpaper.ts`/`featured-video.ts` kiểm tra thêm `saveData()`), nhưng **chưa kiểm tra `navigator.webdriver`** hay query `?reduced=1`. Trên VM chạy Playwright/Computer-Use (vốn không có GPU cứng), phát video nền 4K/HD + vòng lặp canvas liên tục chiếm CPU rất cao và làm ảnh chụp màn hình biến động giữa hai bước suy luận.
- **Tệp cần sửa**: `src/scripts/motion.ts`, `src/scripts/wallpaper.ts`, `src/scripts/featured-video.ts`, `src/scripts/weather.ts`, `src/scripts/mascot.ts`.
- **Thiết kế khắc phục**:
  - Mở rộng `reducedMotion()` trong `src/scripts/motion.ts` (hoặc tạo helper riêng `lowPowerMotion()` dùng chung cho hiệu ứng nền, giữ nguyên `reducedMotion()` thuần `matchMedia` nếu animation click nhỏ vẫn cần chạy nhanh): trả về `true` khi `navigator.webdriver === true`, hoặc `new URLSearchParams(location.search).get('reduced') === '1'`, hoặc `prefers-reduced-motion: reduce`.
  - Áp dụng `lowPowerMotion()` để dừng phát tự động `silk-wallpaper.mp4`, dừng canvas mưa tuyết của `weather.ts` và đặt `mascot.ts` ở trạng thái nghỉ đứng yên (vẫn cho phép người dùng tự bật lại trong `EffectsMenu.astro` khi cần thử nghiệm).

**Nhóm 3 - Hạn chế Accessibility và vùng cập nhật trên `/tai-video`**

- **Hiện trạng verified**: Trong `src/pages/tai-video.astro`, `#dl-input-batch` (textarea nhập nhiều link) chưa có `<label for="dl-input-batch">` rõ ràng; `#dl-progress-bar` là thẻ `<div>` thuần chưa có `role="progressbar"` và `aria-valuenow`/`aria-valuemin`/`aria-valuemax`; các vùng trạng thái `#dl-batch-count`, `#dl-progress-status`, `#viral-xray-status`, `#viral-gen-status` chưa gắn `aria-live="polite"`. Đồng thời, deep-link mới chỉ đọc `?url=...&tab=viral` (`src/scripts/tai-video.ts`).
- **Tệp cần sửa**: `src/pages/tai-video.astro`, `src/scripts/tai-video.ts`, `src/scripts/viral-lab.ts`.
- **Thiết kế khắc phục**:
  - Gắn `<label for="dl-input-batch">` (chỉ chữ tiếng Việt chuẩn `Be Vietnam Pro`, không emoji) và cập nhật `role="progressbar"`, `aria-valuemin="0"`, `aria-valuemax="100"`, `aria-valuenow` mỗi khi tiến trình tải đổi phần trăm.
  - Gắn `aria-live="polite"` + `aria-atomic="true"` cho 4 phần tử trạng thái trên để Playwright (`getByRole('status')`) hoặc screen reader bắt được thời điểm Whisper/LLM hoàn tất.
  - Mở rộng query parser trong `tai-video.ts` và `viral-lab.ts` nhận thêm `?format=<ViralFormatKey>` (đối chiếu tập giá trị hợp lệ của `VIRAL_FORMATS`) và `?mode=batch`, chỉ thiết lập trạng thái UI mà không tự động bấm nút gửi.

**Nhóm 4 - Sửa lỗi `aria-hidden="true"` trong lúc stream của `ChatPanel`**

- **Hiện trạng verified**: Tại `src/scripts/chat-panel.ts` (dòng 267-321), bong bóng `pending` được tạo với `pending.setAttribute('aria-hidden', 'true')`, sau đó `renderReply(pending, latest)` liên tục đổ chữ SSE vào thẻ này ở dòng 310 cho tới khi dòng 320-321 gọi `pending.remove()` rồi `add(...)` để thay bằng bong bóng phản hồi chính thức. Trong suốt 5-20 giây chờ câu trả lời dài trước lúc `pending.remove()`, cây Accessibility và các bộ đọc DOM không thể đọc được nội dung đang stream.
- **Tệp cần sửa**: `src/components/ChatPanel.astro`, `src/scripts/chat-panel.ts`.
- **Thiết kế khắc phục**:
  - Không đặt `aria-hidden="true"` lên `pending` khi văn bản phản hồi đã bắt đầu stream (hoặc gỡ `aria-hidden` ngay ở token đầu tiên và gắn `aria-busy="true"` cho tới khi `add(...)` thay thế bong bóng hoàn chỉnh).
  - Thêm thẻ thông báo trạng thái `role="status" aria-live="polite"` riêng trong `ChatPanel.astro` để công bố các mốc gọn nhẹ ("Agent đang trả lời...", "Đã trả lời xong", hoặc thông báo ngoại tuyến kèm link Zalo) tránh spam trình đọc màn hình ở mỗi chunk token.
  - Bổ sung `aria-expanded` và `aria-controls="chat-panel"` đồng bộ trạng thái đóng/mở trên nút kích hoạt chat.

---

## 5. Ma trận rủi ro tương thích `REVIEW.md` - `DESIGN.md` và Lệnh kiểm chứng nghiệm thu

| Hạng mục AX | Rủi ro đối chiếu `REVIEW.md` và `DESIGN.md` | Biện pháp khóa rủi ro |
| :--- | :--- | :--- |
| YAML frontmatter `.md` twins và `/llms-full.txt` | D1 có thể chứa ký tự đặc biệt làm gãy YAML; `/llms-full.txt` làm nặng Worker nếu ghép chuỗi lớn. | Dùng `JSON.stringify()` cho mọi giá trị scalar YAML; giới hạn số bài xuất full text trong `/llms-full.txt` (12 bài gần nhất hoặc trần 120.000 ký tự). |
| HTTP `Link` headers và `/.well-known/*` | Có thể lọt lên `/admin` hoặc gắn nhầm `type="text/markdown"` vào trang 404 làm gãy `site.mjs`; lỗi cache lẫn HTML/Markdown. | Chỉ gắn `Link` khi `!isPrivate`; kiểm tra `mdTwin !== null`; giữ `prefersMarkdown()` trước Edge Cache `caches.open('pages')`. |
| JSON-LD nâng cao | Rò `@id: '#person'` treo ở trang con làm gãy `site.mjs`; vi phạm quy tắc cấm `FAQPage`/`HowTo`. | Bắt buộc có node `#person` trên mọi trang nếu `WebSite` trỏ về `#person`; tuyệt đối không thêm `FAQPage`/`HowTo`. |
| `/rss.xml`, `/feed.json`, `/catalog.json`, `/.well-known/agent.json` | Rơi vào `Disallow: /api/` hoặc làm gãy tìm kiếm `⌘K` nếu sửa `/search.json`; lộ cấu hình server nhà. | Đặt mọi bề mặt công khai ngoài `/api/`; giữ nguyên cấu trúc mảng của `/search.json`; Agent Card chỉ xuất hạn mức công khai, không lộ URL nội bộ. |
| `src/scripts/webmcp.ts` | Vi phạm CSP `script-src 'self'`; tràn giới hạn Chrome hoặc dính Indirect Prompt Injection từ `/xray/[id]`. | Import qua Astro Vite từ `BaseLayout.astro`, 0 inline script; dùng `SAFE_PATH_RE` chặn `/xray/` bản khách; dùng `credentials: 'omit'`; không throw trong `execute`. |
| Cải thiện GUI (`DesktopShell`, `/tai-video`, `ChatPanel`) | Vô tình dùng `#b8935a` làm chữ/focus, thêm emoji UI, hoặc gắn `role="dialog"` lên `.desktop-window`. | Giữ nguyên token `#8a6420`/`#5e4413` và `<Icon />` SVG; không gắn `role="dialog"` lên `.desktop-window`; mọi nút chạm mobile giữ tối thiểu `44x44px`. |

### Bộ lệnh kiểm chứng nghiệm thu sau triển khai

Chạy tuần tự từng nhóm lệnh sau tại thư mục `/Volumes/2/TQD-Website` sau mỗi giai đoạn cài đặt mã nguồn:

```bash
# 1. Kiểm tra kiểu TypeScript 6, Astro, bài kiểm thử đơn vị và rà soát quyền riêng tư trước khi build
npx astro check
npm test
npm run check:privacy
npm run build
```

```bash
# 2. Kiểm tra Giai đoạn 1 và Giai đoạn 2 trên bản xem trước hoặc production
# (thay BASE bằng http://localhost:4321 khi chạy dev/preview)
BASE="http://localhost:4321"
node scripts/verify/site.mjs "$BASE"

# Xác nhận HTTP Link headers trên cả HEAD lẫn GET, tách cache HTML và text/markdown
curl -sI "$BASE/" | grep -iE '^(http|link|vary|x-robots-tag|content-type):'
curl -sD - -o /dev/null -H "Accept: text/markdown" "$BASE/san-pham" | grep -iE '^(http|link|vary|x-robots-tag|content-type):'

# Xác nhận bề mặt khám phá mới trả về 200 và không bị Disallow bởi robots.txt
curl -sf "$BASE/.well-known/llms.txt" | head -n 20
curl -sf "$BASE/.well-known/agent.json" | jq '{name, capabilities, escalation, skills: [.skills[].id]}'
curl -sf "$BASE/catalog.json" | jq '{schemaVersion, count: (.items | length), machineEndpoints}'
curl -sf "$BASE/feed.json" | jq '{version, count: (.items | length)}'
curl -sfI "$BASE/rss.xml" | grep -iE '^(http|content-type):'
curl -sf "$BASE/search.json" | jq 'type, length'
```

```bash
# 3. Kiểm tra Giai đoạn 3 (WebMCP static validator và quy tắc CSP / GUI A11y)
node /Users/tqd/.gemini/config/skills/ak-webmcp/scripts/validate_webmcp.mjs src/scripts/webmcp.ts --strict
node /Users/tqd/.gemini/config/skills/ak-webmcp/scripts/validate_webmcp.mjs src/lib/webmcp-tools.ts --strict

# Kiểm tra CSP không sinh vi phạm inline script mới và bảng /xray/[id] giữ đúng quy tắc noindex
curl -sI "$BASE/" | grep -i 'content-security-policy'
```

Ngoài các lệnh trên, khi triển khai Giai đoạn 3 cần bổ sung bài test Playwright tự động xác nhận ba điều kiện nghiệm thu gồm không phát sinh `console.error` hay lỗi CSP trên `/` và `/tai-video`, `navigator.webdriver === true` giữ `silk-wallpaper.mp4` ở trạng thái paused và canvas thời tiết không chạy khung hình, đồng thời cây Accessibility của `ChatPanel` đọc được nội dung ngay trong lúc đang stream SSE.
