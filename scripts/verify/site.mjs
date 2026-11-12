// Checks public routes, content, Markdown twin discovery, JSON-LD @id graph integrity, and headers.
// Usage: node scripts/verify/site.mjs <base-url>
const base = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const fails = [];
const get = (p) => fetch(base + p, { redirect: 'manual' });

const ok = [
  '/', '/ho-so', '/san-pham', '/thu-vien', '/video-ai', '/bai-viet', '/lien-he', '/tai-video', '/quyen-rieng-tu',
  '/index.md', '/ho-so.md', '/san-pham.md', '/thu-vien.md', '/video-ai.md', '/bai-viet.md', '/lien-he.md', '/tai-video.md', '/quyen-rieng-tu.md',
  '/llms.txt', '/sitemap.xml', '/robots.txt', '/og.png', '/img/portrait-480.webp',
];
for (const p of ok) {
  const res = await get(p);
  if (res.status !== 200) fails.push(`${p} ${res.status}`);
}

const missing = await get('/khong-co-trang-nay');
const missingHtml = await missing.text();
if (missing.status !== 404) fails.push(`/khong-co-trang-nay ${missing.status}`);
if (missingHtml.includes('type="text/markdown"')) {
  fails.push('/khong-co-trang-nay must not advertise alternate type="text/markdown"');
}

const redirects = { '/chuyen-mon': '/bai-viet', '/so-lieu': '/', '/dao-tao': '/thu-vien', '/dao-tao.md': '/thu-vien.md' };
for (const [from, to] of Object.entries(redirects)) {
  const moved = await get(from);
  const location = moved.headers.get('location') ?? '';
  if (moved.status !== 301 || new URL(location, base).pathname !== to) fails.push(`${from} ${moved.status} ${location}`);
}

const contains = async (p, needles) => {
  const html = await (await get(p)).text();
  for (const n of needles) if (!html.includes(n)) fails.push(`${p} missing ${n}`);
  return html;
};
await contains('/', ['Trịnh Quang Dũng', 'dungtq.ceo@gmail.com', 'zalo.me/trinhquangdung', 'tiktok.com/@abmdungtq', 'href="/tai-video"', 'Tải Video']);
await contains('/san-pham', ['Viết Pro']);
await contains('/robots.txt', ['Disallow: /admin']);

// Verify <link rel="alternate" type="text/markdown"> advertises a reachable 200 Markdown twin.
async function checkMarkdownTwinLink(pagePath) {
  const html = await (await get(pagePath)).text();
  const linkMatch =
    /<link[^>]+rel="alternate"[^>]+type="text\/markdown"[^>]+href="([^"]+)"/i.exec(html) ??
    /<link[^>]+href="([^"]+)"[^>]+type="text\/markdown"/i.exec(html);
  if (!linkMatch) {
    fails.push(`${pagePath} missing <link rel="alternate" type="text/markdown">`);
    return;
  }
  const twinPath = new URL(linkMatch[1], base).pathname;
  const twinRes = await get(twinPath);
  const ct = twinRes.headers.get('content-type') ?? '';
  if (twinRes.status !== 200 || !ct.includes('text/markdown')) {
    fails.push(`${pagePath} markdown twin ${twinPath} status=${twinRes.status} ct=${ct}`);
  }
}

// Verify JSON-LD @graph syntax and internal @id reference integrity (no dangling #person / #website refs).
function collectJsonLdReferences(node, definedIds, refs, isTopGraphNode = false) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLdReferences(item, definedIds, refs, false);
    return;
  }
  const keys = Object.keys(node);
  if (typeof node['@id'] === 'string') {
    if (isTopGraphNode || keys.length > 1) {
      definedIds.add(node['@id']);
    } else {
      refs.add(node['@id']);
    }
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === '@id') continue;
    collectJsonLdReferences(v, definedIds, refs, false);
  }
}

async function checkJsonLdGraph(pagePath) {
  const html = await (await get(pagePath)).text();
  const scripts = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if (scripts.length === 0) {
    fails.push(`${pagePath} missing application/ld+json`);
    return;
  }
  for (const [, rawJson] of scripts) {
    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (e) {
      fails.push(`${pagePath} invalid JSON-LD: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const definedIds = new Set();
    const refs = new Set();
    if (Array.isArray(parsed['@graph'])) {
      for (const gNode of parsed['@graph']) {
        collectJsonLdReferences(gNode, definedIds, refs, true);
      }
    } else {
      collectJsonLdReferences(parsed, definedIds, refs, true);
    }
    for (const ref of refs) {
      if ((ref.includes('#') && (ref.startsWith('#') || ref.includes('tqd.me/'))) && !definedIds.has(ref)) {
        fails.push(`${pagePath} dangling JSON-LD @id reference: ${ref}`);
      }
    }
  }
}

for (const p of ['/', '/san-pham', '/tai-video', '/quyen-rieng-tu']) {
  await checkMarkdownTwinLink(p);
}
for (const p of ['/', '/tai-video']) {
  await checkJsonLdGraph(p);
}

const sitemapXml = await (await get('/sitemap.xml')).text();
const firstArticleMatch = /<loc>https?:\/\/[^<]+(\/bai-viet\/[^<]+)<\/loc>/i.exec(sitemapXml);
if (firstArticleMatch) {
  const articlePath = firstArticleMatch[1];
  await checkMarkdownTwinLink(articlePath);
  await checkJsonLdGraph(articlePath);
}

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

// Video Downloader: status endpoint answers and cross-site resolve is refused with 403.
const dlStatus = await get('/api/dl/status');
const dlStatusBody = await dlStatus.json().catch(() => ({}));
if (dlStatus.status !== 200 || typeof dlStatusBody.online !== 'boolean') fails.push(`/api/dl/status ${dlStatus.status}`);
else console.log(`info dl daemon ${dlStatusBody.online ? 'online' : 'offline'}`);
const dlCrossSite = await fetch(base + '/api/dl/resolve', {
  method: 'POST',
  headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', visitorId: '00000000-0000-4000-8000-000000000000' }),
});
if (dlCrossSite.status !== 403) fails.push(`/api/dl/resolve cross-site ${dlCrossSite.status}`);

const csp = (await get('/')).headers.get('content-security-policy') ?? '';
if (!csp.includes('frame-src https://www.tiktok.com')) fails.push(`csp ${csp}`);

for (const f of fails) console.log('FAIL', f);
console.log(fails.length ? 'BAD site' : 'OK site');
process.exit(fails.length ? 1 : 0);
