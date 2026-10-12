// End-to-end check of the agent API: auth, scopes, If-Match, draft-only keys, rate limit, cleanup.
// Creates and revokes its own keys with scripts/api-key.mjs. Usage: node scripts/verify/api.mjs <base-url> [--remote]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import zlib from 'node:zlib';

const base = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const remote = process.argv.includes('--remote');
const ts = Date.now();
const fullName = `verify-full-${ts}`;
const draftName = `verify-draft-${ts}`;
const fullFile = `.secrets/key-${fullName}`;
const draftFile = `.secrets/key-${draftName}`;

const keyScript = (...args) =>
  execFileSync(process.execPath, ['scripts/api-key.mjs', ...args, ...(remote ? ['--remote'] : [])], { encoding: 'utf8' }).trim();

const cleanupKeys = () => {
  for (const name of [fullName, draftName]) {
    try {
      keyScript('revoke', '--name', name);
    } catch {}
  }
  fs.rmSync(fullFile, { force: true });
  fs.rmSync(draftFile, { force: true });
};

const fail = (step, detail) => {
  console.log(`FAIL ${step} ${detail}`);
  cleanupKeys();
  process.exit(1);
};

keyScript('create', '--name', fullName, '--scopes', 'articles:write,media:write,publish', '--out', fullFile);
keyScript('create', '--name', draftName, '--scopes', 'articles:write,media:write', '--out', draftFile);
const full = fs.readFileSync(fullFile, 'utf8').trim();
const draft = fs.readFileSync(draftFile, 'utf8').trim();

const api = (path, { key, method = 'GET', json, body, type, headers = {} } = {}) => {
  const h = { ...headers };
  if (key) h.Authorization = `Bearer ${key}`;
  if (json !== undefined) h['Content-Type'] = 'application/json';
  if (type) h['Content-Type'] = type;
  return fetch(base + path, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : body });
};

const png1x1 = () => {
  const chunk = (name, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(name), data])));
    return Buffer.concat([len, Buffer.from(name), data, crc]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])),
    chunk('IDAT', zlib.deflateSync(Buffer.from([0, 255, 255, 255, 255]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const pubSlug = `api-test-${ts}`;
const draftSlug = `api-draft-${ts}`;
const title = `Kiểm thử API ${ts}`;
let mediaKey = '';

try {
  // 1. Authentication.
  let res = await api('/api/v1/me');
  if (res.status !== 401) throw [1, `no header ${res.status}`];
  res = await api('/api/v1/me', { key: 'tqd_sai' });
  if (res.status !== 401) throw [1, `bad key ${res.status}`];
  res = await api('/api/v1/me', { key: full });
  if (res.status !== 200 || (await res.json()).name !== fullName) throw [1, `full key ${res.status}`];

  // 2. Upload an image.
  const png = png1x1();
  res = await api('/api/v1/media?filename=verify.png&alt=verify', { key: full, method: 'POST', body: png, type: 'image/png', headers: { 'Content-Length': String(png.length) } });
  if (res.status !== 201) throw [2, `${res.status} ${await res.text()}`];
  mediaKey = (await res.json()).key;

  // 3. Publish with cover and an XSS attempt.
  const article = { title, bodyMd: `![x](/media/${mediaKey})\n\n<script>alert(1)</script>\n\nĐoạn kiểm thử.`, coverKey: mediaKey, publish: true };
  res = await api(`/api/v1/articles/${pubSlug}`, { key: full, method: 'PUT', json: article });
  const created = await res.json();
  if (res.status !== 201 || created.status !== 'published' || res.headers.get('etag') !== '"v1"') {
    throw [3, `${res.status} ${JSON.stringify(created)} ${res.headers.get('etag')}`];
  }
  if (!(await (await fetch(`${base}/bai-viet`)).text()).includes(title)) throw [3, '/bai-viet missing title'];
  const page = await fetch(`${base}/bai-viet/${pubSlug}`);
  if (page.status !== 200 || (await page.text()).includes('<script>alert')) throw [3, `article page ${page.status} or script kept`];
  if (!(await (await fetch(`${base}/search.json`)).text()).includes(`/bai-viet/${pubSlug}`)) throw [3, 'search.json missing article'];

  // 4. Updates need the right If-Match.
  res = await api(`/api/v1/articles/${pubSlug}`, { key: full, method: 'PUT', json: article });
  if (res.status !== 428) throw [4, `no If-Match ${res.status}`];
  res = await api(`/api/v1/articles/${pubSlug}`, { key: full, method: 'PUT', json: article, headers: { 'If-Match': '"v9"' } });
  if (res.status !== 412) throw [4, `wrong If-Match ${res.status}`];
  res = await api(`/api/v1/articles/${pubSlug}`, { key: full, method: 'PUT', json: article, headers: { 'If-Match': '"v1"' } });
  const updated = await res.json();
  if (res.status !== 200 || updated.version !== 2) throw [4, `${res.status} ${JSON.stringify(updated)}`];

  // 5. A key without publish only makes drafts.
  res = await api(`/api/v1/articles/${draftSlug}`, { key: draft, method: 'PUT', json: { title: `${title} nháp`, bodyMd: 'Nháp.', publish: true } });
  const drafted = await res.json();
  if (res.status !== 201 || drafted.status !== 'draft' || !drafted.warning) throw [5, `${res.status} ${JSON.stringify(drafted)}`];
  if ((await fetch(`${base}/bai-viet/${draftSlug}`)).status !== 404) throw [5, 'draft is public'];
  if ((await (await fetch(`${base}/search.json`)).text()).includes(draftSlug)) throw [5, 'draft listed in search.json'];

  // 6. ...and cannot touch a published article.
  res = await api(`/api/v1/articles/${pubSlug}`, { key: draft, method: 'PUT', json: article, headers: { 'If-Match': '"v2"' } });
  if (res.status !== 403) throw [6, res.status];

  // 7. Rate limit.
  const statuses = [];
  for (let i = 0; i < 61; i += 1) statuses.push((await api('/api/v1/me', { key: draft })).status);
  if (!statuses.includes(429)) throw [7, 'no 429 after 61 requests'];

  // 8. Cleanup through the API; backups are never reachable.
  res = await api('/api/v1/media?key=backups/khong-co.json', { key: full, method: 'DELETE' });
  if (res.status !== 404) throw [8, `backup delete ${res.status}`];
  for (const slug of [pubSlug, draftSlug]) {
    res = await api(`/api/v1/articles/${slug}`, { key: full, method: 'DELETE' });
    if (res.status !== 204) throw [8, `delete ${slug} ${res.status}`];
  }
  res = await api(`/api/v1/media?key=${encodeURIComponent(mediaKey)}`, { key: full, method: 'DELETE' });
  mediaKey = '';
  if (res.status !== 204) throw [8, `delete media ${res.status}`];

  // 9. Revoked keys stop working.
  keyScript('revoke', '--name', fullName);
  res = await api('/api/v1/me', { key: full });
  if (res.status !== 401) throw [9, `revoked key ${res.status}`];
} catch (e) {
  // Leave nothing behind before reporting.
  for (const slug of [pubSlug, draftSlug]) await api(`/api/v1/articles/${slug}`, { key: full, method: 'DELETE' }).catch(() => {});
  if (mediaKey) await api(`/api/v1/media?key=${encodeURIComponent(mediaKey)}`, { key: full, method: 'DELETE' }).catch(() => {});
  fail(...(Array.isArray(e) ? e : ['?', e]));
}

cleanupKeys();
console.log('OK api');
