// Checks each section page has an h1 and readable text without running any script.
import fs from 'node:fs';
import path from 'node:path';

const ids = ['ho-so', 'san-pham', 'dao-tao', 'video-ai', 'chuyen-mon', 'so-lieu', 'lien-he'];
let ok = 0;
for (const id of ids) {
  const html = fs.readFileSync(path.resolve('dist', `${id}.html`), 'utf8');
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  if (html.includes('<h1') && text.length >= 200) ok += 1;
  else console.log('FAIL', id, text.length);
}
console.log('OK nojs', ok);
process.exit(ok === ids.length ? 0 : 1);
