---
name: tqd-publish
description: Đăng bài viết, ảnh và video lên tqd.io.vn qua API có API key. Dùng khi cần đăng hoặc sửa bài trên website DũngTQ.
---

# tqd-publish

Đăng và sửa bài trên https://tqd.io.vn bằng `scripts/tqd-publish.mjs` (Node ≥ 20, không cần cài gói).

## Cấu hình key

Key do chủ site tạo tại `https://tqd.io.vn/admin/api-keys`. Script đọc key theo thứ tự:

1. biến môi trường `TQD_API_KEY`;
2. `--key-file <path>`;
3. file mặc định `~/.config/tqd/api-key`.

Không in, không dán, không commit key. `TQD_API_BASE` đổi địa chỉ site (mặc định `https://tqd.io.vn`).

Kiểm tra: `node scripts/tqd-publish.mjs whoami` → `{"name":"...","scopes":[...]}`.

## Lệnh

```
node scripts/tqd-publish.mjs whoami
node scripts/tqd-publish.mjs upload <file> [--alt "mô tả ảnh"]
node scripts/tqd-publish.mjs put <slug> --title "..." --body-file <file.md> [--summary "..."] [--tags a,b] [--cover <mediaKey>] [--publish]
node scripts/tqd-publish.mjs get <slug>
node scripts/tqd-publish.mjs list [--status draft|published]
node scripts/tqd-publish.mjs delete <slug>
node scripts/tqd-publish.mjs delete-media <key>
```

Mỗi lệnh in một dòng JSON ra stdout. Khi lỗi, script in JSON lỗi ra stderr và thoát với mã 1.

## Quy trình đăng bài

1. Viết bài bằng Markdown vào một file `.md`. Tự viết; không chép nguyên văn bài Facebook.
2. Nếu cần ảnh hoặc video, tạo bằng công cụ sẵn có rồi `upload`. Kết quả có `key` và `markdown`.
3. Chèn ảnh vào bài bằng `![alt](/media/<key>)`, hoặc dùng `--cover <key>` để làm ảnh bìa. Ảnh bìa phải là ảnh, không nhận video.
4. Gọi `put`. Script tự đọc bài trước và gửi `If-Match` nếu bài đã có.

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
