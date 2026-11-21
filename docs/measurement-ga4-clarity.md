# Đo lường GA4 / Clarity sau migration

> Cập nhật 2026-11-21. Các script consent, `src/lib/consent-track.ts`, `src/scripts/analytics-beacon.ts` và cấu hình `GA4_MEASUREMENT_ID` / `CLARITY_PROJECT_ID` đã bị xoá khỏi Worker công cụ. Việc đo lường trang công khai giờ do giao diện EzyPlatform quyết định.

## Hiện trạng

- `tqd-tools` chỉ giữ `/api/t` để ghi sự kiện ẩn danh vào Analytics Engine (`tqd_analytics`) khi phía EzyPlatform gọi tới. Không còn script beacon, không còn khung hỏi consent trong repo này.
- `tqd-edge` không chèn mã đo lường vào HTML của EzyPlatform; nó chuyển tiếp nguyên response.
- Nếu bật GA4/Clarity cho `tqd.me`, cấu hình trong page fragment/theme của EzyPlatform và tuân thủ cùng nguyên tắc: chỉ tải sau khi người đọc đồng ý, không pixel quảng cáo.

## Sự kiện `/api/t`

Hợp đồng dữ liệu vẫn giữ nguyên trong [analytics-event-spec.md](analytics-event-spec.md). Payload do phía EzyPlatform gửi lên cần có `event`, `path`, `visitorId` (hoặc định danh ngày đã băm) và các trường tuỳ chọn như `kind`, `value`. Worker băm visitor ID bằng `ANALYTICS_SALT` trước khi ghi.

Đặt secret nếu muốn salt cố định:

```bash
npx wrangler secret put ANALYTICS_SALT --name tqd-tools
```

Không có salt thì lib dùng giá trị mặc định trong code; đặt salt riêng để dữ liệu giữa các môi trường không trùng nhau.
