import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { buildPublicCatalog, type CuratedShareSummary } from '../lib/catalog';
import { getVersion, loadSiteData } from '../lib/content';
import { READ_ONLY_CORS_HEADERS } from '../lib/feeds';

interface CuratedShareRow {
  share_id: string;
  title: string;
  platform_label: string;
  format_key: string;
  industry: string;
  viet_pro_score: number;
  created_at: number;
}

export const GET: APIRoute = async ({ request }) => {
  const origin = new URL(request.url).origin;
  const [data, contentVersion, shareRows] = await Promise.all([
    loadSiteData(env.DB),
    getVersion(env.DB).catch(() => undefined),
    env.DB.prepare(
      "SELECT share_id, title, platform_label, format_key, industry, viet_pro_score, created_at FROM viral_shares WHERE share_id LIKE 'c-%' ORDER BY created_at DESC LIMIT 100",
    )
      .all<CuratedShareRow>()
      .then((res) => res.results ?? [])
      .catch(() => [] as CuratedShareRow[]),
  ]);

  const curatedShares: CuratedShareSummary[] = shareRows.map((row) => ({
    shareId: String(row.share_id),
    title: String(row.title || 'Báo cáo X-Quang Viral'),
    platformLabel: String(row.platform_label || ''),
    formatKey: String(row.format_key || 'tiktok-script'),
    industry: String(row.industry || ''),
    vietProScore: Number(row.viet_pro_score) || 100,
    createdAt: Number(row.created_at) || 0,
  }));

  const catalog = buildPublicCatalog({
    siteOrigin: origin,
    data,
    curatedShares,
    contentVersion,
  });

  return new Response(JSON.stringify(catalog, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...READ_ONLY_CORS_HEADERS,
    },
  });
};

export const OPTIONS: APIRoute = () =>
  new Response(null, {
    status: 204,
    headers: READ_ONLY_CORS_HEADERS,
  });
