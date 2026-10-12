import type { APIRoute } from 'astro';
import { jsonResponse, requireKey } from '../../../lib/api';

export const GET: APIRoute = async (context) => {
  const key = await requireKey(context);
  if (key instanceof Response) return key;
  return jsonResponse({ name: key.name, scopes: key.scopes });
};
