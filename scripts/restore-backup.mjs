// Turns a backups/YYYY-MM-DD.{json,json.gz,json.gz.enc} snapshot into transactional SQL that replaces the content tables.
// Usage: [BACKUP_ENCRYPTION_KEY=...] node scripts/restore-backup.mjs <backup-file> <out.sql>
import { webcrypto } from 'node:crypto';
import fs from 'node:fs';
import zlib from 'node:zlib';

const TABLES = [
  'settings',
  'items',
  'articles',
  'media',
  'api_keys',
  'chat_daily',
  'analytics_daily',
];

const SAFE_IDENT_RE = /^[a-z_][a-z0-9_]{0,63}$/;
const BACKUP_MAGIC = 'TQDBKP01';
const HKDF_INFO = new TextEncoder().encode('tqd-backup-aes-256-gcm-v1');

export function assertSafeColumnName(col) {
  if (typeof col !== 'string' || !SAFE_IDENT_RE.test(col)) {
    throw new Error(`Unsafe or invalid SQL column identifier in backup: ${JSON.stringify(col)}`);
  }
  return col;
}

export const sqlValue = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`Non-finite numeric value in backup: ${v}`);
    return String(v);
  }
  return `'${String(v).replace(/'/g, "''")}'`;
};

async function decryptBackupBuffer(buf, secret) {
  const magicLen = BACKUP_MAGIC.length;
  if (buf.byteLength < magicLen + 16 + 12 + 16) {
    throw new Error('Encrypted backup file is truncated');
  }
  const header = new TextDecoder().decode(buf.subarray(0, magicLen));
  if (header !== BACKUP_MAGIC) {
    throw new Error('Unrecognized encrypted backup header');
  }
  const salt = buf.subarray(magicLen, magicLen + 16);
  const iv = buf.subarray(magicLen + 16, magicLen + 28);
  const ciphertext = buf.subarray(magicLen + 28);

  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'HKDF',
    false,
    ['deriveKey'],
  );
  const aesKey = await webcrypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: HKDF_INFO },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const decrypted = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);
  return Buffer.from(decrypted);
}

async function readBackupJson(filePath) {
  const raw = fs.readFileSync(filePath);
  const header = raw.subarray(0, BACKUP_MAGIC.length).toString('utf8');
  if (filePath.endsWith('.enc') || header === BACKUP_MAGIC) {
    const secret = (process.env.BACKUP_ENCRYPTION_KEY ?? '').trim();
    if (!secret) {
      throw new Error('BACKUP_ENCRYPTION_KEY environment variable is required to decrypt .enc backup');
    }
    const decryptedGzip = await decryptBackupBuffer(raw, secret);
    return JSON.parse(zlib.gunzipSync(decryptedGzip).toString('utf8'));
  }
  if (filePath.endsWith('.gz') || (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b)) {
    return JSON.parse(zlib.gunzipSync(raw).toString('utf8'));
  }
  return JSON.parse(raw.toString('utf8'));
}

export function buildRestoreSql(tables) {
  const lines = ['BEGIN TRANSACTION;'];
  for (const name of TABLES) {
    assertSafeColumnName(name);
    if (!(name in tables) || !Array.isArray(tables[name])) continue;
    lines.push(`DELETE FROM ${name};`);
    for (const row of tables[name]) {
      if (!row || typeof row !== 'object') continue;
      const cols = Object.keys(row).map(assertSafeColumnName);
      if (cols.length === 0) continue;
      lines.push(
        `INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map((c) => sqlValue(row[c])).join(', ')});`,
      );
    }
  }
  lines.push('COMMIT;');
  return lines;
}

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Usage: [BACKUP_ENCRYPTION_KEY=...] node scripts/restore-backup.mjs <backup.{json,json.gz,json.gz.enc}> <out.sql>');
    process.exit(2);
  }
  const { tables } = await readBackupJson(input);
  const lines = buildRestoreSql(tables ?? {});
  fs.writeFileSync(output, lines.join('\n') + '\n');
  console.log(`Wrote ${lines.length} statements to ${output}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
