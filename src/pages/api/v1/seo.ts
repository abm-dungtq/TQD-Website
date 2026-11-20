import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError, jsonResponse, readBodyCapped, requireKey } from '../../../lib/api';
import { getGscSiteUrl } from '../../../lib/seo/gsc-client';
import {
  type GscDailyRow,
  loadSeoDashboard,
  saveSeoSnapshot,
  type SeoKeywordInput,
  upsertGscDailyRows,
  upsertSeoKeywords,
} from '../../../lib/seo/store';

export const prerender = false;

const MAX_BODY_BYTES = 512_000;

export const GET: APIRoute = async (context) => {
  const key = await requireKey(context);
  if (key instanceof Response) return key;

  const url = context.url;
  const siteUrl = url.searchParams.get('site')?.trim() || getGscSiteUrl(env);
  const rangeDays = Number(url.searchParams.get('range') ?? '28');
  const statusFilter = url.searchParams.get('status')?.trim() || 'all';

  const dash = await loadSeoDashboard(env.DB, {
    siteUrl,
    rangeDays,
    statusFilter,
  });

  return jsonResponse({
    siteUrl: dash.siteUrl,
    rangeDays: dash.rangeDays,
    totalKeywords: dash.totalKeywords,
    countsByStatus: dash.countsByStatus,
    gscTotals: dash.gscTotals,
    priorityKeywords: dash.keywords.slice(0, 100),
    lowCtrOpportunities: dash.lowCtrOpportunities,
    topQueries: dash.topQueries,
    snapshots: {
      gsc: dash.gscSnapshot,
      audit: dash.auditSnapshot,
    },
  });
};

export const POST: APIRoute = async (context) => {
  const key = await requireKey(context, 'seo:write');
  if (key instanceof Response) return key;

  const rawBody = await readBodyCapped(context.request, MAX_BODY_BYTES);
  if (rawBody === null) {
    return apiError(413, 'payload_too_large', 'Dữ liệu gửi lên vượt quá giới hạn 512 KB.');
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody || '{}');
  } catch {
    return apiError(400, 'invalid_json', 'Body phải là JSON hợp lệ.');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return apiError(400, 'invalid_payload', 'Payload phải là JSON object.');
  }

  const payload = body as {
    siteUrl?: unknown;
    keywords?: unknown;
    gscRows?: unknown;
    snapshot?: unknown;
  };

  const siteUrl =
    typeof payload.siteUrl === 'string' && payload.siteUrl.trim()
      ? payload.siteUrl.trim().slice(0, 120)
      : getGscSiteUrl(env);

  let keywordsUpserted = 0;
  if (payload.keywords !== undefined) {
    if (!Array.isArray(payload.keywords)) {
      return apiError(400, 'invalid_keywords', 'keywords phải là mảng.');
    }
    const items: SeoKeywordInput[] = payload.keywords
      .filter((k): k is Record<string, unknown> => Boolean(k) && typeof k === 'object')
      .map((k) => ({
        keyword: String(k.keyword ?? ''),
        cluster: typeof k.cluster === 'string' ? k.cluster : undefined,
        intent: typeof k.intent === 'string' ? (k.intent as SeoKeywordInput['intent']) : undefined,
        priority: typeof k.priority === 'string' ? (k.priority as SeoKeywordInput['priority']) : undefined,
        status: typeof k.status === 'string' ? (k.status as SeoKeywordInput['status']) : undefined,
        volume: k.volume as number | null | undefined,
        difficulty: k.difficulty as number | null | undefined,
        cpc: k.cpc as number | null | undefined,
        source: typeof k.source === 'string' && k.source.trim() ? k.source.trim() : `agent:${key.name}`,
        targetSlug: typeof k.targetSlug === 'string' ? k.targetSlug : null,
        suggestedTitle: typeof k.suggestedTitle === 'string' ? k.suggestedTitle : undefined,
        notes: typeof k.notes === 'string' ? k.notes : undefined,
      }));
    keywordsUpserted = await upsertSeoKeywords(env.DB, items);
  }

  let gscRowsUpserted = 0;
  if (payload.gscRows !== undefined) {
    if (!Array.isArray(payload.gscRows)) {
      return apiError(400, 'invalid_gsc_rows', 'gscRows phải là mảng.');
    }
    const rows: GscDailyRow[] = payload.gscRows
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
      .map((r) => ({
        day: String(r.day ?? ''),
        query: String(r.query ?? ''),
        page: typeof r.page === 'string' ? r.page : '',
        clicks: Number(r.clicks ?? 0),
        impressions: Number(r.impressions ?? 0),
        ctr: Number(r.ctr ?? 0),
        position: Number(r.position ?? 0),
      }));
    gscRowsUpserted = await upsertGscDailyRows(env.DB, siteUrl, rows);
  }

  let snapshotSaved = false;
  if (payload.snapshot !== undefined) {
    if (!payload.snapshot || typeof payload.snapshot !== 'object') {
      return apiError(400, 'invalid_snapshot', 'snapshot phải là object có key và data.');
    }
    const snap = payload.snapshot as { key?: unknown; data?: unknown };
    if (typeof snap.key !== 'string' || !/^[a-z0-9_-]{2,60}$/i.test(snap.key)) {
      return apiError(400, 'invalid_snapshot_key', 'snapshot.key chỉ gồm chữ, số, _ hoặc - (2–60 ký tự).');
    }
    await saveSeoSnapshot(env.DB, snap.key, snap.data ?? {});
    snapshotSaved = true;
  }

  return jsonResponse({
    ok: true,
    siteUrl,
    keywordsUpserted,
    gscRowsUpserted,
    snapshotSaved,
  });
};
