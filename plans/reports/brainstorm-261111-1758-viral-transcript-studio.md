# Brainstorm Report: Tiến Hóa `/tai-video` Thành "Phòng Mổ Xẻ & Nhân Bản Kịch Bản Triệu View" (`deepseek-flash` + `viet-pro`)

- **Date**: 2026-11-11
- **Status**: Brainstorm Complete — Ready for Scope Confirmation & `/ak-plan --advice`
- **Advisory Supervision (`--advice`)**: Reviewed by `kongming` (`99cef781-1e8b-4e4a-b4e7-59af874f8091`, host Pro model counsel).

---

## 1. Định Vị Chiến Lược: Tại Sao Chỉ "Tải Video" Sẽ Khó Giữ Chân, Còn "Mổ Xẻ + Nhân Bản Viral" Sẽ Hút Khách?

Các trang tải video thuần túy (SnapTik, SaveFrom, Y2Mate) là thị trường đại dương đỏ: người dùng vào dán link, tải xong thoát ngay trong 10 giây, tỷ lệ nhớ thương hiệu gần bằng 0 nhưng tốn băng thông VPS.

Ngược lại, tệp khách hàng mục tiêu giá trị cao của `tqd.me` (**Creator, Chủ shop, Marketer, SME, Học viên AI**) đi tải video viral trên TikTok, Douyin, Facebook Reels, YouTube Shorts vì **một mục đích sâu hơn**:
> *"Video này nói gì mà lên triệu view? Cấu trúc 3 giây đầu của nó gài tâm lý gì? Làm sao biến khung kịch bản này thành bài bán hàng / xây kênh cho ngành của tôi mà không bị sặc mùi văn mẫu ChatGPT?"*

Khi biến [tai-video.astro](file:///Volumes/2/TQD-Website/src/pages/tai-video.astro) thành **Tổ hợp Tải Video + Bóc Tách Transcript & Nhân Bản Kịch Bản Chuẩn `viet-pro`**, mỗi đường dẫn video người dùng dán vào sẽ tạo ra **5 tài sản nội dung hoàn chỉnh** chỉ trong vài giây.

---

## 2. Brainstorm Contract

### Outcome (Kết quả đầu ra mong muốn)
Nâng cấp trang `/tai-video` trên `tqd.me` với chế độ / tab **"🧬 Mổ Xẻ Viral & Viết Kịch Bản (AI)"** hoạt động 24/7 bên cạnh tính năng tải file hiện có:
1. **Lấy Transcript đa nền tảng có mốc thời gian (`[mm:ss]`)**: Hỗ trợ YouTube, TikTok, Facebook/Instagram Reels, Douyin, X — kể cả video không có phụ đề rời.
2. **X-Quang Công Thức Viral (`deepseek-flash`)**: Chấm điểm & giải mã Hook 3 giây đầu, nhịp giữ chân (Retention Beats), đòn bẩy cảm xúc, tốc độ nói (từ/phút) và công thức CTA.
3. **Nhân Bản Đa Kênh & "Đổi Ngành Giữ Khung" chuẩn `viet-pro`**: Viết lại từ transcript gốc sang nhiều định dạng (Bảng kịch bản quay 3 cột TikTok/Reels, Bài kể chuyện Facebook cá nhân, Chuỗi Threads 5 bài, Dàn ý YouTube dài, Bài chuyên gia LinkedIn) với tùy chọn **đổi sang ngành nghề/sản phẩm của người dùng** hoặc **Việt hóa tự nhiên từ video Trung/Anh**.
4. **Hàng rào chất lượng độc quyền `viet-pro`**: Tích hợp bộ kiểm định tất định (`viet-pro` linter chạy ngay trên trình duyệt) hiển thị **Điểm tự nhiên tiếng Việt (0 văn mẫu AI)** + kiểm tra độ dài chuẩn từng nền tảng + xuất `.srt` / Copy chuẩn CapCut + link chia sẻ báo cáo X-Ray.

### Constraints (Ràng buộc kỹ thuật & vận hành)
- **Cloudflare Workers Free (10ms CPU limit)**: Worker tuyệt đối **không** đọc/parse/encode buffer âm thanh; chỉ xác thực HMAC, kiểm tra cache/rate-limit trên D1 và pipe luồng SSE từ API `deepseek-flash` về trình duyệt.
- **VPS Ubuntu 24/7 (`180.93.50.84` — 4GB RAM, ~4.1GB đĩa trống)**: Đang chạy chung với `chatbot.abmedu.vn`. Tuyệt đối **không** cài mô hình Whisper/LLM cục bộ trên VPS để tránh OOM/đầy đĩa; file âm thanh tạm (`32kbps mono MP3`, ~240 KB/phút) phải xóa ngay lập tức trong khối `finally` sau khi gọi STT API.
- **Hoạt động 24/7 độc lập PC cá nhân**: Không phụ thuộc `GoClaw` trên máy tính Windows ở nhà cho luồng public.
- **Chống Prompt Injection & Lạm dụng**:
  - Transcript/tiêu đề video là dữ liệu không tin cậy (`untrusted input`), bắt buộc bọc trong thẻ cách ly `<untrusted_video_transcript>` theo quy tắc số 2 & 5 của `viet-pro`.
  - Giới hạn cứng cho khách Public: **thời lượng video phân tích ≤ 300 giây (5 phút)**, giới hạn lượt phân tích theo giờ/ngày qua bảng `rate_limits` trên D1 (`src/lib/dl.ts` / `src/worker.ts`). Admin mở khóa video dài hơn.

### Non-goals (Ngoài phạm vi để tránh phình dự án)
- Không chạy Whisper cục bộ (`faster-whisper` / `whisper.cpp`) trên VPS 4GB RAM.
- Không làm Web Teleprompter ghi hình bằng camera trên trình duyệt (dễ lỗi quyền Safari iOS; thay bằng nút **Copy chuẩn CapCut Teleprompter**).
- Hoãn tính năng cắt ảnh hàng loạt bằng `ffmpeg` (Visual Hook Frame Strip) ở bản MVP để giữ I/O đĩa VPS nhẹ tuyệt đối.

### Acceptance Criteria (Tiêu chí nghiệm thu cho bước lập kế hoạch kế tiếp)
1. Video YouTube có phụ đề trả về Transcript < 2.5s; video TikTok/Reels/Douyin không có phụ đề rời trích xuất MP3 32kbps trên VPS + STT trả về Transcript < 6s (cho clip 60–90s) và tự xóa file tạm 100%.
2. Cùng 1 video (sau khi chuẩn hóa URL bỏ `utm_*`, `?si=...`) được dán lần thứ 2 trở đi đọc thẳng từ D1 cache trong `< 50ms`, tốn `0đ` phí STT.
3. Kịch bản sinh ra bởi `deepseek-flash` tuân thủ cấu trúc từng kênh của `viet-pro` (bảng 3 cột cho video ngắn, không mở bài bằng *"Xin chào các bạn"*, làm tròn số khi đọc thoại) và vượt qua bộ kiểm tra `viet-pro-lint.ts` trên trình duyệt với huy hiệu điểm tự nhiên trực quan.
4. Giữ nguyên CPU time của Cloudflare Worker dưới ngưỡng an toàn (`< 5ms`/request) và vượt qua toàn bộ unit test + `npm run build`.

---

## 3. So Sánh 3 Phương Án Kiến Trúc (`Trade-offs`)

| Tiêu chí | Phương án A (Khuyên dùng): Edge Cache + VPS Light Audio/Subs + Cloud STT & `deepseek-flash` SSE | Phương án B: Đi qua Home `GoClaw` (`goclaw.tqd.io.vn`) | Phương án C: All-in-VPS (Chạy Whisper cục bộ trên `180.93.50.84`) |
| :--- | :--- | :--- | :--- |
| **Độ sẵn sàng 24/7** | **100% 24/7** (Worker + VPS + Cloud API luôn bật) | Kém — Mất kết nối khi tắt PC Windows ở nhà | Rủi ro OOM làm sập cả `chatbot.abmedu.vn` |
| **Tải CPU Worker Free** | **< 3ms** (Worker không chạm audio buffer; chỉ pipe SSE & đọc JSON text) | < 3ms | < 3ms |
| **Tải RAM / Đĩa VPS** | **Siêu nhẹ** (~240 KB RAM/temp cho 1 phút audio 32kbps, xóa ngay sau 1s) | Siêu nhẹ | Nặng (2–3GB RAM + 1.5GB model disk trên ổ còn 4.1GB trống) |
| **Tốc độ xử lý clip 60s** | **1.5s – 4.5s** cho Transcript + stream chữ tức thì | Chậm hơn do qua tunnel gia đình & chung bể 120 RPM | 15s – 40s trên CPU VPS không có GPU |
| **Chi phí API ước tính** | Cực thấp nhờ D1 Cache 30 ngày (~vài xu cho hàng trăm video ngắn) | Tận dụng quota sẵn nhưng không ổn định 24/7 | 0đ API STT nhưng rủi ro phải nâng cấp gói VPS đắt hơn nhiều |

### Quyết định kiến trúc tinh chỉnh sau phản biện của `kongming` (Better Approaches)
1. **Đẩy bước gọi STT sang VPS Daemon thay vì Worker**: Thay vì trả file MP3 về Worker rồi bắt Worker gửi lên Whisper (dễ chạm trần 10ms CPU), [ytdlp-daemon.mjs](file:///Volumes/2/TQD-Website/scripts/ytdlp-daemon.mjs) trên VPS tự chạy:
   - Bước 1: Thử `yt-dlp --write-subs --write-auto-subs --skip-download` (nhanh 1.5s cho YouTube).
   - Bước 2 (Luồng chính cho 85% video TikTok/Reels/Douyin bị hardsub): Chạy `ffmpeg -vn -ac 1 -ar 16000 -b:a 32k` ra file `.mp3` siêu nhẹ rồi gọi thẳng REST API của **Groq Whisper (`whisper-large-v3-turbo`)** hoặc **Cloudflare Workers AI (`@cf/openai/whisper-large-v3-turbo`)**, xóa file ngay và trả JSON text gọn sạch về Worker.
2. **Chuẩn hóa URL (`Canonical Video Hash`) + Cache D1 30 ngày**: Tách sạch `platform + canonicalVideoId` (loại bỏ `?si=`, `utm_source`, rút gọn `vt.tiktok.com` / `youtu.be`) trước khi băm SHA-256. Một video đang hot được 100 người dán vào chỉ tốn tiền xử lý đúng 1 lần duy nhất!
3. **Chạy bộ Linter `viet-pro` ở Client-side (0ms Server CPU)**: Port trực tiếp [lint.mjs](file:///Users/tqd/.gemini/config/skills/viet-pro/scripts/lib/lint.mjs) và [profile.mjs](file:///Users/tqd/.gemini/config/skills/viet-pro/scripts/lib/profile.mjs) sang TypeScript chạy trên trình duyệt sau khi luồng SSE hoàn tất, vừa nhanh tức thì vừa không tốn CPU của Worker.

---

## 4. Năm Vũ Khí Khác Biệt Hóa Thu Hút & Giữ Chân Người Dùng

1. **"Đổi Ngành Giữ Khung" (Viral Structure Cloning — Vũ khí giữ chân số 1)**:
   - Khách dán 1 video triệu view bất kỳ (thậm chí khác ngành) -> chọn ngành của mình (*Mỹ phẩm, Bất động sản, F&B, Thời trang, Đào tạo/Khóa học, B2B/SaaS...*) + nhập 1 dòng mô tả sản phẩm -> `deepseek-flash` giữ nguyên **nhịp câu chữ, cấu trúc gài Hook 3 giây và điểm bẻ lái (twist)** của video gốc nhưng viết thành kịch bản mới cho đúng sản phẩm của khách!
2. **"Săn Trend Ngoại — Việt Hóa Tự Nhiên" (Douyin / Xiaohongshu / YouTube US → Tiếng Việt Đời Thường)**:
   - Dân làm nội dung và bán hàng tại Việt Nam săn video Douyin/Trung Quốc và Mỹ cực nhiều, nhưng công cụ dịch thông thường cho ra câu chữ dịch máy ngô nghê (*"Việc sử dụng sản phẩm này đóng vai trò quan trọng..."*). Kết hợp `yt-dlp` (hỗ trợ sẵn Douyin/Bilibili/YouTube) + luật chống văn dịch của `viet-pro` sẽ biến video tiếng Trung/Anh thành **kịch bản tiếng Việt khẩu ngữ tự nhiên, đọc lên quay được ngay**.
3. **Bộ Chuyển Thể Đa Kênh "1 Link → 5 Định Dạng" (`repurpose-matrix.md`)**:
   - Từ 1 transcript, bấm 1 nút chuyển thành:
     - `🎬 Kịch bản quay TikTok/Reels/Shorts` (Bảng 3 cột: *Thời điểm | Lời đọc ~2.5-3 từ/giây | Hình ảnh & Chữ trên màn hình*).
     - `📝 Bài Facebook cá nhân kể chuyện` (Mở bài bằng tình huống thật, không sáo rỗng, giữ độ dài trước nút *"Xem thêm"*).
     - `🧵 Chuỗi Threads 5 bài` (Mỗi bài nối nhau bằng câu mở tò mò, đúng trần 500 ký tự/bài).
     - `💼 Bài phân tích chuyên gia LinkedIn / Blog SEO`.
4. **Huy Hiệu "Chuẩn Viết Pro — 0% Văn Mẫu AI" + Nút "Làm Mượt Giọng Người Thật"**:
   - Hiển thị trực tiếp điểm kiểm định từ bộ 21 quy tắc của `viet-pro` (bắt dấu gạch ngang dài `—`, cấu trúc *"không chỉ... mà còn"*, từ sáo rỗng *"giải pháp toàn diện, chìa khóa then chốt"*, câu đồng dạng). Nếu phát hiện vệt AI, nút **1-Click Khử Văn Mẫu** gửi chính danh sách lỗi đó cho `deepseek-flash` viết gọt lại sạch bóng.
5. **Bánh Đà Lan Truyền: Thẻ "X-Quang Video Triệu View" Chia Sẻ Được (`/xray/<hash>`) + Xuất `.srt` / Copy CapCut**:
   - Nút tải phụ đề `.srt` sạch hoặc **Copy chuẩn CapCut Script** để dán thẳng vào điện thoại quay.
   - Mỗi bản mổ xẻ tạo được link chia sẻ đẹp mắt để người dùng đăng lên nhóm Facebook/Zalo/Threads thảo luận (*"Mình vừa mổ xẻ cấu trúc clip 3 triệu view này trên tqd.me"*), bên dưới khéo léo gắn lời dẫn tự nhiên về hệ sinh thái đào tạo / tư vấn AI thực chiến của DũngTQ.

---

## 5. Câu Hỏi Mở Cần Chốt Trước Khi Sang `/ak-plan --advice`

1. **Nguồn API cho `deepseek-flash` & STT 24/7**:
   - *LLM*: Bạn muốn kết nối qua nhà cung cấp nào cho `deepseek-flash` (OpenCode Go / OpenRouter / DeepSeek API trực tiếp / hay Cloudflare Workers AI)?
   - *STT (cho video TikTok/Reels không phụ đề)*: Dùng **Cloudflare Workers AI (`@cf/openai/whisper-large-v3-turbo`)** gắn trực tiếp trên tài khoản Cloudflare hiện có, hay dùng **Groq Whisper API**?
2. **Phạm vi Phase 1 (MVP)**: Bạn muốn đưa trọn bộ **(Transcript + X-Quang Viral + Đổi Ngành Đa Kênh chuẩn `viet-pro` + Xuất SRT/CapCut)** lên ngay trong tab mới của `/tai-video`, và để phần **Link chia sẻ công khai `/xray/<hash>`** sang Phase 1.5 hay làm luôn cùng lúc?
