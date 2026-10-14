# Brief sản phẩm: opus-video (abm-dungtq)

Repo: https://github.com/abm-dungtq/opus-video · MIT · tạo 2026-10-09, push cuối 2026-10-13 (`gh repo view`). Không có release hay tag nào.

## 1. Vấn đề và đối tượng
- Đây là agent skill nhận brief hoặc chủ đề tiếng Việt và trả về MP4 hoàn chỉnh ở khổ 16:9, 9:16 hoặc cả hai (README.md).
- Skill chỉ điều phối, **không tự render**. Nó gọi viet-pro, HyperFrames, media-use và Remotion theo thứ tự, và bước sau không chạy khi bước trước chưa đạt (SKILL.md; docs/gioi-thieu.md).
- Chạy trên Claude Code, OpenAI Codex, Google Antigravity (app và CLI) và mọi agent đọc được `SKILL.md`, trên macOS, Linux, WSL và Windows (README.md). Agent phải chạy được shell, nếu không thì không qua được các cổng (docs/cai-dat-agent.md).
- Loại video được nêu: explainer, quảng cáo, motion graphics, music video, TikTok/Reels/YouTube (SKILL.md, frontmatter). Thư viện có 30 prompt mẫu chia 5 nhóm: tạo mới, từ nguồn có sẵn (PR GitHub, URL, bài viết, bộ ảnh), footage thật, video dọc, vận hành sau dựng (docs/thu-vien-prompt/README.md).
- Repo không nêu nhóm người dùng cụ thể, cũng không có số liệu về người dùng.

## 2. Pipeline (README.md §6; SKILL.md)
0. `setup-check.mjs` phải trả `READY`.
1. Viết `BRIEF.md`.
2. Kịch bản qua viet-pro ở mức đầy đủ: đọc hết review/editorial, lượt Humanizer có ghi chép, `compare-preserved-content`, lint. Cổng là `check-viet-pro.mjs` → PASS.
3. Storyboard. Tra case trong 813 video mẫu bằng `find-cases`, hoặc nhờ Jev xếp hạng nếu có key.
4. Chọn engine: HyperFrames mặc định, Remotion hoặc Canvas khi cần (references/engine-selection.md).
4b. `PLAN.md` phải qua `check-preflight.mjs --stage plan`.
5. Âm thanh bằng ElevenLabs: giọng `eleven_v4` có timestamp từng từ, SFX `eleven_text_to_sound_v2`, nhạc `music_v2_5`. `eleven.mjs` thoát exit 4 nếu cổng viet-pro chặn. Mỗi file giọng kèm `.gate.json` chứa hash.
6. Dựng hình. 6b: `make-demo.mjs` chụp khung demo, người dùng duyệt, ghi `approval:` vào `DEMO.md`.
7. Nháp dùng `--quality looks`. Bản giao **chỉ** ra qua `render-final.mjs` (exit 5 nếu thiếu plan, demo hoặc lời duyệt). `--audio-only` đổi tiếng mà không render lại hình (CHANGELOG 2026-10-13).
8. QA tối đa 3 vòng, ghi vào `QA.md`.
9. Hai caption Facebook cá nhân và TikTok qua viet-pro (`--stage delivery`). `export.mjs` xuất bản riêng cho zalo, youtube, tiktok, facebook.

Nhánh phụ: footage thật (beta, dùng `cut.mjs`) và "clip làm trục + nền dựng mới" với `voice_source: clip`, phụ đề lấy từ Whisper (README.md; references/clip-master-canvas.md).

## 3. Công cụ, key, chi phí
- Bắt buộc: Node ≥ 22, git, ffmpeg/ffprobe, CLI `hyperframes` ≥ 0.8.144, viet-pro v5.3.0, đủ 20 skill HyperFrames, `ELEVENLABS_API_KEY`, `OPUS_VIDEO_VOICE_ID` (README.md §2–4).
- Tuỳ chọn: `agy` (Gemini làm giám khảo), `TYPESAFE_API_KEY` (Jev), skill Remotion.
- Key nằm trong `~/.config/opus-video/.env`. Script không bao giờ in giá trị key.
- Chi phí có ghi trong tài liệu: Jev xếp hạng khoảng 740 case mất khoảng 1 giây và khoảng 0,03 USD (SKILL.md; CHANGELOG 2026-10-11). Gắn nhãn lại toàn corpus khoảng 0,07 USD (SKILL.md).
- **Chưa xác định:** chi phí ElevenLabs và gói (tier) cần dùng. Tài liệu chỉ nói `doctor` in ra `tier`, và `--reuse` giúp đỡ tốn credit.

## 4. Định dạng
- Khổ `16:9` (1920×1080), `9:16` (1080×1920) hoặc `both`. Bản dọc được dàn lại bố cục chứ không cắt từ bản ngang, và chừa 12% trên, 20% dưới cho UI (references/qa-checklist.md; docs/thu-vien-prompt/README.md).
- `export.mjs` chuẩn hoá loudness về -14 LUFS. Thông số zalo và facebook là giả định, chưa đối chiếu với tài liệu của nền tảng (CHANGELOG 2026-10-13).

## 5. Lệnh cài và dùng (README.md)
```bash
curl -fsSL https://raw.githubusercontent.com/abm-dungtq/opus-video/main/install.sh | bash
```
```powershell
irm https://raw.githubusercontent.com/abm-dungtq/opus-video/main/install.ps1 | iex
```
Cờ của install.sh: `--claude --codex --agy --agy-cli --workspace`, `--ref`, `--with-remotion`, `--skip-deps`. PowerShell dùng `-Hosts claude,codex`.

Kiểm tra: `node ~/.claude/skills/opus-video/scripts/setup-check.mjs`, rồi `node ~/.claude/skills/opus-video/scripts/eleven.mjs doctor`.

Gọi skill: `/opus-video làm video 30 giây giới thiệu <sản phẩm>, cả 16:9 và 9:16` (Codex dùng `$opus-video …`).

Test: `node --test ~/.claude/skills/opus-video/scripts/tests/`

## 6. QA (references/qa-checklist.md; SKILL.md bước 8)
- Đo bằng máy: ffprobe kiểm độ phân giải, fps, thời lượng (lệch ≤ 0,5 s) và audio. `qc-mp4.mjs` kiểm loudness, true peak, khung đen, đứng hình, khoảng lặng, bitrate. Thêm `hyperframes lint/check` và `video-lint.mjs`, bắt lỗi chữ bị ép thường, chữ quá nhỏ, vùng UI 9:16, nhãn rào đón.
- Gemini qua `agy` xem bản 540p (`judge.mjs check`). Từ v2 so cặp phiên bản (`pair`). Repo tự ghi nhận Gemini hay đọc nhầm dấu ở 540p và thiên vị video đưa vào trước, nên mọi lỗi hard phải xem lại trên frame gốc. Không có agy thì QA bằng ảnh tĩnh.
- Thanh điệu và giọng đọc thì agent không tự chấm, người dùng phải tự nghe. Phụ đề lệch giọng tối đa 150 ms.

## 7. Lịch sử phiên bản (CHANGELOG.md; commits)
- 2026-10-09: công bố skill.
- 2026-10-10: thêm nhánh footage thật và `cut.mjs`.
- 2026-10-11: xếp hạng case bằng Jev, thêm `--help` cho mọi script.
- 2026-10-12: cổng viet-pro cưỡng chế, installer đa agent và đa OS, cổng plan và demo.
- 2026-10-13: nhánh clip-voiced; `qc-mp4`, `export`, `audio-mix`, `--audio-only`; hướng dẫn chuyên sâu và thư viện prompt.

## 8. Ví dụ có trong repo
- 30 prompt mẫu, mỗi prompt kèm ví dụ đã điền và id case thật (docs/thu-vien-prompt/).
- Ví dụ brief 15 giây (references/brief-template.md, theo bảng tham chiếu trong SKILL.md, tôi chưa mở file này).
- Fixture test là dự án mẫu tối giản, không phải sản phẩm demo (scripts/tests/fixtures/).
- **Không tìm thấy link video mẫu** do skill tạo ra trong README, docs hay references đã đọc.
- Thời gian đo được: `--audio-only` mất khoảng 1 s, so với khoảng 108–111 s để render đầy đủ video 60 s khổ 9:16 (CHANGELOG 2026-10-13).
- Số ca test lệch nhau giữa các nguồn: docs/gioi-thieu.md ghi 126 ca đều đạt, CHANGELOG 2026-10-12 ghi 82 ca (74 pass, 8 skip). Tôi chưa tự chạy test.

## 9. Giới hạn, những gì không làm
- Không tự đăng video hay caption lên mạng xã hội. Không sửa các skill upstream (SKILL.md "Ranh giới").
- Nhánh footage đang beta: mới smoke trên clip tổng hợp, chưa chạy trên clip người thật. Mốc từ của Whisper lệch trung vị 0,22 s, p90 0,5 s (references/footage-lane.md).
- Lần chép lời đầu tiên phải tải khoảng 3 GB model (references/footage-lane.md).
- Đường Canvas không có lint, check hay studio (references/engine-selection.md).
- Giọng mặc định không gắn nhãn tiếng Việt (docs/huong-dan-chuyen-sau.md).
- Agent chạy không giám sát chỉ được ghi `approval: auto` khi người dùng đã nói rõ (docs/cai-dat-agent.md).

## 10. Giấy phép và ghi công
- Mã nguồn MIT, © 2026 abm-dungtq (LICENSE; NOTICE).
- `cut.mjs` phỏng theo open-edit (https://github.com/veedstudio/open-edit, Apache-2.0, © VEED LIMITED) (NOTICE; third_party/open-edit/LICENSE).
- Corpus 813 case lấy từ yihui-dev/awesome-opus5-5-videos (513 case) và chuspeeism/awesome-opus-5-5-videos (300 case), cả hai đều MIT, lấy ngày 2026-10-08. Prompt thuộc tác giả gốc và repo không phân phối lại video gốc (data/SOURCES.md).
- Các upstream khác: viet-pro (abm-dungtq/viet-pro-codex, MIT; Humanizer xem THIRD_PARTY_NOTICES), HyperFrames (hyperframes.dev, skill lấy từ `heygen-com/hyperframes`), ElevenLabs, Remotion (`remotion-dev/skills`), Gemini qua Google Antigravity `agy`, TypeSafe Jev (README.md; data/SOURCES.md).

## Câu hỏi còn mở
- Chi phí và gói ElevenLabs cần có.
- Hiện có bao nhiêu test (126 hay 82).
- Có video mẫu công khai nào không.
