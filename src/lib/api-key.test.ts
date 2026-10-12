import { describe, expect, it } from 'vitest';
import { authenticate, generateApiKey, parseScopes } from './api-key';
import { sha256Hex } from './auth';

describe('api key', () => {
  it('generates distinct tqd_ keys with prefix and hash', async () => {
    const a = await generateApiKey();
    const b = await generateApiKey();
    expect(a.key).toMatch(/^tqd_[A-Za-z0-9_-]{43}$/);
    expect(a.key).toHaveLength(47);
    expect(a.prefix).toBe(a.key.slice(0, 12));
    expect(a.hash).toBe(await sha256Hex(a.key));
    expect(a.key).not.toBe(b.key);
  });

  it('keeps only known scopes, once each', () => {
    expect(parseScopes('publish, x, publish')).toEqual(['publish']);
    expect(parseScopes('media:write,articles:write')).toEqual(['articles:write', 'media:write']);
  });

  it('rejects malformed headers without touching the database', async () => {
    const db = {} as D1Database;
    for (const header of [null, '', 'Bearer tqd_sai', 'Basic abc', `bearer tqd_${'a'.repeat(43)}`]) {
      expect(await authenticate(db, header)).toBeNull();
    }
  });
});
