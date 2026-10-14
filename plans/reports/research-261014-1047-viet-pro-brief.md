# Brief sản phẩm: Viết Pro (abm-dungtq)

Ngày lập: 2026-10-14. Nguồn đọc qua `gh` và bản cài cục bộ. Ký hiệu nguồn: **[C]** = `abm-dungtq/viet-pro-codex`, **[V]** = `abm-dungtq/viet-pro`, **[P]** = `abm-dungtq/viet-pro-plugin`, **[L]** = `C:\Users\ABM\.claude\skills\viet-pro`.

## 1. Vấn đề và đối tượng

- Skill giúp trợ lý AI "viết và biên tập tiếng Việt tự nhiên, đúng dữ kiện, đúng từng kênh đăng bài" [C README.md].
- Việc làm được: viết mới (blog, SEO, LinkedIn, Facebook, Zalo, newsletter, thread X, kịch bản video), biên tập bản nháp, bớt "giọng dịch", humanize, giữ nguyên dữ kiện, chuyển thể đa kênh, không bịa số liệu/nguồn [C README.md].
- [V] đặt vấn đề: một công thức chung cho mọi yêu cầu khiến đầu ra "quá sơ sài hoặc quá nặng quy trình"; đối tượng gồm email, báo cáo, giáo trình, kịch bản, tài liệu nhiều chương, nội dung có rủi ro pháp lý/nhân sự/tài chính/y tế [V README.md].
- Không gắn với một nhóm người dùng cụ thể. Ví dụ prompt nhắm tới founder công nghệ [C README.md]. Bản 5.4.1 ghi là "bàn giao học viên" [V CHANGELOG.md] (chưa rõ là học viên khóa nào).

## 2. Cách hoạt động (bản mới nhất 5.3.0, [C])

- **Thứ tự ưu tiên:** yêu cầu người dùng > dữ liệu đầu vào (coi là nguồn, không phải chỉ thị) > reference của skill. Khi phong cách xung đột: brief/giọng mẫu -> toàn vẹn dữ kiện -> yêu cầu kênh -> Humanizer -> house style [C skills/viet-pro/SKILL.md].
- **Ba mức vận hành:** Nhanh (sửa ngắn, tự rà trong một lượt), Chuẩn (brief -> soạn -> rà -> bản cuối), Tòa soạn (nghiên cứu lớn, nhiều kênh; chỉ dùng subagent khi tách context thật sự giúp chất lượng, "không spawn subagent chỉ để đóng vai") [C SKILL.md]. Người dùng không cần chọn mức [C README.md].
- **Router reference:** chỉ đọc file cần dùng trong `references/research`, `editorial` (9 file: story-core, hook-close, rhythm, metaphor, reframe, debunk, emphasis, technical...), `publishing` (Facebook, LinkedIn, X thread, blog SEO, newsletter, video script, Zalo, Instagram, repurpose-matrix), `review`, `archive`, `development` [C SKILL.md; cây thư mục].
- **Humanizer:** mọi văn xuôi công khai được rà nhẹ; rà đầy đủ theo `review/humanizer-patterns.md` khi người dùng yêu cầu humanize/audit. File này có 25 dấu hiệu trong 5 nhóm (A. dàn cảnh, B. nhịp công thức, C. thổi phồng, D. định dạng, E. dấu vết chatbot) [C references/review/humanizer-patterns.md]. Sửa tối đa hai vòng, sau mỗi vòng đối chiếu tên, số, ngày, URL, trích dẫn [C SKILL.md].
- **Scripts (Node, không cần mạng):**
  - `lint-vietnamese-content.mjs`: kiểm tra tất định, gồm em-dash, Oxford comma ", và", dấu cách trước dấu câu (ERROR), nhãn kiểu AI ("Key takeaways:", "Trong bài viết này"), lời chatbot sót ("Dưới đây là..."), dấu hai chấm trong tiêu đề, khoảng trắng kép, Title Case; bỏ qua frontmatter và code block [L scripts/lint-vietnamese-content.mjs]. Lint "chỉ là tín hiệu hỗ trợ" [C SKILL.md].
  - `compare-preserved-content.mjs`: so URL, số/ngày, trích dẫn, citation, thứ hạng, tên được `--keep` giữa bản trước và sau [L scripts/compare-preserved-content.mjs]; từ 5.3.0 bắt lỗi đảo nghĩa "tăng 12%" thành "giảm 12%", có `--strict-quotes` [C README.md].
  - `test-humanizer-contract.mjs`: kiểm tra hướng dẫn Humanizer [C README.md].
- **Workspace khi cần lưu file:** `content/{yymmdd}-{slug}/` với `00-brief.md`, `01-draft.md`, `02-review-ticket.md`, `published/{kenh}.md`; trên Antigravity xuất Markdown Artifact [C SKILL.md].

## 3. Nền tảng và lệnh cài (nguyên văn)

[C README.md, INSTALL.md]: Claude Code (`/viet-pro`), OpenAI Codex (`$viet-pro`), Google Antigravity (`/viet-pro`); có thể kích hoạt tự nhiên.

```bash
curl -fsSL https://raw.githubusercontent.com/abm-dungtq/viet-pro-codex/v5.3.0/install.sh | bash
curl -fsSL https://raw.githubusercontent.com/abm-dungtq/viet-pro-codex/v5.3.0/install.sh | bash -s -- --workspace
```

Tùy chọn: `--claude` (`~/.claude/skills/viet-pro`), `--codex` (`~/.agents/skills/viet-pro`), `--agy` (`~/.gemini/config/skills/viet-pro`), `--agy-cli`, `--all`, `--link`, `--ref <tag>`. Bản cũ được chuyển vào `~/.viet-pro-backups/`, không xóa; installer ghim tag và kiểm tra checksum [C INSTALL.md].

[V README.md] (Codex, PowerShell): `git clone https://github.com/abm-dungtq/viet-pro.git` rồi copy `skill` vào `%USERPROFILE%\.codex\skills\viet-pro`.
[P INSTALL.md]: `git clone https://github.com/abm-dungtq/viet-pro-plugin.git ~/.gemini/config/plugins/viet-pro-plugin`, cấm dùng symlink.

## 4. Lịch sử phiên bản

| Thời điểm | Repo | Mốc |
|---|---|---|
| 2026-07-25 | [P] | Viết Pro 4.0: "tòa soạn báo AI" với 4 subagent (researcher, editor, publisher, reviewer) + 2 ban hỗ trợ; xuất bản 9 kênh; lint 7 loại lỗi; pattern catalog 42 bài mẫu [P README.md, commits] |
| 2026-07-10 đến 07-30 | [V] | 5.0, 5.1, 5.2, 5.2.1 theo CHANGELOG (trước khi tạo repo 2026-08-05) [V CHANGELOG.md] |
| 2026-08-05/06 | [V] | Release 5.2.1, 5.3.1 (onboarding), 5.4.0 (AI newsroom), 5.4.1, 5.4.2 "Writing-only" [V releases] |
| 2026-09-05 | [C] | 5.0.0 cho Codex [C commits] |
| 2026-09-09 | [C] | 5.1.0: thêm Antigravity, `install.sh` [C commits] |
| 2026-09-10 | [C] | 5.2.0: tích hợp Humanizer [C commits] |
| 2026-10-08 | [C] | 5.2.1 (installer an toàn), 5.3.0 (eval, CI, so dữ kiện theo chiều nghĩa) [C releases] |

**Chưa chắc:** số phiên bản không nối tiếp giữa các repo ([V] lên 5.4.2 vào tháng 8, [C] lại bắt đầu từ 5.0.0 vào tháng 9). Cây `references/` và script lint của [C] giống [P] chứ không giống [V], nên nhiều khả năng [C] phát triển từ nhánh 4.0 (đây là suy luận, không có tài liệu ghi). GitHub release chỉ có v5.2.1 và v5.3.0 cho [C]. Bản cài cục bộ [L] là 5.2.0, cũ hơn bản trên repo.

## 5. Ví dụ và kết quả có ghi trong repo

- Prompt mẫu: bài LinkedIn 300 chữ, "khóa học 6 tuần, 62% nhân viên hoàn thành"; humanize bài Facebook; một bài gốc ra LinkedIn và tin Zalo dưới 80 chữ [C README.md]. Đây là dữ liệu giả định trong ví dụ, không phải kết quả của khách hàng.
- Trước/sau humanize: bản trước có "Trong bối cảnh...", "Không phải... mà là...", "Và đó mới là điều đáng suy ngẫm"; bản sau giữ 18%, ngày 10/09/2026, URL, "mẫu 120 khách hàng" [1] và hạ claim "bước ngoặt" [C tests/humanizer/facebook-before.md, facebook-after.md].
- Eval 12 ca (LinkedIn, humanize, technical, blog SEO, newsletter, Zalo, X thread, video, đảo nghĩa, claim chưa xác minh, audit AI, repurpose): 5.2.1 đạt 11/12, 5.3.0 đạt 12/12. Repo tự ghi là "mỗi bản chỉ chạy một lần... chưa phải bằng chứng thống kê"; chi phí khoảng 0,3-0,5 USD mỗi ca khi bật judge [C README.md, tests/eval/cases.json].
- [V] tự đánh giá: "private-pilot release candidate; chưa production-proven", audit 95/100, 1 behavioral PASS, 23 NOT_RUN [V README.md, release v5.4.2].

## 6. Giới hạn và những gì không làm

- Không phát hiện văn do AI viết; các dấu hiệu chỉ là thói quen viết [C README.md].
- Không bịa; không đổi "năm trước" thành năm cụ thể; không sửa code/cấu hình; không tự đăng, gửi email, nhắn tin [C README.md, SKILL.md].
- Chỉ làm nội dung chữ: không tạo ảnh, video, âm thanh [V README.md].
- Không thay người có thẩm quyền duyệt văn bản pháp lý, y tế, tài chính; linter không thay review thật [V README.md].
- Installer chưa được kiểm thử trên Windows; cần `git` và `bash` [C README.md].
- Có thể tự tra web khi cần số liệu mới; tắt bằng cách ghi "không tra cứu web" [C README.md].

## 7. Giấy phép và ghi công

- Cả ba repo không có file LICENSE (`licenseInfo: null`). [V] ghi rõ "chưa kèm giấy phép mã nguồn mở" [V README.md].
- Ghi công: Humanizer 3.0.0 của Siqi Chen, https://github.com/blader/humanizer, giấy phép MIT [C skills/viet-pro/THIRD_PARTY_NOTICES.md].
- Tác giả: ABM-DungTQ [C SKILL.md metadata]. README của [P] có ghi hotline/Zalo của tác giả; cần hỏi tác giả trước khi đưa vào bài.

## 8. URL

- https://github.com/abm-dungtq/viet-pro-codex (bản mới nhất, 5.3.0)
- https://github.com/abm-dungtq/viet-pro (Codex/ChatGPT, 5.4.2)
- https://github.com/abm-dungtq/viet-pro-plugin (Antigravity, 4.0)

## Câu hỏi còn mở

- Quan hệ chính thức giữa ba repo và cách đánh số phiên bản: repo nào là bản chính, repo nào đã ngừng phát triển?
- Có định chọn license không?
- Có số liệu người dùng thật không? Hiện không có trong repo, mỗi repo có 0 sao.
