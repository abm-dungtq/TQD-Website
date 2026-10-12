import { sections } from '../data/profile';

const SITE = 'https://tqd.io.vn';
const LASTMOD = '2026-10-12';

export const GET = () => {
  const urls = [`${SITE}/`, ...sections.map((s) => `${SITE}/${s.id}`)];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${u}</loc><lastmod>${LASTMOD}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
