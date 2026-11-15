// Checks public routes, content, Markdown twin discovery, JSON-LD @id graph integrity, and headers.
// Usage: node scripts/verify/site.mjs <base-url>
const base = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const fails = [];
const get = (p) => fetch(base + p, { redirect: 'manual' });

const ok = [
  '/', '/ho-so', '/san-pham', '/thu-vien', '/video-ai', '/bai-viet', '/lien-he', '/tai-video', '/quyen-rieng-tu',
  '/index.md', '/ho-so.md', '/san-pham.md', '/thu-vien.md', '/video-ai.md', '/bai-viet.md', '/lien-he.md', '/tai-video.md', '/quyen-rieng-tu.md',
  '/llms.txt', '/llms-full.txt', '/.well-known/llms.txt', '/.well-known/agent.json', '/catalog.json', '/feed.json', '/rss.xml',
  '/sitemap.xml', '/robots.txt', '/og.png', '/img/portrait-480.webp',
];
for (const p of ok) {
  const res = await get(p);
  if (res.status !== 200) fails.push(`${p} ${res.status}`);
}

const missing = await get('/khong-co-trang-nay');
const missingHtml = await missing.text();
const missingLink = missing.headers.get('link') ?? '';
const missingCsp = missing.headers.get('content-security-policy') ?? '';
if (missing.status !== 404) fails.push(`/khong-co-trang-nay ${missing.status}`);
if (missingHtml.includes('type="text/markdown"')) {
  fails.push('/khong-co-trang-nay must not advertise alternate type="text/markdown" in HTML');
}
if (missingLink.includes('type="text/markdown"')) {
  fails.push('/khong-co-trang-nay must not advertise alternate type="text/markdown" in HTTP Link header');
}
const missingCspHashes = [...missingCsp.matchAll(/'sha256-[^']+'/g)].map((m) => m[0]);
if (new Set(missingCspHashes).size !== missingCspHashes.length) {
  fails.push(`/khong-co-trang-nay duplicated CSP sha256 hash: ${missingCsp}`);
}

const redirects = {
  '/chuyen-mon': '/bai-viet',
  '/so-lieu': '/',
  '/dao-tao': '/thu-vien',
  '/dao-tao.md': '/thu-vien.md',
  '/video': '/video-ai',
  '/video.md': '/video-ai.md',
};
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

// Curated homepage & showcase verification: top repos present, legacy discontinued apps absent.
for (const p of ['/', '/ho-so', '/san-pham', '/index.md', '/llms.txt']) {
  const body = await contains(p, ['github.com/abm-dungtq/viet-pro', 'github.com/abm-dungtq/china-sourcing']);
  const lower = body.toLowerCase();
  for (const banned of ['opus video', 'opus-video', 'clean your mac', 'tqd-clean-your-mac', 'viet-pro-codex']) {
    if (lower.includes(banned)) fails.push(`${p} unexpectedly contains deprecated token "${banned}"`);
  }
}

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
      if ((ref.includes('#') && (ref.startsWith('#') || ref.startsWith(base) || ref.includes('tqd.me/'))) && !definedIds.has(ref)) {
        fails.push(`${pagePath} dangling JSON-LD @id reference: ${ref}`);
      }
    }
  }
}

for (const p of ['/', '/san-pham', '/tai-video', '/quyen-rieng-tu']) {
  await checkMarkdownTwinLink(p);
}
for (const p of ['/', '/ho-so', '/san-pham', '/thu-vien', '/video-ai', '/bai-viet', '/lien-he', '/tai-video', '/quyen-rieng-tu']) {
  await checkJsonLdGraph(p);
}

const sitemapXml = await (await get('/sitemap.xml')).text();
const firstArticleMatch = /<loc>https?:\/\/[^<]+(\/bai-viet\/[^<]+)<\/loc>/i.exec(sitemapXml);
if (firstArticleMatch) {
  const articlePath = firstArticleMatch[1];
  await checkMarkdownTwinLink(articlePath);
  await checkJsonLdGraph(articlePath);

  const [llmsTxtRes, llmsFullRes] = await Promise.all([get('/llms.txt'), get('/llms-full.txt')]);
  const [llmsTxtBody, llmsFullBody] = await Promise.all([llmsTxtRes.text(), llmsFullRes.text()]);
  if (llmsTxtRes.status !== 200 || llmsFullRes.status !== 200 || llmsFullBody.length <= llmsTxtBody.length) {
    fails.push(`/llms-full.txt (${llmsFullBody.length}) should be longer than /llms.txt (${llmsTxtBody.length})`);
  }
}

// Verify discovery schemas: agent.json, catalog.json, feed.json, rss.xml
const [agentRes, catalogRes, feedJsonRes, rssRes] = await Promise.all([
  get('/.well-known/agent.json'),
  get('/catalog.json'),
  get('/feed.json'),
  get('/rss.xml'),
]);

const agentText = await agentRes.text();
try {
  const agentBody = JSON.parse(agentText);
  const robotsTag = (agentRes.headers.get('x-robots-tag') ?? '').toLowerCase();
  if (
    agentRes.status !== 200
    || !robotsTag.includes('noindex')
    || agentRes.headers.get('access-control-allow-origin') !== '*'
    || agentBody?.capabilities?.webmcp_browser_tools?.webOnlyExecution !== true
    || !agentBody?.capabilities?.sameOriginPublicApis
    || !agentBody?.policies
    || /127\.0\.0\.1|CHAT_UPSTREAM_URL|DL_DAEMON_URL/.test(agentText)
  ) {
    fails.push(`/.well-known/agent.json schema or security headers invalid`);
  }
} catch {
  fails.push(`/.well-known/agent.json invalid JSON`);
}

try {
  const catalogBody = await catalogRes.json();
  if (
    catalogRes.status !== 200
    || catalogRes.headers.get('access-control-allow-origin') !== '*'
    || catalogBody?.schemaVersion !== '1.0'
    || !Array.isArray(catalogBody?.items)
    || catalogBody.items.length === 0
    || !catalogBody?.owner
    || !catalogBody?.endpoints
  ) {
    fails.push(`/catalog.json schema invalid`);
  }
} catch {
  fails.push(`/catalog.json invalid JSON`);
}

try {
  const feedBody = await feedJsonRes.json();
  const feedCt = (feedJsonRes.headers.get('content-type') ?? '').toLowerCase();
  if (
    feedJsonRes.status !== 200
    || !feedCt.includes('application/feed+json')
    || feedJsonRes.headers.get('access-control-allow-origin') !== '*'
    || feedBody?.version !== 'https://jsonfeed.org/version/1.1'
    || !Array.isArray(feedBody?.items)
  ) {
    fails.push(`/feed.json schema invalid`);
  }
} catch {
  fails.push(`/feed.json invalid JSON`);
}

const rssText = await rssRes.text();
const rssCt = (rssRes.headers.get('content-type') ?? '').toLowerCase();
if (
  rssRes.status !== 200
  || !rssCt.includes('application/rss+xml')
  || rssRes.headers.get('access-control-allow-origin') !== '*'
  || !rssText.includes('<rss version="2.0"')
  || !rssText.includes('xmlns:atom="http://www.w3.org/2005/Atom"')
  || !rssText.includes('<language>vi</language>')
  || !rssText.includes('<channel>')
) {
  fails.push(`/rss.xml schema invalid`);
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

const homeRes = await get('/');
const homeLink = homeRes.headers.get('link') ?? '';
for (const expected of ['rel="llms-txt"', 'type="text/markdown"', 'application/rss+xml', 'application/feed+json']) {
  if (!homeLink.includes(expected)) fails.push(`/ Link header missing ${expected}: ${homeLink}`);
}
const csp = homeRes.headers.get('content-security-policy') ?? '';
if (!csp.includes('frame-src https://www.tiktok.com')) fails.push(`csp ${csp}`);

for (const f of fails) console.log('FAIL', f);
console.log(fails.length ? 'BAD site' : 'OK site');
process.exit(fails.length ? 1 : 0);
