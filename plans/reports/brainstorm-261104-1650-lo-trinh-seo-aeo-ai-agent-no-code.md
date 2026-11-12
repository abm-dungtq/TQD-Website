# Brainstorm: lộ trình bài viết giải thích AI & AI Agent cho người no-code (SEO + AEO)

Ngày 04/11/2026. Chế độ `--advice`, có `kongming` thẩm định.

## Bằng chứng hiện trạng trên `tqd.me`

- **11 bài đã đăng trong D1 (`tqd_db`):**
  - *Nhóm quyết định & chi phí cho CEO/SME (4 bài):* `chon-cong-cu-ai-theo-dau-viec-cho-ceo`, `chatgpt-chat-work-codex-cho-ceo-doanh-nghiep-nho`, `claude-design-cho-chu-doanh-nghiep-nho`, `chi-phi-ai-theo-tung-nhan-vien-cho-doanh-nghiep-nho`.
  - *Nhóm hạ tầng cho người mới dùng Agent / Vibe Code (2 bài):* `github-co-ban-cho-nguoi-moi-dung-agent-ai`, `cloudflare-cho-nguoi-moi-vibe-code`.
  - *Nhóm cập nhật thị trường & gói cước (2 bài):* `claude-doi-ten-goi-max-thanh-max-va-ultra`, `ban-tin-ai-agent-nua-cuoi-thang-10-2026`.
  - *Nhóm sản phẩm & skill tự xây (3 bài):* `viet-pro-skill-viet-tieng-viet-cho-ai`, `opus-video-skill-lam-video-tieng-viet`, `tqd-clean-your-mac-don-dep-macos-tieng-viet`.
- **Khoảng trống nội dung:** 11 bài hiện tại nhắc liên tục tới các khái niệm cốt lõi (`AI Agent`, `Token`, `Context Window`, `Prompt vs Skill`, `MCP`, `API`, `RAG / Ảo giác AI`, `Vibe Code`, `Computer Use`, `Multi-Agent`, `.env`), nhưng chưa có các bài giải thích nền tảng để neo liên kết nội bộ (internal links) cho người đọc không biết lập trình.
- **Hạ tầng kỹ thuật SEO/AEO sẵn có:** Site đã có `/llms.txt`, `/index.md`, `/{section}.md`, `/bai-viet/{slug}.md`, `<link rel="alternate" type="text/markdown">`, `/sitemap.xml` và JSON-LD (`WebSite`, `WebPage`, `Person`, `Article`).
- **3 điểm hổng kỹ thuật nhỏ về AEO/SEO trong mã nguồn:**
  1. `src/lib/profile-markdown.ts:64` (`llmsText`): danh sách bài viết trong `/llms.txt` chỉ in tiêu đề + link `.md`, chưa kèm `a.summary` như ở `/bai-viet.md`.
  2. `src/layouts/BaseLayout.astro:24`: `og:image` đang gắn cứng `/og.png` thay vì lấy `article.coverKey` của từng bài viết.
  3. `src/pages/bai-viet/[slug].astro:35`: thẻ `<img class="article-cover">` đang để `alt=""` thay vì `alt={article.title}`.

## Contract

- **Outcome:** Xây dựng hệ thống bài viết trụ cột và cụm chủ đề (Pillar & Cluster) trên `tqd.me` giúp người không biết lập trình (chủ doanh nghiệp nhỏ, quản lý, nhân sự văn phòng) hiểu trọn vẹn các khái niệm AI & AI Agent bằng ngôn ngữ đời thường, đồng thời tối ưu SEO truyền thống và AEO (Answer Engine Optimization cho ChatGPT Search, Perplexity, Google AI Overviews, Claude).
- **Constraints:**
  - Tuân thủ tuyệt đối chuẩn biên tập và cổng kiểm định tất định của `viet-pro v5.8.0` (`lint-vietnamese-content.mjs --route-hint` đạt 0 lỗi, `check-platform.mjs blog-seo` đạt PASS).
  - Không trùng lặp văn bản bài Facebook (`fbOverlap: false`), giữ ngôi xưng `mình` - `bạn`, bảng màu minh họa `#faf7f1` / `#1b2030` / `#8a6420`.
  - Không viết các bài hướng dẫn bấm nút phụ thuộc giao diện tạm thời dễ lỗi thời sau vài tuần; tập trung vào mô hình tư duy ("Brain first - AI second") và quyết định vận hành.
- **Non-goals:**
  - Không viết tài liệu kỹ thuật sâu cho kỹ sư học máy (như toán học Transformer, huấn luyện mô hình từ đầu, tối ưu CUDA).
  - Không đẻ hàng chục bài định nghĩa ngắn 300-400 chữ kiểu từ điển mỏng (thin content).
- **Acceptance criteria:**
  - Bộ lộ trình gồm **1 bài Hub tổng quan + 4 Chặng (12 bài chuyên đề) = 13 bài mới**, kết nối hai chiều với **11 bài đã có** thành mạng lưới 24 bài hoàn chỉnh.
  - Mỗi bài mới tuân thủ cấu trúc 6 phần chuẩn AEO + `viet-pro` (Mở bài định nghĩa trực diện 40-60 từ, Ẩn dụ văn phòng/đời sống, Bảng đối chiếu Markdown, Ví dụ thực tế tại doanh nghiệp nhỏ kèm internal link, Quy tắc ngón tay cái, Bộ ảnh minh họa 16:9 theo từng mục).
  - 100% khái niệm cốt lõi xuất hiện trong 11 bài cũ được cập nhật liên kết nội bộ trỏ về bài giải thích tương ứng.

## Trade-offs

- **Phương án 1 (Chọn — Pillar & Cluster 1 Hub + 12 bài theo 4 chặng hành trình người dùng no-code):**
  - *Giả định cốt lõi:* Người đọc no-code và các công cụ trả lời AI (Answer Engines) ưu tiên các bài giải thích gắn liền với cặp khái niệm đối xứng (`Chatbot vs Agent`, `Prompt vs Skill`, `MCP vs API`, `Ảo giác vs RAG`) và nối trực tiếp vào quyết định chi phí/công cụ.
  - *Điều kiện thất bại đầu tiên:* Nếu ngắt quãng giữa chừng mà chưa có bài Hub định hướng, hoặc sa vào thuật ngữ kỹ thuật dịch sát tiếng Anh. Khắc phục bằng cách xuất bản **Bài Hub + Đợt 1 (3 bài nền tảng)** trước tiên.
- **Phương án 2 (Loại — 30+ bài từ điển A-Z ngắn 400 chữ mỗi thuật ngữ):**
  - *Giả định cốt lõi:* Google và AI Search vẫn ưu tiên các trang định nghĩa ngắn tách lẻ từng từ khóa.
  - *Điều kiện thất bại đầu tiên:* Bị Google AI Overviews trả lời trực tiếp trên trang kết quả (0 lượt bấm) và làm loãng trang `/bai-viet` cũng như `/llms.txt` bằng nội dung mỏng.
- **Phương án 3 (Loại — 15 bài hướng dẫn bấm nút từng công cụ cụ thể):**
  - *Giả định cốt lõi:* Người đọc chỉ cần bắt chước thao tác bấm chuột trên giao diện.
  - *Điều kiện thất bại đầu tiên:* Giao diện các hãng AI thay đổi sau mỗi 6-8 tuần làm hỏng ảnh chụp màn hình và thu hút nhóm tìm mẹo miễn phí thay vì khách hàng doanh nghiệp cần tư vấn/đào tạo của ABM.

## Better approaches

- **Xuất bản bài Hub (`/bai-viet/tu-dien-ai-agent-cho-nguoi-khong-biet-lap-trinh`) ngay đầu Đợt 1 thay vì đợi viết xong 12 bài:** Bài Hub đóng vai trò bản đồ toàn cảnh, giải thích ngắn gọn từng khái niệm trong 2-3 câu và trỏ ngay về **11 bài sẵn có**. Khi từng bài trong 12 bài mới lên sóng, chỉ cần gắn thêm liên kết sâu từ bài Hub và cập nhật lại `CAPABILITIES.md` của chatbot GoClaw.
- **Nâng cấp 3 điểm nhỏ trong mã nguồn (`profile-markdown.ts`, `BaseLayout.astro`, `[slug].astro`):** Chỉ tốn vài dòng code nhưng giúp `/llms.txt` có tóm tắt ngữ nghĩa cho mọi bài viết và giúp mỗi bài viết khi chia sẻ lên mạng xã hội hiển thị đúng ảnh bìa riêng (`coverKey`).
