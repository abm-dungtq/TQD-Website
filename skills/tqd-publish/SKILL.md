---
name: tqd-publish
description: "Đăng bài viết, ảnh, video lên website tqd.me qua API."
---

# tqd-publish

Đăng và sửa bài trên https://tqd.me bằng `scripts/tqd-publish.mjs` (Node ≥ 20, không cần cài gói).

## Cấu hình key

Key do chủ site tạo tại `https://tqd.me/admin/api-keys`. Script đọc key theo thứ tự:

1. biến môi trường `TQD_API_KEY`;
2. `--key-file <path>`;
3. file mặc định `~/.config/tqd/api-key`.

Không in, không dán, không commit key. `TQD_API_BASE` đổi địa chỉ site (mặc định `https://tqd.me`).

Kiểm tra: `node scripts/tqd-publish.mjs whoami` → `{"name":"...","scopes":[...]}`.

## Lệnh

```
node scripts/tqd-publish.mjs whoami
node scripts/tqd-publish.mjs next-brief [--pillar <pillar>] [--claim]
node scripts/tqd-publish.mjs queue [--pillar <pillar>] [--status queued|writing|published|skipped]
node scripts/tqd-publish.mjs upload <file> [--alt "mô tả ảnh"]
node scripts/tqd-publish.mjs put <slug> --title "..." --body-file <file.md> [--summary "..."] [--tags a,b] [--cover <mediaKey>] [--publish]
node scripts/tqd-publish.mjs get <slug>
node scripts/tqd-publish.mjs list [--status draft|published]
node scripts/tqd-publish.mjs delete <slug>
node scripts/tqd-publish.mjs delete-media <key>
```

Đường dẫn `scripts/...` tính từ thư mục skill. Khi gọi từ thư mục khác, dùng đường dẫn đầy đủ, ví dụ `node /Users/tqd/.gemini/config/skills/tqd-publish/scripts/tqd-publish.mjs whoami`.

Mỗi lệnh in một dòng JSON ra stdout. Khi lỗi, script in JSON lỗi ra stderr và thoát với mã 1.

## Quy trình viết bài SEO + GEO hàng ngày

1. Lấy và giữ chỗ đề bài hôm nay từ hệ thống trung tâm:
   `node scripts/tqd-publish.mjs next-brief --claim`
   Kết quả trả về `brief` gồm: `pillar`, `slug`, `title`, `primaryKeyword`, `secondaryKeywords`, `geoQuestions`, `answerCapsuleHint`, `sections` (5 tiêu đề H2), `tableSpec`, `eeatAnchor`, `liveInternalLinks` (đã xác minh live 200 OK), `liveSectionLinks` (`/shop`, `/tai-video`, `/san-pham`, `/ho-so`), `analogy`, `fbAngle` và `author` (`Trịnh Quang Dũng (DũngTQ)`, `ABM`).
2. Viết bài bằng Markdown vào một file `.md` tuân thủ chuẩn SEO + GEO:
   - Mở đầu bằng **Answer Capsule 40–60 từ** chứa `primaryKeyword`, trả lời thẳng câu hỏi chính.
   - Không viết `# H1` trong nội dung; dùng đúng 5 `## H2` từ `sections` (sentence case, không dấu `:`).
   - Có ít nhất 1 bảng so sánh Markdown (viết gọn `|Cột 1|Cột 2|`) theo `tableSpec`.
   - Lồng thực thể `Trịnh Quang Dũng (DũngTQ)` / `ABM` cùng `eeatAnchor` vào thân bài và chèn liên kết từ `liveInternalLinks` + `liveSectionLinks`.
   - Tự viết; không chép nguyên văn bài Facebook.
3. Chạy `/Users/tqd/.local/bin/viet-pro gate <file.md>` trước khi đăng.
4. Nếu cần ảnh hoặc video, tạo bằng công cụ sẵn có rồi `upload`. Kết quả có `key` và `markdown`.
5. Chèn ảnh vào bài bằng `![alt](/media/<key>)`, hoặc dùng `--cover <key>` để làm ảnh bìa. Ảnh bìa phải là ảnh, không nhận video. Trang bài viết tự hiện ảnh bìa ở đầu bài, nên không chèn lại ảnh bìa vào nội dung; ảnh trong nội dung nên là ảnh khác, đặt cạnh phần nó minh hoạ.
6. Gọi `put`. Script tự đọc bài trước và gửi `If-Match` nếu bài đã có. Khi `status` là `published`, hệ thống tự động đánh dấu đề bài và các từ khóa mục tiêu sang `published`.

## Quy tắc nội dung

- Slug: chữ thường không dấu, số, nối bằng `-`, tối đa 80 ký tự. Ví dụ: `dung-ai-viet-bao-cao`.
- Một link TikTok (`https://www.tiktok.com/@kenh/video/<số>`) đứng riêng một dòng sẽ thành player.
- HTML thô bị loại bỏ. Ảnh không nằm dưới `/media/` cũng bị loại bỏ.
- Giới hạn: ảnh 10 MB, video 95 MB (JPEG, PNG, GIF, WebP, MP4, WebM); nội dung bài 100 000 ký tự.
- Chỉ dùng `--publish` khi người dùng yêu cầu đăng. Không có `--publish` thì bài mới là nháp, bài cũ giữ nguyên trạng thái.
- Key thiếu quyền `publish` chỉ lưu được nháp. Khi đó kết quả có `warning`; báo lại cho người dùng.
- Khi `put` sửa bài, trường nào không gửi (`--summary`, `--tags`, `--cover`) thì giữ giá trị cũ.
- Nếu kết quả có `"fbOverlap": true`, báo người dùng rằng bài có đoạn trùng với bài Facebook.
- Lỗi `version_mismatch` nghĩa là bài vừa bị sửa ở nơi khác: `get` lại, xem thay đổi, rồi mới `put` lại.
