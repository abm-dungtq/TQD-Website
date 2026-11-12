// GET /api/dl/task/[id]?ticket=...: polls task progress on Home Daemon and issues streamTicket upon completion.
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { apiError, jsonResponse } from '../../../../lib/api';
import {
  callDaemon,
  getDlTicketSecret,
  signDlTicket,
  type TaskTicketPayload,
  verifyDlTicket,
} from '../../../../lib/dl';

const STREAM_TICKET_TTL_SEC = 10 * 60;

export const GET: APIRoute = async ({ params, url }) => {
  const taskId = params.id ?? '';
  const ticketParam = url.searchParams.get('ticket');
  const apiKey = env.DL_API_KEY;
  const baseUrl = env.DL_BASE_URL;
  const ticketSecret = getDlTicketSecret(env as { DL_HMAC_SECRET?: string; DL_API_KEY?: string });

  if (!apiKey || !baseUrl || !ticketSecret) {
    return apiError(503, 'offline', 'Máy chủ tải video đang tạm nghỉ.');
  }

  const ticket = await verifyDlTicket<TaskTicketPayload>(ticketParam, ticketSecret);
  if (!ticket || ticket.kind !== 'task' || ticket.taskId !== taskId) {
    return apiError(403, 'invalid_ticket', 'Vé theo dõi tiến độ không hợp lệ hoặc đã hết hạn.');
  }

  let upstream: Response;
  try {
    upstream = await callDaemon(baseUrl, apiKey, `/task/${encodeURIComponent(taskId)}`, { method: 'GET' }, 10_000);
  } catch {
    return apiError(503, 'offline', 'Mất kết nối tạm thời tới máy chủ tải.');
  }

  const data = (await upstream.json().catch(() => null)) as Record<string, unknown> | null;
  if (!upstream.ok || !data) {
    return apiError(upstream.status === 404 ? 404 : 502, 'task_not_found', 'Không tìm thấy tác vụ tải.');
  }

  if (data.status === 'completed') {
    const exp = Math.floor(Date.now() / 1000) + STREAM_TICKET_TTL_SEC;
    const streamTicket = await signDlTicket(
      {
        kind: 'stream',
        taskId,
        exp,
      },
      ticketSecret,
    );
    data.streamTicket = streamTicket;
    data.streamUrl = `/api/dl/stream?ticket=${encodeURIComponent(streamTicket)}`;
  }

  return jsonResponse(data);
};
