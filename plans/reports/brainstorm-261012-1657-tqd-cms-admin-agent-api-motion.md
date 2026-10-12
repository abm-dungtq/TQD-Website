# Brainstorm: /admin, bài viết từ AI Agent, video TikTok và hiệu ứng kiểu Zuey OS

Ngày: 2026-10-12 · Chế độ: `--advice` · Tư vấn: kongming · Nền tảng hiện tại: [plan v1](../261012-1604-tqd-personal-website/plan.md) (site tĩnh live tại https://tqd.io.vn)

## Outcome

`https://tqd.io.vn` trở thành site có nội dung động:

1. `/admin` (đăng nhập bằng mật khẩu riêng) quản lý **toàn bộ nội dung**: hồ sơ, sản phẩm, đào tạo & sự kiện, video, bài viết, liên hệ, số liệu, ảnh/video đã tải lên, API key.
2. Mục **Video AI** liệt kê video TikTok, phát trực tiếp trên web bằng player chính thức của TikTok.
3. Mục **Chuyên môn** đổi thành **Bài viết** (`/bai-viet`, `/bai-viet/{slug}`), nơi đăng bài hằng ngày.
4. AI Agent của anh tự viết bài, tự tạo ảnh/video và tự đăng qua **API có API key**; kèm skill `tqd-publish` cho Claude Code/Codex gọi API này. Ảnh/video lưu trong **Cloudflare R2**.
5. Làm lại (viết mới) bộ hiệu ứng kiểu Zuey OS: cửa sổ & dock, hình nền & giao diện, mobile & ⌘K, linh vật & thời tiết.

## Constraints

- zuey-me không có license: chỉ dùng bản mô tả hiệu ứng (catalog ở dưới), viết code mới, không chép file.
- Không làm gián đoạn site đang chạy: phiên bản mới chạy thử trên hostname preview, chỉ chuyển `tqd.io.vn` khi đã kiểm tra xong.
- Tài khoản Cloudflare: Xaotiensinh (`b243f38bff984ce1741c379547e97a75`); dùng D1, R2, Workers Rate Limiting, Cron Trigger trong gói Free.
- Nội dung do agent viết là dữ liệu không tin cậy: Markdown → HTML qua sanitizer, không cho HTML thô, ảnh chỉ từ R2 của site, iframe chỉ TikTok với id số.
- Không in hoặc commit secret (mật khẩu admin, khoá ký cookie, API key).
- Giữ quy tắc "không đăng văn bản bài Facebook" cho các trang đã tổng hợp từ dữ liệu Facebook.

## Non-goals

- Agent tự viết bài theo lịch (chọn chủ đề, gọi model, tạo ảnh) — agent hiện có của anh làm; lần này chỉ có API + skill.
- Đăng nhập Cloudflare Access, nhiều tài khoản admin, phân quyền nhiều người.
- Bình luận, thành viên, thanh toán, newsletter, MCP server, chat AI.
- Đăng video lên TikTok tự động.

## Acceptance criteria

1. `/admin` yêu cầu đăng nhập; sai mật khẩu nhiều lần bị chặn tạm; sửa được mọi mục và thay đổi hiện ngay trên site công khai.
2. `POST /api/v1/articles` với API key hợp lệ tạo bài có ảnh/video từ R2 và hiện ở `/bai-viet`; key sai trả 401; key bị thu hồi không dùng được.
3. Skill `tqd-publish` đăng được một bài thử từ Claude Code (bài thử được xoá sau khi kiểm tra).
4. Mục Video AI phát được video TikTok ngay trên trang (player tải khi bấm, không làm chậm trang).
5. Nội dung chứa `<script>`, `onerror=`, `javascript:` trong bài agent gửi không chạy được (test XSS).
6. Các hiệu ứng trong danh sách chạy được, tôn trọng `prefers-reduced-motion`; Lighthouse mobile hiệu năng và truy cập ≥ 90 ở trang chủ và một trang bài viết.
7. Dữ liệu hiện có (hồ sơ, 6 sản phẩm, 4 đào tạo, 5 video, số liệu) được chuyển vào D1 không mất mục nào.
8. Có sao lưu D1 định kỳ và hướng dẫn khôi phục.

## Trade-offs

| Hướng | Giả định chính | Hỏng đầu tiên khi |
|---|---|---|
| **A. Astro + adapter Cloudflare, SSR đọc D1, cache theo phiên bản nội dung (chọn)** | Một Worker gánh cả trang công khai, admin và API vẫn gọn | Trang công khai chậm nếu không có cache; giải bằng Cache API theo `content_version` |
| B. Giữ site tĩnh + Worker API riêng, trang gọi API bằng JS | Nội dung động hiển thị bằng client là đủ | SEO bài viết kém, hai thứ phải deploy và đồng bộ |
| C. CMS dựa trên Git (agent commit Markdown, build lại) | Có GitHub remote và CI | Repo chưa có remote; mỗi bài phải build lại; admin khó làm |

Better approaches: none — hướng A là hướng đáp ứng trực tiếp yêu cầu (admin + agent đăng bài tức thì). Lợi ích phụ: adapter Cloudflare tạo Build Output Specification nên có thể thử lại `cf deploy` (lần trước lỗi đúng vì thiếu phần này).

## Chosen direction

- **Nền tảng:** Astro 7 + `@astrojs/cloudflare` trên Worker `tqd-website`; D1 (`tqd_db`) cho nội dung; R2 (`tqd-media`) cho ảnh/video, phát qua `/media/{key}` (không mở bucket công khai); trang công khai SSR, cache bằng Cache API theo `content_version` tăng mỗi lần sửa.
- **Admin:** mật khẩu băm PBKDF2 (≥ 600k vòng) trong secret; cookie `__Host-` HttpOnly Secure SameSite=Strict, 12 giờ; kiểm `Origin`/`Sec-Fetch-Site` cho mọi thao tác ghi; giới hạn đăng nhập bằng Workers Rate Limiting. Giao diện admin: trang Astro + island React cho trình soạn Markdown có xem trước và chọn media.
- **API cho agent:** API key ngẫu nhiên 32 byte, lưu SHA-256; scope `articles:write`, `media:write`, `publish`; key có `publish` đăng thẳng, key thiếu `publish` tạo bản nháp (công tắc an toàn). Idempotent theo `slug`, chống ghi đè bằng `If-Match`. Upload media giới hạn 10 MB ảnh / 100 MB video, kiểm magic bytes.
- **Bài viết:** Markdown → HTML bằng remark/rehype + `rehype-sanitize`; link `rel="noopener nofollow ugc"`; dòng chỉ chứa link TikTok thành player. CSP chỉ cho `frame-src https://www.tiktok.com`.
- **Video TikTok:** lưu id số (15–20 chữ số) lấy từ link; player `https://www.tiktok.com/player/v1/{id}` hiện khi bấm (ảnh bìa trước, iframe sau); link rút gọn `vm.tiktok.com` được Worker mở ra lấy id khi lưu, không được thì báo dán link đầy đủ.
- **Hiệu ứng** (viết mới bằng TS + WAAPI + CSS, GSAP chỉ khi cần): cửa sổ mở bung từ icon, đóng mờ, thu nhỏ kiểu genie về dock, phóng to/snap cạnh, Exposé; dock phóng đại theo chuột; hình nền aurora, sáng/tối, màu nhấn, chuyển cảnh View Transitions; điện thoại có màn hình icon, sheet trượt lên và kéo xuống để đóng; bảng ⌘K tìm bài viết/video; linh vật DũngTQ (6–8 tư thế tạo từ ảnh chân dung, chuyển cảnh bằng crossfade; dự phòng: avatar cách điệu) và nền thời tiết Hà Nội (Open-Meteo, mưa/tuyết bằng canvas).
- **Sao lưu:** Cron Trigger xuất D1 sang R2 hằng đêm; D1 Time Travel 30 ngày.
- **Deploy:** thử `cf deploy`, dự phòng Wrangler.

## Phân pha (theo mức rủi ro)

0. Adapter + D1/R2 + seed + deploy lên hostname preview; `tqd.io.vn` giữ nguyên.
1. Admin (đăng nhập, sửa hồ sơ/mục/video), trang công khai đọc D1; chuyển `tqd.io.vn` sang bản mới.
2. Bài viết + media + API key + skill `tqd-publish`.
3. Hiệu ứng: ⌘K và mobile trước, rồi cửa sổ/dock/Exposé, hình nền/giao diện.
4. Linh vật và thời tiết sau cùng, không chặn các pha trước.

## Evidence

- Catalog hiệu ứng zuey-me (Explore agent, 60 mục; 8 hiệu ứng chính: cửa sổ WAAPI từ điểm bấm, Exposé, dock cosine falloff, hình nền aurora + View Transition, sheet mobile kéo đóng, thời tiết canvas rAF, linh vật GSAP + sprite, palette `<dialog>`). Các lỗ hổng reduced-motion của bản gốc (nhãn Exposé, overlay mờ) cần tránh khi làm lại.
- TikTok embed player: `https://www.tiktok.com/player/v1/{post_id}`, tham số `autoplay`, `loop`, `muted`, `controls`…, có API `postMessage` (`play`, `pause`, `onStateChange`).
- `cf` 1.0.0-beta.14 lỗi vì thiếu Build Output Specification (`docs/deployment.md`).

## Risks

- Linh vật cần ảnh tư thế nhất quán; nếu model ảnh tạo không đều, dùng avatar cách điệu.
- `vm.tiktok.com` có thể chặn request từ Worker; khi đó yêu cầu link đầy đủ.
- SSR + cache sai có thể hiện nội dung cũ sau khi sửa; `content_version` phải tăng trong cùng giao dịch ghi.
- Agent đăng nhầm hàng loạt: giới hạn tần suất theo key, có thu hồi key và chế độ nháp.

## Unresolved questions

- Bài do agent viết có cần kiểm "trùng văn bản bài Facebook" không? Mặc định: chỉ **cảnh báo** trong admin, không chặn, vì đây là nội dung mới anh chủ động đăng.
