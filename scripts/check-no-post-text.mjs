// Fails when any Facebook post text from the source export appears in the build output.
// Usage: node scripts/check-no-post-text.mjs [path-to-portfolio-ai-3-thang.json]
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SOURCE = 'D:/TQD/tqd-browser/automation_data/portfolio/portfolio-ai-3-thang.json';
const WINDOW = 60;
const STEP = 20;
const MIN_LENGTH = 30;
const EXTENSIONS = new Set(['.html', '.md', '.txt', '.xml', '.js']);

const source = process.argv[2] ?? DEFAULT_SOURCE;
if (!fs.existsSync(source)) {
  console.log('SOURCE_MISSING', source);
  process.exit(2);
}

const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const normalize = (text) =>
  text
    .normalize('NFC')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39);/g, (m) => entities[m])
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });

const outDir = path.resolve('dist');
const haystack = walk(outDir)
  .map((file) => normalize(fs.readFileSync(file, 'utf8')))
  .join('\n');

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
console.log(`OK no post text (${checked})`);
