// Nightly D1 → R2 snapshot of content tables and daily chat/analytics counts.
// Paginates D1 queries in bounded batches, streams JSON directly into gzip compression,
// and optionally encrypts with AES-256-GCM (HKDF-SHA256) when BACKUP_ENCRYPTION_KEY is set.
export const BACKUP_TABLES = [
  'settings',
  'items',
  'articles',
  'media',
  'api_keys',
  'chat_daily',
  'analytics_daily',
] as const;

export const BACKUP_PREFIX = 'backups/';
export const BACKUP_MAGIC = 'TQDBKP01';
const HKDF_INFO = new TextEncoder().encode('tqd-backup-aes-256-gcm-v1');
const PAGE_SIZE = 250;
const KEEP = 30;

const vietnamDate = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

async function deriveBackupAesKey(
  secret: string,
  salt: Uint8Array,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as BufferSource,
      info: HKDF_INFO,
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  );
}

export async function encryptBackupBytes(
  plainGzip: Uint8Array,
  secret: string,
): Promise<Uint8Array> {
  const magic = new TextEncoder().encode(BACKUP_MAGIC);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupAesKey(secret, salt, ['encrypt']);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    plainGzip as BufferSource,
  );
  const cipher = new Uint8Array(cipherBuf);
  const out = new Uint8Array(magic.byteLength + salt.byteLength + iv.byteLength + cipher.byteLength);
  out.set(magic, 0);
  out.set(salt, magic.byteLength);
  out.set(iv, magic.byteLength + salt.byteLength);
  out.set(cipher, magic.byteLength + salt.byteLength + iv.byteLength);
  return out;
}

export async function decryptBackupBytes(
  encrypted: Uint8Array,
  secret: string,
): Promise<Uint8Array> {
  const magicLen = BACKUP_MAGIC.length;
  if (encrypted.byteLength < magicLen + 16 + 12 + 16) {
    throw new Error('Invalid encrypted backup payload (too short)');
  }
  const header = new TextDecoder().decode(encrypted.subarray(0, magicLen));
  if (header !== BACKUP_MAGIC) {
    throw new Error('Invalid encrypted backup header');
  }
  const salt = encrypted.subarray(magicLen, magicLen + 16);
  const iv = encrypted.subarray(magicLen + 16, magicLen + 28);
  const ciphertext = encrypted.subarray(magicLen + 28);
  const key = await deriveBackupAesKey(secret, salt, ['decrypt']);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  );
  return new Uint8Array(plainBuf);
}

export async function gunzipBytesToString(gzipBytes: Uint8Array): Promise<string> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  const writePromise = writer.write(gzipBytes as BufferSource).then(() => writer.close());
  const text = await new Response(ds.readable).text();
  await writePromise;
  return text;
}

async function writeTableStream(
  db: D1Database,
  tableSqlName: string,
  writeText: (chunk: string) => Promise<void>,
): Promise<void> {
  let offset = 0;
  let firstRow = true;
  await writeText('[');
  for (;;) {
    const stmt = db.prepare(`SELECT * FROM ${tableSqlName} LIMIT ${PAGE_SIZE} OFFSET ?`);
    const supportsBind = typeof (stmt as { bind?: unknown }).bind === 'function';
    const bound = supportsBind ? stmt.bind(offset) : stmt;
    const res = await bound.all();
    const rows = res.results ?? [];
    if (rows.length > 0) {
      let batchJson = '';
      for (const row of rows) {
        batchJson += (firstRow ? '' : ',') + JSON.stringify(row);
        firstRow = false;
      }
      await writeText(batchJson);
    }
    if (!supportsBind || rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  await writeText(']');
}

async function buildCompressedBackupJson(env: Env): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  const encoder = new TextEncoder();

  const compressedChunks: Uint8Array[] = [];
  let compressedLen = 0;
  const readerPromise = (async () => {
    const reader = cs.readable.getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        compressedChunks.push(value);
        compressedLen += value.byteLength;
      }
    }
  })();

  const writeText = async (chunk: string) => {
    await writer.write(encoder.encode(chunk));
  };

  await writeText(`{"createdAt":${JSON.stringify(new Date().toISOString())},"tables":{`);
  let firstTable = true;

  for (const name of BACKUP_TABLES) {
    await writeText(`${firstTable ? '' : ','}${JSON.stringify(name)}:`);
    firstTable = false;
    await writeTableStream(env.DB, name, writeText);
  }

  const tuviDb = (env as { TUVI_DB?: D1Database }).TUVI_DB;
  if (tuviDb) {
    for (const [alias, sqlTable] of [
      ['tuvi_orders', 'orders'],
      ['tuvi_sepay_events', 'sepay_events'],
    ] as const) {
      try {
        // Probe table existence before emitting JSON key so partial errors never corrupt JSON syntax.
        await tuviDb.prepare(`SELECT 1 FROM ${sqlTable} LIMIT 1`).all();
        await writeText(`${firstTable ? '' : ','}${JSON.stringify(alias)}:`);
        firstTable = false;
        await writeTableStream(tuviDb, sqlTable, writeText);
      } catch {
        // Ignore if tuvi_db tables are not yet migrated in preview/local.
      }
    }
  }

  await writeText('}}');
  await writer.close();
  await readerPromise;

  const merged = new Uint8Array(compressedLen);
  let pos = 0;
  for (const c of compressedChunks) {
    merged.set(c, pos);
    pos += c.byteLength;
  }
  return merged;
}

/**
 * Writes `backups/YYYY-MM-DD.json.gz` (or `.json.gz.enc` when `BACKUP_ENCRYPTION_KEY` is configured),
 * keeps the newest 30 snapshots, and returns the R2 key written.
 */
export async function runBackup(env: Env): Promise<string> {
  const compressed = await buildCompressedBackupJson(env);
  const encKey = env.BACKUP_ENCRYPTION_KEY?.trim();

  const datePart = vietnamDate();
  const key = encKey
    ? `${BACKUP_PREFIX}${datePart}.json.gz.enc`
    : `${BACKUP_PREFIX}${datePart}.json.gz`;
  const payload = encKey ? await encryptBackupBytes(compressed, encKey) : compressed;
  const contentType = encKey ? 'application/octet-stream' : 'application/gzip';

  await env.MEDIA.put(key, payload, {
    httpMetadata: { contentType },
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
