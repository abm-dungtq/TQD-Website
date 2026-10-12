# Brainstorm: website cá nhân DũngTQ (tqd.io.vn)

Ngày: 2026-10-12 · Chế độ: `--advice --auto` · Tư vấn: kongming

## Outcome

Website cá nhân của Trịnh Quang Dũng (DũngTQ) chạy tại `https://tqd.io.vn`, lấy cảm hứng giao diện từ zuey.me (mrgoonie/zuey-me). Nội dung là thông tin tổng hợp về DũngTQ rút ra từ hoạt động AI trên Facebook 10/07–10/10/2026: hồ sơ, sản phẩm tự xây, đào tạo và sự kiện, video AI, chuyên môn, số liệu tổng hợp, liên hệ.

## Constraints

- Không đăng nội dung bất kỳ bài Facebook nào: không trích văn bản, không danh sách bài, không trang từng bài. Bài đăng chỉ là nguồn để tổng hợp.
- Bỏ 10 bài nhóm "Cần anh xác nhận".
- zuey-me không có license: chỉ lấy cảm hứng (ý tưởng "OS desktop", llms.txt, route `.md`), viết code mới, không sao chép file.
- Deploy vào tài khoản Cloudflare đang đăng nhập ("Xaotiensinh@gmail.com's Account"), đã được người dùng chấp thuận.
- Domain `tqd.io.vn`: zone đang `active` trong cùng tài khoản, NS `leia`/`melnicoff.ns.cloudflare.com`, apex chưa có bản ghi A.
- Công cụ deploy: thử `cf` CLI (beta, chưa cài); Wrangler 4.126 đã cài và đăng nhập là đường dự phòng đã kiểm chứng.
- Site tĩnh: không D1, R2, KV, Workers AI.

## Non-goals

Thành viên, thanh toán, khoá học, booking, referral, MCP server, OAuth, Studio/CMS, chat AI, feed bài viết, mascot, nền thời tiết.

## Acceptance criteria

1. `https://tqd.io.vn` trả 200 qua HTTPS, hiển thị đủ các mục: Hồ sơ, Sản phẩm, Đào tạo & sự kiện, Video AI, Chuyên môn, Số liệu, Liên hệ.
2. Mỗi mục là một route thật, đọc được khi tắt JavaScript; trang chủ có lớp giao diện "desktop" (dock, cửa sổ) trên máy tính và lưới ứng dụng trên điện thoại.
3. Không có đoạn văn bản bài Facebook nào xuất hiện trong mã nguồn build (`dist/`).
4. `/llms.txt`, `/index.md`, `/sitemap.xml` trả 200.
5. Số liệu khớp bản tóm tắt: 71 bài AI / 13 tuần, 11 Reel, Reel cao nhất 73K và 17K lượt xem, phân bổ 9/5/5/17/35.
6. Lighthouse mobile ≥ 90; build sạch lỗi type.
7. README ghi lệnh deploy (`cf` hoặc Wrangler) và tài khoản Cloudflare đích.

## Trade-offs

| Hướng | Giả định chính | Hỏng đầu tiên khi |
|---|---|---|
| A. Astro tĩnh, route thật + lớp "desktop" mỏng (chọn) | Nội dung nhỏ (~7 mục) đủ để lớp desktop có ý nghĩa | Lớp desktop phình JS; khi đó bỏ lớp này, site vẫn chạy như portfolio biên tập |
| B. Fork zuey-me rồi cắt bớt | Được phép dùng lại code | Repo không có license; 24 migration và hạ tầng D1 thừa |
| C. Một trang HTML tĩnh | Không cần cảm giác zuey.me | Mất phần "cảm hứng zuey-me" người dùng yêu cầu |

Better approaches: none — hướng được chọn là hướng người dùng yêu cầu, chỉ đổi cách dùng zuey-me từ "dùng code" sang "lấy cảm hứng" vì repo không có license (`gh repo view` trả `licenseInfo: null`).

## Chosen direction

- Astro (static output) + Tailwind, island React/vanilla chỉ cho lớp desktop.
- Dữ liệu: `src/data/profile.ts` biên soạn tay từ `portfolio-ai-tom-tat.md`, số liệu tổng hợp tính một lần từ JSON (không nhúng JSON thô).
- Deploy: Worker với static assets, `wrangler.jsonc` có `routes: [{ pattern: "tqd.io.vn", custom_domain: true }]`; chạy `cf deploy`, lỗi thì `wrangler deploy`.

## Evidence

- zuey-me: Astro 5 SSR + Cloudflare Pages + D1; trang chủ "Zuey OS" (`src/components/os/`); có `llms.txt`, route `.md`.
- Dữ liệu: `D:\TQD\tqd-browser\automation_data\portfolio\` (JSON 81 mục: 71 AI + 10 cần xác nhận; 15 Reel trong JSON gồm cả Reel không thuộc AI).
- `cf` CLI: beta, `npm i -g cf`, `cf init/dev/build/deploy`, build/deploy ủy quyền cho Wrangler hoặc Vite plugin.

## Risks

- `cf` beta có thể không xử lý custom domain; dự phòng Wrangler.
- Số liệu Reel là chuỗi ("73K", "1,2K"); chỉ dùng số đã có trong bản tóm tắt.
- Trùng bản ghi DNS ở apex (không đọc được danh sách bản ghi với quyền OAuth hiện tại); Wrangler sẽ báo lỗi nếu có.
- Token OAuth có thể thiếu quyền Zone/DNS để gắn custom domain. Nếu deploy lỗi quyền: deploy lên `workers.dev` không kèm route, rồi gắn domain trong dashboard (Worker > Settings > Domains); ghi lại cách này, không thử lặp. `www` ngoài phạm vi.
- Tổng hợp bị "thêm thắt": mọi con số và chi tiết sản phẩm phải truy được về `portfolio-ai-tom-tat.md`; thiếu thì bỏ, không đoán. Chỉ dùng số liệu tổng hợp, không dùng số liệu từng bài.

## Unresolved questions

- Ảnh chân dung, email/Zalo liên hệ và link Facebook hiển thị công khai: chưa có trong dữ liệu; dùng chữ viết tắt "TQD" làm avatar và chỉ đưa link công khai đã có (GitHub abm-dungtq, lp.abmedu.vn) cho đến khi người dùng bổ sung.
