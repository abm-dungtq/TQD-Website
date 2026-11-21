// Reader endpoints generated at the edge from the origin's public API, with Cache API memoization.
import {
  articleMarkdown,
  latestUpdated,
  llmsFullText,
  llmsText,
  privacyMarkdown,
  profileMarkdown,
  sectionMarkdown,
  shopMarkdown,
  SITE,
  taiVideoMarkdown,
  type ReaderData,
  type SectionId,
} from './site';
import { getPost, loadReaderData, OriginError, type LoadReaderDataOptions, type OriginEnv } from './posts';
import { htmlToMarkdown } from './html-to-md';
import {
  buildAgentCard,
  buildCatalog,
  buildJsonFeed,
  buildRobots,
  buildRssXml,
  buildSearchEntries,
  buildSitemap,
  READ_ONLY_CORS_HEADERS,
} from './discovery';

export interface ReaderEnv extends OriginEnv {
  ORIGIN_ADMIN: string;
  /** Worker version; part of the reader cache key because readers embed bundled data (e.g. shop-data.json). */
  CF_VERSION_METADATA?: { id: string };
}

const TTL_STANDARD = 600;
const TTL_SLOW = 900;
const CACHE_CONTROL_STANDARD = `public, max-age=${TTL_STANDARD}, stale-while-revalidate=120`;
const CACHE_CONTROL_SLOW = `public, max-age=${TTL_SLOW}, stale-while-revalidate=180`;

/** Markdown twins whose section was renamed or removed; they keep the old permanent redirects. */
const MARKDOWN_REDIRECTS: Record<string, string> = {
  '/chuyen-mon.md': '/bai-viet.md',
  '/dao-tao.md': '/thu-vien.md',
  '/video.md': '/video-ai.md',
  '/so-lieu.md': '/index.md',
};

const SECTION_DATA: Record<SectionId, LoadReaderDataOptions> = {
  'ho-so': { withProductBodies: true },
  'san-pham': { withProductBodies: true },
  'thu-vien': { withGalleryBodies: true },
  'video-ai': { withVideoBodies: true },
  'bai-viet': {},
  'lien-he': {},
};

interface Produced {
  body: string | null;
  contentType: string;
  status?: number;
  extraHeaders?: Record<string, string>;
  originOk?: boolean;
}

const jsonBody = (value: unknown, pretty = false): string => JSON.stringify(value, null, pretty ? 2 : undefined);

function readCacheKey(url: URL, version: string): Request {
  return new Request(`${url.origin}${url.pathname}?v=${encodeURIComponent(version)}`, { method: 'GET' });
}

/** Serves a reader from the Cache API, rebuilding at most once per TTL. */
async function serveCached(
  url: URL,
  version: string,
  ctx: ExecutionContext,
  ttl: number,
  produce: () => Promise<Produced>,
): Promise<Response> {
  const cache = caches.default;
  const key = readCacheKey(url, version);
  const hit = await cache.match(key);
  if (hit) return hit;

  let produced: Produced;
  try {
    produced = await produce();
  } catch (error) {
    const status = error instanceof OriginError ? error.status : 500;
    return new Response(`Reader unavailable: ${(error as Error).message}`, {
      status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const headers = new Headers(produced.extraHeaders ?? {});
  headers.set('Content-Type', produced.contentType);
  if (produced.originOk === false) {
    // Origin unavailable: keep the fallback usable but refresh quickly so the real content appears once it is back.
    headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    headers.set('X-Origin-Status', 'unavailable');
  } else {
    headers.set('Cache-Control', ttl >= TTL_SLOW ? CACHE_CONTROL_SLOW : CACHE_CONTROL_STANDARD);
  }

  const response = new Response(produced.body, { status: produced.status ?? 200, headers });
  if (produced.originOk !== false && (produced.status === undefined || produced.status === 200)) {
    ctx.waitUntil(cache.put(key, response.clone()));
  }
  return response;
}

const withCors = (extra: Record<string, string> = {}): Record<string, string> => ({
  ...READ_ONLY_CORS_HEADERS,
  ...extra,
});

async function buildData(env: ReaderEnv, origin: string, options: LoadReaderDataOptions): Promise<{ data: ReaderData; originOk: boolean }> {
  return loadReaderData(env, origin, options);
}

/**
 * Handles every generated machine-readable path. Returns `null` when the request is not a reader endpoint so the
 * router can continue with the tools proxy / origin passthrough.
 */
export async function handleReader(
  request: Request,
  env: ReaderEnv,
  ctx: ExecutionContext,
  url: URL,
): Promise<Response | null> {
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  const origin = url.origin;

  if (MARKDOWN_REDIRECTS[path]) {
    return new Response(null, { status: 301, headers: { Location: MARKDOWN_REDIRECTS[path] } });
  }

  if (request.method === 'OPTIONS') {
    if (path === '/rss.xml' || path === '/feed.json' || path === '/catalog.json' || path === '/.well-known/agent.json') {
      return new Response(null, { status: 204, headers: READ_ONLY_CORS_HEADERS });
    }
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') return null;

  const respond = (ttl: number, produce: () => Promise<Produced>): Promise<Response> =>
    serveCached(url, env.CF_VERSION_METADATA?.id ?? 'dev', ctx, ttl, produce);
  const head = async (promise: Promise<Response>): Promise<Response> => {
    const response = await promise;
    if (request.method !== 'HEAD') return response;
    return new Response(null, { status: response.status, headers: response.headers });
  };

  switch (path) {
    case '/robots.txt':
      return head(respond(TTL_SLOW, async () => ({ body: buildRobots(origin), contentType: 'text/plain; charset=utf-8' })));

    case '/sitemap.xml':
      return head(
        respond(TTL_SLOW, async () => {
          const { data, originOk } = await buildData(env, origin, {});
          return { body: buildSitemap(data, origin), contentType: 'application/xml; charset=utf-8', originOk };
        }),
      );

    case '/rss.xml':
      return head(
        respond(TTL_SLOW, async () => {
          const { data, originOk } = await buildData(env, origin, {});
          return {
            body: buildRssXml(data, origin),
            contentType: 'application/rss+xml; charset=utf-8',
            extraHeaders: withCors(),
            originOk,
          };
        }),
      );

    case '/feed.json':
      return head(
        respond(TTL_SLOW, async () => {
          const { data, originOk } = await buildData(env, origin, {});
          return {
            body: jsonBody(buildJsonFeed(data, origin), true),
            contentType: 'application/feed+json; charset=utf-8',
            extraHeaders: withCors(),
            originOk,
          };
        }),
      );

    case '/search.json':
      return head(
        respond(TTL_STANDARD, async () => {
          const { data, originOk } = await buildData(env, origin, {});
          return {
            body: jsonBody(buildSearchEntries(data)),
            contentType: 'application/json; charset=utf-8',
            originOk,
          };
        }),
      );

    case '/catalog.json':
      return head(
        respond(TTL_SLOW, async () => {
          const { data, originOk } = await buildData(env, origin, { withProductBodies: true, withVideoBodies: true });
          return {
            body: jsonBody(buildCatalog(data, origin), true),
            contentType: 'application/json; charset=utf-8',
            extraHeaders: withCors(),
            originOk,
          };
        }),
      );

    case '/.well-known/agent.json':
      return head(
        respond(TTL_SLOW, async () => {
          const { data, originOk } = await buildData(env, origin, {});
          return {
            body: jsonBody(buildAgentCard(data, origin), true),
            contentType: 'application/json; charset=utf-8',
            extraHeaders: withCors({ 'X-Robots-Tag': 'noindex' }),
            originOk,
          };
        }),
      );

    case '/.well-known/llms.txt':
      return head(
        respond(TTL_SLOW, async () => {
          const { data, originOk } = await buildData(env, origin, { withProductBodies: true });
          return {
            body: llmsText(data, origin),
            contentType: 'text/markdown; charset=utf-8',
            extraHeaders: { 'X-Robots-Tag': 'noindex', Link: `<${origin}/llms.txt>; rel="canonical"` },
            originOk,
          };
        }),
      );

    case '/llms.txt':
      return head(
        respond(TTL_SLOW, async () => {
          const { data, originOk } = await buildData(env, origin, { withProductBodies: true });
          return { body: llmsText(data, origin), contentType: 'text/plain; charset=utf-8', extraHeaders: { 'X-Robots-Tag': 'noindex' }, originOk };
        }),
      );

    case '/llms-full.txt':
      return head(
        respond(TTL_SLOW, async () => {
          const { data, originOk } = await buildData(env, origin, { withProductBodies: true, articleBodies: 12 });
          return { body: llmsFullText(data, origin), contentType: 'text/markdown; charset=utf-8', extraHeaders: { 'X-Robots-Tag': 'noindex' }, originOk };
        }),
      );

    case '/index.md':
      return head(
        respond(TTL_STANDARD, async () => {
          const { data, originOk } = await buildData(env, origin, { withProductBodies: true });
          return { body: profileMarkdown(data, origin, latestUpdated(data)), contentType: 'text/markdown; charset=utf-8', extraHeaders: { 'X-Robots-Tag': 'noindex' }, originOk };
        }),
      );

    case '/shop.md':
      return head(
        respond(TTL_SLOW, async () => ({
          body: shopMarkdown(origin),
          contentType: 'text/markdown; charset=utf-8',
          extraHeaders: { 'X-Robots-Tag': 'noindex' },
        })),
      );

    case '/tai-video.md':
      return head(
        respond(TTL_SLOW, async () => ({
          body: taiVideoMarkdown(origin),
          contentType: 'text/markdown; charset=utf-8',
          extraHeaders: { 'X-Robots-Tag': 'noindex' },
        })),
      );

    case '/quyen-rieng-tu.md':
      return head(
        respond(TTL_SLOW, async () => ({
          body: privacyMarkdown(origin),
          contentType: 'text/markdown; charset=utf-8',
          extraHeaders: { 'X-Robots-Tag': 'noindex' },
        })),
      );
  }

  const sectionMatch = /^\/([a-z-]+)\.md$/.exec(path);
  if (sectionMatch && sectionMatch[1] in SECTION_DATA) {
    const id = sectionMatch[1] as SectionId;
    return head(
      respond(TTL_STANDARD, async () => {
        const { data, originOk } = await buildData(env, origin, SECTION_DATA[id]);
        const body = sectionMarkdown(id, data, origin, latestUpdated(data));
        if (!body) {
          return { body: 'Not found', status: 404, contentType: 'text/plain; charset=utf-8', extraHeaders: { 'X-Robots-Tag': 'noindex' } };
        }
        return {
          body,
          contentType: 'text/markdown; charset=utf-8',
          extraHeaders: { 'X-Robots-Tag': 'noindex' },
          originOk,
        };
      }),
    );
  }

  const articleMatch = /^\/bai-viet\/([^/]+)\.md$/.exec(path);
  if (articleMatch) {
    const slug = decodeURIComponent(articleMatch[1]);
    return head(
      respond(TTL_STANDARD, async () => {
        const post = await getPost(env, slug);
        if (!post) {
          return { body: 'Not found', status: 404, contentType: 'text/plain; charset=utf-8', extraHeaders: { 'X-Robots-Tag': 'noindex' } };
        }
        const article = {
          id: post.id,
          slug,
          title: post.title,
          summary: post.summary ?? '',
          bodyMd: htmlToMarkdown(post.content ?? ''),
          tags: (post.terms ?? [])
            .map((term) => (term.name ?? term.title ?? term.slug ?? '').trim())
            .filter((name) => name.length > 0),
          publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
          updatedAt: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
        };
        return {
          body: articleMarkdown(article, { site: SITE, products: [], videos: [], gallery: [], articles: [] }, origin),
          contentType: 'text/markdown; charset=utf-8',
          extraHeaders: { 'X-Robots-Tag': 'noindex' },
        };
      }),
    );
  }

  return null;
}
