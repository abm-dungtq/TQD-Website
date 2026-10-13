// GET /api/chat/status: whether the chatbot agent can answer right now.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { jsonResponse } from '../../../lib/api';
import { goclawOnline } from '../../../lib/chat';

export const GET: APIRoute = async () => {
  const baseUrl = env.GOCLAW_BASE_URL;
  const online = Boolean(env.GOCLAW_API_KEY && baseUrl) && (await goclawOnline(baseUrl));
  return jsonResponse({ online });
};
