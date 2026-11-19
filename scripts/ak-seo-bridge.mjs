#!/usr/bin/env node
/**
 * Bridge connecting TQD-Website to the installed /ak-seo skill scripts
 * (/Users/tqd/.gemini/config/skills/ak-seo/scripts/*) and syncing into D1 / /api/v1/seo.
 *
 * Usage:
 *   node scripts/ak-seo-bridge.mjs status
 *   node scripts/ak-seo-bridge.mjs keywords "AI Agent cho doanh nghiệp" [--sync-local] [--sync-api]
 *   node scripts/ak-seo-bridge.mjs gsc-auth
 *   node scripts/ak-seo-bridge.mjs gsc-sync [--days 28] [--site sc-domain:tqd.me] [--sync-local] [--sync-api]
 *   node scripts/ak-seo-bridge.mjs audit [https://tqd.me] [--sync-local] [--sync-api]
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { DAILY_BRIEF_CATALOG, PILLAR_LABELS } from '../src/lib/seo/daily-catalog.ts';

const require = createRequire(import.meta.url);
const AK_SEO_SCRIPTS = '/Users/tqd/.gemini/config/skills/ak-seo/scripts';
const REPORT_DIR = path.resolve(process.cwd(), 'assets/reports/seo');
const SA_KEY_PATH = path.resolve(process.cwd(), '.secrets/gsc-service-account.json');
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const { getConfigStatus } = require(path.join(AK_SEO_SCRIPTS, 'gsc-config-loader.cjs'));
const { loadEnv, getEnv } = require(path.join(AK_SEO_SCRIPTS, 'env-loader.cjs'));

loadEnv('seo');

const args = process.argv.slice(2);
const command = args[0] ?? 'status';
const rest = args.slice(1);

const hasFlag = (flag) => rest.includes(flag);
const getOpt = (flag, fallback) => {
  const idx = rest.indexOf(flag);
  return idx >= 0 && rest[idx + 1] && !rest[idx + 1].startsWith('--') ? rest[idx + 1] : fallback;
};
const firstPositional = rest.find((a) => !a.startsWith('--'));

function todayIso() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
}

function slugifyAscii(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

function stripDiacriticsLower(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyVietnameseIntent(keyword) {
  const padded = ` ${stripDiacriticsLower(keyword)} `;
  if ([' tqd ', ' dungtq ', ' trinh quang dung ', ' goclaw '].some((p) => padded.includes(p))) {
    return 'navigational';
  }
  if (
    [' mua ', ' bang gia ', ' gia bao nhieu ', ' thue ', ' dang ky ', ' tai ', ' download ', ' shop ', ' nang cap ', ' tai khoan ', ' goi '].some((p) =>
      padded.includes(p),
    )
  ) {
    return 'transactional';
  }
  if (
    [' tot nhat ', ' so sanh ', ' khac gi ', ' review ', ' danh gia ', ' top ', ' nen dung ', ' hay ', ' thay the '].some((p) =>
      padded.includes(p),
    )
  ) {
    return 'commercial';
  }
  return 'informational';
}

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function runLocalD1Sql(sql, remote = false) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tqd-seo-'));
  fs.chmodSync(tmpDir, 0o700);
  const file = path.join(tmpDir, 'seo.sql');
  fs.writeFileSync(file, sql, { mode: 0o600 });
  const res = spawnSync(
    npxBin,
    ['wrangler', 'd1', 'execute', 'tqd_db', remote ? '--remote' : '--local', '--file', file],
    { encoding: 'utf8', shell: false },
  );
  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (res.status !== 0) {
    throw new Error(`wrangler d1 execute failed (${res.status}): ${res.stderr || res.stdout}`);
  }
  return res.stdout;
}

function buildKeywordsUpsertSql(keywords) {
  const lines = [];
  for (const item of keywords) {
    const kw = String(item.keyword || '').normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 160);
    if (!kw) continue;
    const norm = kw.toLowerCase();
    lines.push(
      `INSERT INTO seo_keywords (keyword_norm, keyword, cluster, intent, priority, status, volume, difficulty, cpc, source, target_slug, suggested_title, notes) VALUES (${sqlVal(norm)}, ${sqlVal(kw)}, ${sqlVal(item.cluster || '')}, ${sqlVal(item.intent || 'informational')}, ${sqlVal(item.priority || 'medium')}, ${sqlVal(item.status || 'planned')}, ${sqlVal(item.volume ?? null)}, ${sqlVal(item.difficulty ?? null)}, ${sqlVal(item.cpc ?? null)}, ${sqlVal(item.source || 'ak-seo-cli')}, ${sqlVal(item.targetSlug || null)}, ${sqlVal(item.suggestedTitle || kw)}, ${sqlVal(item.notes || '')}) ON CONFLICT(keyword_norm) DO UPDATE SET keyword = excluded.keyword, cluster = CASE WHEN excluded.cluster != '' THEN excluded.cluster ELSE seo_keywords.cluster END, volume = COALESCE(excluded.volume, seo_keywords.volume), difficulty = COALESCE(excluded.difficulty, seo_keywords.difficulty), cpc = COALESCE(excluded.cpc, seo_keywords.cpc), target_slug = COALESCE(excluded.target_slug, seo_keywords.target_slug), updated_at = datetime('now');`,
    );
  }
  return lines.join('\n');
}

function buildGscUpsertSql(siteUrl, rows) {
  const lines = [];
  for (const r of rows) {
    if (!r.day || !r.query) continue;
    lines.push(
      `INSERT OR REPLACE INTO seo_gsc_daily (site, day, query, page, clicks, impressions, ctr, position) VALUES (${sqlVal(siteUrl)}, ${sqlVal(r.day)}, ${sqlVal(r.query)}, ${sqlVal(r.page || '')}, ${sqlVal(Number(r.clicks || 0))}, ${sqlVal(Number(r.impressions || 0))}, ${sqlVal(Number(r.ctr || 0))}, ${sqlVal(Number(r.position || 0))});`,
    );
  }
  return lines.join('\n');
}

async function syncViaApi(payload) {
  const base = (process.env.TQD_BASE || 'http://127.0.0.1:4321').replace(/\/+$/, '');
  const keyFile = getOpt('--api-key-file', '');
  const apiKey = (
    process.env.TQD_API_KEY ||
    (keyFile && fs.existsSync(keyFile) ? fs.readFileSync(keyFile, 'utf8').trim() : '')
  ).trim();
  if (!apiKey) {
    throw new Error('Thiếu TQD_API_KEY (hoặc --api-key-file) để đẩy dữ liệu qua /api/v1/seo.');
  }
  const res = await fetch(`${base}/api/v1/seo`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST ${base}/api/v1/seo thất bại (${res.status}): ${text}`);
  }
  return JSON.parse(text);
}

async function fetchGoogleSuggestVi(seed) {
  const clean = seed.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const ascii = stripDiacriticsLower(clean);
  const queries = new Set([clean]);
  if (!ascii.includes('la gi')) queries.add(`${clean} là gì`);
  if (!ascii.startsWith('cach ')) queries.add(`cách ${clean}`);
  if (!ascii.includes('doanh nghiep')) queries.add(`${clean} cho doanh nghiệp`);
  if (!ascii.includes('mien phi')) queries.add(`${clean} miễn phí`);
  if (!ascii.includes('so sanh')) queries.add(`so sánh ${clean}`);

  const seen = new Map();
  const settled = await Promise.allSettled(
    [...queries].map(async (q) => {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=vi&gl=vn&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return Array.isArray(json?.[1]) ? json[1].filter((x) => typeof x === 'string') : [];
    }),
  );

  const offBrandTokens = ['voz', 'viblo', 'crypto', 'coin', 'crack', 'mod apk', 'tai game'];
  const isNoise = (text) => {
    const padded = ` ${stripDiacriticsLower(text)} `;
    return offBrandTokens.some((tok) => padded.includes(` ${tok} `) && !` ${ascii} `.includes(` ${tok} `));
  };

  for (const r of settled) {
    if (r.status === 'fulfilled') {
      for (const s of r.value) {
        const c = s.normalize('NFKC').trim().replace(/\s+/g, ' ');
        if (!c || isNoise(c)) continue;
        const norm = c.toLowerCase();
        if (!seen.has(norm)) seen.set(norm, c.slice(0, 160));
        if (seen.size >= 40) break;
      }
    }
  }
  return [...seen.values()];
}

function loadServiceAccountConfig() {
  const raw =
    process.env.GSC_SERVICE_ACCOUNT_JSON?.trim() ||
    (fs.existsSync(SA_KEY_PATH) ? fs.readFileSync(SA_KEY_PATH, 'utf8') : '');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.client_email && parsed?.private_key) return parsed;
  } catch {
    return null;
  }
  return null;
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getServiceAccountToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const unsigned = `${base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/webmasters',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  )}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  const signature = signer.sign(sa.private_key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `OAuth JWT error ${res.status}`);
  }
  return data.access_token;
}

function upsertEnvFile(filePath, keyName, secretValue) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  const escaped = secretValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const nextLine = `${keyName}="${escaped}"`;
  const lines = existing ? existing.split(/\r?\n/) : [];
  let replaced = false;
  const out = [];
  for (const line of lines) {
    if (new RegExp(`^\\s*${keyName}\\s*=`).test(line)) {
      if (!replaced) {
        out.push(nextLine);
        replaced = true;
      }
    } else if (line !== '' || out.length > 0) {
      out.push(line);
    }
  }
  if (!replaced) out.push(nextLine);
  fs.writeFileSync(filePath, `${out.join('\n').replace(/\n+$/, '')}\n`, { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

function readHiddenLine(promptLabel) {
  if (!process.stdin.isTTY) {
    return Promise.resolve(fs.readFileSync(0, 'utf8').trim());
  }
  return new Promise((resolve) => {
    process.stdout.write(promptLabel);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch) => {
      if (ch === '\n' || ch === '\r' || ch === '\u0004') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(value.trim());
      } else if (ch === '\u0003') {
        stdin.setRawMode(false);
        process.exit(130);
      } else if (ch === '\u007f' || ch === '\b') {
        if (value.length > 0) value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function cmdStatus() {
  const gscStatus = getConfigStatus();
  const sa = loadServiceAccountConfig();
  const hasReviewWeb = Boolean(getEnv('REVIEWWEB_API_KEY'));
  const siteBase = (process.env.TQD_LIVE_URL || 'https://tqd.me').replace(/\/+$/, '');

  const checks = await Promise.all(
    ['/robots.txt', '/sitemap.xml', '/llms.txt', '/llms-full.txt'].map(async (p) => {
      try {
        const res = await fetch(`${siteBase}${p}`, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        return { path: p, status: res.status };
      } catch (err) {
        return { path: p, status: err instanceof Error ? err.message : 'ERR' };
      }
    }),
  );

  let localKeywords = 'chưa kiểm tra';
  try {
    const out = runLocalD1Sql('SELECT COUNT(*) AS count FROM seo_keywords;');
    const m = out.match(/"count":\s*(\d+)/);
    localKeywords = m ? `${m[1]} từ khóa` : 'đã kết nối D1';
  } catch {
    localKeywords = 'chưa chạy migration 0007 hoặc chưa có local D1';
  }

  console.log(
    JSON.stringify(
      {
        akSeo: {
          gscServiceAccountFound: Boolean(sa),
          gscServiceAccountEmail: sa?.client_email || null,
          gscClientSecretFound: gscStatus.configFound,
          gscTokenFound: gscStatus.tokenFound,
          reviewWebApiKeyConfigured: hasReviewWeb,
        },
        liveSurfaces: {
          base: siteBase,
          checks,
        },
        localD1: {
          seoKeywords: localKeywords,
        },
      },
      null,
      2,
    ),
  );
}

async function cmdKeywords() {
  const seed = firstPositional;
  if (!seed) {
    console.error('Thiếu từ khóa gốc. Ví dụ: npm run seo:keywords -- "AI Agent cho doanh nghiệp"');
    process.exit(2);
  }

  const suggestions = await fetchGoogleSuggestVi(seed);
  const reviewWebMap = new Map();
  const hasReviewWeb = Boolean(getEnv('REVIEWWEB_API_KEY'));

  if (hasReviewWeb) {
    const res = spawnSync(
      process.execPath,
      [path.join(AK_SEO_SCRIPTS, 'analyze-keywords.cjs'), '--keyword', seed, '--country', 'vn', '--format', 'json'],
      { encoding: 'utf8', shell: false },
    );
    if (res.status === 0 && res.stdout) {
      try {
        const parsed = JSON.parse(res.stdout);
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            const kw = String(entry.keyword || '').trim();
            if (!kw) continue;
            reviewWebMap.set(kw.toLowerCase(), {
              keyword: kw,
              volume: Number.isFinite(Number(entry.volume ?? entry.searchVolume)) ? Math.round(Number(entry.volume ?? entry.searchVolume)) : null,
              difficulty: Number.isFinite(Number(entry.difficulty)) ? Math.round(Number(entry.difficulty)) : null,
              cpc: Number.isFinite(Number(entry.cpc)) ? Number(entry.cpc) : null,
            });
          }
        }
      } catch {
        // Ignore unparseable JSON from external CLI
      }
    }
  }

  let searchDocs = [];
  try {
    const liveSearch = await fetch('https://tqd.me/search.json', { signal: AbortSignal.timeout(5000) });
    if (liveSearch.ok) searchDocs = await liveSearch.json();
  } catch {
    searchDocs = [];
  }

  const combined = new Map();
  const pushKw = (kw, source) => {
    const norm = kw.toLowerCase();
    if (!combined.has(norm)) {
      const rw = reviewWebMap.get(norm);
      const intent = classifyVietnameseIntent(kw);
      const covered = searchDocs.find(
        (d) =>
          typeof d?.title === 'string' &&
          stripDiacriticsLower(d.title).includes(stripDiacriticsLower(kw)),
      );
      combined.set(norm, {
        keyword: kw,
        cluster: `Nghiên cứu: ${seed}`,
        intent,
        priority: intent === 'transactional' || intent === 'commercial' || norm === seed.toLowerCase() ? 'high' : 'medium',
        status: covered ? 'published' : 'planned',
        volume: rw?.volume ?? null,
        difficulty: rw?.difficulty ?? null,
        cpc: rw?.cpc ?? null,
        source,
        targetSlug: covered?.url?.startsWith('/bai-viet/') ? covered.url.slice('/bai-viet/'.length) : slugifyAscii(kw),
        suggestedTitle: kw,
        notes: covered ? `Đã có nội dung liên quan: ${covered.url}` : '',
      });
    }
  };

  pushKw(seed, 'ak-seo-cli');
  for (const s of suggestions) pushKw(s, 'google-suggest-vn');
  for (const rw of reviewWebMap.values()) pushKw(rw.keyword, 'reviewweb');

  const items = [...combined.values()];
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportName = `${todayIso()}-${slugifyAscii(seed) || 'keywords'}-keywords.md`;
  const reportPath = path.join(REPORT_DIR, reportName);

  const lines = [
    `# Nghiên cứu từ khóa: ${seed}`,
    '',
    `- **Ngày:** ${todayIso()}`,
    `- **Nguồn:** Google Suggest VN (hl=vi, gl=vn)${hasReviewWeb ? ' + ReviewWeb.site API' : ' (chưa gắn REVIEWWEB_API_KEY)'}`,
    `- **Số từ khóa:** ${items.length}`,
    '',
    '| Từ khóa | Mục đích | Ưu tiên | Lượt tìm | Độ khó | Slug gợi ý | Trạng thái |',
    '|---|---|---|---:|---:|---|---|',
    ...items.map(
      (i) =>
        `| ${i.keyword} | ${i.intent} | ${i.priority} | ${i.volume ?? '—'} | ${i.difficulty ?? '—'} | \`${i.targetSlug}\` | ${i.status} |`,
    ),
    '',
  ];
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`Đã lưu báo cáo từ khóa: ${reportPath} (${items.length} từ khóa)`);

  if (hasFlag('--sync-local') || hasFlag('--sync-remote')) {
    const sql = buildKeywordsUpsertSql(items);
    if (sql) runLocalD1Sql(sql, hasFlag('--sync-remote'));
    console.log(`Đã đồng bộ ${items.length} từ khóa vào D1 (${hasFlag('--sync-remote') ? 'remote' : 'local'}).`);
  }

  if (hasFlag('--sync-api')) {
    const apiRes = await syncViaApi({ keywords: items });
    console.log('Đã đồng bộ qua /api/v1/seo:', JSON.stringify(apiRes));
  }
}

async function cmdGscAuth() {
  const status = getConfigStatus();
  if (!status.configFound) {
    console.error('Chưa tìm thấy google_client_secret.json.');
    console.error('Đặt file OAuth Client Secret (Desktop app) tại một trong hai đường dẫn:');
    for (const p of status.searchedPaths.config) console.error(`  - ${p}`);
    console.error('\nHoặc cấu hình Service Account trên Cloudflare Worker bằng lệnh:');
    console.error('  npx wrangler secret put GSC_SERVICE_ACCOUNT_JSON');
    process.exit(1);
  }
  const res = spawnSync(process.execPath, [path.join(AK_SEO_SCRIPTS, 'gsc-auth.cjs'), '--auth'], {
    stdio: 'inherit',
    shell: false,
  });
  process.exit(res.status ?? 1);
}

async function cmdGscSync() {
  const site = getOpt('--site', 'sc-domain:tqd.me');
  const days = Math.max(1, Math.min(90, Number(getOpt('--days', '28')) || 28));
  const sa = loadServiceAccountConfig();
  let normalized = [];

  if (sa) {
    const token = await getServiceAccountToken(sa);
    const endDate = todayIso();
    const startMs = Date.parse(`${endDate}T00:00:00Z`) - (days - 1) * 86_400_000;
    const startDate = new Date(startMs).toISOString().slice(0, 10);
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['date', 'query', 'page'],
        rowLimit: 2500,
        dataState: 'all',
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`GSC Service Account query thất bại (${res.status}): ${text.slice(0, 300)}`);
      process.exit(1);
    }
    const payload = await res.json();
    normalized = (payload.rows || [])
      .filter((r) => Array.isArray(r.keys) && r.keys.length >= 2)
      .map((r) => ({
        day: r.keys[0] || endDate,
        query: r.keys[1] || '',
        page: r.keys[2] || '',
        clicks: Number(r.clicks || 0),
        impressions: Number(r.impressions || 0),
        ctr: Number(r.ctr || 0),
        position: Number(r.position || 0),
      }));
  } else {
    const status = getConfigStatus();
    if (!status.configFound || !status.tokenFound) {
      console.error(
        'Chưa xác thực Google Search Console (cần .secrets/gsc-service-account.json hoặc chạy `npm run seo:gsc:auth` trước).',
      );
      process.exit(1);
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tqd-gsc-'));
    const outJson = path.join(tmpDir, 'gsc.json');

    const res = spawnSync(
      process.execPath,
      [
        path.join(AK_SEO_SCRIPTS, 'gsc-query.cjs'),
        '--top-queries',
        '-s',
        site,
        '--days',
        String(days),
        '--format',
        'json',
        '-o',
        outJson,
      ],
      { encoding: 'utf8', shell: false },
    );

    if (res.status !== 0) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.error(res.stderr || res.stdout || 'gsc-query failed');
      process.exit(1);
    }

    const rawRows = JSON.parse(fs.readFileSync(outJson, 'utf8'));
    fs.rmSync(tmpDir, { recursive: true, force: true });

    const day = todayIso();
    normalized = (Array.isArray(rawRows) ? rawRows : []).map((r) => {
      const rawCtr = typeof r.ctr === 'string' && r.ctr.endsWith('%') ? parseFloat(r.ctr) / 100 : Number(r.ctr || 0);
      return {
        day,
        query: String(r.query || r.keys?.[0] || ''),
        page: String(r.page || ''),
        clicks: Number(r.clicks || 0),
        impressions: Number(r.impressions || 0),
        ctr: Number.isFinite(rawCtr) ? rawCtr : 0,
        position: Number(r.position || 0),
      };
    });
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportFile = path.join(REPORT_DIR, `${todayIso()}-gsc-queries.json`);
  fs.writeFileSync(reportFile, JSON.stringify(normalized, null, 2), 'utf8');
  console.log(`Đã xuất ${normalized.length} dòng Search Console tại ${reportFile}`);

  if (hasFlag('--sync-local') || hasFlag('--sync-remote')) {
    const sql = buildGscUpsertSql(site, normalized);
    if (sql) runLocalD1Sql(sql, hasFlag('--sync-remote'));
    console.log(`Đã nạp ${normalized.length} dòng GSC vào D1.`);
  }
  if (hasFlag('--sync-api')) {
    const apiRes = await syncViaApi({ siteUrl: site, gscRows: normalized });
    console.log('Đã đồng bộ GSC qua /api/v1/seo:', JSON.stringify(apiRes));
  }
}

function buildBriefsUpsertSql(briefs, liveSlugs) {
  const lines = [];
  for (const item of briefs) {
    const briefStatus = liveSlugs.has(item.slug) ? 'published' : 'queued';
    const pubAtSql = briefStatus === 'published' ? "datetime('now')" : 'NULL';
    lines.push(
      `INSERT INTO seo_daily_briefs (day_order, pillar, slug, title, primary_keyword, secondary_keywords_json, geo_questions_json, answer_capsule_hint, sections_json, table_spec, eeat_anchor, internal_links_json, cta_path, analogy, fb_angle, status, published_at) VALUES (${sqlVal(item.dayOrder)}, ${sqlVal(item.pillar)}, ${sqlVal(item.slug)}, ${sqlVal(item.title)}, ${sqlVal(item.primaryKeyword)}, ${sqlVal(JSON.stringify(item.secondaryKeywords))}, ${sqlVal(JSON.stringify(item.geoQuestions))}, ${sqlVal(item.answerCapsuleHint)}, ${sqlVal(JSON.stringify(item.sections))}, ${sqlVal(item.tableSpec)}, ${sqlVal(item.eeatAnchor)}, ${sqlVal(JSON.stringify(item.internalLinks))}, ${sqlVal(item.ctaPath)}, ${sqlVal(item.analogy)}, ${sqlVal(item.fbAngle)}, ${sqlVal(briefStatus)}, ${pubAtSql}) ON CONFLICT(slug) DO UPDATE SET day_order = CASE WHEN seo_daily_briefs.status = 'queued' THEN excluded.day_order ELSE seo_daily_briefs.day_order END, pillar = excluded.pillar, title = excluded.title, primary_keyword = excluded.primary_keyword, secondary_keywords_json = excluded.secondary_keywords_json, geo_questions_json = excluded.geo_questions_json, answer_capsule_hint = excluded.answer_capsule_hint, sections_json = excluded.sections_json, table_spec = excluded.table_spec, eeat_anchor = excluded.eeat_anchor, internal_links_json = excluded.internal_links_json, cta_path = excluded.cta_path, analogy = excluded.analogy, fb_angle = excluded.fb_angle, status = CASE WHEN excluded.status = 'published' THEN 'published' ELSE seo_daily_briefs.status END, published_at = COALESCE(seo_daily_briefs.published_at, excluded.published_at), updated_at = datetime('now');`,
    );
  }
  return lines.join('\n');
}

async function cmdSeed() {
  const queuePath = path.resolve(process.cwd(), 'plans/seo-aeo-queue.json');
  const payload = fs.existsSync(queuePath) ? JSON.parse(fs.readFileSync(queuePath, 'utf8')) : { articles: [] };
  const liveSlugs = new Set();
  try {
    const res = await fetch('https://tqd.me/search.json', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const docs = await res.json();
      for (const d of docs) {
        if (typeof d?.url === 'string' && d.url.startsWith('/bai-viet/')) {
          liveSlugs.add(d.url.slice('/bai-viet/'.length));
        }
      }
    }
  } catch {
    // fallback if offline
  }

  const items = [];
  for (const brief of DAILY_BRIEF_CATALOG) {
    const st = liveSlugs.has(brief.slug) ? 'published' : 'planned';
    const cluster = PILLAR_LABELS[brief.pillar] || brief.pillar;
    items.push({
      keyword: brief.primaryKeyword,
      cluster,
      intent: classifyVietnameseIntent(brief.primaryKeyword),
      priority: 'high',
      status: st,
      source: 'seo-daily-catalog',
      targetSlug: brief.slug,
      suggestedTitle: brief.title,
      notes: brief.answerCapsuleHint,
    });
    for (const secKw of brief.secondaryKeywords) {
      items.push({
        keyword: secKw,
        cluster,
        intent: classifyVietnameseIntent(secKw),
        priority: 'medium',
        status: st,
        source: 'seo-daily-catalog',
        targetSlug: brief.slug,
        suggestedTitle: brief.title,
        notes: brief.analogy,
      });
    }
  }

  if (payload.hubSlug && payload.hubTitle) {
    items.push({
      keyword: 'từ điển AI và AI Agent cho người không biết lập trình',
      cluster: 'Trụ cột (Hub)',
      intent: 'informational',
      priority: 'high',
      status: liveSlugs.has(payload.hubSlug) ? 'published' : 'planned',
      source: 'seo-aeo-queue',
      targetSlug: payload.hubSlug,
      suggestedTitle: payload.hubTitle,
      notes: 'Bài tổng hợp trụ cột nối toàn bộ chủ đề AI Agent.',
    });
  }
  for (const article of payload.articles || []) {
    const st = liveSlugs.has(article.slug) ? 'published' : 'planned';
    (article.targetKeywords || []).forEach((kw, idx) => {
      items.push({
        keyword: kw,
        cluster: article.stage || 'Lộ trình AI Agent',
        intent: classifyVietnameseIntent(kw),
        priority: idx === 0 ? 'high' : 'medium',
        status: st,
        source: 'seo-aeo-queue',
        targetSlug: article.slug,
        suggestedTitle: article.title,
        notes: article.analogy || '',
      });
    });
  }

  if (hasFlag('--sync-local') || hasFlag('--sync-remote')) {
    const briefsSql = buildBriefsUpsertSql(DAILY_BRIEF_CATALOG, liveSlugs);
    const kwSql = buildKeywordsUpsertSql(items);
    const purgeSql =
      "DELETE FROM seo_keywords WHERE status = 'planned' AND source IN ('google-suggest-vn', 'keyword-lab') AND (keyword_norm LIKE '% voz%' OR keyword_norm LIKE '% viblo%' OR keyword_norm LIKE '%crypto%' OR keyword_norm LIKE '%github%');";
    const fullSql = [purgeSql, briefsSql, kwSql].filter(Boolean).join('\n');
    runLocalD1Sql(fullSql, hasFlag('--sync-remote'));
    console.log(
      `Đã đồng bộ ${DAILY_BRIEF_CATALOG.length} đề bài hàng ngày và ${items.length} từ khóa vào D1 (${hasFlag('--sync-remote') ? 'remote' : 'local'}).`,
    );
  }
  if (hasFlag('--sync-api')) {
    const apiRes = await syncViaApi({ keywords: items });
    console.log('Đã đồng bộ qua /api/v1/seo:', JSON.stringify(apiRes));
  }
  if (!hasFlag('--sync-local') && !hasFlag('--sync-remote') && !hasFlag('--sync-api')) {
    console.log(
      `Sẵn sàng ${DAILY_BRIEF_CATALOG.length} đề bài SEO+GEO (5 trụ cột) và ${items.length} từ khóa. Thêm --sync-local hoặc --sync-remote để nạp vào D1.`,
    );
  }
}

async function cmdSetReviewWebKey() {
  const key = await readHiddenLine('Nhập REVIEWWEB_API_KEY (không hiện ký tự): ');
  if (!key || key.length < 8 || /\s/.test(key)) {
    console.error('REVIEWWEB_API_KEY không hợp lệ.');
    process.exit(1);
  }

  const skillEnvPath = path.join(os.homedir(), '.claude', 'skills', 'seo', '.env');
  const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
  upsertEnvFile(skillEnvPath, 'REVIEWWEB_API_KEY', key);
  upsertEnvFile(devVarsPath, 'REVIEWWEB_API_KEY', key);
  console.log('Đã lưu REVIEWWEB_API_KEY vào ~/.claude/skills/seo/.env và .dev.vars (quyền 0600).');

  if (!hasFlag('--local-only')) {
    for (const workerName of ['tqd-website', 'tqd-next']) {
      const res = spawnSync(
        npxBin,
        ['wrangler', 'secret', 'put', 'REVIEWWEB_API_KEY', '--name', workerName],
        { input: key, encoding: 'utf8', shell: false },
      );
      if (res.status !== 0) {
        console.error(`Gắn secret lên ${workerName} thất bại: ${res.stderr || res.stdout}`);
        process.exit(1);
      }
      console.log(`Đã gắn REVIEWWEB_API_KEY lên Cloudflare Worker ${workerName}.`);
    }
  }
}

async function cmdAudit() {
  const baseUrl = (firstPositional || 'https://tqd.me').replace(/\/+$/, '');
  const pagesToCheck = ['/', '/tai-video', '/shop', '/bai-viet'];
  const schemaResults = [];

  for (const p of pagesToCheck) {
    try {
      const res = await fetch(`${baseUrl}${p}`, { signal: AbortSignal.timeout(8000) });
      const html = await res.text();
      const match = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
      if (!match) {
        schemaResults.push({ path: p, status: res.status, schemaOk: false, note: 'Không thấy JSON-LD' });
        continue;
      }
      const rawJsonLd = JSON.parse(match[1]);
      const nodes = Array.isArray(rawJsonLd?.['@graph'])
        ? rawJsonLd['@graph'].map((node) => ({ '@context': rawJsonLd['@context'] || 'https://schema.org', ...node }))
        : [rawJsonLd];

      let allOk = true;
      const notes = [];
      for (const node of nodes) {
        const val = spawnSync(
          process.execPath,
          [path.join(AK_SEO_SCRIPTS, 'validate-schema.cjs')],
          { input: JSON.stringify(node), encoding: 'utf8', shell: false },
        );
        const typeLabel = node['@type'] || 'Unknown';
        if (val.status !== 0) {
          allOk = false;
          notes.push(`${typeLabel}: ${(val.stdout || val.stderr || '').trim().split('\n')[0]}`);
        } else {
          notes.push(typeLabel);
        }
      }
      schemaResults.push({
        path: p,
        status: res.status,
        schemaOk: allOk,
        note: allOk ? `Hợp lệ (${notes.join(', ')})` : notes.join('; '),
      });
    } catch (err) {
      schemaResults.push({
        path: p,
        status: 'ERR',
        schemaOk: false,
        note: err instanceof Error ? err.message : 'Lỗi kết nối',
      });
    }
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, `${todayIso()}-tqd.me-audit.md`);
  const md = [
    `# Kiểm tra nhanh SEO & Schema: ${baseUrl}`,
    '',
    `- **Ngày:** ${todayIso()}`,
    '',
    '| Trang | HTTP | JSON-LD | Ghi chú |',
    '|---|---:|---|---|',
    ...schemaResults.map((r) => `| \`${r.path}\` | ${r.status} | ${r.schemaOk ? 'OK' : 'Cảnh báo'} | ${r.note} |`),
    '',
  ].join('\n');
  fs.writeFileSync(reportPath, md, 'utf8');
  console.log(`Đã lưu báo cáo kiểm tra schema: ${reportPath}`);

  const snapshotPayload = {
    checkedAt: new Date().toISOString(),
    baseUrl,
    schemaResults,
  };
  if (hasFlag('--sync-local') || hasFlag('--sync-remote')) {
    runLocalD1Sql(
      `INSERT INTO seo_snapshots (key, value_json, updated_at) VALUES ('seo_audit_latest', ${sqlVal(JSON.stringify(snapshotPayload))}, datetime('now')) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = datetime('now');`,
      hasFlag('--sync-remote'),
    );
  }
  if (hasFlag('--sync-api')) {
    await syncViaApi({ snapshot: { key: 'seo_audit_latest', data: snapshotPayload } });
  }
}

try {
  if (command === 'status') await cmdStatus();
  else if (command === 'keywords') await cmdKeywords();
  else if (command === 'gsc-auth') await cmdGscAuth();
  else if (command === 'gsc-sync') await cmdGscSync();
  else if (command === 'audit') await cmdAudit();
  else if (command === 'seed') await cmdSeed();
  else if (command === 'set-reviewweb-key') await cmdSetReviewWebKey();
  else {
    console.error(
      `Lệnh không hợp lệ: ${command}. Dùng: status | keywords | gsc-auth | gsc-sync | audit | seed | set-reviewweb-key`,
    );
    process.exit(2);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
