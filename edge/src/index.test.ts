import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from './index';

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

type MockFetcher = Fetcher & { fetch: Fetcher['fetch'] & { mock: { calls: [Request][] } } };

const makeEnv = (): Env => ({
  ORIGIN_WEB: 'https://origin.test',
  ORIGIN_ADMIN: 'https://admin.test',
  ORIGIN_KEY: 'test-key',
  TOOLS: { fetch: vi.fn(async () => new Response('{"online":false}', { headers: { 'Content-Type': 'application/json' } })) },
});

const call = (url: string, init: RequestInit = {}, env = makeEnv()) => worker.fetch(new Request(url, init), env, ctx);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('edge router', () => {
  it('answers health without touching the origin', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const response = await call('https://tqd.me/__health');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, origin: 'https://origin.test', tools: 'bound', originKeyConfigured: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('redirects legacy paths with 301 and keeps the query string', async () => {
    const cases = [
      ['/dao-tao?utm=x', '/thu-vien?utm=x'],
      ['/chuyen-mon', '/bai-viet'],
      ['/video', '/video-ai'],
      ['/so-lieu?range=7d', '/?range=7d'],
    ] as const;
    for (const [path, location] of cases) {
      const response = await call(`https://tqd.me${path}`);
      expect(response.status).toBe(301);
      expect(response.headers.get('Location')).toBe(location);
    }
  });

  it('redirects old Open Graph card URLs to their media-library copies', async () => {
    for (const [path, location] of [
      ['/og.png', '/api/v1/media/tqd-og.png'],
      ['/og/ho-so.png', '/api/v1/media/tqd-og-ho-so.png'],
    ]) {
      const response = await call(`https://tqd.me${path}`);
      expect(response.status).toBe(301);
      expect(response.headers.get('Location')).toBe(location);
    }
  });

  it('sends www, the old domain and the former staging host to the same path on tqd.me', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    for (const host of ['www.tqd.me', 'tqd.io.vn', 'stg.tqd.me', 'tqd-edge.ngulongyquan.workers.dev']) {
      const response = await call(`https://${host}/bai-viet/abc.md?ref=zalo`);
      expect(response.status).toBe(301);
      expect(response.headers.get('Location')).toBe('https://tqd.me/bai-viet/abc.md?ref=zalo');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps /bai-viet/<slug> to /bai-viet-detail?slug= and forwards the secret', async () => {
    const originResponse = new Response('<html><body><header class="site-header"></header><title>Bài viết</title></body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html;charset=utf-8' },
    });
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => originResponse);
    vi.stubGlobal('fetch', fetchSpy);

    const response = await call('https://tqd.me/bai-viet/abc?ref=zalo');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [target, init] = fetchSpy.mock.calls[0];
    expect(target.toString()).toBe('https://origin.test/bai-viet-detail?slug=abc&ref=zalo');
    expect(new Headers(init?.headers).get('X-TQD-Origin-Key')).toBe('test-key');
    expect(response.status).toBe(200);
  });

  it('makes canonical, Open Graph and JSON-LD URLs absolute on the public origin', async () => {
    const head =
      '<link rel="canonical" href="/ho-so"><meta property="og:url" content="/ho-so">' +
      '<meta property="og:image" content="/api/v1/media/tqd-og.png"><meta name="twitter:image" content="/api/v1/media/tqd-og.png">' +
      '<script type="application/ld+json">{"url":"/ho-so","sameAs":["/a", "https://x.test/b"],"logo":"//cdn.test/l.png"}</script>';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`<html><head>${head}</head><body><header class="site-header"></header><a href="/x">x</a></body></html>`, {
      headers: { 'Content-Type': 'text/html;charset=utf-8' },
    })));
    const html = await (await call('https://tqd.me/ho-so')).text();
    expect(html).toContain('<link rel="canonical" href="https://tqd.me/ho-so">');
    expect(html).toContain('<meta property="og:url" content="https://tqd.me/ho-so">');
    expect(html).toContain('<meta property="og:image" content="https://tqd.me/api/v1/media/tqd-og.png">');
    expect(html).toContain('<meta name="twitter:image" content="https://tqd.me/api/v1/media/tqd-og.png">');
    expect(html).toContain('{"url":"https://tqd.me/ho-so","sameAs":["https://tqd.me/a", "https://x.test/b"],"logo":"//cdn.test/l.png"}');
    expect(html).toContain('<a href="/x">');
  });

  it('answers 404 when the origin renders its not-found page with HTTP 200', async () => {
    const originResponse = new Response('<main data-tqd-not-found><h1>Không tìm thấy</h1></main>', {
      status: 200,
      headers: { 'Content-Type': 'text/html;charset=utf-8' },
    });
    vi.stubGlobal('fetch', vi.fn(async () => originResponse));

    const response = await call('https://tqd.me/khong-ton-tai');
    expect(response.status).toBe(404);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(await response.text()).toContain('Không tìm thấy');
  });

  it('serves the home page at / and redirects /home', async () => {
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response('<html><body><header class="site-header"></header></body></html>', {
        headers: { 'Content-Type': 'text/html;charset=utf-8' },
      }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const response = await call('https://tqd.me/');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0].toString()).toBe('https://origin.test/home');
    expect(response.status).toBe(200);

    const redirect = await call('https://tqd.me/home');
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get('Location')).toBe('/');
  });

  it('proxies tool routes to the TOOLS service binding', async () => {
    const env = makeEnv();
    const response = await call('https://tqd.me/api/chat/status', {}, env);
    expect(env.TOOLS.fetch).toHaveBeenCalledTimes(1);
    const tools = env.TOOLS as unknown as MockFetcher;
    expect(tools.fetch.mock.calls[0][0].url).toBe('https://tqd.me/api/chat/status');
    expect(await response.json()).toEqual({ online: false });
  });

  it('sends admin traffic to the admin origin and disables caching of admin HTML', async () => {
    const fetchSpy = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('<html>admin</html>', { headers: { 'Content-Type': 'text/html' } }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const response = await call('https://admin.tqd.me/posts?page=2');
    const [target] = fetchSpy.mock.calls[0];
    expect(target.toString()).toBe('https://admin.test/posts?page=2');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 503 JSON when the tools binding is missing', async () => {
    const env = { ...makeEnv(), TOOLS: undefined } as unknown as Env;
    const response = await call('https://tqd.me/api/chat', {}, env);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'tools_unavailable' });
  });
});
