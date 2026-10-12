// Writes hashes of 60-character windows (step 20) of each Facebook post to src/data/fb-fingerprints.json.
// The file holds hashes only, never post text. Usage: node scripts/make-fb-fingerprints.mjs [source.json]
import fs from 'node:fs';
import { normalizeText, windowHash } from '../src/lib/normalize-text.ts';

const SOURCE = process.argv[2] ?? 'D:/TQD/tqd-browser/automation_data/portfolio/portfolio-ai-3-thang.json';
const OUT = 'src/data/fb-fingerprints.json';
const WINDOW = 60;
const STEP = 20;

if (!fs.existsSync(SOURCE)) {
  console.log('SOURCE_MISSING', SOURCE);
  process.exit(2);
}

const hashes = new Set();
for (const post of JSON.parse(fs.readFileSync(SOURCE, 'utf8'))) {
  const text = normalizeText(post.text ?? '');
  if (text.length < WINDOW) continue;
  for (let i = 0; i + WINDOW <= text.length; i += STEP) hashes.add(windowHash(text.slice(i, i + WINDOW)));
}
fs.writeFileSync(OUT, JSON.stringify([...hashes].sort()) + '\n');
console.log(`wrote ${hashes.size} fingerprints`);
