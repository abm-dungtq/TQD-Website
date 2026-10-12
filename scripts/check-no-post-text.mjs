// Fails when any Facebook post text from the source export appears on the public site.
// Usage: node scripts/check-no-post-text.mjs [base-url] [path-to-portfolio-ai-3-thang.json]
import fs from 'node:fs';
import { normalizeText as normalize } from '../src/lib/normalize-text.ts';

const DEFAULT_SOURCE = 'D:/TQD/tqd-browser/automation_data/portfolio/portfolio-ai-3-thang.json';
const WINDOW = 60;
const STEP = 20;
const MIN_LENGTH = 30;

const base = (process.argv[2] ?? 'http://localhost:4321').replace(/\/$/, '');
const source = process.argv[3] ?? DEFAULT_SOURCE;
if (!fs.existsSync(source)) {
  console.log('SOURCE_MISSING', source);
  process.exit(2);
}

const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const urls = new Set([...pages, '/llms.txt', '/index.md']);
for (const p of pages) if (p !== '/') urls.add(`${p}.md`);

const texts = [];
for (const p of urls) {
  const res = await fetch(base + p);
  if (!res.ok) {
    console.log('FETCH_FAIL', p, res.status);
    process.exit(2);
  }
  texts.push(normalize(await res.text()));
}
const haystack = texts.join('\n');

const posts = JSON.parse(fs.readFileSync(source, 'utf8'));
let checked = 0;
let leaks = 0;
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
console.log(`OK no post text (${checked}) over ${urls.size} urls`);
