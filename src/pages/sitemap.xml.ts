import { env } from 'cloudflare:workers';
import { getSite, lastModified, listArticles } from '../lib/content';

const SITE = 'https://tqd.io.vn';

export const GET = async () => {
  const [site, articles, lastmod] = await Promise.all([getSite(env.DB), listArticles(env.DB), lastModified(env.DB)]);
  const urls = [
    { loc: `${SITE}/`, lastmod },
    ...site.sections.map((s) => ({ loc: `${SITE}/${s.id}`, lastmod })),
    ...articles.map((a) => ({ loc: `${SITE}/bai-viet/${a.slug}`, lastmod: a.updatedAt.slice(0, 10) })),
  ];
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
