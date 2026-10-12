// Admin sessions: random token in an HttpOnly cookie, only its SHA-256 stored in D1.
export const COOKIE = '__Host-tqd_admin';
export const TTL_SEC = 12 * 3600;

const COOKIE_ATTRS = 'Path=/; HttpOnly; Secure; SameSite=Strict';

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const randomToken = (): string =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const nowSec = (): number => Math.floor(Date.now() / 1000);

export async function createSession(db: D1Database): Promise<string> {
  const token = randomToken();
  const now = nowSec();
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?1').bind(now),
    db.prepare('INSERT INTO sessions(id_hash, expires_at) VALUES (?1, ?2)').bind(await sha256Hex(token), now + TTL_SEC),
  ]);
  return token;
}

export async function readSession(db: D1Database, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const row = await db
    .prepare('SELECT 1 AS ok FROM sessions WHERE id_hash = ?1 AND expires_at > ?2')
    .bind(await sha256Hex(token), nowSec())
    .first();
  return row !== null;
}

export async function destroySession(db: D1Database, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.prepare('DELETE FROM sessions WHERE id_hash = ?1').bind(await sha256Hex(token)).run();
}

export const cookieHeader = (token: string): string => `${COOKIE}=${token}; ${COOKIE_ATTRS}; Max-Age=${TTL_SEC}`;
export const clearCookieHeader = (): string => `${COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`;
