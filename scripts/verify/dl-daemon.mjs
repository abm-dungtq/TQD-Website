// Automated verification for scripts/ytdlp-daemon.mjs (auth on /health + endpoints, SSRF/allowlist guard, resolve, prepare, stream, and auto-unlink).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { startDlDaemon } from '../ytdlp-daemon.mjs';

const API_KEY = 'test-secret-key-2026';
const TMP_ROOT = '/tmp/tqd-dl';
const fails = [];

const daemon = await startDlDaemon({
  port: 0,
  host: '127.0.0.1',
  apiKey: API_KEY,
  tmpRoot: TMP_ROOT,
  mockEngine: true,
});

try {
  const base = daemon.baseUrl;
  const authHeaders = {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };

  // 1a. Health check without auth MUST be rejected with 401
  const unauthHealthRes = await fetch(`${base}/health`);
  if (unauthHealthRes.status !== 401) {
    fails.push(`/health without auth expected 401, got ${unauthHealthRes.status}`);
  }

  // 1b. Health check with valid Bearer token returns 200 ok:true
  const healthRes = await fetch(`${base}/health`, { headers: authHeaders });
  const healthBody = await healthRes.json().catch(() => ({}));
  if (healthRes.status !== 200 || healthBody.ok !== true) {
    fails.push(`/health with auth expected 200 ok:true, got ${healthRes.status}`);
  }

  // 2. Unauthorized resolve rejected with 401
  const unauthRes = await fetch(`${base}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'] }),
  });
  if (unauthRes.status !== 401) {
    fails.push(`/resolve without auth expected 401, got ${unauthRes.status}`);
  }

  // 3a. SSRF internal IP URL rejected with 400
  const ssrfRes = await fetch(`${base}/resolve`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ urls: ['http://127.0.0.1:8080/video.mp4'] }),
  });
  if (ssrfRes.status !== 400) {
    fails.push(`/resolve SSRF URL expected 400, got ${ssrfRes.status}`);
  }

  // 3b. Unlisted domain rejected on public tier (`allowGeneric: false`) and nip.io rejected even on `allowGeneric: true`
  const unlistedRes = await fetch(`${base}/resolve`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ urls: ['https://evil-unlisted.example.com/video.mp4'], allowGeneric: false }),
  });
  if (unlistedRes.status !== 400) {
    fails.push(`/resolve unlisted domain expected 400, got ${unlistedRes.status}`);
  }

  const nipIoRes = await fetch(`${base}/resolve`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ urls: ['https://127.0.0.1.nip.io/video.mp4'], allowGeneric: true }),
  });
  if (nipIoRes.status !== 400) {
    fails.push(`/resolve nip.io rebinding domain expected 400, got ${nipIoRes.status}`);
  }

  // 4. Valid single video resolve + maxHeight filtering
  const resolveRes = await fetch(`${base}/resolve`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      urls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
      maxHeight: 1080,
    }),
  });
  const resolveData = await resolveRes.json().catch(() => ({}));
  if (resolveRes.status !== 200 || resolveData.mode !== 'single' || !Array.isArray(resolveData.choices)) {
    fails.push(`/resolve valid video failed: ${resolveRes.status}`);
  } else {
    const hasVideo = resolveData.choices.some((c) => c.kind === 'video');
    const hasAudio = resolveData.choices.some((c) => c.kind === 'audio');
    const leaked4k = resolveData.choices.some((c) => String(c.resolutionTag).includes('2160'));
    if (!hasVideo || !hasAudio || leaked4k) {
      fails.push(`/resolve choices invalid: video=${hasVideo} audio=${hasAudio} leaked4k=${leaked4k}`);
    }
  }

  // 5. Playlist / Profile resolve
  const playlistRes = await fetch(`${base}/resolve`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      urls: ['https://www.tiktok.com/@abmdungtq'],
      allowPlaylist: true,
      maxItems: 10,
    }),
  });
  const playlistData = await playlistRes.json().catch(() => ({}));
  if (playlistRes.status !== 200 || playlistData.mode !== 'playlist' || !Array.isArray(playlistData.entries)) {
    fails.push(`/resolve playlist failed: ${playlistRes.status}`);
  }

  // 6. Full prepare -> task poll -> stream -> immediate temp folder deletion
  const prepRes = await fetch(`${base}/prepare`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Bài giảng AI thực chiến 🚀',
      formatId: '720',
      kind: 'video',
      maxHeight: 1080,
      maxFilesizeMB: 200,
      compatibilityMode: true,
    }),
  });
  const prepData = await prepRes.json().catch(() => ({}));
  if (prepRes.status !== 200 || !prepData.taskId) {
    fails.push(`/prepare failed: ${prepRes.status}`);
  } else {
    const taskId = prepData.taskId;
    let taskData = null;
    for (let i = 0; i < 20; i++) {
      const tRes = await fetch(`${base}/task/${taskId}`, { headers: authHeaders });
      taskData = await tRes.json().catch(() => ({}));
      if (taskData.status === 'completed' || taskData.status === 'failed') break;
      await new Promise((r) => setTimeout(r, 25));
    }

    if (!taskData || taskData.status !== 'completed') {
      fails.push(`/task/${taskId} did not complete: ${JSON.stringify(taskData)}`);
    } else {
      const streamRes = await fetch(`${base}/stream/${taskId}`, { headers: authHeaders });
      const disp = streamRes.headers.get('content-disposition') || '';
      const text = await streamRes.text();
      if (streamRes.status !== 200 || !disp.includes('attachment;') || !text.includes(taskId)) {
        fails.push(`/stream/${taskId} invalid response: status=${streamRes.status} disp=${disp}`);
      }

      // Allow brief settle for finish handler
      await new Promise((r) => setTimeout(r, 40));
      const taskDir = path.join(TMP_ROOT, taskId);
      if (existsSync(taskDir)) {
        fails.push(`Temp directory was not deleted after stream: ${taskDir}`);
      }

      // Second stream attempt must return 404
      const secondStream = await fetch(`${base}/stream/${taskId}`, { headers: authHeaders });
      if (secondStream.status !== 404) {
        fails.push(`Second /stream/${taskId} expected 404 after auto-unlink, got ${secondStream.status}`);
      }
    }
  }
} finally {
  await daemon.close();
}

for (const f of fails) console.error('FAIL', f);
console.log(fails.length ? 'BAD dl-daemon' : 'OK dl-daemon');
process.exit(fails.length ? 1 : 0);
