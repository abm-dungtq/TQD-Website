import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clearCookieHeader, COOKIE, destroySession } from '../../lib/auth';
import { logSecurityEvent } from '../../lib/security-log';

export const POST: APIRoute = async ({ request, cookies }) => {
  await destroySession(env.DB, cookies.get(COOKIE)?.value);
  await logSecurityEvent('admin.logout', {}, request);
  return new Response(null, { status: 303, headers: { Location: '/admin/login', 'Set-Cookie': clearCookieHeader() } });
};
