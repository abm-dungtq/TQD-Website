import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getRevenueSummary,
  listRecentOrders,
  listUnmatchedSepayEvents,
} from './revenue';

const TUVI_SCHEMA_SQL = `
CREATE TABLE orders (
  code TEXT PRIMARY KEY,
  product TEXT NOT NULL DEFAULT 'tv2027',
  variant TEXT NOT NULL DEFAULT 'A',
  amount INTEGER NOT NULL,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  claim_hash TEXT NOT NULL,
  redemptions INTEGER NOT NULL DEFAULT 0,
  ai_used INTEGER NOT NULL DEFAULT 0,
  is_test INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE TABLE sepay_events (
  id INTEGER PRIMARY KEY,
  received_at TEXT NOT NULL,
  code TEXT,
  amount INTEGER NOT NULL,
  transfer_type TEXT NOT NULL DEFAULT 'in',
  matched TEXT NOT NULL DEFAULT 'unmatched'
);
`;

function fakeD1(sqlite) {
  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
    run: async () => sqlite.prepare(sql).run(...params),
  });
  return {
    prepare: (sql) => statement(sql),
  };
}

let sqlite;
let tuviDb;

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(TUVI_SCHEMA_SQL);
  tuviDb = fakeD1(sqlite);
});

describe('getRevenueSummary, listRecentOrders & listUnmatchedSepayEvents', () => {
  it('sums only real paid orders (is_test = 0), computes Variant A vs B metrics, and lists unmatched SePay events', async () => {
    const insertOrder = sqlite.prepare(
      `INSERT INTO orders (code, product, variant, amount, paid_amount, status, claim_hash, redemptions, ai_used, is_test, created_at, paid_at)
       VALUES (?, 'tv2027', ?, ?, ?, ?, 'claimhash', ?, ?, ?, ?, ?)`,
    );

    // 2 real paid orders (A = 49k, B = 99k)
    insertOrder.run('TV10000001', 'A', 49000, 49000, 'paid', 2, 1, 0, '2026-11-05T08:00:00Z', '2026-11-05T08:01:00Z');
    insertOrder.run('TV10000002', 'B', 99000, 99000, 'paid', 1, 0, 0, '2026-11-05T09:00:00Z', '2026-11-05T09:01:00Z');
    // 1 test paid order (is_test = 1 -> must be excluded)
    insertOrder.run('TV99999999', 'A', 49000, 49000, 'paid', 0, 0, 1, '2026-11-05T09:30:00Z', '2026-11-05T09:31:00Z');
    // 1 underpaid order (A = 20k / 49k)
    insertOrder.run('TV10000003', 'A', 49000, 20000, 'underpaid', 0, 0, 0, '2026-11-05T10:00:00Z', null);

    const insertEvent = sqlite.prepare(
      `INSERT INTO sepay_events (id, received_at, code, amount, transfer_type, matched)
       VALUES (?, ?, ?, ?, 'in', ?)`,
    );
    insertEvent.run(5001, '2026-11-05T08:01:00Z', 'TV10000001', 49000, 'matched');
    insertEvent.run(5002, '2026-11-05T10:05:00Z', null, 49000, 'unmatched');

    const summary = await getRevenueSummary(tuviDb, '2026-11-01T00:00:00Z', {
      A: 100,
      B: 100,
    });

    expect(summary.totalRevenueVnd).toBe(49000 + 99000);
    expect(summary.paidCount).toBe(2);
    expect(summary.underpaidCount).toBe(1);
    expect(summary.variants.A.revenueVnd).toBe(49000);
    expect(summary.variants.A.revenuePer1kViewsVnd).toBe(490000);
    expect(summary.variants.B.revenueVnd).toBe(99000);
    expect(summary.variants.B.revenuePer1kViewsVnd).toBe(990000);

    const orders = await listRecentOrders(tuviDb, 30);
    expect(orders.map((o) => o.code)).toEqual(['TV10000003', 'TV10000002', 'TV10000001']);

    const unmatched = await listUnmatchedSepayEvents(tuviDb, 20);
    expect(unmatched).toHaveLength(1);
    expect(unmatched[0].id).toBe(5002);
    expect(unmatched[0].matched).toBe('unmatched');
  });

  it('normalizes +07:00 VN midnight timestamps to UTC Z before comparing against UTC created_at', async () => {
    const insertOrder = sqlite.prepare(
      `INSERT INTO orders (code, product, variant, amount, paid_amount, status, claim_hash, redemptions, ai_used, is_test, created_at, paid_at)
       VALUES (?, 'tv2027', ?, ?, ?, 'paid', 'claimhash', 0, 0, 0, ?, ?)`,
    );

    // 2026-11-04T16:30:00Z = 23:30 VN on 2026-11-04 (BEFORE VN midnight 2026-11-05 -> must be excluded)
    insertOrder.run('TV_BEFORE', 'A', 49000, 49000, '2026-11-04T16:30:00Z', '2026-11-04T16:31:00Z');
    // 2026-11-04T18:30:00Z = 01:30 VN on 2026-11-05 (AFTER VN midnight 2026-11-05 -> must be included!)
    insertOrder.run('TV_AFTER', 'B', 99000, 99000, '2026-11-04T18:30:00Z', '2026-11-04T18:31:00Z');

    const summary = await getRevenueSummary(tuviDb, '2026-11-05T00:00:00+07:00', { A: 50, B: 50 });
    expect(summary.paidCount).toBe(1);
    expect(summary.totalRevenueVnd).toBe(99000);
    expect(summary.variants.A.ordersPaid).toBe(0);
    expect(summary.variants.B.ordersPaid).toBe(1);
  });
});
