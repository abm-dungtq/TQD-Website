// GET /api/dl/stream?ticket=...: zero-buffer passthrough stream from Home Daemon to visitor browser.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError } from '../../../lib/api';
import { getDlTicketSecret, type StreamTicketPayload, verifyDlTicket } from '../../../lib/dl';

export const GET: APIRoute = async ({ url }) => {
  const ticketParam = url.searchParams.get('ticket');
  const apiKey = env.DL_API_KEY;
  const baseUrl = env.DL_BASE_URL;
  const ticketSecret = getDlTicketSecret(env as { DL_HMAC_SECRET?: string; DL_API_KEY?: string });

  if (!apiKey || !baseUrl || !ticketSecret) {
    return apiError(503, 'offline', 'Máy chủ tải video đang tạm nghỉ.');
  }

  const ticket = await verifyDlTicket<StreamTicketPayload>(ticketParam, ticketSecret);
  if (!ticket || ticket.kind !== 'stream' || !ticket.taskId) {
    return apiError(403, 'invalid_ticket', 'Liên kết tải file không hợp lệ hoặc đã hết hạn.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl.replace(/\/$/, '')}/stream/${encodeURIComponent(ticket.taskId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
  } catch {
    return apiError(503, 'offline', 'Không thể kết nối tới máy chủ truyền file.');
  } finally {
    clearTimeout(timer);
  }

  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel().catch(() => {});
    return apiError(
      upstream.status === 404 ? 404 : 502,
      'stream_unavailable',
      'File tải đã được nhận hoặc đã tự động xóa khỏi bộ nhớ tạm.',
    );
  }

  const headers = new Headers();
  const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream';
  const disposition = upstream.headers.get('Content-Disposition');
  const contentLength = upstream.headers.get('Content-Length');

  headers.set('Content-Type', contentType);
  if (disposition) headers.set('Content-Disposition', disposition);
  if (contentLength) headers.set('Content-Length', contentLength);
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex');

  return new Response(upstream.body, {
    status: 200,
    headers,
  });
};
