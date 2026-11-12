/**
 * src/lib/analytics/rollup.ts
 * Bộ tổng hợp dữ liệu bất biến (idempotent) từ Workers Analytics Engine sang D1 (`analytics_daily`)
 * và bộ truy vấn phục vụ trang quản trị `/admin/thong-ke`.
 */

import {
  bucketForMs,
  ENGAGED_BUCKET_KEYS,
  percentileFromHistogram,
} from './histogram';
import {
  type AllowedAnalyticsSite,
  assertValidSite,
  assertValidVnDay,
  getVnDayOffset,
  queryWaeSql,
  vnDayToUtcSqlBounds,
  type WaeQueryConfig,
} from './wae-client';

export interface DailyMetricRow {
  site: AllowedAnalyticsSite;
  day: string;
  metric: string;
  dim: string;
  value: number;
}

/**
 * Thực thi rollup bất biến cho một `(site, vnDay)`:
 * - Chạy 4 câu truy vấn WAE SQL phẳng (không dùng subquery `FROM (SELECT ...)`):
 *   1a) Tổng hợp chiều hiển thị (section/path/ref/utm/country/device) tách khỏi sid/vid_day để không bị cắt bởi LIMIT 10000
 *   1b) Đếm phiên (sid) & khách-ngày (vid_day) duy nhất có trọng số `_sample_interval`
 *   2) Gộp `page_end` theo `pv_id` với `SUM(double1 * _sample_interval) / MAX(_sample_interval)`
 *   3) Sự kiện sản phẩm, Phễu A/B & AI
 * - Lưu nguyên tử vào D1 qua `db.batch`: 1 lệnh `DELETE` + các lệnh `INSERT` đa dòng (20 dòng/câu).
 */
export async function rollupSiteDay(
  db: D1Database,
  waeConfig: WaeQueryConfig,
  site: string,
  vnDay: string,
): Promise<{ rowsWritten: number }> {
  assertValidSite(site);
  assertValidVnDay(vnDay);
  const { startSql, endSql } = vnDayToUtcSqlBounds(vnDay);

  // Truy vấn 1a: Tổng quan & phân tích chiều trên page_view / html_hit (tách khỏi sid/vid_day để tránh bùng nổ tổ hợp)
  const q1DimSql = `SELECT blob1 AS event, blob2 AS section, blob4 AS path, blob5 AS ref_host, blob6 AS utm, blob7 AS country, blob8 AS device, SUM(_sample_interval) AS cnt, MAX(_sample_interval) AS max_si FROM tqd_analytics WHERE index1 = '${site}' AND blob1 IN ('page_view', 'html_hit') AND blob13 = '0' AND timestamp >= toDateTime('${startSql}') AND timestamp < toDateTime('${endSql}') GROUP BY blob1, blob2, blob4, blob5, blob6, blob7, blob8 ORDER BY cnt DESC LIMIT 10000`;

  // Truy vấn 1b: Phiên (sid) & khách-ngày (vid_day) duy nhất kèm trọng số _sample_interval
  const q1UniqueSql = `SELECT blob9 AS sid, blob10 AS vid_day, MAX(_sample_interval) AS weight FROM tqd_analytics WHERE index1 = '${site}' AND blob1 = 'page_view' AND blob13 = '0' AND timestamp >= toDateTime('${startSql}') AND timestamp < toDateTime('${endSql}') GROUP BY blob9, blob10 LIMIT 10000`;

  // Truy vấn 2: Gộp page_end theo pv_id để đóng bucket engaged_hist trong JS (chia cho MAX(_sample_interval), không chia cho SUM)
  const q2Sql = `SELECT blob14 AS pv_id, blob2 AS section, blob4 AS path, SUM(double1 * _sample_interval) / MAX(_sample_interval) AS total_ms, MAX(_sample_interval) AS weight FROM tqd_analytics WHERE index1 = '${site}' AND blob1 = 'page_end' AND blob13 = '0' AND timestamp >= toDateTime('${startSql}') AND timestamp < toDateTime('${endSql}') GROUP BY blob14, blob2, blob4 LIMIT 10000`;

  // Truy vấn 3: Sự kiện sản phẩm, Phễu A/B & AI
  const q3Sql = `SELECT blob1 AS event, blob11 AS p1, blob12 AS p2, SUM(_sample_interval) AS cnt, quantileExactWeighted(0.95)(double3, _sample_interval) AS p95_ms FROM tqd_analytics WHERE index1 = '${site}' AND blob13 = '0' AND timestamp >= toDateTime('${startSql}') AND timestamp < toDateTime('${endSql}') GROUP BY blob1, blob11, blob12`;

  const [q1Rows, q1UniqueRows, q2Rows, q3Rows] = await Promise.all([
    queryWaeSql(waeConfig, q1DimSql),
    queryWaeSql(waeConfig, q1UniqueSql),
    queryWaeSql(waeConfig, q2Sql),
    queryWaeSql(waeConfig, q3Sql),
  ]);

  const metricMap = new Map<string, number>();
  const setMetric = (metric: string, dim: string, value: number) => {
    if (!Number.isFinite(value)) return;
    metricMap.set(`${metric}\u0000${dim}`, value);
  };
  const addMetric = (metric: string, dim: string, delta: number) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    const key = `${metric}\u0000${dim}`;
    metricMap.set(key, (metricMap.get(key) ?? 0) + delta);
  };

  // Xử lý kết quả Truy vấn 1a & 1b
  let pageviews = 0;
  let htmlHits = 0;
  let maxSampleInterval = 1;
  const sidWeights = new Map<string, number>();
  const vidWeights = new Map<string, number>();
  const sectionCounts = new Map<string, number>();
  const pathCounts = new Map<string, number>();
  const refCounts = new Map<string, number>();
  const utmCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();

  for (const r of q1Rows) {
    const ev = String(r.event ?? 'page_view');
    const cnt = Number(r.cnt ?? r.pageviews ?? 0);
    const maxSi = Math.max(1, Number(r.max_si ?? r.max_sample_interval ?? 1));
    if (maxSi > maxSampleInterval) maxSampleInterval = maxSi;

    if (ev === 'html_hit') {
      htmlHits += cnt;
      continue;
    }
    if (ev !== 'page_view') continue;

    pageviews += cnt;
    if (typeof r.html_hits === 'number') {
      htmlHits += Number(r.html_hits);
    }

    const sid = String(r.sid ?? '').trim();
    if (sid) sidWeights.set(sid, Math.max(sidWeights.get(sid) ?? 0, maxSi));
    const vid = String(r.vid_day ?? '').trim();
    if (vid) vidWeights.set(vid, Math.max(vidWeights.get(vid) ?? 0, maxSi));

    const sec = String(r.section ?? '').trim();
    if (sec) sectionCounts.set(sec, (sectionCounts.get(sec) ?? 0) + cnt);

    const p = String(r.path ?? '').trim();
    if (p) pathCounts.set(p, (pathCounts.get(p) ?? 0) + cnt);

    const ref = String(r.ref_host ?? '').trim();
    if (ref) refCounts.set(ref, (refCounts.get(ref) ?? 0) + cnt);

    const utm = String(r.utm ?? '').trim();
    if (utm) utmCounts.set(utm, (utmCounts.get(utm) ?? 0) + cnt);

    const dev = String(r.device ?? '').trim();
    if (dev) deviceCounts.set(dev, (deviceCounts.get(dev) ?? 0) + cnt);

    const country = String(r.country ?? '').trim();
    if (country) countryCounts.set(country, (countryCounts.get(country) ?? 0) + cnt);
  }

  for (const r of q1UniqueRows) {
    const weight = Math.max(1, Number(r.weight ?? r.max_si ?? 1));
    if (weight > maxSampleInterval) maxSampleInterval = weight;
    const sid = String(r.sid ?? '').trim();
    if (sid) sidWeights.set(sid, Math.max(sidWeights.get(sid) ?? 0, weight));
    const vid = String(r.vid_day ?? '').trim();
    if (vid) vidWeights.set(vid, Math.max(vidWeights.get(vid) ?? 0, weight));
  }

  let visits = 0;
  for (const w of sidWeights.values()) visits += w;
  let visitors = 0;
  for (const w of vidWeights.values()) visitors += w;

  setMetric('pageviews', '', pageviews);
  setMetric('visits', '', visits);
  setMetric('visitors', '', visitors);
  setMetric('html_hits', '', htmlHits);
  setMetric('max_sample_interval', '', maxSampleInterval);

  for (const [sec, cnt] of sectionCounts.entries()) {
    setMetric('section_pv', sec, cnt);
  }

  const topPaths = [...pathCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50);
  const topPathSet = new Set(topPaths.map(([p]) => p));
  for (const [p, cnt] of topPaths) {
    setMetric('path_pv', p, cnt);
  }

  const topRefs = [...refCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [ref, cnt] of topRefs) {
    setMetric('ref_pv', ref, cnt);
  }

  for (const [utm, cnt] of utmCounts.entries()) {
    setMetric('utm_pv', utm, cnt);
  }

  for (const [dev, cnt] of deviceCounts.entries()) {
    setMetric('device_pv', dev, cnt);
  }

  const topCountries = [...countryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [c, cnt] of topCountries) {
    setMetric('country_pv', c, cnt);
  }

  // Xử lý kết quả Truy vấn 2: gộp theo pv_id (phòng trường hợp nhiều dòng cùng pv_id)
  const pvAgg = new Map<
    string,
    { section: string; path: string; totalMs: number; weight: number }
  >();
  for (const r of q2Rows) {
    const pvId = String(r.pv_id ?? '').trim();
    if (!pvId) continue;
    const sec = String(r.section ?? 'other').trim() || 'other';
    const p = String(r.path ?? '/').trim() || '/';
    const ms = Number(r.total_ms ?? r.delta_ms ?? r.engaged_ms ?? 0);
    const weight = Math.max(1, Number(r.weight ?? 1));
    const existing = pvAgg.get(pvId);
    if (existing) {
      existing.totalMs += ms;
      if (weight > existing.weight) existing.weight = weight;
    } else {
      pvAgg.set(pvId, { section: sec, path: p, totalMs: ms, weight });
    }
  }

  let pvWithEnd = 0;
  const knowledgeHistByPath = new Map<string, Record<string, number>>();

  for (const item of pvAgg.values()) {
    pvWithEnd += item.weight;
    const bKey = bucketForMs(item.totalMs);
    if (!bKey) continue;

    addMetric('engaged_hist', `site:${bKey}`, item.weight);
    addMetric('engaged_hist', `sec:${item.section}:${bKey}`, item.weight);
    if (topPathSet.has(item.path) || pathCounts.size === 0) {
      addMetric('engaged_hist', `path:${item.path}:${bKey}`, item.weight);
    }

    if (item.path.startsWith('/knowledge/')) {
      const kh = knowledgeHistByPath.get(item.path) ?? {};
      kh[bKey] = (kh[bKey] ?? 0) + item.weight;
      knowledgeHistByPath.set(item.path, kh);
    }
  }

  setMetric('pv_with_end', '', pvWithEnd);

  for (const [kPath, kh] of knowledgeHistByPath.entries()) {
    const p50 = percentileFromHistogram(kh, 0.5);
    setMetric('knowledge_engaged_p50', kPath, p50);
  }

  // Xử lý kết quả Truy vấn 3: Sự kiện sản phẩm, Phễu A/B & AI
  for (const r of q3Rows) {
    const ev = String(r.event ?? '').trim();
    if (!ev) continue;
    const p1 = String(r.p1 ?? '').trim();
    const p2 = String(r.p2 ?? '').trim();
    const cnt = Number(r.cnt ?? 0);
    const p95Ms = Number(r.p95_ms ?? 0);

    const eventDim = p2 ? `${ev}:${p1}:${p2}` : p1 ? `${ev}:${p1}` : ev;
    addMetric('event_count', eventDim, cnt);

    if (ev === 'interpret_completed') {
      const outcomeDim = `${p1 || 'unknown'}:${p2 || 'ok'}`;
      addMetric('ai_outcome', outcomeDim, cnt);
      if (p95Ms > 0) {
        setMetric('ai_latency_p95', p1 || 'all', Math.round(p95Ms));
      }
    }
  }

  const rowsToInsert: DailyMetricRow[] = [];
  for (const [compositeKey, value] of metricMap.entries()) {
    const sepIdx = compositeKey.indexOf('\u0000');
    const metric = compositeKey.slice(0, sepIdx);
    const dim = compositeKey.slice(sepIdx + 1);
    rowsToInsert.push({ site, day: vnDay, metric, dim, value });
  }

  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM analytics_daily WHERE site = ? AND day = ?').bind(site, vnDay),
  ];

  const CHUNK_SIZE = 20;
  for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
    const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const bindParams: Array<string | number> = [];
    for (const row of chunk) {
      bindParams.push(row.site, row.day, row.metric, row.dim, row.value);
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO analytics_daily (site, day, metric, dim, value) VALUES ${placeholders}`,
        )
        .bind(...bindParams),
    );
  }

  await db.batch(statements);
  return { rowsWritten: rowsToInsert.length };
}

/**
 * Tự động tổng hợp 2 ngày gần nhất (hôm qua và hôm kia theo giờ VN) cho cả 2 site.
 * Bọc lỗi an toàn nếu `CF_ANALYTICS_TOKEN` chưa được cấu hình.
 */
export async function rollupRecentDays(env: {
  DB: D1Database;
  CF_ACCOUNT_ID?: string;
  CF_ANALYTICS_TOKEN?: string;
}): Promise<void> {
  if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN) return;
  const waeConfig: WaeQueryConfig = {
    accountId: env.CF_ACCOUNT_ID,
    apiToken: env.CF_ANALYTICS_TOKEN,
  };
  const days = [getVnDayOffset(1), getVnDayOffset(2)];
  const sites: AllowedAnalyticsSite[] = ['tuvi.tqd.me', 'tqd.me'];

  for (const day of days) {
    for (const site of sites) {
      try {
        await rollupSiteDay(env.DB, waeConfig, site, day);
      } catch {
        // Không làm gãy tiến trình scheduled nếu 1 ngày/site gặp lỗi tạm thời
      }
    }
  }
}

export interface DashboardSummaryData {
  site: AllowedAnalyticsSite;
  rangeDays: number;
  fromDay: string;
  toDay: string;
  waeLiveNote: string | null;
  maxSampleInterval: number;
  totals: {
    pageviews: number;
    visits: number;
    visitors: number;
    htmlHits: number;
    pvWithEnd: number;
    p50Ms: number;
    p75Ms: number;
    beaconCoveragePct: number;
    htmlHitCoveragePct: number;
  };
  dailySeries: Array<{ day: string; pageviews: number; visits: number; visitors: number }>;
  sections: Array<{ section: string; pageviews: number; p50Ms: number }>;
  topPaths: Array<{ path: string; pageviews: number; p50Ms: number }>;
  referrers: Array<{ ref: string; count: number }>;
  utms: Array<{ utm: string; count: number }>;
  devices: Array<{ device: string; count: number }>;
  countries: Array<{ country: string; count: number }>;
  eventCounts: Record<string, number>;
  aiOutcomes: Record<string, number>;
  aiLatencyP95Ms: number;
}

/**
 * Đọc dữ liệu tổng hợp từ D1 `analytics_daily` cho trang `/admin/thong-ke`.
 */
export async function loadDashboardSummary(
  db: D1Database,
  site: AllowedAnalyticsSite,
  rangeDays: number,
): Promise<DashboardSummaryData> {
  assertValidSite(site);
  const safeDays = [1, 7, 30, 90, 365].includes(rangeDays) ? rangeDays : 7;
  const toDay = getVnDayOffset(0);
  const fromDay = getVnDayOffset(safeDays - 1);

  const res = await db
    .prepare(
      `SELECT day, metric, dim, value FROM analytics_daily WHERE site = ? AND day >= ? AND day <= ? ORDER BY day ASC`,
    )
    .bind(site, fromDay, toDay)
    .all<{ day: string; metric: string; dim: string; value: number }>();

  const rows = res.results ?? [];

  let pageviews = 0;
  let visits = 0;
  let visitors = 0;
  let htmlHits = 0;
  let pvWithEnd = 0;
  let maxSampleInterval = 1;

  const siteHist: Record<string, number> = {};
  const secHist = new Map<string, Record<string, number>>();
  const pathHist = new Map<string, Record<string, number>>();

  const dailyMap = new Map<string, { pageviews: number; visits: number; visitors: number }>();
  const secPv = new Map<string, number>();
  const pathPv = new Map<string, number>();
  const refPv = new Map<string, number>();
  const utmPv = new Map<string, number>();
  const devPv = new Map<string, number>();
  const countryPv = new Map<string, number>();
  const eventCounts: Record<string, number> = {};
  const aiOutcomes: Record<string, number> = {};
  let aiLatencyP95Ms = 0;

  for (const r of rows) {
    const val = Number(r.value ?? 0);
    const dEntry = dailyMap.get(r.day) ?? { pageviews: 0, visits: 0, visitors: 0 };

    switch (r.metric) {
      case 'pageviews':
        pageviews += val;
        dEntry.pageviews += val;
        dailyMap.set(r.day, dEntry);
        break;
      case 'visits':
        visits += val;
        dEntry.visits += val;
        dailyMap.set(r.day, dEntry);
        break;
      case 'visitors':
        visitors += val;
        dEntry.visitors += val;
        dailyMap.set(r.day, dEntry);
        break;
      case 'html_hits':
        htmlHits += val;
        break;
      case 'pv_with_end':
        pvWithEnd += val;
        break;
      case 'max_sample_interval':
        if (val > maxSampleInterval) maxSampleInterval = val;
        break;
      case 'section_pv':
        secPv.set(r.dim, (secPv.get(r.dim) ?? 0) + val);
        break;
      case 'path_pv':
        pathPv.set(r.dim, (pathPv.get(r.dim) ?? 0) + val);
        break;
      case 'ref_pv':
        refPv.set(r.dim, (refPv.get(r.dim) ?? 0) + val);
        break;
      case 'utm_pv':
        utmPv.set(r.dim, (utmPv.get(r.dim) ?? 0) + val);
        break;
      case 'device_pv':
        devPv.set(r.dim, (devPv.get(r.dim) ?? 0) + val);
        break;
      case 'country_pv':
        countryPv.set(r.dim, (countryPv.get(r.dim) ?? 0) + val);
        break;
      case 'engaged_hist': {
        if (r.dim.startsWith('site:')) {
          const b = r.dim.slice(5);
          siteHist[b] = (siteHist[b] ?? 0) + val;
        } else if (r.dim.startsWith('sec:')) {
          const rest = r.dim.slice(4);
          const lastColon = rest.lastIndexOf(':');
          if (lastColon > 0) {
            const sec = rest.slice(0, lastColon);
            const b = rest.slice(lastColon + 1);
            const h = secHist.get(sec) ?? {};
            h[b] = (h[b] ?? 0) + val;
            secHist.set(sec, h);
          }
        } else if (r.dim.startsWith('path:')) {
          const rest = r.dim.slice(5);
          const lastColon = rest.lastIndexOf(':');
          if (lastColon > 0) {
            const p = rest.slice(0, lastColon);
            const b = rest.slice(lastColon + 1);
            const h = pathHist.get(p) ?? {};
            h[b] = (h[b] ?? 0) + val;
            pathHist.set(p, h);
          }
        }
        break;
      }
      case 'event_count':
        eventCounts[r.dim] = (eventCounts[r.dim] ?? 0) + val;
        break;
      case 'ai_outcome':
        aiOutcomes[r.dim] = (aiOutcomes[r.dim] ?? 0) + val;
        break;
      case 'ai_latency_p95':
        if (val > aiLatencyP95Ms) aiLatencyP95Ms = val;
        break;
    }
  }

  // Đảm bảo có đủ khóa bucket mặc định
  for (const k of ENGAGED_BUCKET_KEYS) {
    if (!(k in siteHist)) siteHist[k] = 0;
  }

  const p50Ms = percentileFromHistogram(siteHist, 0.5);
  const p75Ms = percentileFromHistogram(siteHist, 0.75);

  const beaconCoveragePct = pageviews > 0 ? Math.min(100, Math.round((pvWithEnd / pageviews) * 100)) : 0;
  const htmlHitCoveragePct = htmlHits > 0 ? Math.min(100, Math.round((pageviews / htmlHits) * 100)) : 0;

  const dailySeries = [...dailyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, d]) => ({ day, ...d }));

  const sections = [...secPv.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([section, pv]) => ({
      section,
      pageviews: pv,
      p50Ms: percentileFromHistogram(secHist.get(section) ?? {}, 0.5),
    }));

  const topPaths = [...pathPv.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([path, pv]) => ({
      path,
      pageviews: pv,
      p50Ms: percentileFromHistogram(pathHist.get(path) ?? {}, 0.5),
    }));

  const referrers = [...refPv.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([ref, count]) => ({ ref, count }));

  const utms = [...utmPv.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([utm, count]) => ({ utm, count }));

  const devices = [...devPv.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([device, count]) => ({ device, count }));

  const countries = [...countryPv.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([country, count]) => ({ country, count }));

  return {
    site,
    rangeDays: safeDays,
    fromDay,
    toDay,
    waeLiveNote: null,
    maxSampleInterval,
    totals: {
      pageviews,
      visits,
      visitors,
      htmlHits,
      pvWithEnd,
      p50Ms,
      p75Ms,
      beaconCoveragePct,
      htmlHitCoveragePct,
    },
    dailySeries,
    sections,
    topPaths,
    referrers,
    utms,
    devices,
    countries,
    eventCounts,
    aiOutcomes,
    aiLatencyP95Ms,
  };
}
