import { describe, expect, it, vi } from 'vitest';

const FAKE_BYTES = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

function makeR2Object(bytes: Uint8Array, withBody: boolean, slice?: Uint8Array) {
  const base = {
    size: bytes.byteLength,
    httpEtag: '"etag-test-1"',
    writeHttpMetadata(headers: Headers) {
      headers.set('Content-Type', 'video/mp4');
    },
  };
  if (!withBody) return base;
  const payload = slice ?? bytes;
  return {
    ...base,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(payload);
        controller.close();
      },
    }),
  };
}

vi.mock('cloudflare:workers', () => ({
  env: {
    MEDIA: {
      head: async (key: string) => {
        if (key !== '2026/11/demo-video.mp4') return null;
        return makeR2Object(FAKE_BYTES, false);
      },
      get: async (
        key: string,
        opts?: {
          range?: { offset?: number; length?: number; suffix?: number };
          onlyIf?: Headers;
        },
      ) => {
        if (key !== '2026/11/demo-video.mp4') return null;
        if (opts?.onlyIf?.get('If-None-Match') === '"etag-test-1"') {
          return makeR2Object(FAKE_BYTES, false);
        }
        const r = opts?.range;
        if (r) {
          if (typeof r.suffix === 'number') {
            const start = Math.max(0, FAKE_BYTES.byteLength - r.suffix);
            return makeR2Object(FAKE_BYTES, true, FAKE_BYTES.subarray(start));
          }
          const start = r.offset ?? 0;
          const end = typeof r.length === 'number' ? start + r.length : FAKE_BYTES.byteLength;
          return makeR2Object(FAKE_BYTES, true, FAKE_BYTES.subarray(start, end));
        }
        return makeR2Object(FAKE_BYTES, true);
      },
    },
  },
}));

import { GET, HEAD, parseByteRangeHeader } from '../pages/media/[...key]';

function callRoute(handler: typeof GET, key: string, method = 'GET', headers: Record<string, string> = {}) {
  const request = new Request(`https://tqd.me/media/${key}`, { method, headers });
  return handler({ params: { key }, request } as never);
}

describe('media/[...key].ts RFC 9110 Range handling', () => {
  it('parses open-ended, bounded, suffix, and invalid byte ranges accurately', () => {
    expect(parseByteRangeHeader(null, 100)).toEqual({ kind: 'none' });
    expect(parseByteRangeHeader('bytes=0-', 100)).toEqual({
      kind: 'partial',
      start: 0,
      end: 99,
      r2Range: { offset: 0, length: 100 },
    });
    expect(parseByteRangeHeader('bytes=10-29', 100)).toEqual({
      kind: 'partial',
      start: 10,
      end: 29,
      r2Range: { offset: 10, length: 20 },
    });
    expect(parseByteRangeHeader('bytes=-25', 100)).toEqual({
      kind: 'partial',
      start: 75,
      end: 99,
      r2Range: { suffix: 25 },
    });
    expect(parseByteRangeHeader('bytes=100-', 100)).toEqual({ kind: 'unsatisfiable' });
    expect(parseByteRangeHeader('bytes=50-20', 100)).toEqual({ kind: 'unsatisfiable' });
    expect(parseByteRangeHeader('bytes=-0', 100)).toEqual({ kind: 'unsatisfiable' });
  });

  it('returns 206 Partial Content with Content-Range on Range: bytes=0- (Safari/iOS video requirement)', async () => {
    const res = await callRoute(GET, '2026/11/demo-video.mp4', 'GET', { Range: 'bytes=0-' });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 0-9/10');
    expect(res.headers.get('Content-Length')).toBe('10');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(FAKE_BYTES);
  });

  it('returns 206 Partial Content for bounded and suffix byte ranges', async () => {
    const res = await callRoute(GET, '2026/11/demo-video.mp4', 'GET', { Range: 'bytes=2-5' });
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(res.headers.get('Content-Length')).toBe('4');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([30, 40, 50, 60]));

    const suffixRes = await callRoute(GET, '2026/11/demo-video.mp4', 'GET', { Range: 'bytes=-3' });
    expect(suffixRes.status).toBe(206);
    expect(suffixRes.headers.get('Content-Range')).toBe('bytes 7-9/10');
    expect(new Uint8Array(await suffixRes.arrayBuffer())).toEqual(new Uint8Array([80, 90, 100]));
  });

  it('returns 416 Range Not Satisfiable with bytes */size for out-of-bounds ranges', async () => {
    const res = await callRoute(GET, '2026/11/demo-video.mp4', 'GET', { Range: 'bytes=50-60' });
    expect(res.status).toBe(416);
    expect(res.headers.get('Content-Range')).toBe('bytes */10');

    const headRes = await callRoute(HEAD, '2026/11/demo-video.mp4', 'HEAD', { Range: 'bytes=10-' });
    expect(headRes.status).toBe(416);
    expect(headRes.headers.get('Content-Range')).toBe('bytes */10');
  });

  it('returns 200 without Range, 304 on matching If-None-Match, and 404 for private backups/* keys', async () => {
    const fullRes = await callRoute(GET, '2026/11/demo-video.mp4');
    expect(fullRes.status).toBe(200);
    expect(fullRes.headers.get('Content-Length')).toBe('10');
    expect(fullRes.headers.get('Content-Range')).toBeNull();

    const notModified = await callRoute(GET, '2026/11/demo-video.mp4', 'GET', {
      'If-None-Match': '"etag-test-1"',
    });
    expect(notModified.status).toBe(304);

    const backupRes = await callRoute(GET, 'backups/2026-11-12.json.gz');
    expect(backupRes.status).toBe(404);
  });
});
