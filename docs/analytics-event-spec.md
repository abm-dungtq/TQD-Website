# Đặc Tả Hợp Đồng Dữ Liệu Thống Kê Đa Site & Đơn Hàng (`tqd_analytics`, `tqd_db`, `tuvi_db`)

Tài liệu này cố định hợp đồng dữ liệu dùng chung giữa hai kho mã nguồn:
- `tuvi.tqd.me` (`/Volumes/2/AGY/Tu-Vi`)
- `tqd.me` (`/Volumes/2/TQD-Website`)

> **Quy tắc bất biến:** Hai bản sao của file `docs/analytics-event-spec.md` trên hai kho mã nguồn phải khớp nhau từng byte.

---

## 1. Hạ Tầng Cloudflare Dùng Chung (`account_id: b243f38bff984ce1741c379547e97a75`)

| Thành phần | Tên tài nguyên | ID / Dataset | Binding trên `tuvi.tqd.me` | Binding trên `tqd.me` |
| :--- | :--- | :--- | :--- | :--- |
| **Workers Analytics Engine** | Dataset thống kê sự kiện | `tqd_analytics` | `ANALYTICS` | `ANALYTICS` |
| **Cloudflare D1 (`tqd.me`)** | Cơ sở dữ liệu chính + Rollup >90 ngày | `tqd_db` (`b11ff76d-6626-4d05-ab23-34cc124d9163`) | *(không gắn)* | `DB` |
| **Cloudflare D1 (`tuvi.tqd.me`)** | Cơ sở dữ liệu đơn hàng & đối soát SePay | `tuvi_db` (`735a388d-ba27-436e-940a-d7375d41e482`) | `DB` (Đọc/Ghi) | `TUVI_DB` (Chỉ đọc) |

---

## 2. Quy Ước Cột Workers Analytics Engine (`tqd_analytics`)

Mỗi điểm dữ liệu (`AnalyticsEngineDataPoint`) được ghi qua `env.ANALYTICS.writeDataPoint({ indexes: [site], blobs: [...14], doubles: [...5] })` theo đúng thứ tự cố định 1-based của WAE SQL API:

### 2.1. `indexes` (1 phần tử)
- **`index1`** (`indexes[0]`): `site` — `'tuvi.tqd.me'` | `'tqd.me'`

### 2.2. `blobs` (14 phần tử — `blob1` đến `blob14`)

| Cột SQL | Chỉ số mảng | Tên trường | Giá trị hợp lệ / Quy tắc làm sạch |
| :--- | :---: | :--- | :--- |
| `blob1` | `blobs[0]` | `event` | `page_view`, `page_end`, `html_hit`, `cta_click`, `outbound_click`, `chart_generated`, `interpret_started`, `interpret_completed`, `heming_generated`, `heming_interpret`, `share_opened`, `share_action`, `timenav_used`, `history_opened`, `library_search`, `paywall_view`, `checkout_start`, `payment_success`, `premium_report_view` |
| `blob2` | `blobs[1]` | `section` | `home`, `chart`, `heming`, `library`, `knowledge`, `tuvi2027`, `legal`, `articles`, `tools`, `gallery`, `other` |
| `blob3` | `blobs[2]` | `path_tpl` | Ví dụ: `/`, `/chart`, `/heming`, `/library`, `/knowledge/[star]/[topic]`, `/tu-vi-2027`, `/tu-vi-2027/[conGiap]/[gioiTinh]`, `/bai-viet/[slug]`, `other` |
| `blob4` | `blobs[3]` | `path` | Chỉ `pathname` đã qua danh sách cho phép (allowlist), **tuyệt đối không có `?` hoặc `#`** |
| `blob5` | `blobs[4]` | `ref_host` | Hostname của `document.referrer` (chữ thường, bỏ `www.`) hoặc `'direct'` |
| `blob6` | `blobs[5]` | `utm` | `google`, `facebook`, `zalo`, `tiktok`, `youtube`, `email`, `other`, hoặc `''` |
| `blob7` | `blobs[6]` | `country` | Mã quốc gia ISO 2 ký tự từ Cloudflare (`cf-ipcountry`) hoặc `'XX'` |
| `blob8` | `blobs[7]` | `device` | `mobile`, `tablet`, `desktop` |
| `blob9` | `blobs[8]` | `sid` | Mã phiên ngẫu nhiên 16 ký tự chữ-số trong `sessionStorage` (hết hạn sau 30 phút không tương tác) |
| `blob10` | `blobs[9]` | `vid_day` | 16 ký tự hex đầu của `SHA-256(ANALYTICS_SALT + YYYY-MM-DD_VN + ip + ua + site)` (xoay mới mỗi ngày lúc 00:00 giờ VN, không lưu IP thô) |
| `blob11` | `blobs[10]` | `p1` | Thuộc tính enum 1 theo sự kiện (ví dụ: `starSlug`, `scope`, `source`, `product`, `targetHost`) |
| `blob12` | `blobs[11]` | `p2` | Thuộc tính enum 2 theo sự kiện (ví dụ: `topicSlug`, `status:reason`, `variant`, `method`) |
| `blob13` | `blobs[12]` | `is_bot` | `'0'` (người dùng thường) hoặc `'1'` (bot/trình thu thập) |
| `blob14` | `blobs[13]` | `pv_id` | Mã định danh lượt xem trang ngẫu nhiên (8–24 ký tự chữ-số) dùng để gom các lần gửi `page_end` của cùng một lượt xem |

### 2.3. `doubles` (5 phần tử — `double1` đến `double5`)

| Cột SQL | Chỉ số mảng | Tên trường | Ý nghĩa |
| :--- | :---: | :--- | :--- |
| `double1` | `doubles[0]` | `engaged_ms` | Thời gian tương tác thực tính bằng mili-giây (`0..1800000`) |
| `double2` | `doubles[1]` | `max_scroll_pct` | Phần trăm cuộn trang tối đa (`0..100`) |
| `double3` | `doubles[2]` | `latency_ms` | Độ trễ phản hồi API AI tính bằng mili-giây (`0..120000`) |
| `double4` | `doubles[3]` | `value` | Giá trị số theo sự kiện (số tiền VNĐ của đơn hàng, số câu hỏi gợi ý, số kết quả tìm kiếm) |
| `double5` | `doubles[4]` | `count` | Luôn ghi `1` (khi truy vấn WAE SQL API luôn dùng `SUM(_sample_interval)` để bù hệ số lấy mẫu) |

---

## 3. Biểu Đồ Tần Suất Thời Gian Tương Tác (`engaged_hist`)

Để tính phân vị `p50` (trung vị) và `p75` chuẩn xác trên mọi khoảng thời gian (1/7/30/90/365 ngày), tổng `engaged_ms` của mỗi `pv_id` (lọc các lượt xem có tổng `engaged_ms >= 1000`) được phân vào 10 nhóm (buckets) cố định theo ngưỡng trên (đơn vị ms):

```json
{
  "5000": 0,
  "10000": 0,
  "20000": 0,
  "30000": 0,
  "60000": 0,
  "120000": 0,
  "300000": 0,
  "600000": 0,
  "1800000": 0,
  "inf": 0
}
```

- Quy tắc chọn nhóm: chọn ngưỡng nhỏ nhất $\ge \text{total\_engaged\_ms}$ (nếu $> 1800000$ thì vào `"inf"`).
- Cờ tắt theo dõi trên trình duyệt của chủ site:
  ```js
  localStorage.setItem('tqd_notrack', '1');
  ```

---

## 4. Lược Đồ Bảng D1

### 4.1. Bảng `analytics_daily` trên `tqd_db` (`b11ff76d-6626-4d05-ab23-34cc124d9163`)
```sql
CREATE TABLE IF NOT EXISTS analytics_daily (
  day TEXT NOT NULL,
  site TEXT NOT NULL,
  section TEXT NOT NULL,
  path TEXT NOT NULL,
  pageviews INTEGER NOT NULL DEFAULT 0,
  visits INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0,
  html_hits INTEGER NOT NULL DEFAULT 0,
  engaged_total_ms INTEGER NOT NULL DEFAULT 0,
  engaged_count INTEGER NOT NULL DEFAULT 0,
  engaged_hist TEXT NOT NULL DEFAULT '{}',
  scroll_sum_pct INTEGER NOT NULL DEFAULT 0,
  events_json TEXT NOT NULL DEFAULT '{}',
  dims_json TEXT NOT NULL DEFAULT '{}',
  max_sample_interval INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (day, site, section, path)
);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_site_day ON analytics_daily (site, day);
```

### 4.2. Bảng `orders` và `sepay_events` trên `tuvi_db` (`735a388d-ba27-436e-940a-d7375d41e482`)
```sql
CREATE TABLE IF NOT EXISTS orders (
  code TEXT PRIMARY KEY,
  product TEXT NOT NULL,
  variant TEXT NOT NULL,
  amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'underpaid')),
  claim_hash TEXT NOT NULL,
  redemptions INTEGER NOT NULL DEFAULT 0,
  ai_used INTEGER NOT NULL DEFAULT 0,
  is_test INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders (status, created_at);

CREATE TABLE IF NOT EXISTS sepay_events (
  id INTEGER PRIMARY KEY,
  received_at TEXT NOT NULL,
  code TEXT,
  amount INTEGER NOT NULL,
  transfer_type TEXT NOT NULL,
  matched TEXT NOT NULL
);
```

---

## 5. Danh Mục Biến Môi Trường & Secrets Cần Thiết (`Owner Checklist`)

| Tên biến | Loại | Nơi khai báo | Mục đích |
| :--- | :--- | :--- | :--- |
| `CF_ACCOUNT_ID` | `vars` | `wrangler.jsonc` (`tuvi.tqd.me` & `tqd.me`) | ID tài khoản Cloudflare `b243f38bff984ce1741c379547e97a75` |
| `ANALYTICS_SALT` | `secret` | Wrangler Secret (`tuvi.tqd.me` & `tqd.me`) | Chuỗi ngẫu nhiên $\ge 32$ ký tự dùng băm `vid_day` trong ngày |
| `CF_ANALYTICS_TOKEN` | `secret` | Wrangler Secret (`tqd.me` prod & preview) | Cloudflare API Token có quyền `Account \| Account Analytics \| Read` để đọc WAE SQL API |
| `SEPAY_BANK` | `vars` | `wrangler.jsonc` (`tuvi.tqd.me`) | Mã ngân hàng nhận VietQR (ví dụ: `MBBank`, `VietinBank`, `VCB`) |
| `SEPAY_ACCOUNT` | `vars` | `wrangler.jsonc` (`tuvi.tqd.me`) | Số tài khoản nhận tiền khớp với cấu hình SePay |
| `SEPAY_WEBHOOK_SECRET` | `secret` | Wrangler Secret (`tuvi.tqd.me`) | Khóa bí mật xác thực Webhook SePay (`Authorization: Apikey` hoặc HMAC-SHA256) |
| `UNLOCK_SECRET` | `secret` | Wrangler Secret (`tuvi.tqd.me`) + `.dev.vars` | Khóa bí mật ($\ge 32$ ký tự) ký/xác thực `unlockToken` (`v1.<code>.<sig>`) |
