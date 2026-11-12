import { describe, expect, it } from 'vitest';
import {
  detectPlatform,
  extractUrlsFromInput,
  isAllowedMediaHost,
  isPlaylistOrProfileUrl,
  isPrivateOrReservedIp,
  isShortsOrReelsUrl,
  normalizeMediaUrl,
  validateSafeMediaUrl,
} from './dl-platforms';
import {
  cleanupDlLimits,
  getDlTicketSecret,
  parsePrepareBody,
  parseResolveBody,
  resolveDlTier,
  signDlTicket,
  TIER_LIMITS,
  verifyDlTicket,
} from './dl';
import { logSecurityEvent } from './security-log';

const SAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';
const SECRET = 'test-dl-hmac-secret-2026';

describe('dl-platforms: platform & media kind detection', () => {
  it('detects YouTube standard videos, Shorts, playlists, and channels', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({
      key: 'youtube',
      label: 'YouTube',
      mediaKind: 'video',
    });
    expect(detectPlatform('https://www.youtube.com/shorts/abc123xyz')).toMatchObject({
      key: 'youtube',
      label: 'YouTube Shorts',
      mediaKind: 'shorts',
    });
    expect(detectPlatform('https://www.youtube.com/playlist?list=PL12345')).toMatchObject({
      key: 'youtube',
      mediaKind: 'playlist',
    });
    expect(isPlaylistOrProfileUrl('https://www.youtube.com/@dungtq/videos')).toBe(true);
    expect(isPlaylistOrProfileUrl('https://www.youtube.com/@dungtq/shorts')).toBe(true);
  });

  it('detects TikTok single videos vs TikTok @profile URLs', () => {
    const videoUrl = 'https://www.tiktok.com/@dungtq/video/7123456789';
    expect(isShortsOrReelsUrl(videoUrl)).toBe(true);
    expect(isPlaylistOrProfileUrl(videoUrl)).toBe(false);

    const profileUrl = 'https://www.tiktok.com/@dungtq';
    expect(isPlaylistOrProfileUrl(profileUrl)).toBe(true);
    expect(detectPlatform(profileUrl).mediaKind).toBe('playlist');
  });

  it('strips tracking parameters and extracts only allowlisted platform URLs by default', () => {
    const dirty = 'https://www.facebook.com/reel/123456?fbclid=IwAR123&utm_source=share';
    expect(normalizeMediaUrl(dirty)).toBe('https://www.facebook.com/reel/123456');

    const text = `
      Video 1: https://youtu.be/dQw4w9WgXcQ?si=track123,
      Video 2: https://www.tiktok.com/@user/video/987654.
      Unlisted generic host: https://evil.example.com/payload.m3u8
      Local blocked: http://127.0.0.1:4000/secret
    `;
    expect(extractUrlsFromInput(text)).toEqual([
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.tiktok.com/@user/video/987654',
    ]);
    expect(extractUrlsFromInput(text, { allowGeneric: true })).toEqual([
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.tiktok.com/@user/video/987654',
      'https://evil.example.com/payload.m3u8',
    ]);
  });
});

describe('dl-platforms: SSRF, IPv6 transitional ranges, rebinding & domain allowlist guard', () => {
  it('blocks localhost, private IPv4/IPv6, CGNAT, NAT64, 6to4, Teredo, IPv4-compatible, nip.io, and non-http protocols', () => {
    const blocked = [
      'http://localhost:3000/video.mp4',
      'http://127.0.0.1:4000/api',
      'http://10.0.0.1/internal',
      'http://100.64.0.10/tailscale',
      'http://172.16.5.4/stream',
      'http://192.168.1.1/admin',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]:8080/test',
      'http://[::7f00:1]:4099/health',
      'http://[::ffff:127.0.0.1]:4099/health',
      'http://[64:ff9b::7f00:1]/internal',
      'http://[2002:7f00:1::]/internal',
      'http://[2001:0000:4136:e378:8000:63bf:3fff:fdd2]/teredo',
      'http://[fe80::1]/test',
      'https://127.0.0.1.nip.io/video.mp4',
      'https://10-0-0-1.sslip.io/video.mp4',
      'https://app.localtest.me/video.mp4',
      'http://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ',
      'file:///etc/passwd',
      'ftp://example.com/file.mp4',
      'http://intranet/video',
      'http://my-nas.local/video.mp4',
    ];
    for (const url of blocked) {
      expect(validateSafeMediaUrl(url, { allowGeneric: true }).ok, `expected ${url} to be blocked`).toBe(false);
    }
  });

  it('validates DNS-resolved IPs via isPrivateOrReservedIp', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('100.100.100.100')).toBe(true);
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:192.168.1.5')).toBe(true);
    expect(isPrivateOrReservedIp('64:ff9b::a00:1')).toBe(true);
    expect(isPrivateOrReservedIp('142.250.190.46')).toBe(false);
    expect(isPrivateOrReservedIp('2607:f8b0:4005:80a::200e')).toBe(false);
  });

  it('enforces strict PLATFORMS domain allowlist on public tier while allowing generic public domains for admin', () => {
    expect(isAllowedMediaHost('www.youtube.com')).toBe(true);
    expect(isAllowedMediaHost('vt.tiktok.com')).toBe(true);
    expect(isAllowedMediaHost('unlisted-cdn.example.org')).toBe(false);

    expect(validateSafeMediaUrl('https://unlisted-cdn.example.org/clip.mp4').ok).toBe(false);
    expect(validateSafeMediaUrl('https://unlisted-cdn.example.org/clip.mp4', { allowGeneric: true })).toEqual({
      ok: true,
      url: 'https://unlisted-cdn.example.org/clip.mp4',
    });

    const res = validateSafeMediaUrl('https://www.instagram.com/reel/C12345/?igsh=abc');
    expect(res).toEqual({
      ok: true,
      url: 'https://www.instagram.com/reel/C12345/',
    });
  });
});

describe('dl: HKDF-derived HMAC ticket signing, tier isolation & audit log redaction', () => {
  it('signs and verifies a valid itemTicket with HKDF domain separation (rejecting raw HMAC)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      kind: 'item' as const,
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      tier: 'public' as const,
      maxHeight: 1080,
      maxFilesizeMB: 200,
      exp: now + 600,
    };
    const ticket = await signDlTicket(payload, SECRET);

    const verified = await verifyDlTicket(ticket, SECRET);
    expect(verified).toMatchObject({
      kind: 'item',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      tier: 'public',
      maxHeight: 1080,
    });

    // Forge a raw HMAC-SHA256 ticket without HKDF derivation — must be rejected
    const payloadB64 = ticket.split('.')[0];
    const rawKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const rawSig = await crypto.subtle.sign('HMAC', rawKey, new TextEncoder().encode(payloadB64));
    const rawSigB64 = btoa(String.fromCharCode(...new Uint8Array(rawSig)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(await verifyDlTicket(`${payloadB64}.${rawSigB64}`, SECRET)).toBeNull();
  });

  it('prefers DL_HMAC_SECRET over DL_API_KEY in getDlTicketSecret', () => {
    expect(getDlTicketSecret({ DL_HMAC_SECRET: 'sep-secret', DL_API_KEY: 'daemon-key' })).toBe('sep-secret');
    expect(getDlTicketSecret({ DL_API_KEY: 'daemon-key' })).toBe('daemon-key');
    expect(getDlTicketSecret({})).toBeUndefined();
  });

  it('rejects tampered tickets, wrong secrets, and expired tickets', async () => {
    const now = Math.floor(Date.now() / 1000);
    const validTicket = await signDlTicket(
      { kind: 'stream', taskId: 'task-123', exp: now + 300 },
      SECRET,
    );

    const tampered = validTicket.slice(0, -2) + (validTicket.endsWith('aa') ? 'bb' : 'aa');
    expect(await verifyDlTicket(tampered, SECRET)).toBeNull();
    expect(await verifyDlTicket(validTicket, 'wrong-secret')).toBeNull();

    const expiredTicket = await signDlTicket(
      { kind: 'stream', taskId: 'task-123', exp: now - 10 },
      SECRET,
    );
    expect(await verifyDlTicket(expiredTicket, SECRET)).toBeNull();
  });

  it('does NOT elevate editorial Agent API keys to admin tier in resolveDlTier', async () => {
    const mockDb = {
      prepare() {
        return {
          bind() {
            return {
              async first() {
                return null;
              },
            };
          },
        };
      },
    } as unknown as D1Database;

    const tier = await resolveDlTier(mockDb, undefined, 'Bearer tqd_fake_editorial_agent_key_1234567890');
    expect(tier).toBe('public');
  });

  it('redacts secret-like fields in logSecurityEvent', async () => {
    const logs: string[] = [];
    const origInfo = console.info;
    console.info = (msg: string) => logs.push(msg);
    try {
      await logSecurityEvent('apikey.created', {
        keyName: 'bot-1',
        prefix: 'tqd_abcd1234',
        password: 'super-secret-password',
        rawToken: 'tqd_1234567890abcdefghij1234567890',
      });
    } finally {
      console.info = origInfo;
    }
    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('"event":"apikey.created"');
    expect(logs[0]).toContain('"prefix":"tqd_abcd1234"');
    expect(logs[0]).not.toContain('super-secret-password');
    expect(logs[0]).not.toContain('tqd_1234567890abcdefghij1234567890');
  });
});

describe('dl: request body parsing & tier limits', () => {
  it('requires a valid UUID visitorId for public tier and enforces maxBatchItems', () => {
    const missingVisitor = parseResolveBody(JSON.stringify({ url: 'https://youtu.be/dQw4w9WgXcQ' }), 'public');
    expect('error' in missingVisitor).toBe(true);

    const unlistedPublic = parseResolveBody(
      JSON.stringify({ url: 'https://example.org/video.mp4', visitorId: SAMPLE_UUID }),
      'public',
    );
    expect('error' in unlistedPublic).toBe(true);

    const unlistedAdmin = parseResolveBody(JSON.stringify({ url: 'https://example.org/video.mp4' }), 'admin');
    expect('urls' in unlistedAdmin && unlistedAdmin.urls).toEqual(['https://example.org/video.mp4']);

    const manyUrls = Array.from({ length: 40 }, (_, i) => `https://youtu.be/video_${i}`);
    const publicParsed = parseResolveBody(
      JSON.stringify({ urls: manyUrls, visitorId: SAMPLE_UUID }),
      'public',
    );
    expect('urls' in publicParsed && publicParsed.urls.length).toBe(TIER_LIMITS.public.maxBatchItems);

    const adminParsed = parseResolveBody(JSON.stringify({ urls: manyUrls }), 'admin');
    expect('urls' in adminParsed && adminParsed.urls.length).toBe(40);
  });

  it('parses prepare body and defaults compatibilityMode to true', () => {
    const res = parsePrepareBody(
      JSON.stringify({
        itemTicket: 'sample.ticket',
        title: 'Demo Video',
        formatId: '720p',
        kind: 'video',
        visitorId: SAMPLE_UUID,
      }),
      'public',
    );
    expect(res).toEqual({
      itemTicket: 'sample.ticket',
      title: 'Demo Video',
      formatId: '720p',
      kind: 'video',
      compatibilityMode: true,
      visitorId: SAMPLE_UUID,
    });
  });

  it('cleans up expired dl:% rate_limits rows in D1', async () => {
    let boundCutoff = 0;
    let executedSql = '';
    const mockDb = {
      prepare(sql: string) {
        executedSql = sql;
        return {
          bind(cutoff: number) {
            boundCutoff = cutoff;
            return {
              async run() {
                return { success: true };
              },
            };
          },
        };
      },
    } as unknown as D1Database;

    await cleanupDlLimits(mockDb);
    expect(executedSql).toContain("DELETE FROM rate_limits WHERE bucket LIKE 'dl:%'");
    expect(boundCutoff).toBeGreaterThan(1_700_000_000);
  });
});
