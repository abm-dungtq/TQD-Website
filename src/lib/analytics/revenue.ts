/**
 * src/lib/analytics/revenue.ts
 * Bộ truy vấn chỉ đọc doanh thu, đối soát đơn hàng Tử Vi 2027 và giao dịch SePay từ `TUVI_DB`.
 */

export interface VariantPerformance {
  variant: 'A' | 'B';
  priceVnd: number;
  paywallViews: number;
  ordersCreated: number;
  ordersPaid: number;
  ordersUnderpaid: number;
  ordersPending: number;
  conversionPct: number;
  revenueVnd: number;
  revenuePer1kViewsVnd: number;
}

export interface RevenueSummary {
  totalRevenueVnd: number;
  paidCount: number;
  underpaidCount: number;
  pendingCount: number;
  overallConversionPct: number;
  variants: {
    A: VariantPerformance;
    B: VariantPerformance;
  };
}

export interface OrderRecord {
  code: string;
  product: string;
  variant: string;
  amount: number;
  paid_amount: number;
  status: string;
  redemptions: number;
  ai_used: number;
  created_at: string;
  paid_at: string | null;
}

export interface UnmatchedSepayRecord {
  id: number;
  received_at: string;
  code: string | null;
  amount: number;
  matched: string;
}

function emptyVariant(variant: 'A' | 'B', paywallViews = 0): VariantPerformance {
  return {
    variant,
    priceVnd: variant === 'B' ? 99000 : 49000,
    paywallViews,
    ordersCreated: 0,
    ordersPaid: 0,
    ordersUnderpaid: 0,
    ordersPending: 0,
    conversionPct: 0,
    revenueVnd: 0,
    revenuePer1kViewsVnd: 0,
  };
}

export async function getRevenueSummary(
  tuviDb: D1Database | undefined,
  fromIso = '1970-01-01T00:00:00Z',
  paywallViewsByVariant: { A?: number; B?: number } = {},
): Promise<RevenueSummary> {
  const viewsA = Math.max(0, Number(paywallViewsByVariant.A ?? 0));
  const viewsB = Math.max(0, Number(paywallViewsByVariant.B ?? 0));
  const varA = emptyVariant('A', viewsA);
  const varB = emptyVariant('B', viewsB);

  if (!tuviDb) {
    return {
      totalRevenueVnd: 0,
      paidCount: 0,
      underpaidCount: 0,
      pendingCount: 0,
      overallConversionPct: 0,
      variants: { A: varA, B: varB },
    };
  }

  const parsedFromMs = Date.parse(fromIso);
  const utcFromIso = Number.isNaN(parsedFromMs) ? fromIso : new Date(parsedFromMs).toISOString();

  const res = await tuviDb
    .prepare(
      `SELECT variant, status, COUNT(*) AS cnt, COALESCE(SUM(paid_amount), 0) AS total_paid
       FROM orders
       WHERE is_test = 0 AND created_at >= ?
       GROUP BY variant, status`,
    )
    .bind(utcFromIso)
    .all<{ variant: string; status: string; cnt: number; total_paid: number }>();

  const rows = res.results ?? [];

  for (const r of rows) {
    const target = r.variant === 'B' ? varB : varA;
    const cnt = Number(r.cnt ?? 0);
    const paidSum = Number(r.total_paid ?? 0);
    target.ordersCreated += cnt;

    if (r.status === 'paid') {
      target.ordersPaid += cnt;
      target.revenueVnd += paidSum;
    } else if (r.status === 'underpaid') {
      target.ordersUnderpaid += cnt;
    } else {
      target.ordersPending += cnt;
    }
  }

  for (const v of [varA, varB]) {
    if (v.paywallViews > 0) {
      v.conversionPct = Number(((v.ordersPaid / v.paywallViews) * 100).toFixed(2));
      v.revenuePer1kViewsVnd = Math.round((v.revenueVnd / v.paywallViews) * 1000);
    }
  }

  const totalRevenueVnd = varA.revenueVnd + varB.revenueVnd;
  const paidCount = varA.ordersPaid + varB.ordersPaid;
  const underpaidCount = varA.ordersUnderpaid + varB.ordersUnderpaid;
  const pendingCount = varA.ordersPending + varB.ordersPending;
  const totalViews = viewsA + viewsB;
  const overallConversionPct =
    totalViews > 0 ? Number(((paidCount / totalViews) * 100).toFixed(2)) : 0;

  return {
    totalRevenueVnd,
    paidCount,
    underpaidCount,
    pendingCount,
    overallConversionPct,
    variants: { A: varA, B: varB },
  };
}

export async function listRecentOrders(
  tuviDb: D1Database | undefined,
  limit = 30,
): Promise<OrderRecord[]> {
  if (!tuviDb) return [];
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const res = await tuviDb
    .prepare(
      `SELECT code, product, variant, amount, paid_amount, status, redemptions, ai_used, created_at, paid_at
       FROM orders
       WHERE is_test = 0
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(safeLimit)
    .all<OrderRecord>();

  return res.results ?? [];
}

export async function listUnmatchedSepayEvents(
  tuviDb: D1Database | undefined,
  limit = 20,
): Promise<UnmatchedSepayRecord[]> {
  if (!tuviDb) return [];
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const res = await tuviDb
    .prepare(
      `SELECT id, received_at, code, amount, matched
       FROM sepay_events
       WHERE transfer_type = 'in' AND matched != 'matched'
       ORDER BY id DESC
       LIMIT ?`,
    )
    .bind(safeLimit)
    .all<UnmatchedSepayRecord>();

  return res.results ?? [];
}
