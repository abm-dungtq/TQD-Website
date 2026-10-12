// Checks the stats page shows the headline numbers from the summary.
import fs from 'node:fs';
import path from 'node:path';

const t = fs.readFileSync(path.resolve('dist', 'so-lieu.html'), 'utf8');
const need = ['>71<', '>13<', '>11<', '73K', '10/07/2026'];
const miss = need.filter((s) => !t.includes(s));
if (miss.length) {
  console.log('MISSING', miss);
  process.exit(1);
}
console.log('OK stats');
