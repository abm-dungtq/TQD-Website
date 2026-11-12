import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { percentileFromHistogram } from './histogram';
import { loadDashboardSummary, rollupSiteDay } from './rollup';

function fakeD1(sqlite) {
  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
    run: async () => sqlite.prepare(sql).run(...params),
  });
  return {
    prepare: (sql) => statement(sql),
    batch: async (list) => Promise.all(list.map((s) => s.run())),
  };
}

let sqlite;
let db;

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0005_analytics.sql', 'utf8'));
  db = fakeD1(sqlite);
});

describe('rollupSiteDay idempotency, SQL formula correctness, pv_id aggregation, and sample weighting', () => {
  it('uses flat decoupled queries, computes total_ms via / MAX(_sample_interval), weights visits/visitors by _sample_interval, and is strictly idempotent', async () => {
    const day = '2026-11-05';

    let callIdx = 0;
    const capturedSqls = [];
    const run1Config = {
      customRunner: async (sql) => {
        expect(sql).not.toMatch(/FROM\s*\(\s*SELECT/i);
        capturedSqls.push(sql);
        callIdx += 1;
        if (callIdx === 1) {
          // q1DimSql must NOT group by high-cardinality sid (blob9) or vid_day (blob10)
          expect(sql).not.toContain('blob9');
          expect(sql).not.toContain('blob10');
          return [
            {
              event: 'page_view',
              section: 'chart',
              path: '/chart',
              ref_host: 'google.com',
              utm: 'google',
              country: 'VN',
              device: 'mobile',
              cnt: 8,
              max_si: 4,
            },
            {
              event: 'page_view',
              section: 'knowledge',
              path: '/knowledge/old-stale',
              ref_host: 'direct',
              utm: '',
              country: 'VN',
              device: 'desktop',
              cnt: 1,
              max_si: 1,
            },
          ];
        }
        if (callIdx === 2) {
          // q1UniqueSql groups by blob9 (sid), blob10 (vid_day) with MAX(_sample_interval) AS weight
          expect(sql).toContain('blob9 AS sid');
          expect(sql).toContain('blob10 AS vid_day');
          return [
            { sid: 's1', vid_day: 'v1', weight: 4 },
            { sid: 's2', vid_day: 'v2', weight: 1 },
          ];
        }
        if (callIdx === 3) {
          // q2Sql must divide by MAX(_sample_interval), never SUM(_sample_interval)
          expect(sql).toContain('SUM(double1 * _sample_interval) / MAX(_sample_interval) AS total_ms');
          expect(sql).not.toContain('/ SUM(_sample_interval)');
          // Simulate two rows for pv_1 summing to 7000ms -> bucket '10000'
          return [
            { pv_id: 'pv_1', section: 'chart', path: '/chart', total_ms: 3000, weight: 1 },
            { pv_id: 'pv_1', section: 'chart', path: '/chart', total_ms: 4000, weight: 1 },
          ];
        }
        return [
          { event: 'paywall_view', p1: 'tv2027', p2: 'A', cnt: 12, p95_ms: 0 },
          { event: 'paywall_view', p1: 'tv2027', p2: 'B', cnt: 10, p95_ms: 0 },
          { event: 'interpret_completed', p1: 'overview', p2: 'ai:ok', cnt: 5, p95_ms: 1450 },
        ];
      },
    };

    await rollupSiteDay(db, run1Config, 'tuvi.tqd.me', day);
    expect(capturedSqls).toHaveLength(4);

    const afterRun1 = sqlite
      .prepare('SELECT metric, dim, value FROM analytics_daily WHERE site = ? AND day = ? ORDER BY metric, dim')
      .all('tuvi.tqd.me', day);

    // pv_1 (3000 + 4000 = 7000ms) must land in site:10000 (not site:5000)
    expect(afterRun1).toContainEqual({ metric: 'engaged_hist', dim: 'site:10000', value: 1 });
    expect(afterRun1).toContainEqual({ metric: 'path_pv', dim: '/knowledge/old-stale', value: 1 });
    // Weighted visits & visitors: s1/v1 (weight 4) + s2/v2 (weight 1) = 5
    expect(afterRun1).toContainEqual({ metric: 'visits', dim: '', value: 5 });
    expect(afterRun1).toContainEqual({ metric: 'visitors', dim: '', value: 5 });
    expect(afterRun1).toContainEqual({ metric: 'max_sample_interval', dim: '', value: 4 });
    expect(afterRun1).toContainEqual({ metric: 'event_count', dim: 'paywall_view:tv2027:A', value: 12 });
    expect(afterRun1).toContainEqual({ metric: 'event_count', dim: 'paywall_view:tv2027:B', value: 10 });

    // Run 2: '/knowledge/old-stale' is removed; rerun must purge the old dim and match Run 3 byte-for-byte
    const makeCleanRunner = () => {
      let step = 0;
      return {
        customRunner: async () => {
          step += 1;
          if (step === 1) {
            return [
              {
                event: 'page_view',
                section: 'chart',
                path: '/chart',
                ref_host: 'google.com',
                utm: 'google',
                country: 'VN',
                device: 'mobile',
                cnt: 2,
                max_si: 1,
              },
            ];
          }
          if (step === 2) {
            return [{ sid: 's1', vid_day: 'v1', weight: 1 }];
          }
          if (step === 3) {
            return [
              { pv_id: 'pv_1', section: 'chart', path: '/chart', total_ms: 7000, weight: 1 },
              { pv_id: 'pv_2', section: 'chart', path: '/chart', total_ms: 25000, weight: 1 },
            ];
          }
          return [
            { event: 'paywall_view', p1: 'tv2027', p2: 'A', cnt: 15, p95_ms: 0 },
            { event: 'paywall_view', p1: 'tv2027', p2: 'B', cnt: 14, p95_ms: 0 },
            { event: 'checkout_start', p1: 'tv2027', p2: 'A', cnt: 4, p95_ms: 0 },
            { event: 'payment_success', p1: 'tv2027', p2: 'A', cnt: 2, p95_ms: 0 },
          ];
        },
      };
    };

    await rollupSiteDay(db, makeCleanRunner(), 'tuvi.tqd.me', day);
    const afterRun2 = sqlite
      .prepare('SELECT site, day, metric, dim, value FROM analytics_daily ORDER BY metric, dim')
      .all();

    // Old stale dim must be gone
    expect(afterRun2.some((r) => r.dim === '/knowledge/old-stale')).toBe(false);

    // Run 3: identical input -> identical table rows
    await rollupSiteDay(db, makeCleanRunner(), 'tuvi.tqd.me', day);
    const afterRun3 = sqlite
      .prepare('SELECT site, day, metric, dim, value FROM analytics_daily ORDER BY metric, dim')
      .all();

    expect(afterRun3).toEqual(afterRun2);

    // Verify histogram percentile calculation
    const p50 = percentileFromHistogram({ '10000': 1, '30000': 1 }, 0.5);
    const p75 = percentileFromHistogram({ '10000': 1, '30000': 1 }, 0.75);
    expect(p50).toBe(10000);
    expect(p75).toBe(25000);

    // Verify loadDashboardSummary
    const summary = await loadDashboardSummary(db, 'tuvi.tqd.me', 7);
    expect(summary.site).toBe('tuvi.tqd.me');
  });
});
