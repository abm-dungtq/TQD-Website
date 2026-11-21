import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { env } = vi.hoisted(() => ({ env: {} }));
vi.mock('cloudflare:workers', () => ({ env, waitUntil: () => {} }));

import * as dl from './dl';
import { sha256Hex } from './auth';
import { computeVideoHash, saveTranscriptCache } from './viral';
import { POST as transcribe } from '../pages/api/viral/transcribe';
import { POST as share } from '../pages/api/viral/share';
import { POST as generate } from '../pages/api/viral/generate';

const visitorId = '11111111-1111-4111-8111-111111111111';
const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
let sqlite;
let session;

function d1(sqlite) {
  const statement = (sql, params = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...params) }),
    run: async () => sqlite.prepare(sql).run(...params),
  });
  return { prepare: (sql) => statement(sql), batch: async (list) => Promise.all(list.map(s => s.run())) };
}

function call(handler, body, admin = false) {
  const request = new Request('https://tqd.me/api/viral/test', {
    method: 'POST', headers: { Origin: 'https://tqd.me', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
    body: JSON.stringify({ visitorId, ...body }),
  });
  return handler({ request, url: new URL(request.url), cookies: { get: () => admin ? { value: session } : undefined } });
}

async function cache(duration = 120, url = videoUrl) {
  const videoHash = await computeVideoHash(url);
  await saveTranscriptCache(env.DB, { videoHash, platform: 'youtube', platformLabel: 'YouTube', canonicalUrl: url,
    title: 'Test video', uploader: 'Creator', duration, thumbnail: '', language: 'vi', sourceKind: 'subtitles',
    transcriptText: 'A transcript with several words.', segments: [] });
  return videoHash;
}

function dailyCount() {
  return sqlite.prepare("SELECT COALESCE(SUM(count), 0) AS count FROM rate_limits WHERE bucket LIKE 'viral:day:%'").get().count;
}

beforeEach(async () => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0001_init.sql', 'utf8'));
  sqlite.exec(readFileSync('migrations/0006_viral_lab.sql', 'utf8'));
  Object.assign(env, { DB: d1(sqlite), DL_API_KEY: 'test-only', DL_BASE_URL: 'https://daemon.invalid',
    VIRAL_DAILY_CAP: '20', OPENCODE_GO_API_KEY: 'test-only' });
  session = 'test-session-token';
  sqlite.prepare('INSERT INTO sessions (id_hash, expires_at) VALUES (?, ?)').run(
    await sha256Hex(session),
    Math.floor(Date.now() / 1000) + 3600,
  );
  vi.spyOn(dl, 'daemonOnline').mockResolvedValue({ online: true });
  vi.spyOn(dl, 'callDaemon').mockImplementation(async () => new Response(JSON.stringify({
    mode: 'subtitles', text: 'A fresh transcript with several words.', duration: 120, webpageUrl: videoUrl,
  }), { status: 200 }));
});
afterEach(() => { vi.restoreAllMocks(); sqlite.close(); });

describe('Viral shared daily quota', () => {
  it('does not charge repeated shares rejected by the visitor limit', async () => {
    const videoHash = await cache();
    for (let i = 0; i < 15; i++) expect((await call(share, { videoHash, xrayMarkdown: 'Analysis' })).status).toBe(200);
    for (let i = 0; i < 25; i++) expect((await call(share, { videoHash, xrayMarkdown: 'Analysis' })).status).toBe(429);
    expect(dailyCount()).toBe(15);
  });

  it('does not charge a share whose transcript does not exist', async () => {
    expect((await call(share, { videoHash: 'a'.repeat(16), xrayMarkdown: 'Analysis' })).status).toBe(404);
    expect(dailyCount()).toBe(0);
  });

  it('does not charge shares rejected by the IP limit even with a fresh visitor ID', async () => {
    const videoHash = await cache();
    sqlite.prepare('INSERT INTO rate_limits VALUES (?, ?, ?)').run(
      `viral:sh:ip:${await dl.dlIpBucket('192.0.2.1')}`, Math.floor(Date.now() / 1000), 30,
    );
    expect((await call(share, { videoHash, xrayMarkdown: 'Analysis' })).status).toBe(429);
    expect(dailyCount()).toBe(0);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM viral_shares').get().n).toBe(0);
  });

  it('does not charge transcriptions rejected by visitor or IP limits', async () => {
    for (const [bucket, count] of [[`viral:tr:v:${visitorId}`, 8], [`viral:tr:ip:${await dl.dlIpBucket('192.0.2.1')}`, 16]]) {
      sqlite.exec('DELETE FROM rate_limits');
      sqlite.prepare('INSERT INTO rate_limits VALUES (?, ?, ?)').run(bucket, Math.floor(Date.now() / 1000), count);
      expect((await call(transcribe, { url: videoUrl })).status).toBe(429);
      expect(dailyCount()).toBe(0);
    }
    expect(dl.callDaemon).not.toHaveBeenCalled();
  });

  it('charges accepted fresh transcriptions once and keeps cache hits free', async () => {
    expect((await call(transcribe, { url: videoUrl })).status).toBe(200);
    expect((await call(transcribe, { url: videoUrl })).status).toBe(200);
    expect(dailyCount()).toBe(1);
    expect(dl.callDaemon).toHaveBeenCalledTimes(1);
  });

  it('still rejects work once the shared daily limit is reached', async () => {
    sqlite.prepare('INSERT INTO rate_limits VALUES (?, ?, ?)').run(`viral:day:${dl.getVnDayKey()}`, Math.floor(Date.now() / 1000), 20);
    const videoHash = await cache();
    expect((await call(share, { videoHash, xrayMarkdown: 'Analysis' })).status).toBe(429);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM viral_shares').get().n).toBe(0);
  });
});

describe('Viral transcript duration authorization', () => {
  it('rejects a long admin-cached transcript for public transcribe, generate and share', async () => {
    const videoHash = await cache(1200);
    const responses = await Promise.all([
      call(transcribe, { url: videoUrl }), call(generate, { videoHash, action: 'xray' }),
      call(share, { videoHash, xrayMarkdown: 'Analysis' }),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('video_too_long');
    }
    expect(dl.callDaemon).not.toHaveBeenCalled();
    expect(dailyCount()).toBe(0);
  });

  it('permits the admin to reuse a long cached transcript without daily quota', async () => {
    const videoHash = await cache(1800);
    expect((await call(transcribe, { url: videoUrl }, true)).status).toBe(200);
    expect((await call(share, { videoHash, xrayMarkdown: 'Analysis' }, true)).status).toBe(200);
    expect(dailyCount()).toBe(0);
  });

  it('allows the public duration boundary and rejects videos beyond the admin boundary', async () => {
    await cache(300);
    expect((await call(transcribe, { url: videoUrl })).status).toBe(200);
    await cache(1801);
    expect((await call(transcribe, { url: videoUrl }, true)).status).toBe(400);
  });

  it('checks the resolved canonical cache as well as the input URL cache', async () => {
    await cache(1200);
    const shortUrl = 'https://vm.tiktok.com/ABC123/';
    expect((await call(transcribe, { url: shortUrl })).status).toBe(400);
    expect(dl.callDaemon).toHaveBeenCalledTimes(1);
    expect(dailyCount()).toBe(0);
  });

  it('releases the reserved daily quota when a short URL resolves to an allowed cached transcript', async () => {
    await cache(120);
    expect((await call(transcribe, { url: 'https://vm.tiktok.com/ABC123/' })).status).toBe(200);
    expect(dailyCount()).toBe(0);
    expect(dl.callDaemon).toHaveBeenCalledTimes(1);
  });

  it('checks fresh daemon results before saving or invoking speech recognition', async () => {
    vi.mocked(dl.callDaemon).mockResolvedValue(new Response(JSON.stringify({ mode: 'subtitles', duration: 301,
      text: 'A fresh transcript with several words.', webpageUrl: videoUrl })));
    expect((await call(transcribe, { url: videoUrl })).status).toBe(400);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM viral_transcripts').get().n).toBe(0);
    expect(dailyCount()).toBe(0);
  });
});
