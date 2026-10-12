// Checks the built sitemap lists the home page plus the 7 section pages.
import fs from 'node:fs';
import path from 'node:path';

const xml = fs.readFileSync(path.resolve('dist', 'sitemap.xml'), 'utf8');
const count = (xml.match(/<loc>/g) ?? []).length;
console.log(count === 8 ? 'OK' : 'LOC', count);
process.exit(count === 8 ? 0 : 1);
