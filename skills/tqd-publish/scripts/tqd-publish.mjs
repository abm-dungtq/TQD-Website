#!/usr/bin/env node
// CLI for the tqd.io.vn agent API. Node >= 20, no dependencies. Never prints the API key.
// Key: TQD_API_KEY, or --key-file <path>, or ~/.config/tqd/api-key. Base: TQD_API_BASE (default https://tqd.io.vn).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const USAGE = `Usage: tqd-publish.mjs <command> [options] [--key-file <path>]
  whoami
  upload <file> [--alt "..."]
  put <slug> --title "..." --body-file <file.md> [--summary "..."] [--tags a,b] [--cover <mediaKey>] [--publish]
  get <slug>
  list [--status draft|published]
  delete <slug>
  delete-media <key>`;

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (!a.startsWith('--')) positional.push(a);
  else if (a === '--publish') flags.publish = true;
  else flags[a.slice(2)] = argv[(i += 1)];
}
const [command, target] = positional;

// process.exit() right after fetch() can abort Node on Windows, so errors unwind to main() instead.
class Exit extends Error {}
const die = (data) => {
  process.stderr.write(JSON.stringify(data) + '\n');
  process.exitCode = 1;
  throw new Exit();
};
const need = (value, what) => value ?? die({ error: 'usage', message: `Thiếu ${what}.`, usage: USAGE });

async function main() {
  const base = (process.env.TQD_API_BASE ?? 'https://tqd.io.vn').replace(/\/$/, '');
  const keyFile = flags['key-file'] ?? path.join(os.homedir(), '.config', 'tqd', 'api-key');
  let key = process.env.TQD_API_KEY?.trim();
  if (!key) {
    try {
      key = fs.readFileSync(keyFile, 'utf8').trim();
    } catch {
      die({ error: 'no_key', message: `Không tìm thấy API key: đặt TQD_API_KEY hoặc tạo file ${keyFile}.` });
    }
  }

  async function call(method, urlPath, { json, body, headers = {}, ok = [200] } = {}) {
    const h = { Authorization: `Bearer ${key}`, ...headers };
    if (json !== undefined) h['Content-Type'] = 'application/json';
    const res = await fetch(base + urlPath, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : body });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text.slice(0, 300) };
    }
    if (!ok.includes(res.status)) die({ status: res.status, ...data });
    return { res, data };
  }

  const out = (data) => process.stdout.write(JSON.stringify(data) + '\n');
  const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4', '.webm': 'video/webm' };

  switch (command) {
    case 'whoami':
      out((await call('GET', '/api/v1/me')).data);
      break;

    case 'upload': {
      const file = need(target, 'đường dẫn tệp');
      const bytes = fs.readFileSync(file);
      const qs = new URLSearchParams({ filename: path.basename(file), alt: flags.alt ?? '' });
      const { data } = await call('POST', `/api/v1/media?${qs}`, {
        body: bytes,
        headers: { 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Content-Length': String(bytes.length) },
        ok: [201],
      });
      out(data);
      break;
    }

    case 'put': {
      const slug = need(target, 'slug');
      const payload = {
        title: need(flags.title, '--title'),
        bodyMd: fs.readFileSync(need(flags['body-file'], '--body-file'), 'utf8'),
      };
      if (flags.summary !== undefined) payload.summary = flags.summary;
      if (flags.tags !== undefined) payload.tags = flags.tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (flags.cover !== undefined) payload.coverKey = flags.cover;
      if (flags.publish) payload.publish = true;
      // Existing articles need the current version in If-Match.
      const current = await call('GET', `/api/v1/articles/${encodeURIComponent(slug)}`, { ok: [200, 404] });
      const headers = current.res.status === 200 ? { 'If-Match': current.res.headers.get('etag') } : {};
      out((await call('PUT', `/api/v1/articles/${encodeURIComponent(slug)}`, { json: payload, headers, ok: [200, 201] })).data);
      break;
    }

    case 'get':
      out((await call('GET', `/api/v1/articles/${encodeURIComponent(need(target, 'slug'))}`)).data);
      break;

    case 'list': {
      const qs = flags.status ? `?status=${encodeURIComponent(flags.status)}` : '';
      out((await call('GET', `/api/v1/articles${qs}`)).data);
      break;
    }

    case 'delete':
      await call('DELETE', `/api/v1/articles/${encodeURIComponent(need(target, 'slug'))}`, { ok: [204] });
      out({ deleted: target });
      break;

    case 'delete-media':
      await call('DELETE', `/api/v1/media?key=${encodeURIComponent(need(target, 'media key'))}`, { ok: [204] });
      out({ deleted: target });
      break;

    default:
      die({ error: 'usage', message: 'Lệnh không hợp lệ.', usage: USAGE });
  }
}

await main().catch((e) => {
  if (!(e instanceof Exit)) throw e;
});
