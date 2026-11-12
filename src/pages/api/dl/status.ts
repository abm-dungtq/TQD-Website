// GET /api/dl/status: checks Home Daemon reachability and returns caller tier (public vs admin) + limits.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { jsonResponse } from '../../../lib/api';
import { COOKIE } from '../../../lib/auth';
import { daemonOnline, resolveDlTier, TIER_LIMITS } from '../../../lib/dl';

export const GET: APIRoute = async ({ request, cookies }) => {
  const tier = await resolveDlTier(
    env.DB,
    cookies.get(COOKIE)?.value,
    request.headers.get('Authorization'),
  );
  const baseUrl = env.DL_BASE_URL;
  const apiKey = env.DL_API_KEY;
  const health =
    apiKey && baseUrl
      ? await daemonOnline(baseUrl, apiKey)
      : { online: false, version: undefined };

  return jsonResponse({
    online: health.online,
    ...(tier === 'admin' && health.version ? { version: health.version } : {}),
    tier,
    limits: TIER_LIMITS[tier],
  });
};
