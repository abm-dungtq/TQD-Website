// Fixed-window counter in D1, one row per bucket.
const HIT_SQL = `INSERT INTO rate_limits(bucket, window_start, count) VALUES (?1, ?2, 1)
ON CONFLICT(bucket) DO UPDATE SET
  count = CASE WHEN rate_limits.window_start <= ?2 - ?3 THEN 1 ELSE rate_limits.count + 1 END,
  window_start = CASE WHEN rate_limits.window_start <= ?2 - ?3 THEN ?2 ELSE rate_limits.window_start END
RETURNING count, window_start`;

export async function hit(
  db: D1Database,
  bucket: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(HIT_SQL)
    .bind(bucket, now, windowSec)
    .first<{ count: number; window_start: number }>();
  const count = row?.count ?? 1;
  const windowStart = row?.window_start ?? now;
  return { allowed: count <= limit, retryAfter: Math.max(0, windowStart + windowSec - now) };
}

export async function reset(db: D1Database, bucket: string): Promise<void> {
  await db.prepare('DELETE FROM rate_limits WHERE bucket = ?1').bind(bucket).run();
}
