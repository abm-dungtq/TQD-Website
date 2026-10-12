// Checks that a built file contains every given substring.
// Usage: node scripts/verify/build-contains.mjs index.html "Trịnh Quang Dũng" ...
import fs from 'node:fs';
import path from 'node:path';

const [file, ...needles] = process.argv.slice(2);
const text = fs.readFileSync(path.resolve('dist', file), 'utf8');
const missing = needles.filter((n) => !text.includes(n));
if (missing.length) {
  console.log('MISSING', file, missing);
  process.exit(1);
}
console.log('OK', file, needles.length);
