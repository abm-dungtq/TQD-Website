import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { rollupSiteDay } from '../../../lib/analytics/rollup';
import {
  assertValidSite,
  assertValidVnDay,
  getVnDayOffset,
} from '../../../lib/analytics/wae-client';

export const prerender = false;

const MAX_DAYS_PER_REQUEST = 2;

function addDaysToVnDay(vnDay: string, deltaDays: number): string {
  const ms = Date.parse(`${vnDay}T00:00:00Z`) + deltaDays * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export const POST: APIRoute = async (context) => {
  if (!context.locals.admin) {
    return new Response('Unauthorized', { status: 401 });
  }

  let site = 'tuvi.tqd.me';
  let rangeDays = 7;
  let fromDay = getVnDayOffset(1);
  let toDay = getVnDayOffset(0);

  try {
    const form = await context.request.formData();
    const rawSite = String(form.get('site') ?? 'tuvi.tqd.me').trim();
    const rawRange = Number(form.get('range') ?? '7');
    const rawFrom = String(form.get('fromDay') ?? '').trim();
    const rawTo = String(form.get('toDay') ?? '').trim();

    assertValidSite(rawSite);
    site = rawSite;
    if ([1, 7, 30, 90, 365].includes(rawRange)) {
      rangeDays = rawRange;
    }

    if (rawFrom) {
      assertValidVnDay(rawFrom);
      fromDay = rawFrom;
    }
    if (rawTo) {
      assertValidVnDay(rawTo);
      toDay = rawTo;
    }
  } catch {
    return new Response('Invalid site or date parameters', { status: 400 });
  }

  if (fromDay > toDay) {
    const tmp = fromDay;
    fromDay = toDay;
    toDay = tmp;
  }

  if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_TOKEN) {
    return context.redirect(
      `/admin/thong-ke?site=${encodeURIComponent(site)}&range=${rangeDays}&rollup=missing_token`,
      303,
    );
  }

  const daysToProcess: string[] = [];
  let cursor = fromDay;
  while (cursor <= toDay && daysToProcess.length < MAX_DAYS_PER_REQUEST) {
    daysToProcess.push(cursor);
    cursor = addDaysToVnDay(cursor, 1);
  }

  const waeConfig = {
    accountId: env.CF_ACCOUNT_ID,
    apiToken: env.CF_ANALYTICS_TOKEN,
  };

  try {
    for (const d of daysToProcess) {
      await rollupSiteDay(env.DB, waeConfig, site, d);
    }
  } catch {
    return context.redirect(
      `/admin/thong-ke?site=${encodeURIComponent(site)}&range=${rangeDays}&rollup=error`,
      303,
    );
  }

  if (cursor <= toDay) {
    return context.redirect(
      `/admin/thong-ke?site=${encodeURIComponent(site)}&range=${rangeDays}&rollup=partial&nextFrom=${encodeURIComponent(cursor)}&to=${encodeURIComponent(toDay)}`,
      303,
    );
  }

  return context.redirect(
    `/admin/thong-ke?site=${encodeURIComponent(site)}&range=${rangeDays}&rollup=ok`,
    303,
  );
};
