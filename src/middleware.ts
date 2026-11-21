// Security headers for the tooling Worker. The public HTML pages and admin UI moved to EzyPlatform/edge, so the
// middleware no longer caches pages, negotiates Markdown or tracks page hits; it only stamps headers on responses.
import { defineMiddleware } from 'astro:middleware';

const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=()';
const HSTS_HEADER = 'max-age=31536000; includeSubDomains';

/**
 * X-ray report pages are the only HTML this Worker still renders. They use inline styles and an inline JSON-LD
 * block, hence the relaxed style/script directives; frames are limited to the TikTok player.
 */
const HTML_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; frame-src https://www.tiktok.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

export interface HeaderOptions {
  isHttps: boolean;
}

const mutableHeaders = (response: Response): Headers => new Headers(response.headers);

export function withSecurityHeaders(response: Response, opts: HeaderOptions): Response {
  const headers = mutableHeaders(response);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  if (opts.isHttps) headers.set('Strict-Transport-Security', HSTS_HEADER);
  if (headers.get('Content-Type')?.includes('text/html')) headers.set('Content-Security-Policy', HTML_CSP);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  return withSecurityHeaders(response, { isHttps: new URL(context.request.url).protocol === 'https:' });
});
