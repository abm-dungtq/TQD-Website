import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getSite, lastModified, listArticles } from '../lib/content';

export const GET: APIRoute = async ({ request }) => {
  const siteOrigin = new URL(request.url).origin;
  const [site, articles, lastmod] = await Promise.all([getSite(env.DB), listArticles(env.DB), lastModified(env.DB)]);
  const urls = [
    { loc: `${siteOrigin}/`, lastmod },
    ...site.sections.map((s) => ({ loc: `${siteOrigin}/${s.id}`, lastmod })),
    ...articles.map((a) => ({ loc: `${siteOrigin}/bai-viet/${a.slug}`, lastmod: a.updatedAt.slice(0, 10) })),
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
