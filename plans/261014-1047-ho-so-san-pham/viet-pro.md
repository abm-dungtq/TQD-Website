---
slug: viet-pro-skill-viet-tieng-viet-cho-ai
title: "Viết Pro: skill giúp trợ lý AI viết tiếng Việt tự nhiên và đúng dữ kiện"
summary: "Viết Pro là skill cho Claude Code, OpenAI Codex và Google Antigravity: viết mới, biên tập, bớt giọng dịch và chuyển thể bài theo từng kênh, trong khi giữ nguyên tên, số liệu, ngày và đường link."
tags: ["Viết Pro", "Skill", "Claude Code", "Codex", "Antigravity"]
---

Viết Pro là một skill dạy trợ lý AI viết và biên tập tiếng Việt. Nó chạy trong Claude Code, OpenAI Codex và Google Antigravity, mã nguồn ở [github.com/abm-dungtq/viet-pro-codex](https://github.com/abm-dungtq/viet-pro-codex). Bản mới nhất là 5.3.0, phát hành ngày 08/10/2026.

## Vì sao mình làm Viết Pro

Ai dùng AI viết tiếng Việt đủ lâu đều nhận ra vài thói quen lặp lại: mở bài bằng "Trong bối cảnh...", câu đối lập kiểu "Không phải... mà là...", kết bài bằng một câu cảm thán cho có. Đọc qua thì trôi, nhưng người đọc nhận ra ngay đó là văn máy. Tệ hơn, khi nhờ AI "viết lại cho hay", nó thỉnh thoảng đổi luôn con số, ngày tháng hoặc làm hỏng đường link.

Thay vì dặn lại cùng một danh sách lưu ý trong mỗi câu lệnh, mình gói những lưu ý đó thành một skill để trợ lý AI tự áp dụng.

## Viết Pro làm được những gì

- Viết mới: bài blog, bài chuẩn SEO, bài LinkedIn, Facebook, tin Zalo, bản tin email, chuỗi bài trên X, kịch bản video.
- Biên tập bản nháp có sẵn, bớt giọng dịch, làm câu văn tự nhiên hơn.
- Chuyển một bài gốc thành nhiều phiên bản cho từng kênh mà vẫn giữ thông điệp và số liệu.
- Giữ nguyên tên riêng, số liệu, ngày tháng, đường link và trích dẫn qua mọi lần sửa.
- Không bịa số liệu, nguồn hay trải nghiệm. Phần nào chưa kiểm chứng được thì ghi rõ hoặc bỏ.

Bạn không cần học cú pháp riêng. Trong Claude Code gõ `/viet-pro` kèm yêu cầu, trong Codex gõ `$viet-pro`, hoặc chỉ cần nói "viết giúp mình bài này bằng Viết Pro".

## Cách skill vận hành

**Tự chọn mức làm việc.** Viết Pro có ba mức: Nhanh cho một chỉnh sửa ngắn, Chuẩn cho một bài mới và Tòa soạn cho việc cần nghiên cứu nhiều hoặc làm nhiều kênh cùng lúc. Bạn không phải chọn; skill đọc yêu cầu rồi quyết định. Mức Tòa soạn chỉ chia việc cho nhiều agent khi việc tách ra thực sự giúp bài tốt hơn, không dựng một dây chuyền nhiều vai cho có.

**Chỉ đọc phần hướng dẫn cần dùng.** Hướng dẫn được chia thành từng nhóm: nghiên cứu, kỹ thuật viết (mở bài, nhịp câu, ẩn dụ, phản bác, tài liệu kỹ thuật), từng kênh đăng (Facebook, LinkedIn, X, blog SEO, bản tin, kịch bản video, Zalo, Instagram) và rà soát. Viết một tin Zalo thì skill không cần đọc hướng dẫn viết bài SEO, nên đỡ tốn ngữ cảnh và trả lời nhanh hơn.

**Rà dấu hiệu văn máy.** Mọi văn bản công khai đều được rà nhẹ. Khi bạn yêu cầu "bớt giọng AI", skill rà đầy đủ theo danh mục 25 dấu hiệu chia năm nhóm: mở bài dàn cảnh, nhịp câu theo công thức, thổi phồng, định dạng trang trí và dấu vết chatbot. Mỗi lần sửa xong, skill đối chiếu lại tên, số, ngày, link và trích dẫn. Sửa tối đa hai vòng; nếu bài không khá hơn thì dừng và nói rõ chỗ vướng thay vì viết lại mãi.

**Hai công cụ kiểm tra chạy ngay trên máy, không cần mạng:**

- `lint-vietnamese-content.mjs` bắt các lỗi trình bày hay gặp: dấu cách trước dấu câu, khoảng trắng kép, tiêu đề viết hoa từng chữ kiểu tiếng Anh, các nhãn như "Key takeaways:" hay câu sót lại kiểu "Dưới đây là...".
- `compare-preserved-content.mjs` so bản trước và sau khi sửa, báo ngay nếu một đường link, con số, ngày tháng hay tên riêng bị mất hoặc bị đổi. Từ bản 5.3.0, công cụ này còn bắt được lỗi đảo nghĩa, ví dụ "tăng 12%" bị viết thành "giảm 12%".

## Ví dụ trước và sau

Trong repo có một bài Facebook mẫu trước và sau khi biên tập. Bản trước mở bằng "Trong bối cảnh...", có câu "Không phải... mà là..." và kết bằng "Và đó mới là điều đáng suy ngẫm". Bản sau bỏ các cụm đó, nói thẳng vào ý chính, hạ chữ "bước ngoặt" xuống mức mà dữ liệu cho phép, nhưng giữ nguyên con số 18%, ngày 10/09/2026, đường link và trích dẫn "mẫu 120 khách hàng".

Mình cũng chạy bộ 12 bài kiểm tra cho bản 5.3.0, gồm bài LinkedIn, humanize, tài liệu kỹ thuật, blog SEO, bản tin, tin Zalo, chuỗi bài X, kịch bản video, lỗi đảo nghĩa, claim chưa kiểm chứng, kiểm tra dấu hiệu văn máy và chuyển thể đa kênh. Bản 5.3.0 đạt cả 12 ca, bản 5.2.1 đạt 11. Mỗi bản mới chạy một lần, nên đây là tín hiệu tốt chứ chưa phải bằng chứng thống kê.

## Cài đặt

Trên macOS hoặc Linux, một lệnh cài cho cả ba nền tảng:

```bash
curl -fsSL https://raw.githubusercontent.com/abm-dungtq/viet-pro-codex/v5.3.0/install.sh | bash
```

Có thể chọn nơi cài bằng các cờ `--claude`, `--codex`, `--agy` hoặc `--all`. Bộ cài ghim đúng phiên bản và kiểm tra checksum. Nếu máy đã có bản cũ, bản cũ được chuyển vào `~/.viet-pro-backups/` chứ không bị xóa.

Bộ cài cần `git` và `bash` và chưa được kiểm thử trên Windows.

## Những gì Viết Pro không làm

- Không phát hiện được một văn bản do AI hay người viết. Các dấu hiệu trong danh mục chỉ là thói quen viết nên tránh.
- Không tự đăng bài, gửi email hay nhắn tin. Skill chỉ trả bản thảo sẵn sàng để bạn đăng.
- Chỉ làm chữ, không tạo ảnh, âm thanh hay video. Phần video mình làm ở một skill khác là [Opus Video](/bai-viet/opus-video-skill-lam-video-tieng-viet) và Opus Video dùng chính Viết Pro để viết kịch bản.
- Không thay người có thẩm quyền duyệt văn bản pháp lý, y tế hay tài chính.

## Các phiên bản trước

Viết Pro đi qua vài repo. Bản 4.0 cho Google Antigravity ra ngày 25/07/2026 ở [viet-pro-plugin](https://github.com/abm-dungtq/viet-pro-plugin), dựng theo mô hình tòa soạn với bốn agent. Bản cho Codex và ChatGPT Skills nằm ở [viet-pro](https://github.com/abm-dungtq/viet-pro). Từ tháng 9/2026, mình gom về [viet-pro-codex](https://github.com/abm-dungtq/viet-pro-codex) để một bản chạy được trên cả ba nền tảng. Đây là repo nên dùng.

## Ghi công

Danh mục dấu hiệu văn máy dựa trên [Humanizer](https://github.com/blader/humanizer) 3.0.0 của Siqi Chen, giấy phép MIT, được chuyển sang tiếng Việt và điều chỉnh cho cách viết tiếng Việt.

Nếu bạn viết nội dung tiếng Việt bằng AI hằng ngày, hãy cài thử và đưa cho nó một bài nháp bạn đang chưa ưng. Báo lỗi hoặc góp ý qua mục Issues trên [GitHub](https://github.com/abm-dungtq/viet-pro-codex).
