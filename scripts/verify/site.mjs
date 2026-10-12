// Checks public routes, content and headers. Usage: node scripts/verify/site.mjs <base-url>
const base = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const fails = [];
const get = (p) => fetch(base + p, { redirect: 'manual' });

const ok = [
  '/', '/ho-so', '/san-pham', '/dao-tao', '/video-ai', '/bai-viet', '/so-lieu', '/lien-he',
  '/index.md', '/bai-viet.md', '/llms.txt', '/sitemap.xml', '/robots.txt', '/og.png', '/img/portrait-480.webp',
];
for (const p of ok) {
  const res = await get(p);
  if (res.status !== 200) fails.push(`${p} ${res.status}`);
}

const missing = await get('/khong-co-trang-nay');
if (missing.status !== 404) fails.push(`/khong-co-trang-nay ${missing.status}`);

const moved = await get('/chuyen-mon');
if (moved.status !== 301 || !(moved.headers.get('location') ?? '').endsWith('/bai-viet')) {
  fails.push(`/chuyen-mon ${moved.status} ${moved.headers.get('location')}`);
}

const contains = async (p, needles) => {
  const html = await (await get(p)).text();
  for (const n of needles) if (!html.includes(n)) fails.push(`${p} missing ${n}`);
};
await contains('/', ['Trịnh Quang Dũng', 'dungtq.ceo@gmail.com', 'zalo.me/trinhquangdung']);
await contains('/so-lieu', ['>71<']);
await contains('/san-pham', ['Viết Pro']);
await contains('/robots.txt', ['Disallow: /admin']);

const csp = (await get('/')).headers.get('content-security-policy') ?? '';
if (!csp.includes('frame-src https://www.tiktok.com')) fails.push(`csp ${csp}`);

for (const f of fails) console.log('FAIL', f);
console.log(fails.length ? 'BAD site' : 'OK site');
process.exit(fails.length ? 1 : 0);
