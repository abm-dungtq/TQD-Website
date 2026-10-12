// Checks that public HTML is served from the Cache API. Usage: node scripts/verify/cache.mjs <base-url>
const base = (process.argv[2] ?? 'https://tqd.io.vn').replace(/\/$/, '');
const seen = [];
for (let i = 0; i < 3; i += 1) {
  if (i) await new Promise((resolve) => setTimeout(resolve, 1000));
  const res = await fetch(`${base}/san-pham`);
  await res.arrayBuffer();
  seen.push({ cache: res.headers.get('x-cache'), version: res.headers.get('x-content-version') });
}
const hitAfterFirst = seen.slice(1).some((s) => s.cache === 'HIT');
const sameVersion = seen.every((s) => s.version && s.version === seen[0].version);
console.log(seen.map((s) => `${s.cache}@${s.version}`).join(' '));
if (!hitAfterFirst || !sameVersion) {
  console.log('BAD cache');
  process.exit(1);
}
console.log('OK cache');
