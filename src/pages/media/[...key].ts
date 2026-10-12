import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

// Only keys storeMedia can generate; backups/ and anything else in the bucket stay private.
const MEDIA_KEY = /^\d{4}\/\d{2}\/[a-z0-9-]+\.(jpg|png|gif|webp|mp4|webm)$/;

/**
 * Byte range to send. R2 reports `range` even when none was asked for (and every key of it
 * is present, unset ones as undefined), so the request header decides whether this is partial.
 */
function byteRange(request: Request, obj: R2Object): { start: number; end: number; partial: boolean } {
  let start = 0;
  let end = obj.size - 1;
  const r = obj.range as { offset?: number; length?: number; suffix?: number } | undefined;
  const wantsRange = request.headers.has('Range');
  if (wantsRange && r) {
    if (typeof r.suffix === 'number') {
      start = Math.max(0, obj.size - r.suffix);
    } else {
      start = typeof r.offset === 'number' ? r.offset : 0;
      if (typeof r.length === 'number') end = Math.min(obj.size - 1, start + r.length - 1);
    }
  }
  return { start, end, partial: wantsRange && (start > 0 || end < obj.size - 1) };
}

const serve: APIRoute = async ({ params, request }) => {
  const key = params.key ?? '';
  if (!MEDIA_KEY.test(key)) return new Response('Not found', { status: 404 });

  const isHead = request.method === 'HEAD';
  const obj = isHead
    ? await env.MEDIA.head(key)
    : await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers });
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('ETag', obj.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox");

  // A precondition failed, so R2 returned metadata only.
  if (!isHead && !('body' in obj)) {
    const conditionalGet = request.headers.has('If-None-Match') || request.headers.has('If-Modified-Since');
    return new Response(null, { status: conditionalGet ? 304 : 412, headers });
  }

  const { start, end, partial } = byteRange(request, obj);
  headers.set('Content-Length', String(end - start + 1));
  if (partial) headers.set('Content-Range', `bytes ${start}-${end}/${obj.size}`);
  const body = isHead ? null : (obj as R2ObjectBody).body;
  return new Response(body, { status: partial ? 206 : 200, headers });
};

export const GET = serve;
export const HEAD = serve;
