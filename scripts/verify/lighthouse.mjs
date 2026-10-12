// Checks saved Lighthouse reports score at least 0.9 for performance and accessibility.
import fs from 'node:fs';

let failed = false;
for (const file of ['.lighthouse-home.json', '.lighthouse-san-pham.json']) {
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const scores = Object.fromEntries(Object.entries(report.categories).map(([k, v]) => [k, v.score]));
  const ok = scores.performance >= 0.9 && scores.accessibility >= 0.9;
  if (!ok) failed = true;
  console.log(ok ? 'OK' : 'LOW', file, JSON.stringify(scores));
}
process.exit(failed ? 1 : 0);
