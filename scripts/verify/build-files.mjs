// Checks that each named file exists in the build output folder.
// Usage: node scripts/verify/build-files.mjs index.html ho-so.html
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('dist');
const missing = process.argv.slice(2).filter((name) => !fs.existsSync(path.join(outDir, name)));
if (missing.length) {
  console.log('MISSING', missing);
  process.exit(1);
}
console.log('OK', process.argv.length - 2);
