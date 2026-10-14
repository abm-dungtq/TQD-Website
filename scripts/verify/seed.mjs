// Checks that D1 holds every piece of seeded content (migrations 0002 and 0003). Usage: node scripts/verify/seed.mjs [--remote]
import { execFileSync } from 'node:child_process';

const target = process.argv.includes('--remote') ? '--remote' : '--local';

function query(sql) {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'tqd_db', target, '--json', '--command', `"${sql}"`], {
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: 'b243f38bff984ce1741c379547e97a75' },
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(out.slice(out.indexOf('[')))[0].results;
}

const fails = [];
const items = query('SELECT kind, title FROM items');
const count = (kind) => items.filter((i) => i.kind === kind).length;
// Products and videos grow through the admin after seeding; the training section was removed.
for (const [kind, min] of [['product', 6], ['video', 5]]) {
  if (count(kind) < min) fails.push(`${kind} count ${count(kind)} < ${min}`);
}
if (count('training') !== 0) fails.push(`training count ${count('training')} != 0`);

const titles = [
  'Viết Pro', 'Điều phối nhiều model', '3 nhân sự số', 'Agent tự dựng video', 'Thư viện prompt tạo ảnh',
  'App dọn dẹp và tối ưu macOS', 'Short drama với FLUX 3', 'Video 20 giây từ một prompt',
  'Chuỗi video làm 100% bằng AI', 'Thử Omni 1.1', 'Video AI kiểm soát ổn định',
];
const have = new Set(items.map((i) => i.title));
for (const t of titles) if (!have.has(t)) fails.push(`missing title ${t}`);

const settings = Object.fromEntries(query('SELECT key, value FROM settings').map((r) => [r.key, r.value]));
try {
  const stats = JSON.parse(settings.stats);
  const values = stats.headline.map((h) => h.value).join(',');
  if (values !== '71,13,11,73K') fails.push(`stats headline ${values}`);
  const groups = stats.byGroup.map((g) => g.count).join(',');
  if (groups !== '9,5,5,17,35') fails.push(`stats byGroup ${groups}`);
} catch {
  fails.push('stats not parseable');
}
try {
  const person = JSON.parse(settings.person);
  if (person.email !== 'dungtq.ceo@gmail.com') fails.push('person email');
  if (person.zalo !== 'https://zalo.me/trinhquangdung') fails.push('person zalo');
} catch {
  fails.push('person not parseable');
}
try {
  const ids = JSON.parse(settings.sections).map((s) => s.id);
  if (!ids.includes('bai-viet') || !ids.includes('thu-vien') || ids.includes('chuyen-mon') || ids.includes('dao-tao')) fails.push(`sections ${ids.join(',')}`);
} catch {
  fails.push('sections not parseable');
}

for (const f of fails) console.log('FAIL', f);
console.log(fails.length ? 'BAD seed' : 'OK seed');
process.exit(fails.length ? 1 : 0);
