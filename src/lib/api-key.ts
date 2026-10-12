// Agent API keys: `tqd_` + 32 random bytes in base64url, only the SHA-256 stored in D1.
import { randomToken, sha256Hex } from './auth';

export const SCOPES = ['articles:write', 'media:write', 'publish'] as const;
export type Scope = (typeof SCOPES)[number];

export interface ApiKey {
  id: number;
  name: string;
  scopes: Scope[];
}

const BEARER = /^Bearer (tqd_[A-Za-z0-9_-]{43})$/;

export async function generateApiKey(): Promise<{ key: string; prefix: string; hash: string }> {
  const key = `tqd_${randomToken()}`;
  return { key, prefix: key.slice(0, 12), hash: await sha256Hex(key) };
}

export function parseScopes(text: string): Scope[] {
  const wanted = text.split(',').map((s) => s.trim());
  return SCOPES.filter((s) => wanted.includes(s));
}

export async function authenticate(db: D1Database, authHeader: string | null): Promise<ApiKey | null> {
  const key = BEARER.exec(authHeader ?? '')?.[1];
  if (!key) return null;
  const row = await db
    .prepare('SELECT id, name, scopes FROM api_keys WHERE hash = ?1 AND revoked_at IS NULL')
    .bind(await sha256Hex(key))
    .first<{ id: number; name: string; scopes: string }>();
  return row ? { id: row.id, name: row.name, scopes: parseScopes(row.scopes) } : null;
}
