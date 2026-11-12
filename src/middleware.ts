// Serves public HTML from the Workers cache keyed by content_version, negotiates Markdown for AI agents, and enforces security headers.
import type { APIContext } from 'astro';
import { defineMiddleware } from 'astro:middleware';
import { env, waitUntil } from 'cloudflare:workers';
import {
  detectBot,
  detectDevice,
  normalizeRefHost,
  normalizeTqdPath,
  normalizeUtm,
} from './lib/analytics/normalize';
import {
  computeVidDay,
  getVnDateString,
  writeAnalyticsEvent,
} from './lib/analytics/server';
import { COOKIE, readSession } from './lib/auth';
import { getVersion } from './lib/content';
import { logSecurityEvent } from './lib/security-log';

const DEV_CSP =
  "frame-src https://www.tiktok.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

const PUBLIC_CSP =
  "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; media-src 'self' blob:; connect-src 'self' https://api.open-meteo.com https://cloudflareinsights.com; font-src 'self'; frame-src https://www.tiktok.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

const ADMIN_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'";

const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=()';
const HSTS_HEADER = 'max-age=31536000; includeSubDomains';
const BROWSER_CACHE = 'public, max-age=0, must-revalidate';
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Lazily initialized per-isolate fallback salt (Cloudflare Workers forbids crypto.randomUUID() in global scope). */
let fallbackAnalyticsSalt: string | undefined;
function getFallbackAnalyticsSalt(): string {
  if (!fallbackAnalyticsSalt) {
    fallbackAnalyticsSalt = crypto.randomUUID();
  }
  return fallbackAnalyticsSalt;
}

const EXECUTABLE_INLINE_SCRIPT_TYPES = new Set([
  '',
  'module',
  'text/javascript',
  'application/javascript',
  'ecmascript',
  'text/ecmascript',
  'application/ecmascript',
  'importmap',
  'speculationrules',
]);

function safeWaitUntil(promise: Promise<unknown>): void {
  try {
    waitUntil(promise);
  } catch {
    void promise.catch(() => {});
  }
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

async function sha256CspToken(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return `'sha256-${toBase64(new Uint8Array(digest))}'`;
}

/**
 * Resolves the `.md` twin endpoint path for public HTML routes that support `Accept: text/markdown`.
 * Returns `null` for API, admin, media, static assets, or `.md` endpoints themselves.
 */
function markdownTwinPath(rawPath: string): string | null {
  const path = rawPath !== '/' && rawPath.endsWith('/') ? rawPath.slice(0, -1) : rawPath;
  if (path === '/') return '/index.md';
  if (
    path === '/404' ||
    path.includes('.') ||
    path.startsWith('/admin') ||
    path.startsWith('/api/') ||
    path === '/api' ||
    path.startsWith('/media/') ||
    path === '/media' ||
    path.startsWith('/_')
  ) {
    return null;
  }
  if (/^\/[a-z0-9-]+$/i.test(path)) return `${path}.md`;
  if (/^\/bai-viet\/[a-z0-9-]+$/i.test(path)) return `${path}.md`;
  if (/^\/xray\/(?:c-)?[a-f0-9]{12,24}$/i.test(path)) return `${path}.md`;
  return null;
}

/** Returns `true` when the `Accept` header explicitly prefers `text/markdown` over `text/html`. */
function prefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;
  const lower = acceptHeader.toLowerCase();
  if (!lower.includes('text/markdown') && !lower.includes('text/x-markdown')) return false;

  let mdQ = 0;
  let mdIdx = Infinity;
  let htmlQ = 0;
  let htmlIdx = Infinity;

  const parts = lower.split(',');
  for (let idx = 0; idx < parts.length; idx++) {
    const sub = parts[idx].trim().split(';').map((s) => s.trim());
    const mime = sub[0];
    let q = 1;
    for (let i = 1; i < sub.length; i++) {
      const m = sub[i].match(/^q=([0-9.]+)$/);
      if (m) {
        const parsed = Number.parseFloat(m[1]);
        if (Number.isFinite(parsed)) q = Math.max(0, Math.min(1, parsed));
      }
    }
    if (mime === 'text/markdown' || mime === 'text/x-markdown') {
      if (q > mdQ) {
        mdQ = q;
        mdIdx = idx;
      }
    } else if (mime === 'text/html' || mime === 'application/xhtml+xml') {
      if (q > htmlQ) {
        htmlQ = q;
        htmlIdx = idx;
      }
    }
  }

  if (mdQ <= 0) return false;
  return mdQ > htmlQ || (mdQ === htmlQ && mdIdx < htmlIdx);
}

function appendVaryAccept(headers: Headers): void {
  const existing = headers.get('Vary');
  if (!existing) {
    headers.set('Vary', 'Accept');
    return;
  }
  const tokens = existing.split(',').map((t) => t.trim().toLowerCase());
  if (!tokens.includes('accept') && !tokens.includes('*')) {
    headers.set('Vary', `${existing}, Accept`);
  }
}

/** Returns a response whose headers can be changed. */
const mutable = (res: Response): Response => {
  try {
    res.headers.set('X-Content-Type-Options', 'nosniff');
    return res;
  } catch {
    return new Response(res.body, res);
  }
};

interface HeaderSecurityOptions {
  isPrivate: boolean;
  isAdmin: boolean;
  isHttps: boolean;
  varyAccept?: boolean;
}

const withSecurityHeaders = (res: Response, opts: HeaderSecurityOptions): Response => {
  const out = mutable(res);
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  out.headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  if (opts.isHttps) {
    out.headers.set('Strict-Transport-Security', HSTS_HEADER);
  }
  if (!out.headers.has('Content-Security-Policy')) {
    const csp = import.meta.env.DEV ? DEV_CSP : opts.isAdmin ? ADMIN_CSP : PUBLIC_CSP;
    out.headers.set('Content-Security-Policy', csp);
  }
  if (opts.varyAccept) {
    appendVaryAccept(out.headers);
  }
  if (opts.isPrivate) {
    out.headers.set('Cache-Control', 'no-store');
    out.headers.set('X-Robots-Tag', 'noindex');
  }
  return out;
};

/**
 * Computes W3C CSP3 `'sha256-...'` hashes for any Astro-bundled inline `<script>` tags on SSR HTML responses
 * in production so `script-src 'self'` remains strict without `'unsafe-inline'`.
 */
async function withHtmlInlineScriptHashes(res: Response, isAdmin: boolean): Promise<Response> {
  if (import.meta.env.DEV) return res;
  const ct = res.headers.get('Content-Type') ?? '';
  if (!ct.toLowerCase().includes('text/html')) return res;

  const html = await res.text();
  const tokens = new Set<string>();
  let needUnsafeHashes = false;

  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html)) !== null) {
    const attrs = match[1] ?? '';
    const body = match[2] ?? '';
    if (!body || /\bsrc\s*=/i.test(attrs)) continue;
    const typeMatch = attrs.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const scriptType = (typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? '').trim().toLowerCase();
    if (!EXECUTABLE_INLINE_SCRIPT_TYPES.has(scriptType)) continue;
    tokens.add(await sha256CspToken(body));
  }

  if (isAdmin) {
    const submitRe = /\bonsubmit\s*=\s*"([^"]+)"/gi;
    while ((match = submitRe.exec(html)) !== null) {
      if (match[1]) {
        needUnsafeHashes = true;
        tokens.add(await sha256CspToken(match[1]));
      }
    }
  }

  const headers = new Headers(res.headers);
  if (tokens.size > 0) {
    const baseCsp = headers.get('Content-Security-Policy') ?? (isAdmin ? ADMIN_CSP : PUBLIC_CSP);
    const extra = [...(needUnsafeHashes ? ["'unsafe-hashes'"] : []), ...tokens].join(' ');
    headers.set(
      'Content-Security-Policy',
      baseCsp.replace("script-src 'self'", `script-src 'self' ${extra}`),
    );
  }

  return new Response(html, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

const recordHtmlHitIfPublicHtml = (context: APIContext, res: Response): void => {
  try {
    if (context.request.method !== 'GET' || res.status !== 200) return;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return;

    const reqUrl = new URL(context.request.url);
    const norm = normalizeTqdPath(reqUrl.pathname);
    if (!norm) return;

    const ua = context.request.headers.get('user-agent') || '';
    const netKey =
      context.request.headers.get('cf-connecting-ip') ||
      (import.meta.env.DEV
        ? context.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        : undefined) ||
      '0.0.0.0';
    const cfCountry =
      ((context.request as unknown as { cf?: { country?: string } }).cf?.country ||
        context.request.headers.get('cf-ipcountry') ||
        'XX')
        .slice(0, 2)
        .toUpperCase();
    const refHeader = context.request.headers.get('referer') || '';
    const utmSource = reqUrl.searchParams.get('utm_source') || '';
    const salt = (env as { ANALYTICS_SALT?: string }).ANALYTICS_SALT || getFallbackAnalyticsSalt();

    const task = (async () => {
      try {
        const vnDate = getVnDateString();
        const vidDay = await computeVidDay(salt, vnDate, netKey, ua, 'tqd.me');
        writeAnalyticsEvent(env.ANALYTICS, {
          site: 'tqd.me',
          event: 'html_hit',
          section: norm.section,
          pathTpl: norm.pathTpl,
          path: norm.path,
          refHost: normalizeRefHost(refHeader, 'tqd.me'),
          utm: normalizeUtm(utmSource),
          country: cfCountry || 'XX',
          device: detectDevice(ua),
          sid: '',
          vidDay,
          p1: '',
          p2: '',
          isBot: detectBot(ua, false),
          pvId: '',
          engagedMs: 0,
          maxScrollPct: 0,
          latencyMs: 0,
          value: 0,
        });
      } catch {
        // ignore background analytics error
      }
    })();

    safeWaitUntil(task);
  } catch {
    // ignore middleware analytics error
  }
};

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);
  const path = url.pathname;
  const isHttps = url.protocol === 'https:';

  // Astro routes on the decoded path and tolerates repeated slashes, so the checks
  // below only hold for canonical paths. Every real route is plain ASCII; refuse the rest.
  let decoded: string;
  try {
    decoded = decodeURI(path);
  } catch {
    return withSecurityHeaders(new Response('Bad request', { status: 400 }), {
      isPrivate: true,
      isAdmin: false,
      isHttps,
    });
  }
  if (decoded !== path || /\/{2,}/.test(path)) {
    return withSecurityHeaders(new Response('Not found', { status: 404 }), {
      isPrivate: true,
      isAdmin: false,
      isHttps,
    });
  }

  const lower = path.toLowerCase();
  const isAdmin = lower.startsWith('/admin');
  const isPrivate = isAdmin || lower.startsWith('/api/');
  const method = context.request.method;

  if (isAdmin) {
    if (WRITE_METHODS.has(method)) {
      const site = context.request.headers.get('Sec-Fetch-Site');
      if (context.request.headers.get('Origin') !== url.origin || (site && site !== 'same-origin')) {
        await logSecurityEvent(
          'admin.csrf_blocked',
          { path, method, origin: context.request.headers.get('Origin') ?? '' },
          context.request,
        );
        return withSecurityHeaders(new Response('Forbidden', { status: 403 }), {
          isPrivate: true,
          isAdmin: true,
          isHttps,
        });
      }
    }
    if (path !== '/admin/login') {
      if (!(await readSession(env.DB, context.cookies.get(COOKIE)?.value))) {
        if (method === 'GET') {
          return withSecurityHeaders(context.redirect('/admin/login', 303), {
            isPrivate: true,
            isAdmin: true,
            isHttps,
          });
        }
        return withSecurityHeaders(new Response('Unauthorized', { status: 401 }), {
          isPrivate: true,
          isAdmin: true,
          isHttps,
        });
      }
      context.locals.admin = true;
    }
  }

  const mdTwin = (method === 'GET' || method === 'HEAD') && !isPrivate ? markdownTwinPath(path) : null;
  const varyAccept = mdTwin !== null;

  // Agent content negotiation (`Accept: text/markdown`) BEFORE the HTML Edge Cache lookup.
  if (mdTwin && prefersMarkdown(context.request.headers.get('Accept'))) {
    const mdRes = await context.rewrite(mdTwin);
    return withSecurityHeaders(mdRes, {
      isPrivate: false,
      isAdmin: false,
      isHttps,
      varyAccept: true,
    });
  }

  // Public HTML pages ignore marketing query params (`?utm_source=...`, `?fbclid=...`) via normalized path cache key.
  const cacheable = method === 'GET' && !isPrivate && !path.startsWith('/media/');

  // The build ID is fixed for a whole dev session, so caching there would hide template edits.
  if (!cacheable || import.meta.env.DEV) {
    let res = withSecurityHeaders(await next(), { isPrivate, isAdmin, isHttps, varyAccept });
    res = await withHtmlInlineScriptHashes(res, isAdmin);
    recordHtmlHitIfPublicHtml(context, res);
    return res;
  }

  const version = await getVersion(env.DB);
  const key = new Request(`${url.origin}${path}?v=${version}&b=${__BUILD_ID__}`);
  const cache = await caches.open('pages');
  const hit = await cache.match(key);
  if (hit) {
    const out = new Response(hit.body, hit);
    out.headers.set('Cache-Control', BROWSER_CACHE);
    out.headers.set('X-Cache', 'HIT');
    out.headers.set('X-Content-Version', String(version));
    if (varyAccept) appendVaryAccept(out.headers);
    if (isHttps) out.headers.set('Strict-Transport-Security', HSTS_HEADER);
    recordHtmlHitIfPublicHtml(context, out);
    return out;
  }

  let res = withSecurityHeaders(await next(), {
    isPrivate: false,
    isAdmin: false,
    isHttps,
    varyAccept,
  });
  res = await withHtmlInlineScriptHashes(res, false);

  if (res.status === 200 && !res.headers.has('Set-Cookie')) {
    const stored = new Response(res.clone().body, res);
    stored.headers.set('Cache-Control', 'public, max-age=86400');
    safeWaitUntil(cache.put(key, stored));
  }
  res.headers.set('Cache-Control', BROWSER_CACHE);
  res.headers.set('X-Cache', 'MISS');
  res.headers.set('X-Content-Version', String(version));
  recordHtmlHitIfPublicHtml(context, res);
  return res;
});
