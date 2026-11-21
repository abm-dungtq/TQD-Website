// Session cookie reader for the downloader's admin tier. The admin UI itself now lives in EzyPlatform
// (admin.tqd.me), so only the read path that `resolveDlTier` needs is kept.
export const COOKIE = '__Host-tqd_admin';

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function readSession(db: D1Database, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const row = await db
    .prepare('SELECT 1 AS ok FROM sessions WHERE id_hash = ?1 AND expires_at > ?2')
    .bind(await sha256Hex(token), Math.floor(Date.now() / 1000))
    .first();
  return row !== null;
}
