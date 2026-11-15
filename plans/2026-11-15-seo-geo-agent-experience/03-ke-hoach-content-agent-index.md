# Kế hoạch Content Chuẩn Agent-Index cho tqd.me

> Phạm vi dự án: `https://tqd.me` (`/Volumes/2/TQD-Website`) · Chủ sở hữu thương hiệu: Trịnh Quang Dũng (DũngTQ) · CTA B2B chính: `https://zalo.me/trinhquangdung` · Ngày kiểm kê live: 15/11/2026 (`x-content-version: 105`).

Kế hoạch này định chuẩn toàn bộ kiến trúc nội dung, định dạng trích dẫn cho AI (GEO/RAG) và lộ trình xuất bản 8 tuần trên `tqd.me`. Mọi số liệu hiện trạng bên dưới được đối chiếu trực tiếp từ phản hồi HTTP thực tế trên `https://tqd.me` (`/llms.txt`, `/llms-full.txt`, `/sitemap.xml`, `/search.json`, các tệp `.md` song sinh và mã nguồn trong `src/`) kết hợp hàng đợi `plans/seo-aeo-queue.json`.

---

## Phần 1 - Kiểm kê hiện trạng nội dung live và điểm nghẽn index của Agent

### 1.1 Bảng kiểm kê đối chiếu thực tế live trên tqd.me so với kế hoạch

Tính đến ngày 15/11/2026, kho nội dung trên Cloudflare D1 (`tqd_db`) đang chạy thực tế như sau:

| Thực thể nội dung | Tuyến live (HTML / `.md`) | Số lượng đang live | Đối chiếu với kế hoạch `plans/seo-aeo-queue.json` & tài liệu cũ | Khoảng trống cần xử lý |
|---|---|---|---|---|
| Bài viết chuyên sâu | `/bai-viet/[slug]` | **19 bài** | Đã xuất bản **2/13 bài** trong hàng đợi (bài Hub `tu-dien-ai-agent-cho-nguoi-khong-biet-lap-trinh` và bài `1.1` `ai-agent-khac-gi-chatbot`). Còn **11/13 bài** chưa viết (mã `1.2` đến `4.3`). Có **10 bài nền tảng** từ tháng 10 đến 04/11 và **7 bài mới** đăng ngày 11-13/11 (6 bài showcase sản phẩm + 1 bài tin NVIDIA). | Bài `opus-video-skill-lam-video-tieng-viet` đã bị xóa ngày 11/11 theo `plans/261111-showcase-san-pham/upsert-products.sql:10`, nhưng `plans/seo-aeo-queue.json` và `/ho-so.md` vẫn còn nhắc tên. |
| Sản phẩm & Skill | `/san-pham` và `/san-pham.md` | **8 mục D1** + 1 thẻ `/tai-video` hardcode | 6 mục là sản phẩm/game mới (11-12/11), 2 mục công cụ cũ (`Viết Pro`, `TQD-Clean Your Mac`). Thẻ `/tai-video` chỉ có trên HTML (`src/components/SectionBody.astro:116-133`), vắng mặt trong `/san-pham.md`. | `Viết Pro` và `TQD-Clean Your Mac` thiếu `coverKey`; chưa có mục dịch vụ tư vấn triển khai AI Agent cho SME; mô tả mới chỉ 35-55 từ dạng giới thiệu tính năng. |
| Video AI | `/video-ai` và `/video-ai.md` | **7 video TikTok** | 4 video ứng dụng AI (10-14/10/2026) và 3 video nhạc AI (10/2025). Lưu ý tuyến `/video` và `/video.md` trả **HTTP 404**. | Chỉ nhúng iframe TikTok, mô tả 5-24 từ, 0 transcript, 0 luận điểm chính, 0 link về bài viết liên quan, thiếu schema `VideoObject`. |
| Thư viện thực địa | `/thu-vien` và `/thu-vien.md` | **4 mục** (1 video, 3 ảnh) | 1 video đào tạo Agribank `.mp4`, 2 ảnh lớp Agribank (15-16/06/2026) và 1 ảnh buổi làm việc tại Vina2. | `/thu-vien.md` chỉ là 4 dòng link thô; thiếu transcript video Agribank, thiếu tư liệu của BSR, ABIC, Hanoitourist dù `/ho-so` có nhắc tên. |
| Xưởng phân tích viral | `/tai-video` và `/xray/c-*` | **0 trang `/xray/c-*`** trong `sitemap.xml` | Hạ tầng đã sẵn sàng (`src/lib/viral.ts`, `src/pages/xray/[id].astro`), nhưng chưa có case study tuyển chọn (`c-*`) nào được tạo và gắn link công khai. | Rủi ro mất dữ liệu vĩnh viễn: `cleanupViralCache` (`src/lib/viral.ts:708`) chạy cron hằng đêm xóa mọi `viral_shares` quá 30 ngày mà chưa loại trừ `c-*`. |
| Hồ sơ & Số liệu | `/ho-so` (`/so-lieu` bị 301) | **1 trang `/ho-so`**, `/so-lieu` **301 về `/`** | `src/pages/so-lieu.ts` và `so-lieu.md.ts` chuyển hướng 301 về trang chủ; `/admin/so-lieu` chỉ còn sửa `topics`. | Các chỉ số thực chứng E-E-A-T bị mất khỏi bề mặt công khai; `/ho-so.md` vẫn nhắc `Opus Video` đã ngừng duy trì. |

Ghi nhận tích cực từ đối chiếu mã nguồn: cả ba lỗi từng nêu trong `plans/reports/brainstorm-261104-1650-lo-trinh-seo-aeo-ai-agent-no-code.md` (thiếu `a.summary` trong `/llms.txt`, `og:image` gắn cứng `/og.png`, thẻ `alt=""` trên ảnh bìa bài viết) **đều đã được sửa trên bản live hiện tại** (`src/lib/profile-markdown.ts:154`, `src/pages/bai-viet/[slug].astro:38,114`).

### 1.2 Kết quả kiểm toán khả năng trích dẫn AI trên 19 bài viết live

Đo kiểm toàn bộ 19 tệp `.md` song sinh tải trực tiếp từ `https://tqd.me/bai-viet/<slug>.md` (tổng cộng 34.199 từ) cho thấy cấu trúc RAG và trích dẫn vẫn còn bốn điểm yếu hệ thống:

1. **Đoạn mở đầu dài, thiếu Answer Capsule chuẩn 40-60 từ:** Chỉ có 2/19 bài giữ đoạn mở đầu sát ngưỡng 40-60 từ (`chon-cong-cu-ai-theo-dau-viec-cho-ceo` 51 từ và `viet-pro-skill-viet-tieng-viet-cho-ai` 38 từ). Các bài còn lại mở đầu từ 70 đến 120 từ theo lối kể chuyện (`cloudflare-cho-nguoi-moi-vibe-code` 120 từ, `jensen-huang-tu-chuc-ceo-nvidia-tac-dong-thi-truong-ai` 111 từ, `website-ngu-long-y-quan-dong-y-co-phong` 110 từ), khiến các mô hình tóm tắt khó bóc ngay định nghĩa chuẩn trong chunk đầu tiên.
2. **Thiếu bảng đối chiếu dữ liệu có cấu trúc:** Chỉ **7/19 bài** có bảng Markdown đối xứng (`ai-agent-khac-gi-chatbot`, `chi-phi-ai...`, `chon-cong-cu...`, `claude-doi-ten...`, `cloudflare...`, `github...`, `tu-dien-ai...`). Toàn bộ **12/19 bài còn lại** (bao gồm cả 6 bài showcase sản phẩm mới nhất) chỉ dùng văn xuôi và gạch đầu dòng.
3. **Đứt gãy nghiêm trọng mạng lưới liên kết nội bộ trong thân bài:**
   - **8/19 bài đang là bài mồ côi (0 inbound link trong thân bài):** `ai-agent-khac-gi-chatbot` (chính bài Hub `tu-dien-ai-agent-cho-nguoi-khong-biet-lap-trinh` cũng chưa trỏ link tới bài này dù cả hai đăng cùng ngày 04/11), `jensen-huang-tu-chuc-ceo-nvidia-tac-dong-thi-truong-ai` và toàn bộ **6 bài showcase sản phẩm**.
   - **11/19 bài có 0 outbound link tới bài viết khác:** 6 bài showcase sản phẩm không liên kết sang bất kỳ bài nào; 5 bài nền tảng tháng 10 (`chatgpt-chat-work-codex...`, `claude-design...`, `github-co-ban...`, `tqd-clean-your-mac...`, `viet-pro...`) chưa được hồi tố liên kết ngược về bài Hub.
   - **0/19 bài viết đặt liên kết ngữ cảnh trong thân bài trỏ về `/san-pham`, `/tai-video` hoặc `/ho-so`:** Mọi bài viết hiện phụ thuộc hoàn toàn vào khối CTA tĩnh ở cuối trang HTML và danh sách 3 bài mới nhất ở cuối trang (`src/pages/bai-viet/[slug].astro:42`), không xuất hiện trong bản `.md` dùng cho Agent.
4. **Hụt định danh thực thể bên trong từng đoạn chunk `## H2`:** Mặc dù dòng tiêu đề bản `.md` ghi rõ tác giả `Trịnh Quang Dũng (DũngTQ)`, phần thân dưới các mục `## H2` lại xưng "mình" chung chung. Khi hệ thống RAG của công cụ tìm kiếm AI cắt tách riêng một đoạn `## H2` để nạp vào ngữ cảnh trả lời, tên thực thể tác giả và tổ chức `ABM` bị rơi mất khỏi đoạn trích.

### 1.3 Các điểm nghẽn mù thông tin đối với AI crawler và Agent

- **Lỗ hổng `/llms-full.txt` rỗng toàn văn bài viết:** Đây là điểm nghẽn nghiêm trọng nhất ở tầng tổng hợp tri thức. Tệp `src/pages/llms-full.txt.ts:7` gọi `loadSiteData(env.DB)`, trong đó `listArticles` (`src/lib/content.ts:230`) dùng `LIST_COLUMNS` gắn cứng `'' AS body_md`. Hệ quả là bản `/llms-full.txt` live (33.168 bytes) tuy đề mục là `## Toàn văn Bài viết chuyên sâu` nhưng **0/19 bài có nội dung thân bài**, chỉ hiện tiêu đề, URL, dòng tóm tắt và nhãn. Agent đọc `/llms-full.txt` hoàn toàn không thấy dữ liệu chi tiết bên trong 19 bài viết.
- **Độ mờ của `/video-ai` và `/thu-vien`:** Trang `/video-ai` chỉ render `TikTokPlayer` (`src/components/SectionBody.astro:195`), crawler không đọc được lời thoại trong iframe. Bản `.md` của `/thu-vien` chỉ có 4 dòng đường dẫn tệp media, không có bối cảnh nghiệp vụ để Agent trích dẫn chứng minh năng lực đào tạo tại doanh nghiệp.
- **Thiếu trang chi tiết và phân mảnh `search.json` cho `/san-pham`:** Tệp `src/pages/search.json.ts:38-44` trỏ toàn bộ 8 sản phẩm về một URL chung `/san-pham` với `hint: "Sản phẩm"`, bỏ qua link tới bài giới thiệu chuyên sâu và thiếu tóm tắt năng lực sản phẩm trong chỉ mục tìm kiếm nhanh. Toàn bộ 3 trang `/san-pham`, `/video-ai`, `/thu-vien` hiện mới có `BreadcrumbList` trong JSON-LD (`src/pages/[section].astro:29-32`).

---

## Phần 2 - Tiêu chuẩn khối tri thức cho Agent trích dẫn

Mọi nội dung tạo mới hoặc nâng cấp trên `tqd.me` phải tuân thủ quy tắc ngôn ngữ **Viết Pro** (trực diện, không sáo ngữ dịch máy, không emoji làm icon UI, không chép bài Facebook) và quy tắc cấu trúc từ `REVIEW.md` (tuyệt đối không gắn schema `FAQPage` hoặc `HowTo` nhằm mục đích hiển thị kết quả giàu chi tiết).

### 2.1 Thực thể Bài viết (`/bai-viet/[slug]` và `/bai-viet/[slug].md`)

Mỗi bài viết đóng vai trò một tài liệu tham chiếu độc lập cho cả người đọc lẫn công cụ RAG (mỗi đoạn dưới `## H2` dài khoảng 180-320 từ để giữ trọn ngữ nghĩa khi chunking):

1. **Answer Capsule 40-60 từ ngay đầu bài:** Đặt ngay dưới phần tóm tắt, trước mục `## H2` đầu tiên. Đoạn này trả lời thẳng khái niệm hoặc kết luận chính bằng câu khẳng định rõ chủ ngữ, chứa từ khóa trung tâm và tự đứng độc lập mà không dùng đại từ mơ hồ ("điều này", "như trên").
2. **Tiêu đề `## H2` dạng câu hỏi hoặc bài toán thực tế:** Tối thiểu 60% số `## H2` trong bài viết theo ngữ cảnh truy vấn thật (ví dụ: `## Khi nào doanh nghiệp chỉ cần Chatbot và khi nào phải dựng AI Agent`, `## Chi phí vận hành mỗi tháng hết bao nhiêu tiền Việt`). Hàm `injectHeadingIdsAndToc` (`src/lib/toc.ts:47`) tự sinh `#anchor` tiếng Việt sạch dấu cho từng `## H2` và `### H3`, giúp AI Search trích dẫn sâu tới đúng đề mục.
3. **Bảng so sánh Markdown đối xứng:** Mỗi bài giải thích khái niệm, lựa chọn công cụ, chi phí hoặc showcase kỹ thuật bắt buộc có ít nhất 1 bảng Markdown 3-4 cột với tên tiêu chí cụ thể (tránh viết chung chung như "Ưu điểm", "Nhược điểm").
4. **Số liệu thực tế VNĐ/USD và quy tắc ngón tay cái gắn thực thể:** Trong phần phân tích quyết định, lồng ít nhất 1 con số đối chiếu chi phí hoặc thời gian thực tế (quy đổi USD và VNĐ theo mặt bằng SME Việt Nam) kèm một **quy tắc ngón tay cái** mang dấu ấn chuyên môn của **Trịnh Quang Dũng (DũngTQ)** hoặc **nguyên tắc Brain first - AI second tại ABM** (ví dụ: *"Theo kinh nghiệm triển khai cho các doanh nghiệp SME của Trịnh Quang Dũng (DũngTQ), quy trình nào bắt nhân sự sao chép thủ công trên 30 phút mỗi ngày thì đáng chuyển sang Agent"*). Cách viết này giữ nguyên thực thể tác giả ngay cả khi RAG chỉ trích xuất duy nhất chunk `## H2` đó.
5. **Khối Khi nào dùng và khi nào không dùng:** Đặt gần cuối bài, phân định rõ trường hợp nên áp dụng và trường hợp nên dừng lại ở thao tác thủ công hoặc công cụ rẻ hơn để tăng độ tin cậy học thuật và loại bỏ cảm giác quảng cáo một chiều.
6. **Liên kết nội bộ hai chiều trong thân bài:** Tối thiểu 2 liên kết sang bài Hub hoặc bài chuyên sâu liên quan và tối thiểu 1 liên kết ngữ cảnh về `/san-pham`, `/tai-video` hoặc `/ho-so` đặt trực tiếp trong Markdown `bodyMd` để bản `.md` twin giữ nguyên mạch điều hướng cho Agent.

### 2.2 Thực thể Sản phẩm và Skill (`/san-pham` và `/san-pham.md`)

Trang `/san-pham` phải chuyển từ danh sách mô tả tính năng sang danh mục giải pháp để AI Assistant tự tin đề xuất sản phẩm của DũngTQ khi người dùng hỏi tìm công cụ:

- **Khung mô tả chuẩn 5 lớp trong giới hạn D1 (`summary <= 1000` ký tự theo `docs/admin-agent-operations.md:205`):**
  1. **Bài toán:** Nỗi đau vận hành hoặc khoảng trống cụ thể mà người dùng Việt Nam đang vướng.
  2. **Đối tượng:** Nhóm người dùng phù hợp nhất (chủ SME, người viết tiếng Việt, nhà sáng tạo video, gia đình có con nhỏ...).
  3. **Cơ chế:** Công nghệ lõi hoặc luồng xử lý chính (ví dụ: 25 nhóm lỗi Viết Pro, MCP, Durable Objects, Whisper + deepseek-v4.1-flash).
  4. **Kết quả đo lường:** Con số đầu ra hoặc thời gian tiết kiệm thực tế (không bịa số, chỉ ghi mức đo được như gói tải 209 KB, kiểm định 21 nhóm bệnh văn mẫu, bộ nhớ KidGuard 45 KB).
  5. **Đường dẫn kép:** Đủ cả link dùng thử trực tiếp (`Play / App / GitHub`) lẫn link bài giải thích kiến trúc sâu (`/bai-viet/...`).
- **Tái cấu trúc danh mục trên `/san-pham`:**
  - Bổ sung ảnh bìa `coverKey` (tỉ lệ 16:9) cho `Viết Pro` và `TQD-Clean Your Mac` để đồng bộ với 6 sản phẩm còn lại.
  - Bổ sung mục sản phẩm/dịch vụ đại diện cho nhánh tư vấn B2B (`Gói Đào tạo AI & Thiết kế Skill/Agent theo quy trình SME - ABM`) gắn trực tiếp CTA `https://zalo.me/trinhquangdung` và link `/ho-so`, `/thu-vien`.
  - Đồng bộ mục `Tải video & Xưởng mổ xẻ kịch bản viral AI (/tai-video)` vào cấu trúc dữ liệu xuất ra `/san-pham.md` để AI đọc qua Markdown không bỏ sót công cụ miễn phí chủ lực này.

### 2.3 Thực thể Video AI và Thư viện (`/video-ai`, `/video-ai.md`, `/thu-vien`, `/thu-vien.md`)

Do crawler không xem được nội dung video trong iframe TikTok hay tệp MP4 thô, bản văn bản HTML và `.md` twin phải gánh toàn bộ ngữ nghĩa của video và ảnh thực địa:

- **Quy chuẩn cho từng mục trên `/video-ai`:**
  - Dùng đúng tuyến `/video-ai` (và điều chỉnh mọi tài liệu/liên kết nội bộ không trỏ nhầm vào `/video` đang 404).
  - Mỗi mục video gồm 4 phần chuẩn hóa trong `summary` (hoặc trường transcript mở rộng nếu nâng cấp schema D1): **1 câu bài toán mở đầu** + **3 luận điểm chính dạng danh sách** + **Tóm tắt lời thoại rút gọn (80-120 từ trích từ transcript thật)** + **Liên kết sâu tới bài viết/sản phẩm tương ứng** (ví dụ gắn `/bai-viet/claude-design-cho-chu-doanh-nghiep-nho` vào video làm trang giới thiệu bằng Claude, gắn `/bai-viet/viet-pro-skill-viet-tieng-viet-cho-ai` vào video Viết Pro).
  - Rà soát 3 video nhạc AI (10/2025): giữ lại để thể hiện thử nghiệm AI đa phương tiện hoặc tách nhóm phụ ở cuối trang, ưu tiên hiển thị 4+ video ứng dụng nghiệp vụ SME lên đầu (`sort` nhỏ hơn) để không làm loãng chủ đề chuyên gia của trang.
- **Quy chuẩn cho từng mục trên `/thu-vien`:**
  - Mở rộng `caption` trong `gallery` theo công thức: `[Đơn vị đối tác] - [Tên chương trình & Thời gian/Địa điểm] - [Nội dung thực hành & Đầu ra dùng lại được]`.
  - Bổ sung phần tóm tắt nội dung/transcript cho video đào tạo tại Agribank (`agribank-dao-tao-ai.mp4`).
  - Bổ sung ít nhất 3 mục tư liệu ảnh/tóm tắt cho **BSR (Lọc Hóa dầu Bình Sơn), ABIC, Hanoitourist** để khớp với danh sách đối tác đã công bố trên `/ho-so`.
- **Dữ liệu có cấu trúc đi kèm:** Phối hợp cùng bộ phận kỹ thuật web bổ sung `VideoObject` (có `name`, `description`, `uploadDate`, `embedUrl`, `thumbnailUrl`, `transcript`) trên `/video-ai` và `ImageObject`/`VideoObject` trên `/thu-vien`.

### 2.4 Thực thể Xưởng Kịch bản Viral tuyển chọn (`/xray/c-*` và `/xray/c-*.md`)

Các trang `/xray/c-*` là bề mặt **Programmatic GEO** cho nhóm truy vấn sản xuất nội dung ngắn tại Việt Nam (giữ nguyên chính sách `noindex, nofollow` và tước link ngoài cho bản ghi khách không có `c-` theo `REVIEW.md`):

- **Tiêu chí tuyển chọn để gắn tiền tố `c-`:** Chỉ tuyển chọn các video mẫu có giá trị phân tích cấu trúc cao trong 8 nhóm ngành mục tiêu (Đào tạo AI, F&B, Bất động sản, Thời trang/TMĐT, Mỹ phẩm/Làm đẹp, Khóa học, Sức khỏe, SaaS/B2B). Điểm tự nhiên `vietProScore` bắt buộc đạt từ **95/100 trở lên** trước khi lưu thành `c-*`.
- **Cấu trúc giá trị gia tăng của mỗi trang `/xray/c-*`:**
  - Tiêu đề tối ưu rõ theo dạng *"Phân tích Hook & Kịch bản ngành [Ngành] từ video [Chủ đề/Kênh]"*.
  - Phần `X-Quang Hook & Nhịp Giữ Chân` có chấm điểm cụ thể theo thang X/100, bóc tách mốc giây và cơ chế tâm lý.
  - Phần `Kịch bản chuyển thể` viết lại hoàn chỉnh sang bối cảnh, đơn vị tiền tệ VNĐ và khẩu ngữ Việt Nam tự nhiên.
  - Gắn đường dẫn nội bộ ngược về công cụ `/tai-video`, bài `viet-pro-skill-viet-tieng-viet-cho-ai` và CTA B2B `https://zalo.me/trinhquangdung`.
- **Điều kiện kỹ thuật bắt buộc trước khi triển khai:**
  1. Sửa `cleanupViralCache` tại `src/lib/viral.ts:708` thành `DELETE FROM viral_shares WHERE created_at < ?1 AND share_id NOT LIKE 'c-%'` để các case study tuyển chọn không bị xóa sau 30 ngày.
  2. Xây dựng danh mục liệt kê các mẫu `/xray/c-*` tiêu biểu ngay trên `/tai-video` (hoặc trang chuyên đề liên kết từ `/tai-video`) để crawler đi theo liên kết nội bộ thay vì chỉ phụ thuộc `sitemap.xml`.

### 2.5 Thực thể Hồ sơ và Số liệu (`/ho-so`, `/ho-so.md` và lộ trình `/so-lieu`)

Vì `/so-lieu` và `/so-lieu.md` đã bị đóng bằng lệnh chuyển hướng 301 về trang chủ (`src/pages/so-lieu.ts`), không khôi phục trang `/so-lieu` chỉ để thống kê lại lượng bài Facebook cũ. Thay vào đó, hợp nhất toàn bộ **tín hiệu thực chứng E-E-A-T** vào ngay trang `/ho-so` (và phản chiếu đầy đủ ra `/ho-so.md`, `/index.md`, `/llms.txt`):

1. **Làm sạch dữ liệu cũ trên `/ho-so`:** Gỡ hoặc cập nhật câu nhắc *"Opus Video để làm video"* trong `person.intro` (`settings.person`) vì sản phẩm và bài viết `Opus Video` đã xóa; thay bằng **Tải video & Xưởng mổ xẻ kịch bản viral AI (`/tai-video`)** và bộ công cụ sản phẩm mới nhất.
2. **Bổ sung khối "Năng lực thực chứng" trên `/ho-so` và `/ho-so.md`:**
   - **Nền tảng điều hành:** 10 năm giữ vai trò CEO và nhà sáng lập doanh nghiệp xuất nhập khẩu Trung Quốc - Việt Nam; toàn thời gian đào tạo và triển khai AI từ đầu năm 2025.
   - **Khách hàng doanh nghiệp đã đứng lớp/triển khai:** BSR (Lọc Hóa dầu Bình Sơn), Agribank (15-16/06/2026 tại TP.HCM), ABIC, Hanoitourist, Vina2 - gắn link sang `/thu-vien` để đối chứng ảnh/video thực địa.
   - **Sản phẩm & mã nguồn mở đang vận hành:** Liệt kê số lượng thực tế từ D1 (8 sản phẩm + 1 xưởng video trên `/tai-video`, gồm các hệ thống đang chạy thật như `tuvi.tqd.me`, `ngulongyquan.com`, `tv.tqd.me`, `chess.tqd.me`, `gem.tqd.me`, `789.tqd.io.vn`, `Viết Pro`, `TQD-Clean Your Mac`) kèm link về `/san-pham`.
   - **Kho tri thức công khai:** Số lượng bài viết thực chiến đã xuất bản trên `/bai-viet` (cập nhật từ D1, hiện tại là 19 bài hướng tới 35 bài sau lộ trình 8 tuần).
3. **Nâng cấp `Person` JSON-LD (`src/lib/structured-data.ts:11-26`):** Thêm thuộc tính `worksFor` (`@type: Organization`, `name: "Công ty Cổ phần Công nghệ và Đào tạo ABM"`, `url: "https://lp.abmedu.vn"`), chuẩn hóa mảng `knowsAbout` thành các thực thể chuyên môn rõ ràng (`AI Agent cho doanh nghiệp`, `Đào tạo AI vận hành SME`, `Xây dựng Skill cho Claude Code & Codex`, `Tự động hóa nội dung tiếng Việt`) đồng thời rà soát đầy đủ `sameAs`.

---

## Phần 3 - Bản đồ cụm chủ đề và ma trận truy vấn sang nguồn trích dẫn

### 3.1 Cấu trúc 4 trụ cột nội dung kết nối toàn bộ kho bài viết

Toàn bộ **19 bài đã xuất bản**, **11 bài tồn trong `plans/seo-aeo-queue.json`** và **5 bài chuyên đề mới lấp khoảng trống 2026** (tổng cộng **35 bài viết** + hệ thống `/san-pham`, `/tai-video`, `/xray/c-*`, `/thu-vien`) được quy hoạch thành 4 trụ cột liên kết chặt chẽ:

| Trụ cột nội dung | Bài Hub / Trang neo chính | Bài đã đăng thuộc trụ cột (19 bài) | Bài tồn từ `seo-aeo-queue.json` (11 bài) | Bài mới lấp khoảng trống 2026 (5 bài) |
|---|---|---|---|---|
| **Trụ cột 1 - Kiến trúc Nhân sự số & Quy trình Agentic cho SME** | `/bai-viet/tu-dien-ai-agent-cho-nguoi-khong-biet-lap-trinh` | `ai-agent-khac-gi-chatbot`, `chatgpt-chat-work-codex-cho-ceo-doanh-nghiep-nho`, `ban-tin-ai-agent-nua-cuoi-thang-10-2026`, `jensen-huang-tu-chuc-ceo-nvidia-tac-dong-thi-truong-ai` (4 bài + Hub) | `2.1` `prompt-khac-gi-skill-trong-ai-agent`, `2.2` `mcp-va-api-la-gi-cho-nguoi-khong-biet-code`, `2.3` `ao-giac-ai-hallucination-va-rag-la-gi`, `2.4` `computer-use-va-browser-agent-la-gi`, `4.2` `multi-agent-dieu-phoi-nhieu-agent-la-gi`, `4.3` `human-in-the-loop-diem-dung-duyet-tay` (6 bài) | 1. `agentic-workflow-cho-sme-theo-phong-ban` (Quy trình nhân sự số cho Sales, Kế toán, CSKH)<br>2. `webmcp-va-website-chuan-agent-ready` (Chuẩn WebMCP và kiến trúc web cho AI Agent đọc hiểu) |
| **Trụ cột 2 - Quyết định Công cụ, Chi phí & ROI Nhân sự số** | `/bai-viet/chon-cong-cu-ai-theo-dau-viec-cho-ceo` | `chi-phi-ai-theo-tung-nhan-vien-cho-doanh-nghiep-nho`, `claude-doi-ten-goi-max-thanh-max-va-ultra` (2 bài + Hub) | `1.2` `token-va-context-window-la-gi`, `1.3` `model-suy-luan-khac-gi-model-chat-nhanh`, `4.1` `api-key-tep-env-va-tran-chi-tieu-ai` (3 bài) | 3. `chi-phi-va-roi-nhan-su-so-cho-sme` (Bài toán ROI giữa mua gói thuê bao, API và chi phí nhân sự vận hành) |
| **Trụ cột 3 - Vibe Code, Sản phẩm Thực chiến & Hạ tầng Biên** | `/san-pham` và `/bai-viet/cloudflare-cho-nguoi-moi-vibe-code` | `github-co-ban-cho-nguoi-moi-dung-agent-ai`, `claude-design-cho-chu-doanh-nghiep-nho`, `tqd-clean-your-mac-don-dep-macos-tieng-viet` + 6 bài showcase sản phẩm (`tuvi`, `ngu-long-y-quan`, `kidguard`, `wizard-chess`, `lumigem`, `789`) (9 bài + bài neo Cloudflare) | `3.1` `vibe-code-la-gi-cho-nguoi-khong-biet-lap-trinh`, `3.2` `frontend-backend-database-la-gi` (2 bài) | *(Gắn trực tiếp 6 bài showcase sản phẩm vào cụm `3.1` và `3.2` làm dẫn chứng triển khai thực địa trên Cloudflare Workers/D1/R2)* |
| **Trụ cột 4 - Tự động hóa Nội dung, Chống Văn mẫu AI & Video/Media** | `/tai-video` và `/bai-viet/viet-pro-skill-viet-tieng-viet-cho-ai` | `viet-pro-skill-viet-tieng-viet-cho-ai` (1 bài + `/tai-video` + `/video-ai` + `/xray/c-*`) | *(Không có bài riêng trong queue 04/11 sau khi `opus-video` bị xóa)* | 4. `he-thong-chong-van-mau-ai-tieng-viet` (Giải phẫu 25 lỗi AI slop & cổng kiểm định tự động)<br>5. `tu-dong-hoa-san-xuat-video-media-bang-ai` (Quy trình bóc băng, X-Quang kịch bản, TTS & xuất bản đa kênh) |

### 3.2 Ma trận truy vấn mục tiêu sang nguồn trích dẫn trên tqd.me

| Nhóm truy vấn người dùng / prompt hỏi AI Search | Ý định chính | Nguồn trích dẫn ưu tiên trên `tqd.me` | Khối dữ kiện thiết kế để AI bốc nguyên cụm | Điểm chuyển đổi B2B / dùng thử |
|---|---|---|---|---|
| *"AI Agent khác gì ChatGPT/Chatbot?", "Khi nào công ty nhỏ cần dùng AI Agent?"* | Hiểu khái niệm và xác định điểm rơi đầu tư | `/bai-viet/ai-agent-khac-gi-chatbot` và `/bai-viet/tu-dien-ai-agent-cho-nguoi-khong-biet-lap-trinh` | Answer Capsule định nghĩa Chatbot vs Agent + Bảng 5 tiêu chí vận hành + Quy tắc 30 phút lặp lại/ngày | `/san-pham` và link đặt lịch tư vấn `zalo.me/trinhquangdung` |
| *"Cách xây quy trình nhân sự số cho SME", "Giao việc nhiều bước cho AI không bị sai"* | Thiết kế Agentic Workflow & kiểm soát rủi ro | `agentic-workflow-cho-sme-theo-phong-ban`, `prompt-khac-gi-skill-trong-ai-agent`, `human-in-the-loop-diem-dung-duyet-tay` | Khung 4 bước (Thao tác tay -> Skill SOP -> Nối MCP -> Chốt duyệt tay) + Ma trận rủi ro hoàn tác | Khối tư vấn đào tạo nội bộ tại `/ho-so` và `/thu-vien` |
| *"MCP là gì?", "Làm sao cho AI tự đọc dữ liệu web/phần mềm công ty?"* | Kết nối dữ liệu nội bộ & WebMCP | `mcp-va-api-la-gi-cho-nguoi-khong-biet-code`, `webmcp-va-website-chuan-agent-ready`, `website-ngu-long-y-quan-dong-y-co-phong` | Ẩn dụ ổ cắm Type-C + Case study cổng MCP trên `ngulongyquan.com` và cấu trúc `.md` twin của `tqd.me` | Link trải nghiệm `/llms.txt` và tư vấn triển khai ABM |
| *"Chi phí triển khai AI cho công ty 10-30 người", "Tính ROI nhân sự số thế nào?"* | Lập ngân sách & duyệt chi | `chi-phi-ai-theo-tung-nhan-vien-cho-doanh-nghiep-nho`, `chi-phi-va-roi-nhan-su-so-cho-sme`, `token-va-context-window-la-gi` | Bảng giá theo đầu người USD/VNĐ + Công thức chia nhóm dùng ít/nhiều + Bảng so sánh gói thuê bao vs API | `/bai-viet/chon-cong-cu-ai-theo-dau-viec-cho-ceo` và Zalo DũngTQ |
| *"Không biết code làm sao tự dựng phần mềm chạy thật không tốn tiền server?"* | Vibe code & đưa web lên mạng | `vibe-code-la-gi-cho-nguoi-khong-biet-lap-trinh`, `cloudflare-cho-nguoi-moi-vibe-code`, `frontend-backend-database-la-gi`, `website-tu-vi-dau-so-thien-ky` | Mô hình nhà hàng 3 tầng + So sánh gói Cloudflare 0 đồng vs 5 USD + Case study 6 sản phẩm chạy thật | `/san-pham` (chơi/mở thử `tuvi.tqd.me`, `tv.tqd.me`) |
| *"Làm sao AI viết tiếng Việt tự nhiên không bị văn mẫu?", "Công cụ viết lại kịch bản TikTok không sáo ngữ"* | Khử AI slop & sản xuất nội dung | `viet-pro-skill-viet-tieng-viet-cho-ai`, `he-thong-chong-van-mau-ai-tieng-viet`, `/tai-video`, `/xray/c-*` | Danh mục 25 dấu hiệu văn máy + Quy tắc giữ nguyên số liệu/tên riêng + Case study kịch bản `/xray/c-*` | Cài GitHub `viet-pro-codex` hoặc dùng ngay `/tai-video` |
| *"Chuyên gia đào tạo AI thực chiến cho doanh nghiệp tại Việt Nam?"* | Tìm chuyên gia & thẩm định uy tín (E-E-A-T) | `/ho-so`, `/thu-vien`, `/san-pham` | Lý lịch 10 năm CEO XNK + Minh chứng lớp BSR, Agribank, ABIC, Hanoitourist, Vina2 + Hệ 8 sản phẩm thật | `https://zalo.me/trinhquangdung` và `dungtq.ceo@gmail.com` |

---

## Phần 4 - Lộ trình xuất bản 8 tuần

Lộ trình chia làm 4 Sprint (mỗi Sprint 2 tuần), ưu tiên sửa lỗi mù dữ liệu của hệ thống hiện có trước, tiếp theo hoàn tất 11 bài còn thiếu trong `plans/seo-aeo-queue.json`, đồng thời nâng cấp toàn bộ trang thực thể và mở 5 chuyên đề 2026.

| Sprint & Thời gian | Hạng mục viết mới (Slug / Tuyến) | Hạng mục nâng cấp & hồi tố nội bộ | Chỉ tiêu hoàn thành (Definition of Done) |
|---|---|---|---|
| **Sprint 1 (Tuần 1-2)** - Vá lỗ hổng Index & Đợt 1 hàng đợi | **Viết mới 3 bài (Đợt 1 queue):**<br>1. `token-va-context-window-la-gi` (`1.2`)<br>2. `prompt-khac-gi-skill-trong-ai-agent` (`2.1`, sửa tham chiếu `opus-video` đã xóa thành `viet-pro` và `/tai-video`)<br>3. `mcp-va-api-la-gi-cho-nguoi-khong-biet-code` (`2.2`) | - Yêu cầu dev vá `llms-full.txt` (`bodyMd`) và cron `cleanupViralCache` (`c-*`).<br>- Sửa `tu-dien-ai-agent-cho-nguoi-khong-biet-lap-trinh`: gắn link trỏ tới `ai-agent-khac-gi-chatbot` và 3 bài Đợt 1.<br>- Sửa `ai-agent-khac-gi-chatbot`: rút Answer Capsule về 40-60 từ, gắn link `/san-pham`.<br>- Hồi tố 4 bài SME cũ (`chon-cong-cu`, `chi-phi`, `chatgpt-chat-work-codex`, `claude-design`): chèn link ngược về Hub, Đợt 1 và `/ho-so`. | 3 bài Đợt 1 lên sóng; `/llms-full.txt` xuất đủ 100% toàn văn; giảm số bài thiếu outbound link từ 11 xuống còn 7. |
| **Sprint 2 (Tuần 3-4)** - Đợt 2 hàng đợi & Chuẩn hóa Sản phẩm/Hồ sơ | **Viết mới 4 bài (Đợt 2 queue):**<br>4. `ao-giac-ai-hallucination-va-rag-la-gi` (`2.3`)<br>5. `vibe-code-la-gi-cho-nguoi-khong-biet-lap-trinh` (`3.1`)<br>6. `api-key-tep-env-va-tran-chi-tieu-ai` (`4.1`)<br>7. `model-suy-luan-khac-gi-model-chat-nhanh` (`1.3`) | - Nâng cấp toàn bộ 8 mục trên `/san-pham` theo khung 5 lớp (thêm `coverKey` cho `Viết Pro` và `TQD-Clean Your Mac`, thêm thẻ tư vấn AI Agent B2B, đưa `/tai-video` vào `/san-pham.md`).<br>- Hồi tố 6 bài showcase sản phẩm (`tuvi`, `ngu-long-y-quan`, `kidguard`, `wizard-chess`, `lumigem`, `789`): thêm Answer Capsule, bảng thông số kỹ thuật, link tới `vibe-code`, `cloudflare` và `/san-pham`.<br>- Cập nhật `/ho-so` (gỡ `Opus Video`, thêm khối Số liệu Thực chứng E-E-A-T). | Chấm dứt hoàn toàn 8/19 bài mồ côi; 100% sản phẩm trên `/san-pham` đạt chuẩn gợi ý AI. |
| **Sprint 3 (Tuần 5-6)** - Hoàn tất Đợt 3 hàng đợi & Mở khóa Video/Thư viện | **Viết mới 4 bài (Đợt 3 queue):**<br>8. `frontend-backend-database-la-gi` (`3.2`)<br>9. `computer-use-va-browser-agent-la-gi` (`2.4`)<br>10. `multi-agent-dieu-phoi-nhieu-agent-la-gi` (`4.2`)<br>11. `human-in-the-loop-diem-dung-duyet-tay` (`4.3`) | - Hồi tố 4 bài còn lại (`github-co-ban`, `viet-pro`, `tqd-clean-your-mac`, `cloudflare`) gắn Answer Capsule + bảng đối chiếu + link về Hub và Đợt 2-3.<br>- Nâng cấp 7 mục trên `/video-ai` (thêm 3 luận điểm + tóm tắt transcript + link bài viết tương ứng).<br>- Nâng cấp `/thu-vien`: bổ sung transcript video Agribank và tư liệu thực địa BSR, ABIC, Hanoitourist. | Đạt **13/13 bài** của `plans/seo-aeo-queue.json`; 100% bài cũ đạt chuẩn Agent-Citable; `/video-ai.md` và `/thu-vien.md` hết tình trạng mù chữ. |
| **Sprint 4 (Tuần 7-8)** - Lấp khoảng trống 2026 & Programmatic GEO `/xray/c-*` | **Viết mới 5 bài 2026:**<br>12. `agentic-workflow-cho-sme-theo-phong-ban`<br>13. `webmcp-va-website-chuan-agent-ready`<br>14. `chi-phi-va-roi-nhan-su-so-cho-sme`<br>15. `he-thong-chong-van-mau-ai-tieng-viet`<br>16. `tu-dong-hoa-san-xuat-video-media-bang-ai`<br>**Xuất bản 8-10 trang `/xray/c-*`** qua công cụ `/tai-video` (phiên Admin). | - Gắn danh sách các `/xray/c-*` tuyển chọn lên `/tai-video` và chèn làm ví dụ thực tế trong bài `tu-dong-hoa-san-xuat-video-media-bang-ai` và `he-thong-chong-van-mau-ai-tieng-viet`.<br>- Kiểm tra chéo toàn bộ liên kết nội bộ trên 35 bài viết để không còn bài mồ côi mới. | Kho tri thức đạt **35 bài viết** + **8-10 trang `/xray/c-*`** được index trong `sitemap.xml` và đồng bộ đầy đủ vào Chatbot GoClaw. |

---

## Phần 5 - Quy trình vận hành và đồng bộ kiến thức tự động

Mọi bài viết và hạng mục cập nhật đều đi qua quy trình 6 bước khép kín để đảm bảo nội dung vừa sạch lỗi tiếng Việt, vừa lên đúng định dạng trên HTML, `.md` twin và bộ nhớ của Chatbot Agent DũngTQ.

### Bước 1 - Biên soạn và tự kiểm chuẩn Agent-Citable Spec

- Kiểm tra đủ 6 thành phần cấu trúc của bài viết (Answer Capsule 40-60 từ, H2 câu hỏi chiếm >= 60%, ít nhất 1 bảng Markdown, số liệu VNĐ/USD kèm quy tắc thực hành gắn tên Trịnh Quang Dũng/ABM, khối Khi nào dùng và khi nào không dùng, tối thiểu 2 link bài viết + 1 link section `/san-pham` hoặc `/tai-video`).
- Kiểm tra ảnh minh họa tỉ lệ 16:9 hợp lệ (JPEG/PNG/WebP dưới 10 MB, có `alt` mô tả rõ ý nghĩa hình ảnh). Tuyệt đối không chèn lại ảnh bìa (`coverKey`) vào trong `bodyMd` vì template `src/pages/bai-viet/[slug].astro:112` tự hiển thị ảnh bìa ở đầu trang.

### Bước 2 - Cổng biên tập tiếng Việt bắt buộc (Viết Pro Lint + Decision Gate)

1. Chạy bộ kiểm lỗi tất định từ dòng lệnh trên bản thảo `.md`:
   ```bash
   node /Users/tqd/.gemini/config/skills/viet-pro/scripts/lint-vietnamese-content.mjs <duong-dan-bai.md> --keep "Trịnh Quang Dũng" --keep "DũngTQ" --route-hint
   ```
   Yêu cầu: **0 lỗi `ERROR`** (loại bỏ triệt để gạch ngang dài, dấu hai chấm trong tiêu đề `#`/`##`, dấu phẩy trước chữ `và`, tiêu đề viết hoa từng chữ kiểu tiếng Anh) và xử lý sạch các cảnh báo văn dịch/sáo ngữ `WARN`.
2. Gọi công cụ chấm định lượng `audit_viet_pro_gate` của MCP server `gemini-decisions`:
   ```bash
   /Users/tqd/.local/bin/mcporter call gemini-decisions.audit_viet_pro_gate file_path="<duong-dan-bai.md>"
   ```
   Yêu cầu: `gate_passed` là `true` và `rhythm_score_0_to_3 >= 2.0`. Nếu trượt, sửa đúng điểm liệt kê trong `flagged_defects` tối đa 2 vòng rồi chấm lại. Trường hợp dịch vụ MCP lỗi kết nối, ghi nhận rõ trạng thái *"chưa chấm gate"* kèm thông báo lỗi vào nhật ký xuất bản.

### Bước 3 - Xuất bản qua `/api/v1` (hoặc `/admin` cho mục phi bài viết)

- Với **bài viết và tệp ảnh/video đi kèm**, dùng CLI của skill `tqd-publish` (`skills/tqd-publish/scripts/tqd-publish.mjs` theo `docs/agent-publishing.md`):
  1. Kiểm tra xác thực key: `node skills/tqd-publish/scripts/tqd-publish.mjs whoami`.
  2. Tải ảnh lên R2 trước để lấy `key`: `node skills/tqd-publish/scripts/tqd-publish.mjs upload <file-anh> --alt "<mô tả ảnh>"`.
  3. Đăng hoặc cập nhật bài viết: `node skills/tqd-publish/scripts/tqd-publish.mjs put <slug> --title "..." --body-file <file.md> --summary "..." --tags "..." --cover <mediaKey> [--publish]`. Script tự gọi `GET` trước để kẹp header `If-Match: "v{version}"` khi sửa bài cũ.
  4. Kiểm tra kết quả JSON trả về: nếu `"fbOverlap": true`, **bắt buộc viết lại** phần trùng lặp trước khi công khai vì chính sách site cấm trùng văn bản bài Facebook.
- Với **sản phẩm, video AI, thư viện và hồ sơ**, thao tác qua phiên `/admin` theo `docs/admin-agent-operations.md`:
  1. Luôn chạy sao lưu D1 trước khi sửa hàng loạt: `POST /admin/sao-luu`.
  2. Vì mọi form `/admin` ghi đè toàn bộ bản ghi, luôn thực hiện vòng lặp **Đọc hiện trạng -> Trộn thay đổi -> Gửi đủ mọi trường** (đặc biệt giữ nguyên `visible=on` và `tiktokUrl` khi sửa mục trên `/admin/muc/video`).
- Với **bản ghi `/xray/c-*`**, đăng nhập phiên Admin vào `/tai-video` để công cụ tự sinh mã `c-<16hex>` khi chia sẻ (`src/lib/viral.ts:593`).

### Bước 4 - Kiểm chứng bề mặt phát hiện trên production

Ngay sau khi lưu thành công (`content_version` tự tăng để xóa cache cũ trên Cloudflare Workers), chạy bộ lệnh `curl` đối chiếu:
- Kiểm tra HTML trả về `HTTP 200`, đủ `<link rel="alternate" type="text/markdown">` và JSON-LD hợp lệ: `curl -sSI https://tqd.me/bai-viet/<slug>`.
- Kiểm tra đàm phán nội dung Agent trả về `Content-Type: text/markdown; charset=utf-8`, `Vary: Accept` và `X-Robots-Tag: noindex`: `curl -sSI -H "Accept: text/markdown" https://tqd.me/bai-viet/<slug>`.
- Kiểm tra các tệp tổng hợp đã chứa đường dẫn và tóm tắt mới: kiểm tra trên `https://tqd.me/llms.txt`, `https://tqd.me/llms-full.txt`, `https://tqd.me/sitemap.xml` và `https://tqd.me/search.json`.

### Bước 5 - Đồng bộ tri thức Chatbot `Agent DũngTQ` trên GoClaw

Theo `docs/chatbot.md`, trợ lý `dungtq-web` trả lời khách hàng trên `tqd.me` dựa vào tệp `CAPABILITIES.md` chạy trên máy chủ GoClaw (`https://goclaw.tqd.io.vn`). Ngay sau khi hoàn tất Bước 4 (hoặc chốt từng đợt Sprint), thực hiện đồng bộ:
1. Chạy trên máy GoClaw: `node D:/Goclaw/plans/261013-dungtq-web/sync-context.mjs` để cập nhật `CAPABILITIES.md` từ `https://tqd.me/index.md` và danh sách bài viết (lưu ý `sync-context.mjs` cần đọc từng `/bai-viet/<slug>.md` hoặc dùng `/llms-full.txt` sau khi đã vá lỗi `LIST_COLUMNS` để Agent nắm trọn số liệu và bảng so sánh trong thân bài).
2. Chạy kiểm thử tự động phía GoClaw: `node D:/Goclaw/plans/261013-dungtq-web/verify-chat.mjs` và xác nhận đầu ra `ALL PASS`.

### Bước 6 - Theo dõi hiệu quả trích dẫn và bảo trì định kỳ

- Hằng tuần rà soát `/admin/thong-ke` và `/admin/chat` (chỉ đếm lưu lượng tổng hợp và phân nhóm truy vấn, tuân thủ chính sách không lưu nội dung tin nhắn thô của người dùng theo `docs/chatbot.md:16`).
- Đối chiếu các câu hỏi khách hàng thường gõ trong chat nhưng Chatbot chưa trả lời dứt khoát được để đưa vào danh sách cập nhật Answer Capsule hoặc bổ sung bài mới ở vòng Sprint kế tiếp.
