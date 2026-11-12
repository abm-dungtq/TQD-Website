import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getSite, lastModified, listArticles } from '../lib/content';

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = async ({ request }) => {
  const siteOrigin = new URL(request.url).origin;
  const [site, articles, lastmod, curatedShares] = await Promise.all([
    getSite(env.DB),
    listArticles(env.DB),
    lastModified(env.DB),
    env.DB.prepare(
      "SELECT share_id, created_at FROM viral_shares WHERE share_id LIKE 'c-%' ORDER BY created_at DESC LIMIT 100",
    )
      .all<{ share_id: string; created_at: number }>()
      .then((res) => res.results ?? [])
      .catch(() => [] as { share_id: string; created_at: number }[]),
  ]);

  const urls = [
    { loc: `${siteOrigin}/`, lastmod },
    { loc: `${siteOrigin}/tai-video`, lastmod },
    { loc: `${siteOrigin}/quyen-rieng-tu`, lastmod },
    ...site.sections.map((s) => ({ loc: `${siteOrigin}/${s.id}`, lastmod })),
    ...articles.map((a) => ({ loc: `${siteOrigin}/bai-viet/${a.slug}`, lastmod: a.updatedAt.slice(0, 10) })),
    ...curatedShares.map((sh) => ({
      loc: `${siteOrigin}/xray/${encodeURIComponent(sh.share_id)}`,
      lastmod: sh.created_at ? new Date(sh.created_at * 1000).toISOString().slice(0, 10) : lastmod,
    })),
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((u) => `  <url><loc>${escapeXml(u.loc)}</loc><lastmod>${escapeXml(u.lastmod)}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
