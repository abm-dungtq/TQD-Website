// Creates or revokes agent API keys in D1. The key is written to a file and never printed.
// Usage: node scripts/api-key.mjs create --name <name> --scopes <a,b> --out <file> [--remote]
//        node scripts/api-key.mjs revoke --name <name> [--remote]
// Same format as src/lib/api-key.ts: tqd_ + 32 random bytes base64url, SHA-256 hex stored.
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SCOPES = ['articles:write', 'media:write', 'publish'];
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const [command, ...rest] = process.argv.slice(2);
const arg = (flag) => {
  const i = rest.indexOf(flag);
  return i >= 0 ? rest[i + 1] : undefined;
};
const remote = rest.includes('--remote');
const name = arg('--name') ?? '';
const usage = () => {
  console.error('Usage: node scripts/api-key.mjs create --name <name> --scopes <a,b> --out <file> [--remote]');
  console.error('       node scripts/api-key.mjs revoke --name <name> [--remote]');
  process.exit(2);
};
if (!/^[\w.-]{1,60}$/.test(name)) usage();

const d1 = (sql) => {
  // Execute via argument array (`shell: false`) and a restricted temp SQL file.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tqd-key-'));
  fs.chmodSync(tmpDir, 0o700);
  const file = path.join(tmpDir, 'q.sql');
  fs.writeFileSync(file, sql, { mode: 0o600 });
  const res = spawnSync(
    npxBin,
    ['wrangler', 'd1', 'execute', 'tqd_db', remote ? '--remote' : '--local', '--file', file],
    { encoding: 'utf8', shell: false },
  );
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (res.status !== 0) {
    console.error(`wrangler failed (${res.status})\n${res.stderr || res.stdout}`);
    process.exit(1);
  }
};

if (command === 'create') {
  const scopes = SCOPES.filter((s) => (arg('--scopes') ?? '').split(',').map((x) => x.trim()).includes(s));
  const out = arg('--out');
  if (!scopes.length || !out) usage();
  const key = `tqd_${randomBytes(32).toString('base64url')}`;
  const hash = createHash('sha256').update(key).digest('hex');
  d1(`INSERT INTO api_keys (name, prefix, hash, scopes) VALUES ('${name}', '${key.slice(0, 12)}', '${hash}', '${scopes.join(',')}');`);
  const outDir = path.dirname(path.resolve(out));
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(out, key + '\n', { mode: 0o600 });
  fs.chmodSync(out, 0o600);
  console.log(`created ${name} ${key.slice(0, 4)}`);
} else if (command === 'revoke') {
  d1(`UPDATE api_keys SET revoked_at = datetime('now') WHERE name = '${name}' AND revoked_at IS NULL;`);
  console.log(`revoked ${name}`);
} else usage();
