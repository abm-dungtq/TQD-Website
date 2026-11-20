import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError, jsonResponse, readBodyCapped, requireKey } from '../../../../lib/api';
import {
  getNextDailyBrief,
  listDailyBriefQueue,
  setBriefStatusBySlug,
} from '../../../../lib/seo/briefs';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const key = await requireKey(context, 'articles:write');
  if (key instanceof Response) return key;

  const sp = context.url.searchParams;
  const pillar = sp.get('pillar')?.trim() || undefined;
  const listMode = sp.get('list') === '1' || sp.get('list') === 'true';

  if (listMode) {
    const status = sp.get('status')?.trim() || undefined;
    const queue = await listDailyBriefQueue(env.DB, { pillar, status });
    return jsonResponse(queue);
  }

  const brief = await getNextDailyBrief(env.DB, { pillar });
  return jsonResponse({ done: !brief, claimed: false, brief });
};

export const POST: APIRoute = async (context) => {
  const key = await requireKey(context, 'articles:write');
  if (key instanceof Response) return key;

  const raw = await readBodyCapped(context.request, 32_000);
  if (raw === null) {
    return apiError(413, 'payload_too_large', 'Body vượt quá 32 KB.');
  }

  let body: Record<string, unknown> = {};
  if (raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return apiError(400, 'invalid_payload', 'Body phải là JSON object.');
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return apiError(400, 'invalid_json', 'Body phải là JSON hợp lệ.');
    }
  }

  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const action = typeof body.action === 'string' ? body.action.trim() : '';

  if (slug && (action === 'release' || action === 'skip' || action === 'queue')) {
    const ok = await setBriefStatusBySlug(env.DB, slug, action);
    return jsonResponse({ ok, slug, action });
  }

  const pillar = typeof body.pillar === 'string' ? body.pillar.trim() : undefined;
  const brief = await getNextDailyBrief(env.DB, { pillar, claimBy: key.name });
  return jsonResponse({ done: !brief, claimed: Boolean(brief), brief });
};
