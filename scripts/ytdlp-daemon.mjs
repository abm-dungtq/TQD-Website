// Home Daemon for tqd.me /tai-video — wraps yt-dlp & ffmpeg safely with a bounded 2-slot queue,
// DNS pre-resolution SSRF protection, H.264 + AAC faststart MP4 normalization, and auto-unlink temp storage.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import { createReadStream, existsSync, readFileSync, rmSync } from 'node:fs';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectPlatform,
  isPlaylistOrProfileUrl,
  isPrivateOrReservedIp,
  isShortsOrReelsUrl,
  validateSafeMediaUrl,
} from '../src/lib/dl-platforms.ts';

const DEFAULT_TMP_ROOT = '/tmp/tqd-dl';
const MAX_CONCURRENT = 2;
const MAX_QUEUE = 20;
const TASK_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_TMP_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB
const MAX_STDOUT_BYTES = 12 * 1024 * 1024; // 12 MB cap on metadata stdout
const MAX_STDERR_BYTES = 64 * 1024; // 64 KB tail cap on stderr
const MAX_VIDEO_CHOICES = 8;
const PROGRESS_PREFIX = 'DLMEDIA|';
const PROGRESS_TEMPLATE = `${PROGRESS_PREFIX}%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s`;

function badRequest(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

/**
 * Validates URL syntax/allowlist AND resolves DNS `A`/`AAAA` records (when `!mockEngine`)
 * to block DNS rebinding (`nip.io`, custom domains pointing to `127.0.0.1` / `100.x` / `::1`).
 */
async function assertPublicResolvedUrl(rawUrl, { mockEngine = false, allowGeneric = false } = {}) {
  const check = validateSafeMediaUrl(String(rawUrl || ''), { allowGeneric });
  if (!check.ok) {
    throw badRequest(check.error);
  }
  if (!mockEngine) {
    const hostname = new URL(check.url).hostname.replace(/^\[|\]$/g, '');
    let records;
    try {
      records = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw badRequest('Không thể phân giải tên miền hợp lệ cho đường dẫn này.');
    }
    if (!Array.isArray(records) || records.length === 0) {
      throw badRequest('Tên miền không có bản ghi IP công khai hợp lệ.');
    }
    for (const rec of records) {
      if (!rec?.address || isPrivateOrReservedIp(rec.address)) {
        throw badRequest('Từ chối kết nối tới địa chỉ mạng nội bộ hoặc dải IP đặc biệt.');
      }
    }
  }
  return check.url;
}

function appendTail(current, chunkStr, maxChars = MAX_STDERR_BYTES) {
  const next = current + chunkStr;
  return next.length > maxChars ? next.slice(-maxChars) : next;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val >= 100 || idx === 0 ? Math.round(val) : val.toFixed(1)} ${units[idx]}`;
}

function resolveBinary(envVar, candidates, fallback) {
  if (process.env[envVar] && existsSync(process.env[envVar])) {
    return process.env[envVar];
  }
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return fallback;
}

export function detectIsVerticalVideo(info, url = '') {
  if (info?.height && info?.width && info.height > info.width) return true;
  const formats = Array.isArray(info?.formats) ? info.formats : [];
  const vFormats = formats.filter((f) => f.vcodec && f.vcodec !== 'none' && f.height && f.width);
  if (vFormats.length > 0) {
    const sample = vFormats[vFormats.length - 1];
    if (sample.height && sample.width && sample.height > sample.width) return true;
  }
  return isShortsOrReelsUrl(url);
}

function getQualityBadge(shortEdge, isVertical) {
  const orient = isVertical ? ' (Shorts 9:16)' : '';
  if (shortEdge >= 2160) return `2160p 4K Ultra HD${orient}`;
  if (shortEdge >= 1440) return `1440p 2K QHD${orient}`;
  if (shortEdge >= 1080) return `1080p Full HD${orient}`;
  if (shortEdge >= 720) return `720p HD${orient}`;
  if (shortEdge >= 540) return `540p qHD${orient}`;
  if (shortEdge >= 480) return `480p SD${orient}`;
  if (shortEdge >= 360) return `360p${orient}`;
  return `${shortEdge}p${orient}`;
}

function scoreVideo(f) {
  let score = f.tbr ?? 0;
  if (f.ext === 'mp4') score += 10_000;
  if (f.vcodec?.startsWith('avc') || f.vcodec?.startsWith('h264')) score += 5_000;
  return score;
}

export function buildChoices(info, maxHeight = 2160) {
  const formats = Array.isArray(info?.formats) ? info.formats : [];
  const choices = [];

  const audioOnly = formats.filter((f) => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
  const bestAudio = [...audioOnly].sort((a, b) => (b.abr ?? b.tbr ?? 0) - (a.abr ?? a.tbr ?? 0))[0];
  const audioSize = bestAudio?.filesize ?? bestAudio?.filesize_approx;

  const videos = formats.filter((f) => {
    if (!f.vcodec || f.vcodec === 'none' || !f.height) return false;
    const shortEdge = f.width ? Math.min(f.height, f.width) : f.height;
    return shortEdge <= maxHeight;
  });

  const heights = [...new Set(videos.map((f) => f.height))].sort((a, b) => b - a);

  for (const height of heights.slice(0, MAX_VIDEO_CHOICES)) {
    const candidates = videos.filter((f) => f.height === height);
    const best = [...candidates].sort((a, b) => scoreVideo(b) - scoreVideo(a))[0];
    const muxed = best.acodec && best.acodec !== 'none';
    const sizeBytes = (best.filesize ?? best.filesize_approx ?? 0) + (muxed ? 0 : (audioSize ?? 0));
    const sizeLabel = sizeBytes > 0 ? ` · ~${formatBytes(sizeBytes)}` : '';

    const isVertical = Boolean(best.height && best.width && best.height > best.width);
    const shortEdge = best.height && best.width ? Math.min(best.height, best.width) : height;
    const qualityName = getQualityBadge(shortEdge, isVertical);

    choices.push({
      formatId: String(height),
      kind: 'video',
      resolutionTag: `${shortEdge}p`,
      label: `${qualityName} · mp4${sizeLabel}`,
      sizeBytes: sizeBytes || undefined,
    });
  }

  if (choices.length === 0) {
    const anyVideo = formats.find((f) => f.vcodec && f.vcodec !== 'none');
    const directSize = anyVideo?.filesize ?? anyVideo?.filesize_approx ?? 0;
    const sizeLabel = directSize > 0 ? ` · ~${formatBytes(directSize)}` : '';
    choices.push({
      formatId: 'best',
      kind: 'video',
      resolutionTag: 'best',
      label: `Best Quality (Auto Shorts/Long) · mp4${sizeLabel}`,
      sizeBytes: directSize || undefined,
    });
  }

  const audioSizeLabel = audioSize ? ` · ~${formatBytes(audioSize)}` : '';
  choices.push({
    formatId: 'audio',
    kind: 'audio',
    resolutionTag: 'audio',
    label: `Audio MP3 (320kbps) · mp3${audioSizeLabel}`,
    sizeBytes: audioSize || undefined,
  });

  return choices;
}

function cleanYtDlpError(stderr) {
  const lines = String(stderr || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('ERROR:'));
  const last = lines.at(-1);
  return last ? last.replace(/^ERROR:\s*(\[[^\]]+\]\s*)?/, '') : '';
}

function toNumber(value) {
  if (!value || value === 'NA' || value === 'None') return undefined;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : undefined;
}

function safeTokenEqual(headerVal, expectedKey) {
  if (!expectedKey || typeof headerVal !== 'string') return false;
  const m = /^Bearer\s+(.+)$/i.exec(headerVal.trim());
  if (!m) return false;
  const a = crypto.createHash('sha256').update(m[1]).digest();
  const b = crypto.createHash('sha256').update(expectedKey).digest();
  return crypto.timingSafeEqual(a, b);
}

function sanitizeDownloadFilename(name, extFallback = 'mp4') {
  const base = path.basename(name || `video.${extFallback}`);
  const ascii = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]+/g, '_')
    .replace(/["\\/:*?<>|]+/g, '_')
    .trim();
  return {
    ascii: ascii || `tqd-media.${extFallback}`,
    utf8: encodeURIComponent(base),
  };
}

async function readJsonBody(req, maxBytes = 32 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      const err = new Error('Payload too large');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw badRequest('JSON không hợp lệ.');
  }
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function parseTimestampSec(ts) {
  const clean = String(ts || '').trim().replace(',', '.');
  const parts = clean.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function cleanCueLine(raw) {
  return String(raw || '')
    .replace(/<\d{2}:\d{2}(?::\d{2})?[.,]\d{3}>/g, '')
    .replace(/<\/?[a-zA-Z0-9._-]+[^>]*>/g, '')
    .replace(/\{\\an\d+\}/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function mergeRollingSegments(rawSegments) {
  const merged = [];
  for (const seg of rawSegments) {
    let text = cleanCueLine(seg.text);
    if (!text) continue;
    if (/^\[(?:music|âm nhạc|applause|vỗ tay)\]$/i.test(text)) continue;

    const prev = merged.at(-1);
    if (prev) {
      if (prev.text === text) {
        prev.end = Math.max(prev.end, seg.end);
        continue;
      }
      // YouTube rolling VTT often repeats the previous line as a prefix of the next cue
      if (text.startsWith(prev.text) && text.length > prev.text.length) {
        const suffix = text.slice(prev.text.length).trim();
        if (suffix) text = suffix;
      } else if (prev.text.endsWith(text)) {
        prev.end = Math.max(prev.end, seg.end);
        continue;
      }
      // Merge ultra-short (< 2.5s & < 45 chars) consecutive fragments into natural ~5s sentences
      if (
        seg.start - prev.end <= 0.6 &&
        seg.end - prev.start <= 6.5 &&
        prev.text.length + text.length < 110 &&
        !/[.!?…]$/.test(prev.text)
      ) {
        prev.text = `${prev.text} ${text}`.replace(/\s+/g, ' ').trim();
        prev.end = Math.max(prev.end, seg.end);
        continue;
      }
    }
    merged.push({
      start: Math.max(0, Math.round(seg.start * 10) / 10),
      end: Math.max(0, Math.round(seg.end * 10) / 10),
      text,
    });
  }

  const fullText = merged.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();
  return { text: fullText, segments: merged };
}

/** Parses `.json3`, `.vtt`, or `.srt` subtitle files into deduplicated timestamped segments. */
export function parseSubtitleContent(rawContent, ext = '.vtt') {
  const raw = String(rawContent || '').trim();
  if (!raw) return { text: '', segments: [] };

  const lowerExt = ext.toLowerCase();
  if (lowerExt.endsWith('json3') || raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      const events = Array.isArray(parsed?.events) ? parsed.events : [];
      const rawSegs = [];
      for (const ev of events) {
        if (!Array.isArray(ev?.segs)) continue;
        const txt = ev.segs.map((s) => s?.utf8 || '').join('').replace(/\n+/g, ' ');
        const cleaned = cleanCueLine(txt);
        if (!cleaned) continue;
        const start = (Number(ev.tStartMs) || 0) / 1000;
        const dur = (Number(ev.dDurationMs) || 2500) / 1000;
        rawSegs.push({ start, end: start + dur, text: cleaned });
      }
      return mergeRollingSegments(rawSegs);
    } catch {
      // fall through to VTT/SRT line parser
    }
  }

  const blocks = raw.replace(/\r\n/g, '\n').split(/\n{2,}/);
  const rawSegs = [];
  const timeRe = /(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})/;

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;
    if (/^(WEBVTT|NOTE|STYLE|REGION)\b/i.test(lines[0])) continue;

    const timeIdx = lines.findIndex((l) => timeRe.test(l));
    if (timeIdx < 0) continue;
    const m = timeRe.exec(lines[timeIdx]);
    if (!m) continue;

    const start = parseTimestampSec(m[1]);
    const end = Math.max(start + 0.5, parseTimestampSec(m[2]));
    const cueLines = [];
    for (const line of lines.slice(timeIdx + 1)) {
      const c = cleanCueLine(line);
      if (c && cueLines.at(-1) !== c) cueLines.push(c);
    }
    if (cueLines.length > 0) {
      rawSegs.push({ start, end, text: cueLines.join(' ') });
    }
  }

  return mergeRollingSegments(rawSegs);
}

function runProcessCapture(bin, args, timeoutMs = 25_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stdoutBytes = 0;
    let stderr = '';
    let abortedForSize = false;
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Quá thời gian xử lý media trên máy chủ (timeout).'));
    }, timeoutMs);

    child.stdout.on('data', (c) => {
      stdoutBytes += c.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) {
        abortedForSize = true;
        child.kill('SIGKILL');
        return;
      }
      stdout += c.toString();
    });
    child.stderr.on('data', (c) => {
      stderr = appendTail(stderr, c.toString());
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (abortedForSize) {
        reject(badRequest('Phản hồi dữ liệu nguồn quá lớn, từ chối xử lý để bảo vệ bộ nhớ.'));
        return;
      }
      if (code !== 0) {
        reject(new Error(cleanYtDlpError(stderr) || stderr.trim().slice(-240) || `Tiến trình thoát với mã ${code}.`));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

function selectPreferredSubLang(info) {
  const subs = info?.subtitles && typeof info.subtitles === 'object' ? info.subtitles : {};
  const autoSubs =
    info?.automatic_captions && typeof info.automatic_captions === 'object' ? info.automatic_captions : {};
  const validKeys = (obj) =>
    Object.keys(obj).filter((k) => k && !/^(live_chat|danmaku)/i.test(k) && Array.isArray(obj[k]) && obj[k].length > 0);

  const manualKeys = validKeys(subs);
  const autoKeys = validKeys(autoSubs);
  if (manualKeys.length === 0 && autoKeys.length === 0) return null;

  const origLang = typeof info?.language === 'string' ? info.language.trim() : '';
  const priorityPrefixes = [
    ...(origLang ? [origLang.toLowerCase(), origLang.split('-')[0].toLowerCase()] : []),
    'vi',
    'en',
    'zh',
    'ja',
    'ko',
  ];

  for (const pool of [manualKeys, autoKeys]) {
    for (const pref of priorityPrefixes) {
      const exact = pool.find((k) => k.toLowerCase() === pref);
      if (exact) return { lang: exact, isAuto: pool === autoKeys };
      const prefixHit = pool.find((k) => k.toLowerCase().startsWith(`${pref}-`) || k.toLowerCase().startsWith(`${pref}_`));
      if (prefixHit) return { lang: prefixHit, isAuto: pool === autoKeys };
    }
  }

  const fallback = manualKeys[0] || autoKeys[0];
  return fallback ? { lang: fallback, isAuto: manualKeys.length === 0 } : null;
}

export async function startDlDaemon(options = {}) {
  const port = options.port ?? Number(process.env.DL_PORT || 4099);
  const host = options.host ?? process.env.DL_HOST ?? '127.0.0.1';
  const apiKey = options.apiKey ?? process.env.DL_API_KEY ?? '';
  const tmpRoot = options.tmpRoot ?? process.env.DL_TMP_ROOT ?? DEFAULT_TMP_ROOT;
  const mockEngine = Boolean(options.mockEngine ?? process.env.DL_MOCK_ENGINE === '1');

  const ytdlpBin = resolveBinary(
    'YTDLP_BIN',
    ['/Users/tqd/.local/bin/yt-dlp', '/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp'],
    'yt-dlp',
  );
  const ffmpegBin = resolveBinary(
    'FFMPEG_BIN',
    ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg'],
    undefined,
  );

  await fs.mkdir(tmpRoot, { recursive: true, mode: 0o700 });

  const tasks = new Map();
  const queue = [];
  const activeTranscribeDirs = new Set();
  const activeStreamDirs = new Set();
  let activeCount = 0;

  function pruneQueue() {
    for (let i = queue.length - 1; i >= 0; i--) {
      const t = queue[i];
      if (!t || t.cleaned || !tasks.has(t.id) || t.status !== 'queued') {
        queue.splice(i, 1);
      }
    }
  }

  function isProtectedDir(dirPath) {
    if (activeTranscribeDirs.has(dirPath) || activeStreamDirs.has(dirPath)) return true;
    for (const task of tasks.values()) {
      if (
        task.taskDir === dirPath &&
        (task.status === 'queued' || task.status === 'downloading' || task.status === 'processing')
      ) {
        return true;
      }
    }
    return false;
  }

  function removeTaskArtifactsSync(task) {
    if (!task || task.cleaned) return;
    task.cleaned = true;
    if (task.taskDir) {
      try {
        rmSync(task.taskDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  }

  async function removeTaskArtifacts(task) {
    removeTaskArtifactsSync(task);
  }

  async function reapExpiredTasks() {
    const now = Date.now();
    for (const [id, task] of tasks.entries()) {
      if (
        now - task.createdAt > TASK_TTL_MS &&
        task.status !== 'downloading' &&
        task.status !== 'processing' &&
        !activeStreamDirs.has(task.taskDir)
      ) {
        await removeTaskArtifacts(task);
        tasks.delete(id);
      }
    }
    pruneQueue();

    try {
      const entries = await fs.readdir(tmpRoot, { withFileTypes: true });
      let totalSize = 0;
      const folderStats = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const dirPath = path.join(tmpRoot, entry.name);
        if (isProtectedDir(dirPath)) continue;

        const st = await fs.stat(dirPath).catch(() => null);
        if (!st) continue;
        if (now - st.mtimeMs > TASK_TTL_MS) {
          await fs.rm(dirPath, { recursive: true, force: true }).catch(() => {});
          for (const [tid, t] of tasks.entries()) {
            if (t.taskDir === dirPath) {
              t.cleaned = true;
              tasks.delete(tid);
            }
          }
          continue;
        }
        const files = await fs.readdir(dirPath).catch(() => []);
        let dirBytes = 0;
        for (const f of files) {
          const fst = await fs.stat(path.join(dirPath, f)).catch(() => null);
          if (fst?.isFile()) dirBytes += fst.size;
        }
        totalSize += dirBytes;
        folderStats.push({ dirPath, mtimeMs: st.mtimeMs, dirBytes });
      }
      if (totalSize > MAX_TMP_BYTES) {
        folderStats.sort((a, b) => a.mtimeMs - b.mtimeMs);
        for (const item of folderStats) {
          if (totalSize <= MAX_TMP_BYTES) break;
          if (isProtectedDir(item.dirPath)) continue;
          await fs.rm(item.dirPath, { recursive: true, force: true }).catch(() => {});
          for (const [tid, t] of tasks.entries()) {
            if (t.taskDir === item.dirPath) {
              t.cleaned = true;
              tasks.delete(tid);
            }
          }
          totalSize -= item.dirBytes;
        }
      }
    } catch {
      // ignore reaper errors
    }
  }

  const reaperTimer = setInterval(() => {
    void reapExpiredTasks();
  }, 60_000);
  reaperTimer.unref?.();

  async function probeOneUrl(url, { allowPlaylist = false, allowGeneric = false, maxItems = 25, maxHeight = 1080 } = {}) {
    await assertPublicResolvedUrl(url, { mockEngine, allowGeneric });

    if (mockEngine) {
      if (allowPlaylist && isPlaylistOrProfileUrl(url)) {
        return {
          mode: 'playlist',
          url,
          title: 'Mock Playlist / Profile',
          uploader: 'TQD Mock Channel',
          platform: detectPlatform(url),
          entries: [
            {
              id: 'mock-1',
              url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              title: 'Mock Video #1',
              duration: 212,
              uploader: 'TQD Mock Channel',
              platform: detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
            },
            {
              id: 'mock-2',
              url: 'https://www.youtube.com/shorts/abc123xyz',
              title: 'Mock Shorts #2',
              duration: 45,
              uploader: 'TQD Mock Channel',
              platform: detectPlatform('https://www.youtube.com/shorts/abc123xyz'),
            },
          ].slice(0, maxItems),
        };
      }

      const mockInfo = {
        id: 'dQw4w9WgXcQ',
        title: 'Mock Video Title',
        uploader: 'Mock Uploader',
        duration: 212,
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        width: isShortsOrReelsUrl(url) ? 1080 : 1920,
        height: isShortsOrReelsUrl(url) ? 1920 : 1080,
        formats: [
          { format_id: '401', ext: 'mp4', vcodec: 'avc1.640033', acodec: 'none', width: 3840, height: 2160, filesize: 85_000_000 },
          { format_id: '137', ext: 'mp4', vcodec: 'avc1.640028', acodec: 'none', width: 1920, height: 1080, filesize: 28_000_000 },
          { format_id: '136', ext: 'mp4', vcodec: 'avc1.4d401f', acodec: 'none', width: 1280, height: 720, filesize: 14_000_000 },
          { format_id: '140', ext: 'm4a', vcodec: 'none', acodec: 'mp4a.40.2', abr: 128, filesize: 3_400_000 },
        ],
      };

      return {
        mode: 'single',
        url,
        title: mockInfo.title,
        uploader: mockInfo.uploader,
        duration: mockInfo.duration,
        thumbnail: mockInfo.thumbnail,
        isVertical: detectIsVerticalVideo(mockInfo, url),
        platform: detectPlatform(url),
        choices: buildChoices(mockInfo, maxHeight),
      };
    }

    const args = [
      '-J',
      '--no-warnings',
      '--no-config',
      '--no-exec',
      '--no-mark-watched',
      '--geo-bypass',
      '--socket-timeout',
      '15',
    ];

    const isList = allowPlaylist || isPlaylistOrProfileUrl(url);
    if (isList) {
      args.push('--yes-playlist', '--flat-playlist', '--playlist-end', String(Math.max(1, Math.min(maxItems, 100))));
    } else {
      args.push('--no-playlist');
    }
    args.push('--', url);

    const { stdout } = await runProcessCapture(ytdlpBin, args, 25_000);
    const info = JSON.parse(stdout);
    if (info._type === 'playlist' && Array.isArray(info.entries) && info.entries.length > 0) {
      const entries = info.entries
        .map((e) => {
          const entryUrl =
            e.webpage_url ||
            e.url ||
            (e.id && String(info.extractor_key || '').toLowerCase().includes('youtube')
              ? `https://www.youtube.com/watch?v=${e.id}`
              : '');
          const check = validateSafeMediaUrl(entryUrl, { allowGeneric });
          if (!check.ok) return null;
          return {
            id: e.id || crypto.randomUUID().slice(0, 8),
            url: check.url,
            title: e.title || `Video #${e.id || 'item'}`,
            duration: e.duration,
            thumbnail: e.thumbnail || e.thumbnails?.[0]?.url || '',
            uploader: e.uploader || info.uploader || info.channel || '',
            platform: detectPlatform(check.url),
          };
        })
        .filter(Boolean)
        .slice(0, maxItems);

      return {
        mode: 'playlist',
        url,
        title: info.title || 'Danh sách phát / Kênh',
        uploader: info.uploader || info.channel || '',
        platform: detectPlatform(url),
        entries,
      };
    }

    const isVertical = detectIsVerticalVideo(info, url);
    return {
      mode: 'single',
      url,
      title: info.title || 'Video',
      uploader: info.uploader || info.channel || '',
      duration: info.duration,
      thumbnail: info.thumbnail || info.thumbnails?.at(-1)?.url || '',
      isVertical,
      platform: detectPlatform(url),
      choices: buildChoices(info, maxHeight),
    };
  }

  function pumpQueue() {
    while (activeCount < MAX_CONCURRENT && queue.length > 0) {
      const nextTask = queue.shift();
      if (!nextTask) break;
      // Skip tasks that were reaped or already cancelled while waiting in the queue
      if (nextTask.cleaned || !tasks.has(nextTask.id) || nextTask.status !== 'queued') {
        continue;
      }
      activeCount++;
      void executeTask(nextTask).finally(() => {
        activeCount--;
        pumpQueue();
      });
    }
  }

  async function executeTask(task) {
    if (task.cleaned || !tasks.has(task.id)) return;
    task.status = 'downloading';
    await fs.mkdir(task.taskDir, { recursive: true, mode: 0o700 });

    try {
      await assertPublicResolvedUrl(task.url, { mockEngine, allowGeneric: Boolean(task.allowGeneric) });
    } catch (err) {
      task.status = 'failed';
      task.error = err?.message || 'Đường dẫn tải không hợp lệ.';
      await removeTaskArtifacts(task);
      return;
    }

    if (mockEngine) {
      const ext = task.kind === 'audio' ? 'mp3' : 'mp4';
      const safeTitle = (task.title || 'Mock Video').replace(/["\\/:*?<>|]+/g, '_').trim() || 'Mock-Video';
      const outPath = path.join(task.taskDir, `${safeTitle} [mock].${ext}`);
      const payload = Buffer.from(`MOCK_MEDIA_CONTENT_${task.id}_${task.kind}_${task.formatId}`);
      await fs.writeFile(outPath, payload);
      task.progress = {
        downloadedBytes: payload.length,
        totalBytes: payload.length,
        speed: payload.length * 10,
        eta: 0,
        percent: 100,
      };
      task.filepath = outPath;
      task.filename = path.basename(outPath);
      task.sizeBytes = payload.length;
      task.status = 'completed';
      return;
    }

    const formatArgs = [];
    const heightMatch = /^(\d{3,4})p?$/i.exec(task.formatId);
    if (task.kind === 'audio' || task.formatId === 'audio' || task.formatId === 'mp3' || task.formatId === 'audio-mp3') {
      formatArgs.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
    } else if (heightMatch) {
      const h = Math.min(Number(heightMatch[1]), task.maxHeight);
      formatArgs.push(
        '-f',
        `bv*[height=${h}]+ba/b[height=${h}]/bv*[height<=${h}]+ba/b[height<=${h}]/bv*+ba/b`,
        '--merge-output-format',
        'mp4',
      );
    } else {
      formatArgs.push('-f', 'bv*+ba/b', '--merge-output-format', 'mp4');
    }

    const args = [
      ...formatArgs,
      '--no-playlist',
      '--no-warnings',
      '--no-config',
      '--no-exec',
      '--no-mark-watched',
      '--geo-bypass',
      '--newline',
      '--no-quiet',
      '--progress',
      '--progress-template',
      `download:${PROGRESS_TEMPLATE}`,
      '--max-filesize',
      `${task.maxFilesizeMB}M`,
      '--downloader-args',
      'ffmpeg:-protocol_whitelist https,tls,tcp,crypto',
      '--print',
      'after_move:filepath',
      '--no-simulate',
      '-o',
      path.join(task.taskDir, '%(title).80B [%(id).16B].%(ext)s'),
    ];

    if (task.kind !== 'audio') {
      const sortCap = /^\d+$/.test(task.formatId)
        ? Math.min(Number(task.formatId), task.maxHeight)
        : task.maxHeight;
      if (task.compatibilityMode !== false) {
        args.push('-S', `vcodec:h264,res:${sortCap},acodec:m4a`);
      } else {
        args.push('-S', `res:${sortCap}`);
      }
      args.push('--ppa', 'Merger+ffmpeg_o1:-movflags +faststart');
    }

    if (ffmpegBin) {
      args.push('--ffmpeg-location', ffmpegBin);
    }

    args.push('--', task.url);

    await new Promise((resolve) => {
      const child = spawn(ytdlpBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      let buffer = '';
      let printedPath = '';

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        task.status = 'failed';
        task.error = 'Quá thời gian tải file (tối đa 8 phút).';
      }, 8 * 60 * 1000);

      child.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        if (buffer.length > 64 * 1024) buffer = buffer.slice(-32 * 1024);
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;
          if (line.startsWith(PROGRESS_PREFIX)) {
            const [dl, total, est, speed, eta] = line.slice(PROGRESS_PREFIX.length).split('|');
            const downloadedBytes = toNumber(dl) ?? 0;
            const totalBytes = toNumber(total) ?? toNumber(est);
            const percent =
              totalBytes && totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
            task.progress = {
              downloadedBytes,
              totalBytes,
              speed: toNumber(speed),
              eta: toNumber(eta),
              percent,
            };
          } else if (line.includes('[Merger]') || line.includes('[ExtractAudio]')) {
            task.status = 'processing';
          } else if (path.isAbsolute(line) && line.startsWith(task.taskDir)) {
            printedPath = line;
          }
        }
      });

      child.stderr.on('data', (chunk) => {
        stderr = appendTail(stderr, chunk.toString());
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        task.status = 'failed';
        task.error = err.message || 'Không thể khởi chạy yt-dlp.';
        resolve();
      });

      child.on('close', async (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          let finalPath = printedPath;
          if (!finalPath || !existsSync(finalPath)) {
            const files = await fs.readdir(task.taskDir).catch(() => []);
            const mediaFile = files.find((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'));
            if (mediaFile) finalPath = path.join(task.taskDir, mediaFile);
          }
          if (finalPath && existsSync(finalPath)) {
            const st = await fs.stat(finalPath).catch(() => null);
            task.filepath = finalPath;
            task.filename = path.basename(finalPath);
            task.sizeBytes = st?.size ?? task.progress.downloadedBytes;
            task.progress.percent = 100;
            task.status = 'completed';
            resolve();
            return;
          }
        }
        task.status = 'failed';
        task.error = cleanYtDlpError(stderr) || `Tải không thành công (mã thoát ${code}).`;
        await removeTaskArtifacts(task);
        resolve();
      });
    });
  }

  let transcribeActive = 0;

  async function transcribeOneUrl(
    url,
    { maxDurationSec = 300, maxAudioDurationSec = 600, allowGeneric = false } = {},
  ) {
    if (isPlaylistOrProfileUrl(url)) {
      throw badRequest('Vui lòng dán đường dẫn của 1 video cụ thể để bóc băng kịch bản (không hỗ trợ cả Playlist/Kênh).');
    }

    await assertPublicResolvedUrl(url, { mockEngine, allowGeneric });

    if (mockEngine) {
      return {
        mode: 'subtitles',
        id: 'mock-viral-01',
        webpageUrl: url,
        title: '3 Sai Lầm Khiến Quán Cà Phê Vắng Khách Dù Đồ Uống Ngon',
        uploader: 'TQD Creator Lab',
        duration: 58,
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        language: 'vi',
        platform: detectPlatform(url),
        text: '90 phần trăm chủ quán cà phê mới mở đều đốt sạch vốn trong 6 tháng đầu chỉ vì 1 hiểu lầm này. Bạn cứ nghĩ pha ly nước ngon hơn đối thủ là khách tự kéo đến, nhưng sự thật khách hàng bước vào quán lần đầu bằng mắt chứ không phải bằng lưỡi.',
        segments: [
          {
            start: 0,
            end: 5.2,
            text: '90 phần trăm chủ quán cà phê mới mở đều đốt sạch vốn trong 6 tháng đầu chỉ vì 1 hiểu lầm này.',
          },
          {
            start: 5.2,
            end: 13.8,
            text: 'Bạn cứ nghĩ pha ly nước ngon hơn đối thủ là khách tự kéo đến, nhưng sự thật khách hàng bước vào quán lần đầu bằng mắt chứ không phải bằng lưỡi.',
          },
        ],
      };
    }

    if (transcribeActive >= MAX_CONCURRENT) {
      const err = new Error('Máy chủ đang bóc băng nhiều video cùng lúc. Bạn thử lại sau khoảng 10 giây nhé.');
      err.statusCode = 429;
      throw err;
    }

    transcribeActive++;
    const transDir = path.join(tmpRoot, `tr-${crypto.randomUUID()}`);
    activeTranscribeDirs.add(transDir);
    await fs.mkdir(transDir, { recursive: true, mode: 0o700 });

    try {
      const { stdout: metaOut } = await runProcessCapture(
        ytdlpBin,
        ['-J', '--no-playlist', '--no-warnings', '--no-config', '--no-exec', '--no-mark-watched', '--geo-bypass', '--socket-timeout', '15', '--', url],
        25_000,
      );
      const info = JSON.parse(metaOut);
      if (info?._type === 'playlist') {
        throw badRequest('Vui lòng dán đường dẫn của 1 video lẻ cụ thể.');
      }

      const duration = Math.round(Number(info?.duration) || 0);
      if (duration > 0 && duration > maxDurationSec) {
        const mins = Math.ceil(duration / 60);
        const capMins = Math.floor(maxDurationSec / 60);
        throw badRequest(
          `Video dài khoảng ${mins} phút, vượt giới hạn ${capMins} phút của chế độ hiện tại để bảo vệ tốc độ xử lý.`,
        );
      }

      let resolvedUrl = url;
      if (typeof info?.webpage_url === 'string') {
        try {
          resolvedUrl = await assertPublicResolvedUrl(info.webpage_url, { mockEngine, allowGeneric });
        } catch {
          resolvedUrl = url;
        }
      }

      const metaBase = {
        id: String(info?.id || ''),
        webpageUrl: resolvedUrl,
        title: String(info?.title || 'Video'),
        uploader: String(info?.uploader || info?.channel || ''),
        duration,
        thumbnail: String(info?.thumbnail || info?.thumbnails?.at(-1)?.url || ''),
        platform: detectPlatform(resolvedUrl),
      };

      // Tier 1: Fast native/auto subtitles via yt-dlp (~1.5s, 0 Whisper Neurons)
      const subChoice = selectPreferredSubLang(info);
      if (subChoice) {
        try {
          const subArgs = [
            '--skip-download',
            '--no-playlist',
            '--no-warnings',
            '--no-config',
            '--no-exec',
            '--geo-bypass',
            '--socket-timeout',
            '12',
            subChoice.isAuto ? '--write-auto-subs' : '--write-subs',
            '--sub-langs',
            subChoice.lang,
            '--sub-format',
            'json3/vtt/srt',
            '-o',
            path.join(transDir, 'sub'),
            '--',
            url,
          ];
          await runProcessCapture(ytdlpBin, subArgs, 18_000);
          const files = await fs.readdir(transDir);
          const subFile = files.find((f) => f.startsWith('sub.') && /\.(json3|vtt|srt)$/i.test(f));
          if (subFile) {
            const rawSub = await fs.readFile(path.join(transDir, subFile), 'utf8');
            const parsed = parseSubtitleContent(rawSub, path.extname(subFile));
            const wordCount = parsed.text.split(/\s+/).filter(Boolean).length;
            if (wordCount >= 5) {
              return {
                mode: 'subtitles',
                ...metaBase,
                language: subChoice.lang,
                text: parsed.text,
                segments: parsed.segments,
              };
            }
          }
        } catch {
          // Fall back seamlessly to Tier 2 audio extraction if subtitle download fails
        }
      }

      // Guard Tier 2 Whisper audio extraction to <= maxAudioDurationSec (default 10m) so Base64 stays small
      const effectiveAudioCap = Math.min(maxDurationSec, Math.max(60, Number(maxAudioDurationSec) || 600));
      if (duration > 0 && duration > effectiveAudioCap) {
        const capMins = Math.floor(effectiveAudioCap / 60);
        throw badRequest(
          `Video này không có phụ đề sẵn và dài hơn ${capMins} phút nên vượt ngưỡng nhận diện giọng nói trực tiếp.`,
        );
      }

      // Tier 2: Extract ultra-light 32kbps 16kHz mono MP3 (~240 KB/min) for Cloudflare Workers AI Whisper
      const dlArgs = [
        '-f',
        'ba/b',
        '--no-playlist',
        '--no-warnings',
        '--no-config',
        '--no-exec',
        '--no-mark-watched',
        '--geo-bypass',
        '--socket-timeout',
        '15',
        '--max-filesize',
        '45M',
        '--downloader-args',
        'ffmpeg:-protocol_whitelist https,tls,tcp,crypto',
        '-o',
        path.join(transDir, 'raw.%(ext)s'),
      ];
      if (ffmpegBin) dlArgs.push('--ffmpeg-location', ffmpegBin);
      dlArgs.push('--', url);

      await runProcessCapture(ytdlpBin, dlArgs, 45_000);
      const afterFiles = await fs.readdir(transDir);
      const rawFile = afterFiles.find((f) => f.startsWith('raw.') && !f.endsWith('.part') && !f.endsWith('.ytdl'));
      if (!rawFile) {
        throw new Error('Không tách được luồng âm thanh từ video này.');
      }

      const speechMp3 = path.join(transDir, 'speech.mp3');
      const ffExe = ffmpegBin || 'ffmpeg';
      await runProcessCapture(
        ffExe,
        [
          '-y',
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          path.join(transDir, rawFile),
          '-vn',
          '-ac',
          '1',
          '-ar',
          '16000',
          '-b:a',
          '32k',
          '-t',
          String(effectiveAudioCap),
          speechMp3,
        ],
        25_000,
      );

      const mp3Buf = await fs.readFile(speechMp3);
      return {
        mode: 'audio',
        ...metaBase,
        language: typeof info?.language === 'string' ? info.language : '',
        audioBase64: mp3Buf.toString('base64'),
        audioBytes: mp3Buf.length,
      };
    } finally {
      activeTranscribeDirs.delete(transDir);
      transcribeActive = Math.max(0, transcribeActive - 1);
      try {
        rmSync(transDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const reqUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = reqUrl.pathname;

      if (!safeTokenEqual(req.headers.authorization, apiKey)) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return;
      }

      if (req.method === 'GET' && pathname === '/health') {
        pruneQueue();
        sendJson(res, 200, {
          ok: true,
          version: mockEngine ? 'mock-2026.11' : 'ytdlp-daemon-1.2',
          activeTasks: activeCount,
          queuedTasks: queue.length,
          transcribeActive,
        });
        return;
      }

      if (req.method === 'POST' && pathname === '/transcribe') {
        const body = await readJsonBody(req);
        const allowGeneric = Boolean(body.allowGeneric);
        const maxDurationSec = Math.max(30, Math.min(Number(body.maxDurationSec) || 300, 1800));
        const maxAudioDurationSec = Math.max(60, Math.min(Number(body.maxAudioDurationSec) || 600, maxDurationSec));
        try {
          const safeUrl = await assertPublicResolvedUrl(String(body.url || ''), { mockEngine, allowGeneric });
          const result = await transcribeOneUrl(safeUrl, { maxDurationSec, maxAudioDurationSec, allowGeneric });
          sendJson(res, 200, result);
        } catch (err) {
          const status = Number(err?.statusCode) || 500;
          sendJson(res, status, { error: err?.message || 'Không thể bóc băng video này.' });
        }
        return;
      }

      if (req.method === 'POST' && pathname === '/resolve') {
        const body = await readJsonBody(req);
        const allowGeneric = Boolean(body.allowGeneric);
        const rawUrls = Array.isArray(body.urls)
          ? body.urls
          : typeof body.url === 'string'
            ? [body.url]
            : [];
        if (rawUrls.length === 0) {
          sendJson(res, 400, { error: 'Thiếu đường dẫn URL.' });
          return;
        }

        const maxItems = Math.max(1, Math.min(Number(body.maxItems) || 25, 100));
        const safeUrls = [];
        for (const u of rawUrls.slice(0, maxItems)) {
          try {
            const safeUrl = await assertPublicResolvedUrl(String(u), { mockEngine, allowGeneric });
            safeUrls.push(safeUrl);
          } catch (err) {
            sendJson(res, Number(err?.statusCode) || 400, { error: err?.message || 'Đường dẫn không hợp lệ.' });
            return;
          }
        }

        const maxHeight = Number(body.maxHeight) || 1080;

        if (safeUrls.length > 1) {
          const entries = safeUrls.map((u, idx) => {
            const p = detectPlatform(u);
            return {
              id: `batch-${idx + 1}`,
              url: u,
              title: `${p.label} · ${u}`,
              platform: p,
            };
          });
          sendJson(res, 200, {
            mode: 'batch',
            title: `Danh sách ${entries.length} đường dẫn`,
            entries,
          });
          return;
        }

        try {
          const singleResult = await probeOneUrl(safeUrls[0], {
            allowPlaylist: Boolean(body.allowPlaylist),
            allowGeneric,
            maxItems,
            maxHeight,
          });
          sendJson(res, 200, singleResult);
        } catch (err) {
          sendJson(res, Number(err?.statusCode) || 500, {
            error: err?.message || 'Không thể phân tích đường dẫn này.',
          });
        }
        return;
      }

      if (req.method === 'POST' && pathname === '/prepare') {
        const body = await readJsonBody(req);
        const allowGeneric = Boolean(body.allowGeneric);
        let safeUrl;
        try {
          safeUrl = await assertPublicResolvedUrl(String(body.url || ''), { mockEngine, allowGeneric });
        } catch (err) {
          sendJson(res, Number(err?.statusCode) || 400, { error: err?.message || 'Đường dẫn không hợp lệ.' });
          return;
        }

        pruneQueue();
        if (queue.length >= MAX_QUEUE) {
          sendJson(res, 429, { error: 'Hàng đợi xử lý tải đang đầy. Bạn vui lòng thử lại sau ít phút nhé.' });
          return;
        }

        const taskId = crypto.randomUUID();
        const taskDir = path.join(tmpRoot, taskId);
        const task = {
          id: taskId,
          url: safeUrl,
          allowGeneric,
          title: typeof body.title === 'string' ? body.title.slice(0, 140) : 'Video',
          formatId: typeof body.formatId === 'string' ? body.formatId : 'best',
          kind: body.kind === 'audio' ? 'audio' : 'video',
          maxHeight: Number(body.maxHeight) || 1080,
          maxFilesizeMB: Number(body.maxFilesizeMB) || 200,
          compatibilityMode: body.compatibilityMode !== false,
          taskDir,
          status: 'queued',
          progress: {
            downloadedBytes: 0,
            totalBytes: undefined,
            speed: undefined,
            eta: undefined,
            percent: 0,
          },
          filepath: '',
          filename: '',
          sizeBytes: 0,
          error: undefined,
          cleaned: false,
          createdAt: Date.now(),
        };

        tasks.set(taskId, task);
        queue.push(task);
        pumpQueue();

        sendJson(res, 200, { taskId, status: task.status });
        return;
      }

      if (req.method === 'GET' && pathname.startsWith('/task/')) {
        const taskId = decodeURIComponent(pathname.slice('/task/'.length));
        const task = tasks.get(taskId);
        if (!task || task.cleaned) {
          sendJson(res, 404, { error: 'Không tìm thấy tác vụ tải.' });
          return;
        }
        sendJson(res, 200, {
          id: task.id,
          status: task.status,
          progress: task.progress,
          filename: task.filename,
          sizeBytes: task.sizeBytes,
          error: task.error,
        });
        return;
      }

      if (req.method === 'GET' && pathname.startsWith('/stream/')) {
        const taskId = decodeURIComponent(pathname.slice('/stream/'.length));
        const task = tasks.get(taskId);
        if (!task || task.cleaned || task.status !== 'completed' || !task.filepath || !existsSync(task.filepath)) {
          sendJson(res, 404, { error: 'File tải không tồn tại hoặc đã được tự động xóa.' });
          return;
        }

        const ext = path.extname(task.filename).toLowerCase();
        const contentType = ext === '.mp3' ? 'audio/mpeg' : 'video/mp4';
        const names = sanitizeDownloadFilename(task.filename, ext === '.mp3' ? 'mp3' : 'mp4');

        activeStreamDirs.add(task.taskDir);
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': String(task.sizeBytes),
          'Content-Disposition': `attachment; filename="${names.ascii}"; filename*=UTF-8''${names.utf8}`,
          'Cache-Control': 'no-store',
        });

        const stream = createReadStream(task.filepath);
        res.on('finish', () => {
          stream.destroy();
          activeStreamDirs.delete(task.taskDir);
          removeTaskArtifactsSync(task);
          tasks.delete(taskId);
        });
        res.on('close', () => {
          stream.destroy();
          activeStreamDirs.delete(task.taskDir);
        });
        stream.on('error', () => {
          activeStreamDirs.delete(task.taskDir);
          if (!res.headersSent) {
            sendJson(res, 500, { error: 'Lỗi đọc file tạm.' });
          } else {
            res.destroy();
          }
        });
        stream.pipe(res);
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      const status = Number(err?.statusCode) || 500;
      sendJson(res, status, { error: err?.message || 'Internal daemon error' });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;

  return {
    server,
    port: actualPort,
    baseUrl: `http://${host}:${actualPort}`,
    close: () =>
      new Promise((resolve) => {
        clearInterval(reaperTimer);
        server.close(() => resolve());
      }),
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  let apiKey = process.env.DL_API_KEY || '';
  if (!apiKey) {
    const secretFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.secrets/dl-api-key.txt');
    if (existsSync(secretFile)) {
      apiKey = readFileSync(secretFile, 'utf8').trim();
    }
  }
  if (!apiKey) {
    console.error('[ytdlp-daemon] Missing DL_API_KEY environment variable or .secrets/dl-api-key.txt.');
    process.exit(1);
  }
  const daemon = await startDlDaemon({ apiKey });
  console.log(`[ytdlp-daemon] Listening on ${daemon.baseUrl}`);
}
