# Brief sản phẩm: TQD-Clean Your Mac

Repo: https://github.com/abm-dungtq/TQD-Clean-Your-Mac (nhánh `main`, push gần nhất 2026-10-09, 0 sao). Ký hiệu nguồn: [R] = `README.md`, [A] = `AGENTS.md`, [P] = `package.json`, [J1] = `plans/journals/2026-10-09-phases-5-6-shipped-native-bridge-deferred.md`, [J2] = `plans/journals/2026-10-09-upgrade-plan-for-tqd-clean-security-agent-install-ui.md`, [U] = README của upstream `tw93/Mole`.

## 1. Giải quyết vấn đề gì, cho ai
- `tw93/mole` dọn macOS "mạnh và cẩn thận, nhưng chỉ chạy trên Terminal". TQD-Clean đóng gói mole thành ứng dụng macOS giao diện tiếng Việt: "xem trước chính xác những gì mole sẽ dọn, rồi mới dọn" [R].
- Đối tượng: người dùng Mac nói tiếng Việt không quen Terminal. Họ cài bằng cách nhờ một agent lập trình (Claude Code, Codex...) [R]. Repo không nêu đối tượng cụ thể hơn (suy luận, cần xác nhận).

## 2. Tính năng [R]
- **Tổng quan:** dung lượng ổ đĩa (kèm phần có thể dọn), CPU và RAM theo thời gian thực, tự đổi sáng/tối theo macOS.
- **Dọn dẹp:** chạy `mole clean --dry-run`, hiện từng mục theo nhóm kèm dung lượng. Nút "Dọn tất cả" dọn đúng danh sách đó, nút "Luôn bỏ qua" đưa mục vào danh sách loại trừ. Một số cache hệ thống cần quyền quản trị viên nên có thể bị bỏ qua.
- **Dọn dự án lập trình:** tìm `node_modules`, `target`, `.gradle`, `venv`, `.venv`, cho người dùng chọn rồi chuyển vào Thùng rác.
- **Gỡ ứng dụng:** dùng `mole uninstall`, chạy thử để liệt kê tệp liên quan, người dùng xác nhận rồi mới chuyển vào Thùng rác.
- **Phân tích ổ đĩa:** `mole analyze`, xem thư mục chiếm chỗ trong thư mục người dùng, đi sâu từng cấp, mở trong Finder. Chỉ đọc. Theo [J1], chỉ quét trong home folder.
- **Tối ưu:** giải phóng RAM, xoá cache DNS, dựng lại chỉ mục Spotlight, sửa menu "Mở bằng".
- **Cài đặt:** phiên bản, lệnh cập nhật, trạng thái Full Disk Access, danh sách loại trừ, biểu đồ dung lượng đã giải phóng trong 30 ngày, lịch sử dọn.
- **Nhắc dọn hằng tuần (tuỳ chọn):** sau 7 ngày chưa dọn thì nhắc. "App không bao giờ tự dọn khi chưa có bạn xác nhận."
- **Thanh menu:** hiện dung lượng còn trống khi app đang mở.
- **Giao diện "Cyber-HUD":** mô tả repo vẫn ghi "Giao diện Cyber-HUD 100% Tiếng Việt", nhưng README hiện tại không nhắc Cyber-HUD. Theo lịch sử commit: bản khởi tạo (2026-09-03) dùng UI Cyber-HUD, cùng ngày chuyển sang "macOS Native Light Theme", và ngày 2026-10-09 thiết kế lại mọi màn hình trên hệ sáng/tối oklch ([J1], `docs/design-guidelines.md`). **Nên mô tả là giao diện tiếng Việt sáng/tối kiểu macOS. "Cyber-HUD" là cách gọi cũ.**
- Kiến trúc: vỏ Swift AppKit + WKWebView, backend Bun/TypeScript, UI React + Vite + Tailwind [R][A].

## 3. Cơ chế an toàn
- Mọi thao tác dọn đều do mole thực hiện và tôn trọng `~/.config/mole/whitelist` [R].
- Gỡ ứng dụng và dọn dự án chuyển tệp vào Thùng rác, không xoá vĩnh viễn [R].
- Máy chủ nội bộ chỉ nghe trên `127.0.0.1`, kiểm tra Host/Origin, mỗi yêu cầu cần mã phiên ngẫu nhiên [R]. Ở chế độ native, cổng do hệ điều hành cấp, token được tiêm qua WKUserScript chứ không nằm trên URL, liên kết ngoài mở bằng trình duyệt [J1].
- Nhật ký thao tác: `~/Library/Logs/mole/operations.log` [R].
- Quy tắc cho agent: không bao giờ chạy `mole clean`, `mole uninstall` (khi thiếu `--dry-run`) hay `mole update` thay người dùng; không dùng `sudo`; không sửa whitelist khi chưa được yêu cầu; không xoá tệp để lấy chỗ build [A].
- Do upstream thừa hưởng: mole kiểm tra đường dẫn, bảo vệ vị trí dùng chung và vị trí của hệ thống, bỏ qua hoặc từ chối mục nó không chứng minh được là an toàn [U]. **Lưu ý:** `mo clean` mặc định dọn sạch Thùng rác, trừ khi người dùng chọn Trash trong whitelist [U]. README của TQD không nhắc điểm này, chưa rõ app xử lý thế nào.
- Repo không có danh sách "những thứ không bao giờ xoá" riêng của TQD. Không nên tự viết một danh sách như vậy.

## 4. Hệ điều hành và chip
macOS 13 trở lên, Apple Silicon và Intel [R][A]. Bản thân mole hỗ trợ từ macOS 12 [U]. Như vậy macOS 12 có mole chạy được nhưng TQD-Clean không hỗ trợ.

## 5. Cài đặt và sử dụng (nguyên văn [R])
- Nhờ agent: "Hãy cài TQD-Clean Your Mac từ https://github.com/abm-dungtq/TQD-Clean-Your-Mac theo AGENTS.md trong repo."
- Thủ công:
  - `git clone https://github.com/abm-dungtq/TQD-Clean-Your-Mac.git ~/Developer/TQD-Clean-Your-Mac`
  - `cd ~/Developer/TQD-Clean-Your-Mac && bash scripts/install.sh --open`
  - Không cần `sudo`. App cài vào `~/Applications/TQD-Clean Your Mac.app`.
- Yêu cầu: Xcode Command Line Tools (`xcode-select --install`), bun 1.4.1 trở lên, Node.js 20 trở lên kèm npm. Mã thoát 2 nghĩa là thiếu công cụ; script in ra lệnh sửa nhưng không tự cài [A].
- Cập nhật: `cd ~/Developer/TQD-Clean-Your-Mac && git pull --ff-only && bash scripts/install.sh --open`
- Gỡ cài đặt: `cd ~/Developer/TQD-Clean-Your-Mac && bash scripts/uninstall-app.sh`. Lệnh này chuyển app vào Thùng rác và giữ lại `~/.config/mole`.
- Một số thư mục cần cấp Full Disk Access (System Settings > Privacy & Security) [A].

## 6. Phiên bản và lịch sử
- `package.json` ghi version `2.0.0` [P]. Repo không có GitHub Release hay tag nào.
- Engine được ghim ở mole `1.58.0` (tag `V1.58.0`) và kiểm tra SHA-256 cho binary arm64/amd64 (`config/mole-pin.json`).
- 2026-09-03: tạo repo và khởi tạo app với UI Cyber-HUD, chuyển sang Light Theme, viết README, thêm script đồng bộ mole và trình kiểm tra cập nhật.
- 2026-10-09: sửa lỗ hổng localhost (rò token, xoá tùy ý), đồng bộ mole 1.58.0, bỏ đường DMG để chuyển sang build từ mã nguồn qua agent, thiết kế lại UI, thêm phân tích ổ đĩa, nhắc hằng tuần, biểu đồ 30 ngày, telemetry qua SSE, mục thanh menu (lịch sử commit; [J2]).

## 7. Ảnh minh hoạ
- Chỉ có một ảnh: https://raw.githubusercontent.com/abm-dungtq/TQD-Clean-Your-Mac/main/assets/macos_light_dashboard.png
- **Không chắc còn đúng:** ảnh được commit ngày 2026-09-03, trước đợt thiết kế lại ngày 2026-10-09, nên có thể không khớp UI hiện tại. [J1] ghi rằng chưa ai xác nhận bằng mắt trên app đã cài.

## 8. Giới hạn và rủi ro
- Không có bản cài đóng gói sẵn (DMG). Phải build từ mã nguồn và có bộ công cụ dev [R].
- "Dọn dẹp luôn có rủi ro: hãy đọc bản xem trước trước khi bấm 'Dọn tất cả'" [R]. Một số cache cần quyền admin có thể bị bỏ qua [R].
- Không dọn theo từng nhóm: mole đã bỏ `--select/--categories`, nên app chỉ có "Dọn tất cả" kèm whitelist [J2].
- Phân tích ổ đĩa chỉ quét thư mục người dùng [R][J1]. Mole được đồng bộ thủ công, app không tự tải engine mới [J2].
- Repo mới (2 đợt commit, 0 sao). Repo không công bố số người dùng hay kết quả dọn thực tế. Các tiêu chí thành công trong plan chưa được đánh dấu hoàn thành [J1].

## 9. Giấy phép và ghi công upstream
- README và `package.json` ghi GPL-3.0 "kế thừa từ `tw93/mole`" [R][P]. **Tuy vậy repo chưa có tệp LICENSE ở gốc** (GitHub không nhận diện được giấy phép; [J1] cũng ghi "the LICENSE file is missing"). Chỉ có `mole/LICENSE` (GNU GPL v3).
- Thừa kế từ mole: toàn bộ engine dọn, gỡ, tối ưu, phân tích, dry-run, whitelist, log thao tác. Mã nguồn mole nằm trong `mole/` [R][U].
- TQD tự làm thêm: vỏ app macOS, UI tiếng Việt, máy chủ nội bộ, cài qua agent, nhắc hằng tuần, biểu đồ và lịch sử, thanh menu, màn dọn dự án chuyển vào Thùng rác [R]. Upstream `mo purge` thì xoá vĩnh viễn [U]; cách TQD triển khai chưa được kiểm chứng trong mã.
- Chính sách thương hiệu của mole (`mole/TRADEMARK.md`): GPL-3.0 chỉ áp dụng cho mã, không cho thương hiệu. Bản fork phải dùng tên và icon riêng, không được ngụ ý mole bảo trợ. "Mole for Mac" (mole.fit) là sản phẩm độc quyền riêng biệt. TQD dùng tên riêng và chỉ ghi "chạy trên động cơ tw93/mole", phù hợp với chính sách. Bài viết không nên ngụ ý có liên kết chính thức với mole.

## Câu hỏi còn mở
- Có cần thêm tệp LICENSE trước khi đăng bài?
- Có ảnh chụp mới của UI sau ngày 2026-10-09 không?
- App có giữ hành vi "dọn sạch Thùng rác" mặc định của mole không?
