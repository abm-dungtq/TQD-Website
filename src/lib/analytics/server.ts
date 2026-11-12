/**
 * src/lib/analytics/server.ts
 * Các hàm xử lý phía Server cho thống kê first-party trên `tqd.me`:
 * - Băm ẩn danh xoay theo ngày `vid_day` (không bao giờ lưu địa chỉ IP gốc)
 * - Ghi điểm dữ liệu vào Workers Analytics Engine (`tqd_analytics`) theo đúng thứ tự cột 1-based.
 */

import type { AnalyticsDataPointInput } from './schema';

export interface AnalyticsEngineWriterLike {
  writeDataPoint(event: {
    indexes?: string[];
    blobs?: string[];
    doubles?: number[];
  }): void;
}

/**
 * Trả về ngày hiện tại theo múi giờ Việt Nam (UTC+7) dạng YYYY-MM-DD.
 */
export function getVnDateString(now: Date = new Date()): string {
  const vnTime = new Date(now.getTime() + 7 * 3600_000);
  return vnTime.toISOString().slice(0, 10);
}

let ephemeralSalt: string | undefined;

/**
 * Trả về salt đã cấu hình hoặc sinh salt ngẫu nhiên theo vòng đời isolate
 * thay vì chuỗi tĩnh dễ đoán ('default-salt' / 'default-tqd-salt').
 */
export function resolveAnalyticsSalt(configured?: string): string {
  const trimmed = configured?.trim();
  if (trimmed) return trimmed;
  if (!ephemeralSalt) {
    ephemeralSalt = crypto.randomUUID();
  }
  return ephemeralSalt;
}

/**
 * Băm SHA-256 chuỗi `salt|vnDate|networkKey|ua|site` và lấy 16 ký tự hex đầu.
 * Đầu vào mạng chỉ dùng trong bộ nhớ để băm, tuyệt đối không lưu hay truyền vào mảng blobs.
 */
export async function computeVidDay(
  salt: string,
  vnDate: string,
  networkKey: string,
  ua: string,
  site: string,
): Promise<string> {
  const effectiveSalt = resolveAnalyticsSalt(salt);
  const raw = `${effectiveSalt}|${vnDate}|${networkKey}|${ua || ''}|${site}`;
  const encoded = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Ghi điểm dữ liệu vào dataset Workers Analytics Engine `tqd_analytics`.
 */
export function writeAnalyticsEvent(
  dataset: AnalyticsEngineWriterLike | undefined,
  point: AnalyticsDataPointInput,
): void {
  if (!dataset || typeof dataset.writeDataPoint !== 'function') return;
  try {
    dataset.writeDataPoint({
      indexes: [point.site],
      blobs: [
        point.event,
        point.section,
        point.pathTpl,
        point.path,
        point.refHost,
        point.utm,
        point.country,
        point.device,
        point.sid,
        point.vidDay,
        point.p1,
        point.p2,
        point.isBot,
        point.pvId,
      ],
      doubles: [
        point.engagedMs ?? 0,
        point.maxScrollPct ?? 0,
        point.latencyMs ?? 0,
        point.value ?? 0,
        1,
      ],
    });
  } catch {
    // Không làm gián đoạn luồng chính nếu Analytics Engine tạm thời lỗi
  }
}
