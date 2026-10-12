// Serves public HTML from the Workers cache keyed by content_version and adds security headers.
import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { getVersion } from './lib/content';

const PUBLIC_CSP =
  "frame-src https://www.tiktok.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";
const BROWSER_CACHE = 'public, max-age=0, must-revalidate';

/** Returns a response whose headers can be changed. */
const mutable = (res: Response): Response => {
  try {
    res.headers.set('X-Content-Type-Options', 'nosniff');
    return res;
  } catch {
    return new Response(res.body, res);
  }
};

const withSecurityHeaders = (res: Response, isPrivate: boolean): Response => {
  const out = mutable(res);
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (!out.headers.has('Content-Security-Policy')) out.headers.set('Content-Security-Policy', PUBLIC_CSP);
  if (isPrivate) {
    out.headers.set('Cache-Control', 'no-store');
    out.headers.set('X-Robots-Tag', 'noindex');
  }
  return out;
};

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const isPrivate = path.startsWith('/admin') || path.startsWith('/api/');
  const cacheable =
    context.request.method === 'GET' && !isPrivate && !path.startsWith('/media/') && url.search === '';

  if (!cacheable) return withSecurityHeaders(await next(), isPrivate);

  const version = await getVersion(env.DB);
  const key = new Request(`${url.origin}${path}?v=${version}`);
  const cache = await caches.open('pages');
  const hit = await cache.match(key);
  if (hit) {
    const out = new Response(hit.body, hit);
    out.headers.set('Cache-Control', BROWSER_CACHE);
    out.headers.set('X-Cache', 'HIT');
    out.headers.set('X-Content-Version', String(version));
    return out;
  }

  const res = withSecurityHeaders(await next(), false);
  if (res.status === 200 && !res.headers.has('Set-Cookie')) {
    const stored = new Response(res.clone().body, res);
    stored.headers.set('Cache-Control', 'public, max-age=86400');
    context.locals.cfContext.waitUntil(cache.put(key, stored));
  }
  res.headers.set('Cache-Control', BROWSER_CACHE);
  res.headers.set('X-Cache', 'MISS');
  res.headers.set('X-Content-Version', String(version));
  return res;
});
