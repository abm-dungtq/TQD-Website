// tqd-edge: public edge for tqd.me + admin.tqd.me.
// - tqd.me: generated readers (llms.txt, *.md, feeds, sitemap), tool routes proxied to the tooling Worker, legacy
//   redirects, and a transparent passthrough to the EzyPlatform web origin.
// - www.tqd.me, tqd.io.vn and the former staging host stg.tqd.me: 301 to the same path on tqd.me.
// - admin: transparent passthrough to the EzyPlatform admin origin, never cached.
import { handleReader, type ReaderEnv } from './readers';

export interface Env extends ReaderEnv {
  TOOLS: Fetcher;
}

const CANONICAL_REDIRECTS: Record<string, string> = {
  '/dao-tao': '/thu-vien',
  '/chuyen-mon': '/bai-viet',
  '/video': '/video-ai',
  '/so-lieu': '/',
};

/** Old Open Graph card URLs (cached by share crawlers) → their media-library copies. */
function ogCardTarget(path: string): string | null {
  if (path === '/og.png') return '/api/v1/media/tqd-og.png';
  const card = /^\/og\/([a-z0-9-]+\.png)$/.exec(path);
  return card ? `/api/v1/media/tqd-og-${card[1]}` : null;
}

const CANONICAL_ORIGIN = 'https://tqd.me';
const ALIAS_HOSTS: Record<string, true> = { 'www.tqd.me': true, 'tqd.io.vn': true, 'stg.tqd.me': true };
// The Worker's own `*.workers.dev` address would otherwise publish a second copy of every page under its own
// canonical URLs, so it redirects to tqd.me as well.
const ALIAS_SUFFIX = '.workers.dev';

const TOOL_PREFIXES = ['/api/dl/', '/api/viral/', '/api/chat/', '/xray/', '/media/'];
const TOOL_EXACT: Record<string, true> = { '/api/chat': true, '/api/t': true, '/xray': true, '/media': true };
const ORIGIN_KEY_HEADER = 'X-TQD-Origin-Key';

const isAdminHost = (hostname: string): boolean => hostname.startsWith('admin.');

const normalizePath = (pathname: string): string => (pathname.length > 1 ? pathname.replace(/\/+$/, '') || '/' : pathname);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

function rewriteLocation(
  response: Response,
  originBase: string,
  publicUrl: URL,
  mapPath?: (originPathname: string) => string | null,
): Response {
  const location = response.headers.get('location');
  if (!location) return response;
  try {
    const target = new URL(location, originBase);
    if (target.origin !== new URL(originBase).origin) return response;
    const mapped = mapPath?.(target.pathname) ?? target.pathname;
    const headers = new Headers(response.headers);
    headers.set('location', `${publicUrl.origin}${mapped}${target.search}${target.hash}`);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return response;
  }
}

/**
 * The EzyPlatform templates keep page URLs relative so they never hard-code a domain, but share crawlers (Facebook,
 * Zalo, X) and search engines want absolute canonical/Open Graph URLs and JSON-LD ids; the edge knows the public
 * origin and fills it in.
 */
function absolutizeShareUrls(html: string, origin: string): string {
  return html
    .replace(/(<link rel="(?:canonical|alternate)"[^>]*? href=")\/(?!\/)/g, `$1${origin}/`)
    .replace(/(<meta (?:property="og:(?:url|image)"|name="twitter:image") content=")\/(?!\/)/g, `$1${origin}/`)
    .replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (_m, open: string, json: string, close: string) =>
      open + json.replace(/([:[,]\s*)"\/(?!\/)/g, `$1"${origin}/`) + close,
    );
}

/**
 * Transparent origin passthrough; the origin only answers requests that carry the shared secret header.
 * `target` is the exact origin URL to fetch, `publicUrl` is the browser-facing URL used to keep redirects on the
 * public hostname.
 */
async function proxyToOrigin(
  request: Request,
  env: Env,
  originBase: string,
  target: URL,
  publicUrl: URL,
  admin: boolean,
  mapPath?: (originPathname: string) => string | null,
): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set(ORIGIN_KEY_HEADER, env.ORIGIN_KEY ?? '');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body !== null;
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    redirect: 'manual',
    ...(hasBody ? { body: request.body, duplex: 'half' as const } : {}),
  };

  let response: Response;
  try {
    response = await fetch(target, init);
  } catch (error) {
    return new Response(`Origin không phản hồi: ${(error as Error).message}`, {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  const rewritten = rewriteLocation(response, originBase, publicUrl, mapPath);
  // Media responses carry `Vary: User-Agent` from Jetty, which fragments the edge cache per browser; keep the
  // encoding axis only, and let versioned URLs be cached for a year.
  if (publicUrl.pathname.startsWith('/api/v1/media/')) {
    const mediaHeaders = new Headers(rewritten.headers);
    mediaHeaders.delete('vary');
    mediaHeaders.set('Vary', 'Accept-Encoding');
    if (publicUrl.searchParams.has('v')) mediaHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(rewritten.body, { status: rewritten.status, statusText: rewritten.statusText, headers: mediaHeaders });
  }

  const isHtml = rewritten.headers.get('content-type')?.includes('text/html') ?? false;
  if (admin) {
    if (!isHtml) return rewritten;
    const headersOut = new Headers(rewritten.headers);
    headersOut.set('Cache-Control', 'no-store');
    return new Response(rewritten.body, { status: rewritten.status, statusText: rewritten.statusText, headers: headersOut });
  }
  if (!isHtml) return rewritten;

  // EzyPlatform renders its "not found" page with HTTP 200; the page carries a marker so the public URL can answer
  // 404 like the old Astro site did. When the platform's own bare error page answers instead of our design, the
  // edge serves the real 404 page from the origin.
  if (rewritten.status === 200) {
    let body = await rewritten.text();
    const headersOut = new Headers(rewritten.headers);
    headersOut.delete('content-length');
    const explicitNotFound = body.includes('data-tqd-not-found');
    const missingPage =
      publicUrl.pathname !== '/404' && !explicitNotFound && !body.includes('class="site-header"');
    const notFound = explicitNotFound || missingPage;
    if (missingPage) {
      const fallback = await fetch(new URL('/404', originBase), {
        headers: { [ORIGIN_KEY_HEADER]: env.ORIGIN_KEY ?? '' },
        redirect: 'manual',
      }).catch(() => null);
      if (fallback?.ok) {
        body = await fallback.text();
        headersOut.set('Content-Type', fallback.headers.get('content-type') ?? 'text/html;charset=utf-8');
      }
    }
    if (notFound) headersOut.set('X-Robots-Tag', 'noindex');
    return new Response(absolutizeShareUrls(body, publicUrl.origin), {
      status: notFound ? 404 : 200,
      statusText: notFound ? 'Not Found' : rewritten.statusText,
      headers: headersOut,
    });
  }
  return rewritten;
}

async function proxyToTools(request: Request, env: Env): Promise<Response> {
  if (!env.TOOLS) {
    return jsonResponse({ error: 'tools_unavailable', message: 'Service binding TOOLS chưa được cấu hình.' }, 503);
  }
  try {
    return await env.TOOLS.fetch(request);
  } catch (error) {
    return jsonResponse({ error: 'tools_unreachable', message: (error as Error).message }, 502);
  }
}

const originTarget = (env: Env, pathname: string, search: string): URL => new URL(`${pathname}${search}`, env.ORIGIN_WEB);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const matchPath = normalizePath(path);

    if (url.hostname in ALIAS_HOSTS || url.hostname.endsWith(ALIAS_SUFFIX)) {
      return new Response(null, {
        status: 301,
        headers: { Location: `${CANONICAL_ORIGIN}${path}${url.search}`, 'Cache-Control': 'public, max-age=86400' },
      });
    }

    if (matchPath === '/__health') {
      return jsonResponse({
        ok: true,
        origin: env.ORIGIN_WEB,
        admin: env.ORIGIN_ADMIN,
        tools: env.TOOLS ? 'bound' : 'missing',
        originKeyConfigured: Boolean(env.ORIGIN_KEY),
      });
    }

    if (isAdminHost(url.hostname)) {
      return proxyToOrigin(
        request,
        env,
        env.ORIGIN_ADMIN,
        new URL(`${path}${url.search}`, env.ORIGIN_ADMIN),
        url,
        true,
      );
    }

    if (matchPath in TOOL_EXACT || TOOL_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return proxyToTools(request, env);
    }

    const readerResponse = await handleReader(request, env, ctx, url);
    if (readerResponse) return readerResponse;

    const ogTarget = ogCardTarget(matchPath);
    if (ogTarget) {
      return new Response(null, { status: 301, headers: { Location: ogTarget, 'Cache-Control': 'public, max-age=86400' } });
    }

    const redirectTarget = CANONICAL_REDIRECTS[matchPath];
    if (redirectTarget) {
      return new Response(null, {
        status: 301,
        headers: { Location: `${redirectTarget}${url.search}`, 'Cache-Control': 'public, max-age=86400' },
      });
    }

    const articleMatch = /^\/bai-viet\/([^/]+)$/.exec(matchPath);
    if (articleMatch) {
      // EzyArticle pages take one path segment, so the article page reads `?slug=`; the public URL keeps /bai-viet/<slug>.
      const target = new URL(`/bai-viet-detail?slug=${encodeURIComponent(articleMatch[1])}${url.search ? '&' + url.search.slice(1) : ''}`, env.ORIGIN_WEB);
      return proxyToOrigin(request, env, env.ORIGIN_WEB, target, url, false);
    }

    if (matchPath === '/home') {
      return new Response(null, { status: 301, headers: { Location: `/${url.search}`, 'Cache-Control': 'public, max-age=86400' } });
    }

    if (matchPath === '/') {
      // The origin serves the published `home` page at /home; the public site keeps it at the root.
      return proxyToOrigin(request, env, env.ORIGIN_WEB, originTarget(env, '/home', url.search), url, false);
    }

    return proxyToOrigin(request, env, env.ORIGIN_WEB, originTarget(env, path, url.search), url, false);
  },
} satisfies ExportedHandler<Env>;
