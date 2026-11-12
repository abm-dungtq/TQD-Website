import { describe, expect, it } from 'vitest';
import {
  assertSafeColumnName,
  buildRestoreSql,
} from '../../scripts/restore-backup.mjs';
import {
  BACKUP_TABLES,
  decryptBackupBytes,
  gunzipBytesToString,
  runBackup,
} from './backup';

function makePaginatedFakeDb(totalRowsByTable = {}) {
  const queries = [];
  return {
    queries,
    prepare(sql) {
      return {
        bind(offset = 0) {
          return {
            all: async () => {
              queries.push({ sql, offset });
              const match = /FROM\s+([a-z_]+)/i.exec(sql);
              const table = match ? match[1] : 'unknown';
              const rows = totalRowsByTable[table] ?? [{ table, id: 1 }];
              return { results: rows.slice(offset, offset + 250) };
            },
          };
        },
        all: async () => ({ results: [{ sql }] }),
      };
    },
  };
}

describe('BACKUP_TABLES & runBackup (paginated streaming gzip + AES-256-GCM encryption)', () => {
  it('paginates D1 tables across >250 rows, includes analytics_daily, and writes gzip snapshot when BACKUP_ENCRYPTION_KEY is unset', async () => {
    expect(BACKUP_TABLES).toContain('analytics_daily');

    // 320 rows in analytics_daily forces 2 paginated D1 queries (250 + 70)
    const manyRows = Array.from({ length: 320 }, (_, i) => ({
      site: 'tqd.me',
      day: '2026-11-12',
      metric: 'path_pv',
      dim: `/p-${i}`,
      value: i + 1,
    }));

    const stored = new Map();
    const db = makePaginatedFakeDb({ analytics_daily: manyRows });
    const fakeEnv = {
      DB: db,
      MEDIA: {
        put: async (key, body) => {
          stored.set(key, body instanceof Uint8Array ? body : new Uint8Array(body));
        },
        list: async () => ({
          objects: [...stored.keys()].map((key) => ({ key })),
          truncated: false,
        }),
        delete: async () => {},
      },
    };

    const key = await runBackup(fakeEnv);
    expect(key).toMatch(/^backups\/\d{4}-\d{2}-\d{2}\.json\.gz$/);

    const rawBytes = stored.get(key);
    expect(rawBytes).toBeInstanceOf(Uint8Array);
    const jsonText = await gunzipBytesToString(rawBytes);
    const payload = JSON.parse(jsonText);

    expect(Object.keys(payload.tables)).toContain('analytics_daily');
    expect(payload.tables.analytics_daily).toHaveLength(320);
    // Verify pagination actually issued OFFSET 0 and OFFSET 250 for analytics_daily
    const analyticsCalls = db.queries.filter((q) => q.sql.includes('analytics_daily'));
    expect(analyticsCalls.map((c) => c.offset)).toEqual([0, 250]);
  });

  it('encrypts compressed snapshot with AES-256-GCM when BACKUP_ENCRYPTION_KEY is set and rejects wrong keys', async () => {
    const stored = new Map();
    const secret = 'test-super-secret-backup-key-32b!';
    const fakeEnv = {
      BACKUP_ENCRYPTION_KEY: secret,
      DB: makePaginatedFakeDb({
        api_keys: [{ id: 1, name: 'bot', key_hash: 'abc123hash' }],
      }),
      MEDIA: {
        put: async (key, body) => {
          stored.set(key, body instanceof Uint8Array ? body : new Uint8Array(body));
        },
        list: async () => ({
          objects: [...stored.keys()].map((key) => ({ key })),
          truncated: false,
        }),
        delete: async () => {},
      },
    };

    const key = await runBackup(fakeEnv);
    expect(key).toMatch(/^backups\/\d{4}-\d{2}-\d{2}\.json\.gz\.enc$/);

    const encrypted = stored.get(key);
    // Encrypted ciphertext must not contain plaintext table names
    expect(new TextDecoder().decode(encrypted)).not.toContain('analytics_daily');

    // Wrong key must fail GCM authentication
    await expect(decryptBackupBytes(encrypted, 'wrong-key')).rejects.toThrow();

    // Right key decrypts cleanly to valid gzipped JSON
    const decryptedGzip = await decryptBackupBytes(encrypted, secret);
    const payload = JSON.parse(await gunzipBytesToString(decryptedGzip));
    expect(payload.tables.api_keys).toEqual([{ id: 1, name: 'bot', key_hash: 'abc123hash' }]);
  });

  it('restore-backup validates column identifiers strictly, includes analytics_daily, and wraps SQL in a transaction', () => {
    expect(() => assertSafeColumnName('id); DROP TABLE articles; --')).toThrow(/Unsafe or invalid SQL column identifier/);
    expect(() => assertSafeColumnName('1bad')).toThrow();
    expect(assertSafeColumnName('key_hash')).toBe('key_hash');

    const sqlLines = buildRestoreSql({
      analytics_daily: [{ site: 'tqd.me', day: '2026-11-12', metric: 'pageviews', dim: '', value: 42 }],
    });
    expect(sqlLines[0]).toBe('BEGIN TRANSACTION;');
    expect(sqlLines.at(-1)).toBe('COMMIT;');
    expect(sqlLines).toContain('DELETE FROM analytics_daily;');
    expect(sqlLines).toContain(
      "INSERT INTO analytics_daily (site, day, metric, dim, value) VALUES ('tqd.me', '2026-11-12', 'pageviews', '', 42);",
    );

    expect(() =>
      buildRestoreSql({
        settings: [{ 'key); DROP TABLE settings;--': 'v' }],
      }),
    ).toThrow(/Unsafe or invalid SQL column identifier/);
  });
});
