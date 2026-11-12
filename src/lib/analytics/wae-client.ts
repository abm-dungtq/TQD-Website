/**
 * src/lib/analytics/wae-client.ts
 * Trình khách truy vấn Workers Analytics Engine SQL API.
 * Kiểm tra nghiêm ngặt `site` và `vnDay` trước khi nội suy chuỗi SQL để chống SQL Injection tuyệt đối.
 */

export type AllowedAnalyticsSite = 'tuvi.tqd.me' | 'tqd.me';

const VALID_SITES = new Set<AllowedAnalyticsSite>(['tuvi.tqd.me', 'tqd.me']);
const VN_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface WaeQueryConfig {
  accountId?: string;
  apiToken?: string;
  /** Cho phép tiêm hàm giả lập trong unit test */
  customRunner?: (sql: string) => Promise<Array<Record<string, unknown>>>;
}

export function assertValidSite(site: string): asserts site is AllowedAnalyticsSite {
  if (!VALID_SITES.has(site as AllowedAnalyticsSite)) {
    throw new Error(`Invalid analytics site: ${site}`);
  }
}

export function assertValidVnDay(vnDay: string): void {
  if (typeof vnDay !== 'string' || !VN_DAY_RE.test(vnDay)) {
    throw new Error(`Invalid Vietnam date format (expected YYYY-MM-DD): ${vnDay}`);
  }
  const parsed = Date.parse(`${vnDay}T00:00:00Z`);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid calendar date: ${vnDay}`);
  }
}

/**
 * Chuyển đổi một ngày theo múi giờ Việt Nam (UTC+7, YYYY-MM-DD) sang khoảng thời gian UTC
 * định dạng `YYYY-MM-DD HH:MM:SS` dùng trong hàm `toDateTime(...)` của WAE SQL.
 */
export function vnDayToUtcSqlBounds(vnDay: string): { startSql: string; endSql: string } {
  assertValidVnDay(vnDay);
  const startUtcMs = Date.parse(`${vnDay}T00:00:00+07:00`);
  const endUtcMs = startUtcMs + 86_400_000;
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
  return {
    startSql: fmt(startUtcMs),
    endSql: fmt(endUtcMs),
  };
}

/**
 * Trả về chuỗi ngày Việt Nam `YYYY-MM-DD` cách thời điểm `now` một số ngày `daysAgo`.
 */
export function getVnDayOffset(daysAgo: number, now: Date = new Date()): string {
  const vnNowMs = now.getTime() + 7 * 3600_000 - daysAgo * 86_400_000;
  return new Date(vnNowMs).toISOString().slice(0, 10);
}

/**
 * Gửi câu lệnh SQL phẳng tới Cloudflare Workers Analytics Engine SQL API.
 */
export async function queryWaeSql(
  config: WaeQueryConfig,
  sql: string,
): Promise<Array<Record<string, unknown>>> {
  if (config.customRunner) {
    return config.customRunner(sql);
  }

  const accountId = config.accountId?.trim();
  const apiToken = config.apiToken?.trim();
  if (!accountId || !apiToken) {
    throw new Error('Missing CF_ACCOUNT_ID or CF_ANALYTICS_TOKEN for WAE SQL API');
  }

  const trimmed = sql.trim().replace(/;+\s*$/, '');
  const finalSql = /\bFORMAT\s+JSON\s*$/i.test(trimmed) ? trimmed : `${trimmed} FORMAT JSON`;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: finalSql,
    },
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`WAE SQL HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await response.json()) as { data?: Array<Record<string, unknown>> };
  return Array.isArray(json.data) ? json.data : [];
}
