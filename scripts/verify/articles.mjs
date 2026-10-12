// End-to-end check of articles and media: admin → public pages, XSS stripped, Range requests, cleanup.
// Usage: TQD_ADMIN_PASSWORD=... node scripts/verify/articles.mjs <base-url>
import zlib from 'node:zlib';

const base = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const password = (process.env.TQD_ADMIN_PASSWORD ?? '').trim();
const email = (process.env.TQD_ADMIN_EMAIL ?? 'dungtq.ceo@gmail.com').trim();
if (!password) {
  console.log('FAIL setup TQD_ADMIN_PASSWORD is empty');
  process.exit(1);
}

const fail = (step, detail) => {
  console.log(`FAIL ${step} ${detail}`);
  process.exit(1);
};

// The astro dev proxy resets its workerd connection when the Worker answers before
// reading the whole request body (rejected uploads); a short pause lets it recover.
const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

let cookie = '';
const request = (path, { method = 'GET', form, body, type, headers = {} } = {}) => {
  const h = { ...headers };
  if (cookie) h.Cookie = cookie;
  if (method !== 'GET') h.Origin = base;
  if (form) h['Content-Type'] = 'application/x-www-form-urlencoded';
  if (type) h['Content-Type'] = type;
  return fetch(base + path, { method, headers: h, body: form ? new URLSearchParams(form) : body, redirect: 'manual' });
};

const png1x1 = () => {
  const chunk = (name, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(name), data])));
    return Buffer.concat([len, Buffer.from(name), data, crc]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
  const idat = zlib.deflateSync(Buffer.from([0, 255, 255, 255, 255]));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// 1. Log in.
let res = await request('/admin/login', { method: 'POST', form: { email, password } });
if (res.status !== 303) fail(1, res.status);
cookie = res.headers.getSetCookie().find((c) => c.startsWith('__Host-tqd_admin='))?.split(';')[0] ?? '';
if (!cookie) fail(1, 'no session cookie');

// 2. Upload a PNG.
res = await request('/admin/api/media?filename=verify.png&alt=verify', { method: 'POST', body: png1x1(), type: 'image/png' });
if (res.status !== 201) fail(2, `${res.status} ${await res.text()}`);
const { key } = await res.json();

// 3. SVG is refused.
res = await request('/admin/api/media?filename=verify.svg&alt=x', {
  method: 'POST',
  body: '<svg xmlns="http://www.w3.org/2000/svg"/>',
  type: 'image/svg+xml',
});
await settle();
if (res.status !== 415) fail(3, res.status);

// 4. The file is served, with Range support.
res = await request(`/media/${key}`);
if (res.status !== 200 || res.headers.get('content-type') !== 'image/png') fail(4, `${res.status} ${res.headers.get('content-type')}`);
await res.arrayBuffer();
res = await request(`/media/${key}`, { headers: { Range: 'bytes=0-3' } });
const part = Buffer.from(await res.arrayBuffer());
if (res.status !== 206 || part.length !== 4) fail(4, `range ${res.status} ${part.length}`);

// 5. Publish an article that tries XSS and embeds the image and a TikTok link.
const slug = `kiem-thu-${Date.now()}`;
const title = `Kiểm thử ${slug}`;
// Dev mode adds data-astro-* attributes, so allow any attributes after href.
const articleLink = new RegExp(`href="/admin/bai-viet/(\\d+)"[^>]*>${title}<`);
res = await request('/admin/bai-viet/moi', {
  method: 'POST',
  form: {
    _action: 'save',
    title,
    slug,
    summary: 'Bài kiểm thử tự động.',
    tags: 'kiem-thu',
    coverKey: key,
    status: 'published',
    bodyMd: [`![x](/media/${key})`, '', '<script>alert(1)</script>', '', 'https://www.tiktok.com/@a/video/7420000000000000001'].join('\n'),
  },
});
if (res.status !== 303) fail(5, `${res.status} ${(await res.text()).slice(0, 300)}`);

try {
  // 6. Public pages show it, safely.
  if (!(await (await request('/bai-viet')).text()).includes(title)) throw [6, '/bai-viet missing title'];
  res = await request(`/bai-viet/${slug}`);
  const html = await res.text();
  if (res.status !== 200) throw [6, res.status];
  if (!html.includes(`/media/${key}`)) throw [6, 'image missing'];
  if (!html.includes('data-tiktok-id="7420000000000000001"')) throw [6, 'tiktok placeholder missing'];
  if (html.includes('<script>alert')) throw [6, 'script not stripped'];
  if (html.includes('<iframe')) throw [6, 'iframe rendered before click'];

  // 7. Sitemap lists it.
  if (!(await (await request('/sitemap.xml')).text()).includes(`/bai-viet/${slug}`)) throw [7, 'sitemap missing article'];
} catch (e) {
  // Leave nothing behind before reporting.
  const id = (await (await request('/admin/bai-viet')).text()).match(articleLink)?.[1];
  if (id) await request(`/admin/bai-viet/${id}`, { method: 'POST', form: { _action: 'delete' } });
  await request(`/admin/api/media?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
  fail(...(Array.isArray(e) ? e : ['6-7', e]));
}

// 8. Delete the article and the media; backups cannot be deleted.
const id = (await (await request('/admin/bai-viet')).text()).match(articleLink)?.[1];
if (!id) fail(8, 'article id not found');
res = await request(`/admin/bai-viet/${id}`, { method: 'POST', form: { _action: 'delete' } });
if (res.status !== 303) fail(8, `delete article ${res.status}`);
if ((await request(`/bai-viet/${slug}`)).status !== 404) fail(8, 'article still public');
res = await request(`/admin/api/media?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
if (res.status !== 204) fail(8, `delete media ${res.status}`);
if ((await request(`/media/${key}`)).status !== 404) fail(8, 'media still served');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
res = await request(`/media/backups/${today}.json`);
if (res.status !== 404) fail(8, `backup served ${res.status}`);
res = await request('/admin/api/media?key=backups/khong-co.json', { method: 'DELETE' });
if (res.status !== 404) fail(8, `backup delete ${res.status}`);

console.log('OK articles');
