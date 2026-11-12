// Fails when any Facebook post text (raw export or SHA/cyrb53 60-char fingerprints) appears on the public site.
// Usage: node scripts/check-no-post-text.mjs [base-url] [path-to-portfolio-ai-3-thang.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeText as normalize, windowHash } from '../src/lib/normalize-text.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = 'D:/TQD/tqd-browser/automation_data/portfolio/portfolio-ai-3-thang.json';
const FINGERPRINTS_PATH = path.join(ROOT, 'src/data/fb-fingerprints.json');
const WINDOW = 60;
const STEP = 20;
const MIN_LENGTH = 30;

const explicitBase = process.argv[2];
const base = (explicitBase ?? 'http://localhost:4321').replace(/\/$/, '');
const sourceArg = process.argv[3] ?? process.env.TQD_FB_SOURCE ?? DEFAULT_SOURCE;
const hasRawSource = fs.existsSync(sourceArg);

if (!hasRawSource && !fs.existsSync(FINGERPRINTS_PATH)) {
  console.log('SOURCE_MISSING', sourceArg, 'and', FINGERPRINTS_PATH);
  process.exit(2);
}

function collectLocalSourceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'data' || entry.name === 'node_modules' || entry.name === 'dist') continue;
      collectLocalSourceFiles(full, out);
    } else if (
      /\.(astro|ts|mjs|md|sql|json)$/i.test(entry.name) &&
      !entry.name.includes('.test.') &&
      full !== FINGERPRINTS_PATH
    ) {
      out.push(full);
    }
  }
  return out;
}

let targets = [];
let targetMode = 'live';

try {
  const smRes = await fetch(`${base}/sitemap.xml`, { signal: AbortSignal.timeout(3000) });
  if (!smRes.ok) throw new Error(`sitemap status ${smRes.status}`);
  const sitemap = await smRes.text();
  const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const urls = new Set([...pages, '/llms.txt', '/index.md']);
  for (const p of pages) if (p !== '/') urls.add(`${p}.md`);

  for (const p of urls) {
    const res = await fetch(base + p, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      console.log('FETCH_FAIL', p, res.status);
      process.exit(2);
    }
    targets.push({ label: p, norm: normalize(await res.text()) });
  }
} catch (err) {
  if (explicitBase) {
    console.log('FETCH_FAIL', `${base}/sitemap.xml`, err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
  targetMode = 'offline-files';
  const files = [
    ...collectLocalSourceFiles(path.join(ROOT, 'src')),
    ...collectLocalSourceFiles(path.join(ROOT, 'migrations')),
  ];
  for (const f of files) {
    targets.push({
      label: path.relative(ROOT, f),
      norm: normalize(fs.readFileSync(f, 'utf8')),
    });
  }
}

let leaks = 0;

if (hasRawSource) {
  const haystack = targets.map((t) => t.norm).join('\n');
  const posts = JSON.parse(fs.readFileSync(sourceArg, 'utf8'));
  let checked = 0;
  for (const post of posts) {
    const text = normalize(post.text ?? '');
    if (text.length < MIN_LENGTH) continue;
    checked += 1;
    const windows = [];
    if (text.length < WINDOW) windows.push(text);
    else for (let i = 0; i + WINDOW <= text.length; i += STEP) windows.push(text.slice(i, i + WINDOW));
    for (const w of windows) {
      if (haystack.includes(w)) {
        console.log(`LEAK ${post.date} ${post.url} "${w}"`);
        leaks += 1;
      }
    }
  }
  if (leaks) process.exit(1);
  console.log(`OK no post text (${checked} raw posts) over ${targets.length} ${targetMode} targets`);
} else {
  const fingerprintSet = new Set(JSON.parse(fs.readFileSync(FINGERPRINTS_PATH, 'utf8')));
  for (const target of targets) {
    const norm = target.norm;
    for (let i = 0; i + WINDOW <= norm.length; i += 1) {
      const slice = norm.slice(i, i + WINDOW);
      if (fingerprintSet.has(windowHash(slice))) {
        console.log(`LEAK ${target.label} "${slice}"`);
        leaks += 1;
        break;
      }
    }
  }
  if (leaks) process.exit(1);
  console.log(
    `OK no post text (${fingerprintSet.size} fingerprints) over ${targets.length} ${targetMode} targets`,
  );
}
