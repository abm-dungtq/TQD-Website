// Checks the contact page shows email and Zalo, and the profile page shows the portrait.
import fs from 'node:fs';
import path from 'node:path';

const t = fs.readFileSync(path.resolve('dist', 'lien-he.html'), 'utf8');
const h = fs.readFileSync(path.resolve('dist', 'ho-so.html'), 'utf8');
const ok = t.includes('dungtq.ceo@gmail.com')
  && t.includes('zalo.me/trinhquangdung')
  && h.includes('alt="Chân dung Trịnh Quang Dũng"');
console.log(ok ? 'OK contact' : 'FAIL contact');
process.exit(ok ? 0 : 1);
