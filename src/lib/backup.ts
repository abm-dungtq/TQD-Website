// Nightly D1 → R2 snapshot of content tables and daily chat counts. Sessions, rate limits and the per-visitor
// chat rows are left out on purpose.
export const BACKUP_TABLES = ['settings', 'items', 'articles', 'media', 'api_keys', 'chat_daily'] as const;
export const BACKUP_PREFIX = 'backups/';
const KEEP = 30;

const vietnamDate = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

/** Writes backups/YYYY-MM-DD.json, keeps the newest 30, returns the key written. */
export async function runBackup(env: Env): Promise<string> {
  const tables: Record<string, unknown[]> = {};
  for (const name of BACKUP_TABLES) {
    tables[name] = (await env.DB.prepare(`SELECT * FROM ${name}`).all()).results;
  }
  const key = `${BACKUP_PREFIX}${vietnamDate()}.json`;
  await env.MEDIA.put(key, JSON.stringify({ createdAt: new Date().toISOString(), tables }), {
    httpMetadata: { contentType: 'application/json' },
  });

  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.MEDIA.list({ prefix: BACKUP_PREFIX, cursor });
    keys.push(...page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const stale = keys.sort().reverse().slice(KEEP);
  if (stale.length) await env.MEDIA.delete(stale);
  return key;
}
