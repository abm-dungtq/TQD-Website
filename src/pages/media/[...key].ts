import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

// Only keys storeMedia can generate; backups/ and anything else in the bucket stay private.
const MEDIA_KEY = /^\d{4}\/\d{2}\/[a-z0-9-]+\.(jpg|png|gif|webp|mp4|webm)$/;

export type ParsedByteRange =
  | { kind: 'none' }
  | { kind: 'unsatisfiable' }
  | {
      kind: 'partial';
      start: number;
      end: number;
      r2Range: { offset: number; length: number } | { suffix: number };
    };

/**
 * Parses an HTTP `Range` header per RFC 9110 §14.1.2 against a known object `size`.
 * - `Range: bytes=0-` resolves to `206 Partial Content` (`0-(size-1)/size`), required by Safari/iOS `<video>`.
 * - Invalid or out-of-bounds byte ranges resolve to `416 Range Not Satisfiable`.
 */
export function parseByteRangeHeader(rangeHeader: string | null, size: number): ParsedByteRange {
  if (!rangeHeader) return { kind: 'none' };
  const trimmed = rangeHeader.trim();
  if (!/^bytes=/i.test(trimmed)) return { kind: 'none' };

  const spec = trimmed.slice(6).trim();
  // Multi-range requests are unsupported; treat malformed or empty specs as unsatisfiable.
  if (!spec || spec.includes(',')) return { kind: 'unsatisfiable' };

  const match = /^(\d*)-(\d*)$/.exec(spec);
  if (!match || (match[1] === '' && match[2] === '') || size <= 0) {
    return { kind: 'unsatisfiable' };
  }

  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { kind: 'unsatisfiable' };
    const length = Math.min(size, suffix);
    const start = size - length;
    const end = size - 1;
    return { kind: 'partial', start, end, r2Range: { suffix: length } };
  }

  const start = Number(match[1]);
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) {
    return { kind: 'unsatisfiable' };
  }

  if (match[2] === '') {
    const end = size - 1;
    return { kind: 'partial', start, end, r2Range: { offset: start, length: end - start + 1 } };
  }

  const rawEnd = Number(match[2]);
  if (!Number.isSafeInteger(rawEnd) || rawEnd < start) {
    return { kind: 'unsatisfiable' };
  }

  const end = Math.min(size - 1, rawEnd);
  return { kind: 'partial', start, end, r2Range: { offset: start, length: end - start + 1 } };
}

function buildBaseHeaders(obj: R2Object): Headers {
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('ETag', obj.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
  return headers;
}

const serve: APIRoute = async ({ params, request }) => {
  const key = params.key ?? '';
  if (!MEDIA_KEY.test(key)) return new Response('Not found', { status: 404 });

  const isHead = request.method === 'HEAD';
  const rawRangeHeader = request.headers.get('Range');

  if (isHead || rawRangeHeader !== null) {
    const meta = await env.MEDIA.head(key);
    if (!meta) return new Response('Not found', { status: 404 });

    let parsed = parseByteRangeHeader(rawRangeHeader, meta.size);
    const ifRange = request.headers.get('If-Range')?.trim();
    if (parsed.kind === 'partial' && ifRange && (ifRange.startsWith('"') || ifRange.startsWith('W/')) && ifRange !== meta.httpEtag) {
      parsed = { kind: 'none' };
    }

    if (parsed.kind === 'unsatisfiable') {
      const headers = buildBaseHeaders(meta);
      headers.set('Content-Range', `bytes */${meta.size}`);
      return new Response(null, { status: 416, headers });
    }

    if (isHead) {
      const headers = buildBaseHeaders(meta);
      if (parsed.kind === 'partial') {
        headers.set('Content-Length', String(parsed.end - parsed.start + 1));
        headers.set('Content-Range', `bytes ${parsed.start}-${parsed.end}/${meta.size}`);
        return new Response(null, { status: 206, headers });
      }
      headers.set('Content-Length', String(meta.size));
      return new Response(null, { status: 200, headers });
    }

    const obj = await env.MEDIA.get(
      key,
      parsed.kind === 'partial'
        ? { range: parsed.r2Range, onlyIf: request.headers }
        : { onlyIf: request.headers },
    );
    if (!obj) return new Response('Not found', { status: 404 });

    const headers = buildBaseHeaders(obj);
    if (!('body' in obj)) {
      const conditionalGet = request.headers.has('If-None-Match') || request.headers.has('If-Modified-Since');
      return new Response(null, { status: conditionalGet ? 304 : 412, headers });
    }

    if (parsed.kind === 'partial') {
      headers.set('Content-Length', String(parsed.end - parsed.start + 1));
      headers.set('Content-Range', `bytes ${parsed.start}-${parsed.end}/${obj.size}`);
      return new Response(obj.body, { status: 206, headers });
    }

    headers.set('Content-Length', String(obj.size));
    return new Response(obj.body, { status: 200, headers });
  }

  const obj = await env.MEDIA.get(key, { onlyIf: request.headers });
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = buildBaseHeaders(obj);
  if (!('body' in obj)) {
    const conditionalGet = request.headers.has('If-None-Match') || request.headers.has('If-Modified-Since');
    return new Response(null, { status: conditionalGet ? 304 : 412, headers });
  }

  headers.set('Content-Length', String(obj.size));
  return new Response(obj.body, { status: 200, headers });
};

export const GET = serve;
export const HEAD = serve;
