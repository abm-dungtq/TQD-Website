// Checks public routes, content and headers. Usage: node scripts/verify/site.mjs <base-url>
const base = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const fails = [];
const get = (p) => fetch(base + p, { redirect: 'manual' });

const ok = [
  '/', '/ho-so', '/san-pham', '/dao-tao', '/video-ai', '/bai-viet', '/lien-he',
  '/index.md', '/bai-viet.md', '/llms.txt', '/sitemap.xml', '/robots.txt', '/og.png', '/img/portrait-480.webp',
];
for (const p of ok) {
  const res = await get(p);
  if (res.status !== 200) fails.push(`${p} ${res.status}`);
}

const missing = await get('/khong-co-trang-nay');
if (missing.status !== 404) fails.push(`/khong-co-trang-nay ${missing.status}`);

const redirects = { '/chuyen-mon': '/bai-viet', '/so-lieu': '/' };
for (const [from, to] of Object.entries(redirects)) {
  const moved = await get(from);
  const location = moved.headers.get('location') ?? '';
  if (moved.status !== 301 || new URL(location, base).pathname !== to) fails.push(`${from} ${moved.status} ${location}`);
}

const contains = async (p, needles) => {
  const html = await (await get(p)).text();
  for (const n of needles) if (!html.includes(n)) fails.push(`${p} missing ${n}`);
};
await contains('/', ['Trịnh Quang Dũng', 'dungtq.ceo@gmail.com', 'zalo.me/trinhquangdung', 'tiktok.com/@abmdungtq']);
await contains('/san-pham', ['Viết Pro']);
await contains('/robots.txt', ['Disallow: /admin']);

// Chat: status answers either way (the agent runs on a home server); a cross-site post is refused.
// No real message is sent, so this never uses the daily chat allowance.
const status = await get('/api/chat/status');
const statusBody = await status.json().catch(() => ({}));
if (status.status !== 200 || typeof statusBody.online !== 'boolean') fails.push(`/api/chat/status ${status.status}`);
else console.log(`info chat agent ${statusBody.online ? 'online' : 'offline'}`);
const crossSite = await fetch(base + '/api/chat', {
  method: 'POST',
  headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'hi', visitorId: '00000000-0000-4000-8000-000000000000' }),
});
if (crossSite.status !== 403) fails.push(`/api/chat cross-site ${crossSite.status}`);

const csp = (await get('/')).headers.get('content-security-policy') ?? '';
if (!csp.includes('frame-src https://www.tiktok.com')) fails.push(`csp ${csp}`);

for (const f of fails) console.log('FAIL', f);
console.log(fails.length ? 'BAD site' : 'OK site');
process.exit(fails.length ? 1 : 0);
