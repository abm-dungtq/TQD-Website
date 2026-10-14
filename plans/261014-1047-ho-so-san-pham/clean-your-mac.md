---
slug: tqd-clean-your-mac-don-dep-macos-tieng-viet
title: "TQD-Clean Your Mac: dọn dẹp và tối ưu macOS bằng giao diện tiếng Việt"
summary: "TQD-Clean Your Mac đóng gói công cụ dọn dẹp mã nguồn mở tw93/mole thành một ứng dụng macOS tiếng Việt: xem trước chính xác những gì sẽ bị dọn, rồi mới dọn. Gỡ ứng dụng và dọn dự án đều chuyển vào Thùng rác."
tags: ["TQD-Clean Your Mac", "macOS", "Mã nguồn mở", "App"]
---

TQD-Clean Your Mac là ứng dụng dọn dẹp và tối ưu macOS có giao diện hoàn toàn bằng tiếng Việt. Bên dưới, mọi thao tác dọn đều do [Mole](https://github.com/tw93/mole) thực hiện. Mole là công cụ dòng lệnh mã nguồn mở của tw93, dọn rất kỹ và cẩn thận nhưng chỉ chạy trong Terminal. Ứng dụng của mình thêm một lớp giao diện để người không quen Terminal cũng dùng được. Mã nguồn ở [github.com/abm-dungtq/TQD-Clean-Your-Mac](https://github.com/abm-dungtq/TQD-Clean-Your-Mac).

## Xem trước rồi mới dọn

Ứng dụng dọn dẹp nào cũng có rủi ro xoá nhầm. Vì vậy mọi màn hình trong TQD-Clean đều đi theo cùng một thứ tự: chạy thử để liệt kê, bạn đọc danh sách, bạn bấm xác nhận, rồi mới thực hiện. Ứng dụng không bao giờ tự dọn khi chưa có bạn xác nhận, kể cả khi bật lời nhắc hằng tuần.

## Các màn hình chính

- **Tổng quan:** dung lượng ổ đĩa và phần có thể dọn, CPU và RAM theo thời gian thực. Giao diện sáng hoặc tối tự đổi theo macOS.
- **Dọn dẹp:** chạy `mole clean --dry-run` và hiện từng mục theo nhóm kèm dung lượng. Nút "Dọn tất cả" dọn đúng danh sách bạn vừa xem. Mục nào bạn muốn giữ thì bấm "Luôn bỏ qua" để đưa vào danh sách loại trừ.
- **Dọn dự án lập trình:** tìm các thư mục `node_modules`, `target`, `.gradle`, `venv`, `.venv` trong máy, để bạn chọn những thư mục cần xoá rồi chuyển chúng vào Thùng rác.
- **Gỡ ứng dụng:** liệt kê ứng dụng cùng các tệp đi kèm, bạn xác nhận thì chuyển tất cả vào Thùng rác.
- **Phân tích ổ đĩa:** xem thư mục nào chiếm chỗ trong thư mục người dùng, đi sâu từng cấp, mở thẳng trong Finder. Màn này chỉ đọc, không xoá gì.
- **Tối ưu:** giải phóng RAM, xoá bộ nhớ đệm DNS, dựng lại chỉ mục Spotlight, sửa menu "Mở bằng" bị lặp.
- **Cài đặt và lịch sử:** phiên bản, lệnh cập nhật, trạng thái quyền truy cập toàn bộ ổ đĩa, danh sách loại trừ, biểu đồ dung lượng đã giải phóng trong 30 ngày và lịch sử các lần dọn.
- **Thanh menu:** hiện dung lượng còn trống khi ứng dụng đang mở.

## Các lớp an toàn

- Mọi thao tác dọn đều đi qua Mole và tôn trọng danh sách loại trừ của Mole tại `~/.config/mole/whitelist`. Mole kiểm tra đường dẫn, bảo vệ thư mục hệ thống và thư mục dùng chung, gặp mục nào không chứng minh được là an toàn thì bỏ qua.
- Gỡ ứng dụng và dọn dự án chuyển tệp vào Thùng rác, không xoá vĩnh viễn, nên vẫn khôi phục được. Lưu ý: theo mặc định của Mole, lệnh dọn dẹp cũng làm trống Thùng rác. Nếu vừa gỡ nhầm thứ gì, hãy khôi phục trước khi bấm "Dọn tất cả", hoặc thêm Thùng rác vào danh sách loại trừ.
- Mỗi thao tác được ghi vào nhật ký `~/Library/Logs/mole/operations.log`.
- Máy chủ nội bộ của ứng dụng chỉ nghe trên `127.0.0.1` và mỗi yêu cầu phải kèm mã phiên ngẫu nhiên, để chặn trang web khác gọi vào ứng dụng.
- Phiên bản Mole được ghim cố định (hiện là 1.58.0) và kiểm tra mã băm SHA-256 trước khi dùng.

Dù vậy, dọn dẹp luôn có rủi ro. Hãy đọc kỹ bản xem trước trước khi bấm "Dọn tất cả".

## Cài đặt bằng agent lập trình

Hiện chưa có bản cài đóng gói sẵn. Ứng dụng được dựng từ mã nguồn ngay trên máy bạn và cách dễ nhất là nhờ một agent lập trình như Claude Code hay Codex làm giúp. Mở agent và gõ:

```text
Hãy cài TQD-Clean Your Mac từ https://github.com/abm-dungtq/TQD-Clean-Your-Mac theo AGENTS.md trong repo.
```

Tệp `AGENTS.md` trong repo quy định rõ agent được và không được làm gì: không tự chạy lệnh dọn hay gỡ ứng dụng thay bạn, không dùng `sudo`, không sửa danh sách loại trừ khi bạn chưa yêu cầu.

Nếu muốn tự cài, máy cần Xcode Command Line Tools, bun 1.4.1 trở lên và Node.js 20 trở lên:

```bash
git clone https://github.com/abm-dungtq/TQD-Clean-Your-Mac.git ~/Developer/TQD-Clean-Your-Mac
cd ~/Developer/TQD-Clean-Your-Mac && bash scripts/install.sh --open
```

Ứng dụng được cài vào `~/Applications`, không cần quyền quản trị. Một số thư mục chỉ dọn được khi bạn cấp quyền Full Disk Access trong System Settings > Privacy & Security.

Cập nhật bản mới:

```bash
cd ~/Developer/TQD-Clean-Your-Mac && git pull --ff-only && bash scripts/install.sh --open
```

## Yêu cầu và giới hạn

- Chạy trên macOS 13 trở lên, cả máy Apple Silicon lẫn Intel.
- Phải dựng từ mã nguồn, nên cần bộ công cụ lập trình ở trên.
- Mole đã bỏ chế độ chọn từng nhóm khi dọn, nên ứng dụng chỉ có "Dọn tất cả" kết hợp danh sách loại trừ.
- Một số bộ nhớ đệm hệ thống cần quyền quản trị nên có thể bị bỏ qua.
- Phân tích ổ đĩa chỉ quét trong thư mục người dùng.
- Ứng dụng không tự tải phiên bản Mole mới; engine chỉ đổi khi bạn cập nhật ứng dụng từ repo.

## Ghi công và giấy phép

Toàn bộ engine dọn dẹp, gỡ ứng dụng, tối ưu, phân tích, chạy thử và danh sách loại trừ là của [Mole](https://github.com/tw93/mole) do tw93 phát triển, phát hành theo giấy phép GPL-3.0. Phần mình làm thêm là vỏ ứng dụng macOS, giao diện tiếng Việt, máy chủ nội bộ, cách cài qua agent, lời nhắc hằng tuần, biểu đồ, lịch sử và mục trên thanh menu. TQD-Clean Your Mac kế thừa giấy phép GPL-3.0 của Mole. Đây là dự án độc lập, không phải sản phẩm chính thức của Mole và không được Mole bảo trợ.

Nếu bạn dùng Mac và muốn biết ổ đĩa đang đầy vì đâu, hãy cài thử và mở màn Phân tích ổ đĩa trước, vì màn này chỉ đọc nên không có rủi ro gì. Báo lỗi hoặc góp ý qua mục Issues trên [GitHub](https://github.com/abm-dungtq/TQD-Clean-Your-Mac).
