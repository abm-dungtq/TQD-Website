/**
 * src/lib/analytics/histogram.ts
 * Bộ phân nhóm (10 buckets) thời gian tương tác thực `engaged_ms` và tính phân vị
 * `p50` / `p75` trên mọi khoảng ngày (1/7/30/90/365 ngày) mà không mắc lỗi trung bình hóa số trung vị.
 */

export const ENGAGED_BUCKETS_MS = [
  5000,
  10000,
  20000,
  30000,
  60000,
  120000,
  300000,
  600000,
  1800000,
  Infinity,
] as const;

export const ENGAGED_BUCKET_KEYS = [
  '5000',
  '10000',
  '20000',
  '30000',
  '60000',
  '120000',
  '300000',
  '600000',
  '1800000',
  'inf',
] as const;

export type EngagedBucketKey = (typeof ENGAGED_BUCKET_KEYS)[number];

const BUCKET_BOUNDS: Array<{ key: EngagedBucketKey; lower: number; upper: number }> = [
  { key: '5000', lower: 1000, upper: 5000 },
  { key: '10000', lower: 5000, upper: 10000 },
  { key: '20000', lower: 10000, upper: 20000 },
  { key: '30000', lower: 20000, upper: 30000 },
  { key: '60000', lower: 30000, upper: 60000 },
  { key: '120000', lower: 60000, upper: 120000 },
  { key: '300000', lower: 120000, upper: 300000 },
  { key: '600000', lower: 300000, upper: 600000 },
  { key: '1800000', lower: 600000, upper: 1800000 },
  { key: 'inf', lower: 1800000, upper: 1800000 },
];

/**
 * Chọn khóa bucket nhỏ nhất >= totalMs.
 * Theo đặc tả Mục 3: chỉ tính các lượt xem có tổng engaged_ms >= 1000 (trả về null nếu < 1000).
 */
export function bucketForMs(totalMs: number): EngagedBucketKey | null {
  if (!Number.isFinite(totalMs) || totalMs < 1000) return null;
  for (const b of BUCKET_BOUNDS) {
    if (b.key !== 'inf' && totalMs <= b.upper) {
      return b.key;
    }
  }
  return 'inf';
}

/**
 * Tính phân vị `q` (0.5 cho p50, 0.75 cho p75) từ bản đồ tổng số mẫu theo từng bucket.
 * Nội suy tuyến tính giữa cận dưới và cận trên của bucket chứa vị trí phân vị `q`.
 */
export function percentileFromHistogram(
  countsByBucketKey: Record<string, number>,
  q: 0.5 | 0.75,
): number {
  let total = 0;
  for (const b of BUCKET_BOUNDS) {
    const c = Number(countsByBucketKey[b.key] ?? 0);
    if (c > 0) total += c;
  }
  if (total <= 0) return 0;

  const target = total * q;
  let cumulative = 0;

  for (const b of BUCKET_BOUNDS) {
    const count = Number(countsByBucketKey[b.key] ?? 0);
    if (count <= 0) continue;
    const prev = cumulative;
    cumulative += count;
    if (cumulative >= target) {
      if (b.key === 'inf' || b.upper === b.lower) {
        return b.upper;
      }
      const ratio = Math.max(0, Math.min(1, (target - prev) / count));
      return Math.round(b.lower + ratio * (b.upper - b.lower));
    }
  }

  return 1800000;
}
