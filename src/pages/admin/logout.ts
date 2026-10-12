import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { clearCookieHeader, COOKIE, destroySession } from '../../lib/auth';

export const POST: APIRoute = async ({ cookies }) => {
  await destroySession(env.DB, cookies.get(COOKIE)?.value);
  return new Response(null, { status: 303, headers: { Location: '/admin/login', 'Set-Cookie': clearCookieHeader() } });
};
