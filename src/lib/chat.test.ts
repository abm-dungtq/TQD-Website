import { describe, expect, it } from 'vitest';
import { callGoclaw, goclawOnline, goclawUserId, ipBucket, MAX_MESSAGE_CHARS, parseChatBody, sameOrigin } from './chat';

const VISITOR = '3f2b8c1e-9a4d-4e7f-8b6a-1c2d3e4f5a6b';
const body = (data: unknown) => JSON.stringify(data);

describe('parseChatBody', () => {
  it('accepts a message and a v4 UUID, trimming the message', () => {
    expect(parseChatBody(body({ message: '  Agent là gì?  ', visitorId: VISITOR }))).toEqual({ message: 'Agent là gì?', visitorId: VISITOR });
  });

  it.each([
    ['not json', '{'],
    ['missing visitor', body({ message: 'hi' })],
    ['visitor namespace injection', body({ message: 'hi', visitorId: 'system' })],
    ['visitor with prefix', body({ message: 'hi', visitorId: `facebook:${VISITOR}` })],
    ['uppercase uuid', body({ message: 'hi', visitorId: VISITOR.toUpperCase() })],
    ['empty message', body({ message: '   ', visitorId: VISITOR })],
    ['non-string message', body({ message: 42, visitorId: VISITOR })],
    ['too long', body({ message: 'a'.repeat(MAX_MESSAGE_CHARS + 1), visitorId: VISITOR })],
  ])('rejects %s', (_name, text) => {
    expect(parseChatBody(text)).toHaveProperty('error');
  });

  it('accepts exactly the maximum length', () => {
    expect(parseChatBody(body({ message: 'a'.repeat(MAX_MESSAGE_CHARS), visitorId: VISITOR }))).not.toHaveProperty('error');
  });
});

describe('goclawUserId', () => {
  it('always namespaces visitors under web:', () => {
    expect(goclawUserId(VISITOR)).toBe(`web:${VISITOR}`);
  });
});

describe('ipBucket', () => {
  it('is stable, short and does not contain the address', async () => {
    const a = await ipBucket('203.0.113.7');
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await ipBucket('203.0.113.7')).toBe(a);
    expect(await ipBucket('203.0.113.8')).not.toBe(a);
  });
});

describe('sameOrigin', () => {
  const origin = 'https://tqd.io.vn';
  const req = (headers: Record<string, string>) => new Request(`${origin}/api/chat`, { method: 'POST', headers });

  it('accepts same-origin requests', () => {
    expect(sameOrigin(req({ Origin: origin, 'Sec-Fetch-Site': 'same-origin' }), origin)).toBe(true);
    expect(sameOrigin(req({ Origin: origin }), origin)).toBe(true);
  });

  it('rejects other origins and cross-site fetches', () => {
    expect(sameOrigin(req({ Origin: 'https://evil.example' }), origin)).toBe(false);
    expect(sameOrigin(req({ Origin: origin, 'Sec-Fetch-Site': 'cross-site' }), origin)).toBe(false);
    expect(sameOrigin(req({}), origin)).toBe(false);
  });
});

describe('unreachable GoClaw', () => {
  // Port 9 (discard) on loopback refuses connections, standing in for the home server being off.
  const baseUrl = 'http://127.0.0.1:9';

  it('rejects the chat call so the route can answer offline', async () => {
    await expect(callGoclaw({ baseUrl, agent: 'dungtq-web', apiKey: 'test' }, { message: 'hi', visitorId: VISITOR })).rejects.toThrow();
  });

  it('reports offline from the health check', async () => {
    expect(await goclawOnline(baseUrl)).toBe(false);
  });
});
