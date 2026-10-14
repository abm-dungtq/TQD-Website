---
slug: opus-video-skill-lam-video-tieng-viet
title: "Opus Video: skill để agent làm video tiếng Việt từ brief đến MP4"
summary: "Opus Video là skill mã nguồn mở giúp Claude Code, Codex và Antigravity làm video tiếng Việt khổ 16:9 và 9:16: kịch bản qua Viết Pro, giọng đọc ElevenLabs, dựng bằng HyperFrames, rồi tự kiểm lỗi trước khi giao."
tags: ["Opus Video", "Skill", "Video AI", "HyperFrames", "Claude Code"]
---

Opus Video là một skill cho agent lập trình (Claude Code, OpenAI Codex, Google Antigravity). Bạn đưa một brief hoặc một chủ đề bằng tiếng Việt, agent trả về file MP4 hoàn chỉnh ở khổ ngang 16:9, khổ dọc 9:16 hoặc cả hai. Mã nguồn mở theo giấy phép MIT tại [github.com/abm-dungtq/opus-video](https://github.com/abm-dungtq/opus-video).

Mình làm skill này vì một vấn đề rất cụ thể. Agent bây giờ viết được kịch bản, gọi được công cụ đọc giọng và dựng được hình, nhưng để nó tự làm từ đầu đến cuối thì hay hỏng ở những chỗ người xem nhận ra ngay: câu văn dịch máy, chữ bị cắt ở khổ dọc, giọng lệch phụ đề, tiếng nhạc to hơn tiếng nói. Opus Video không thay các công cụ đó. Nó là bộ quy trình bắt agent đi đúng thứ tự và dừng lại khi một bước chưa đạt.

## Skill này làm gì và không làm gì

Opus Video chỉ điều phối, không tự render. Phần dựng hình do HyperFrames đảm nhận (Remotion hoặc Canvas khi cần), giọng đọc, hiệu ứng âm thanh và nhạc nền lấy từ ElevenLabs, kịch bản đi qua Viết Pro. Skill lo phần nối các công cụ lại và đặt cổng kiểm tra giữa chúng.

Những loại video skill hướng tới: video giải thích, quảng cáo, motion graphics, music video, video ngắn cho TikTok, Reels và YouTube. Trong repo có thư viện 30 prompt mẫu chia năm nhóm: làm mới từ đầu, làm từ nguồn có sẵn (một PR trên GitHub, một URL, một bài viết, một bộ ảnh), làm từ footage thật, video dọc và các việc sau khi dựng.

Skill không tự đăng video hay caption lên mạng xã hội. Đăng ở đâu, lúc nào vẫn là việc của bạn.

## Quy trình chín bước, bước sau chỉ chạy khi bước trước đạt

1. **Kiểm tra máy.** Script `setup-check.mjs` phải trả về `READY` thì mới bắt đầu.
2. **Brief.** Agent viết `BRIEF.md`: video nói gì, cho ai, dài bao lâu, khổ nào.
3. **Kịch bản qua Viết Pro.** Đây là cổng cứng. Kịch bản phải qua đủ lượt biên tập, kiểm tra giữ nguyên tên và số liệu, lint tiếng Việt, rồi `check-viet-pro.mjs` trả PASS. Nếu chưa qua, script đọc giọng sẽ từ chối chạy.
4. **Storyboard.** Agent tra 813 video mẫu để tìm cách dựng phù hợp, rồi chọn engine.
5. **Kế hoạch.** `PLAN.md` phải qua bước kiểm tra trước khi tốn tiền làm âm thanh.
6. **Âm thanh.** Giọng đọc ElevenLabs có mốc thời gian từng từ để khớp phụ đề, kèm hiệu ứng âm thanh và nhạc nền.
7. **Dựng hình và duyệt khung mẫu.** Agent chụp vài khung demo để bạn xem. Bạn duyệt thì mới dựng tiếp.
8. **Bản cuối.** Bản giao chỉ được xuất qua `render-final.mjs` và script này từ chối nếu thiếu kế hoạch, thiếu demo hoặc chưa có lời duyệt. Muốn đổi giọng mà giữ hình thì có chế độ `--audio-only`: với một video 60 giây khổ dọc, đổi tiếng mất khoảng một giây thay vì gần hai phút render lại.
9. **Kiểm lỗi và caption.** Tối đa ba vòng QA, sau đó agent viết caption cho Facebook và TikTok, cũng qua Viết Pro.

Cách làm này chậm hơn việc để agent tự do một chút ở đầu, nhưng nhanh hơn nhiều so với việc phát hiện lỗi sau khi đã render xong.

## Kiểm lỗi bằng máy trước, bằng mắt người sau cùng

Phần đo được thì giao cho máy. `ffprobe` kiểm độ phân giải, số khung hình mỗi giây, thời lượng và âm thanh. `qc-mp4.mjs` bắt các lỗi hay gặp như khung đen, hình đứng, khoảng lặng, âm lượng và đỉnh âm vượt ngưỡng. Một bộ lint riêng bắt chữ quá nhỏ, chữ lọt vào vùng giao diện của ứng dụng ở khổ dọc.

Phần cần mắt nhìn thì có thể nhờ Gemini (qua Antigravity CLI) xem bản nén 540p và chỉ lỗi. Repo ghi rõ giới hạn của cách này: ở độ phân giải thấp Gemini hay đọc nhầm dấu tiếng Việt, nên mọi lỗi nặng nó báo đều phải xem lại trên khung hình gốc.

Có một việc skill không tự chấm: thanh điệu và độ tự nhiên của giọng đọc. Phần này bạn phải tự nghe.

## Khổ dọc được dàn lại, không cắt từ khổ ngang

Khổ ngang xuất 1920×1080, khổ dọc 1080×1920. Bản dọc được dàn bố cục lại từ đầu và chừa khoảng trống phía trên, phía dưới cho thanh tên, nút bấm của TikTok hay Reels, thay vì cắt giữa bản ngang. Khi xuất cho từng nền tảng, `export.mjs` đưa âm lượng về mức -14 LUFS.

## Cần gì để chạy

- Node.js 22 trở lên, git, ffmpeg.
- CLI HyperFrames và bộ skill HyperFrames, skill Viết Pro.
- Tài khoản ElevenLabs với API key và một giọng đọc bạn chọn. Repo chưa ghi chi phí ElevenLabs cụ thể; chế độ tái dùng âm thanh giúp đỡ tốn credit khi sửa nhiều lần.
- Tuỳ chọn: Antigravity CLI để Gemini xem video, skill Remotion.

Key được lưu trong `~/.config/opus-video/.env` và các script không bao giờ in giá trị key ra màn hình.

Cài trên macOS, Linux hoặc WSL:

```bash
curl -fsSL https://raw.githubusercontent.com/abm-dungtq/opus-video/main/install.sh | bash
```

Cài trên Windows (PowerShell):

```powershell
irm https://raw.githubusercontent.com/abm-dungtq/opus-video/main/install.ps1 | iex
```

Sau đó gọi skill trong Claude Code:

```text
/opus-video làm video 30 giây giới thiệu <sản phẩm>, cả 16:9 và 9:16
```

Trong Codex thì dùng `$opus-video` thay cho `/opus-video`.

## Giới hạn hiện tại

- Nhánh làm từ footage thật vẫn đang beta, mới chạy thử trên clip tổng hợp.
- Lần đầu chép lời từ footage phải tải model khoảng 3 GB.
- Thông số xuất cho Zalo và Facebook mới là giả định, chưa đối chiếu với tài liệu của hai nền tảng.
- Agent phải chạy được lệnh shell; agent chỉ chat thì không qua được các cổng.

## Ghi công

Opus Video đứng trên vai nhiều dự án khác: HyperFrames để dựng hình, ElevenLabs cho âm thanh, Remotion, Gemini qua Google Antigravity. Phần cắt footage phỏng theo [open-edit](https://github.com/veedstudio/open-edit) của VEED (Apache-2.0). Bộ 813 video mẫu lấy từ hai tuyển tập mã nguồn mở theo giấy phép MIT; prompt thuộc về tác giả gốc và repo không phân phối lại video gốc.

Nếu bạn làm video bằng agent và hay phải sửa đi sửa lại cùng một loại lỗi, hãy thử cài Opus Video và chạy với một video ngắn 15–30 giây trước. Góp ý và báo lỗi gửi qua mục Issues trên [GitHub](https://github.com/abm-dungtq/opus-video).
