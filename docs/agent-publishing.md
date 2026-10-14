# Đăng bài từ agent

Agent (Claude Code, Codex hoặc script bất kỳ) đăng bài lên tqd.io.vn qua API `/api/v1` bằng API key. Code: `src/lib/api.ts`, `src/lib/api-key.ts`, `src/pages/api/v1/`. Kiểm tra đầu-cuối: `scripts/verify/api.mjs`. Các việc admin khác mà API chưa có: [admin-agent-operations.md](admin-agent-operations.md).

## Hợp đồng API

Xác thực bằng header `Authorization: Bearer tqd_<43 ký tự base64url>`; API không đọc cookie. Có ba quyền (scope): `articles:write`, `media:write` và `publish`. Mọi lỗi trả JSON dạng `{ "error": "<mã>", "message": "<tiếng Việt>" }`. Mỗi key được tối đa 60 request mỗi phút; vượt mức thì nhận 429 kèm `Retry-After`.

| Method & path | Scope | Thành công | Lỗi |
|---|---|---|---|
| `GET /api/v1/me` | bất kỳ key hợp lệ | 200 `{ name, scopes }` | 401 `unauthorized` |
| `GET /api/v1/articles?status=draft\|published` | `articles:write` | 200 `[{ slug, title, status, version, updatedAt }]` (≤ 50, mới nhất trước) | 401, 403 `forbidden` |
| `GET /api/v1/articles/{slug}` | `articles:write` | 200 bài đầy đủ + `ETag: "v{version}"` | 404 `not_found` |
| `PUT /api/v1/articles/{slug}` body JSON `{ title, bodyMd, summary?, coverKey?, tags?, publish? }`, tối đa 200 KB | `articles:write` | 201 (tạo) / 200 (sửa) `{ slug, url, status, version, fbOverlap, warning? }` + `ETag` | 400 `invalid` (kèm `errors`), 403, 412 `version_mismatch`, 413 `too_large`, 428 `if_match_required` |
| `DELETE /api/v1/articles/{slug}` | `articles:write` (+ `publish` nếu bài đang đăng) | 204 | 403, 404 |
| `POST /api/v1/media?filename=&alt=` body là file thô, có `Content-Length` | `media:write` | 201 `{ key, url, markdown, contentType, size }` | 400, 411, 413, 415 |
| `DELETE /api/v1/media?key=` | `media:write` | 204 | 404 (cả với key `backups/...`) |

Quy tắc của `PUT`:

- **Bài chưa có.** Không được gửi `If-Match` (gửi thì 412). Nếu `publish: true` và key có quyền `publish`, bài được đăng. Nếu key thiếu quyền đó, bài thành nháp và kết quả có `warning`.
- **Bài đã có.** Bắt buộc gửi `If-Match: "v{version}"`: thiếu thì 428, sai thì 412. Chỉ nhận dạng `"v{n}"`; `If-Match: *` bị coi là sai. Bài đang đăng mà key thiếu `publish` thì 403. Không gửi `publish` thì bài giữ trạng thái cũ; `publish: false` chuyển bài về nháp.
- **Trường không gửi.** Khi sửa bài, `summary`, `tags` và `coverKey` không gửi thì giữ giá trị cũ.
- **Slug và nguồn.** Slug chỉ lấy từ đường dẫn. Nguồn bài được ghi là `agent:<tên key>`.

Giới hạn tệp: ảnh 10 MB, video 95 MB. Loại tệp được kiểm bằng byte đầu, nên SVG và HTML bị từ chối.

Ảnh bìa (`coverKey`) phải là ảnh đã có trong thư viện media.

## Ví dụ curl

```bash
# $TQD_API_KEY lấy từ biến môi trường; không ghi key thật vào lệnh hay file commit.
curl -s https://tqd.io.vn/api/v1/me -H "Authorization: Bearer $TQD_API_KEY"

curl -s "https://tqd.io.vn/api/v1/media?filename=anh.png&alt=Ảnh minh hoạ" \
  -H "Authorization: Bearer $TQD_API_KEY" -H "Content-Type: image/png" --data-binary @anh.png

curl -s -X PUT https://tqd.io.vn/api/v1/articles/bai-dau-tien \
  -H "Authorization: Bearer $TQD_API_KEY" -H "Content-Type: application/json" \
  -d '{"title":"Bài đầu tiên","bodyMd":"Xin chào.","publish":true}'

# Sửa bài: lấy ETag trước rồi gửi lại trong If-Match.
curl -si https://tqd.io.vn/api/v1/articles/bai-dau-tien -H "Authorization: Bearer $TQD_API_KEY" | grep -i etag
curl -s -X PUT https://tqd.io.vn/api/v1/articles/bai-dau-tien \
  -H "Authorization: Bearer $TQD_API_KEY" -H "Content-Type: application/json" -H 'If-Match: "v1"' \
  -d '{"title":"Bài đầu tiên","bodyMd":"Xin chào lần nữa."}'
```

## Tạo và thu hồi key

- **Trong admin.** Vào `https://tqd.io.vn/admin/api-keys`, đặt tên và chọn quyền. Mặc định chỉ có `articles:write` và `media:write`, tức agent chỉ tạo được nháp. Key chỉ hiện một lần: chép ngay vào `~/.config/tqd/api-key` trên máy chạy agent. Nút **Thu hồi** khoá key ngay lập tức.
- **Bằng script.** Dùng cho kiểm thử; key ghi vào file và không in ra màn hình:

  ```bash
  node scripts/api-key.mjs create --name <tên> --scopes articles:write,media:write --out .secrets/<file> [--remote]
  node scripts/api-key.mjs revoke --name <tên> [--remote]
  ```

D1 chỉ lưu SHA-256 của key. Bản sao lưu hằng đêm có bảng `api_keys`, nên khôi phục bản sao lưu cũ có thể làm sống lại key đã thu hồi sau thời điểm sao lưu. Sau khi khôi phục, mở lại trang API key để thu hồi lại những key đó.

Mọi key có `media:write` đều xoá được mọi tệp media, kể cả ảnh tải lên từ admin. Điều này chấp nhận được vì site chỉ có một chủ. Hãy cấp quyền này có chủ đích.

## Cài skill `tqd-publish`

Skill nằm ở `skills/tqd-publish` (`SKILL.md` và `scripts/tqd-publish.mjs`). Chép cả thư mục:

- Claude Code: `~/.claude/skills/tqd-publish`
- Codex: `~/.codex/skills/tqd-publish`

Kiểm tra: `node ~/.claude/skills/tqd-publish/scripts/tqd-publish.mjs whoami`.
