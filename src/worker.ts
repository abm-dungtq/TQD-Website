// Worker entry: Astro handles HTTP; the cron trigger runs the nightly D1 backup and limit cleanup.
import { handle } from '@astrojs/cloudflare/handler';

// tqd.me is the canonical domain. The old tqd.io.vn and www.tqd.me redirect permanently, keeping path and query;
// writes get 308 so the method and body survive.
const CANONICAL_HOST = 'tqd.me';
const REDIRECT_HOSTS = new Set(['tqd.io.vn', 'www.tqd.io.vn', 'www.tqd.me']);

export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (REDIRECT_HOSTS.has(url.hostname)) {
      url.protocol = 'https:';
      url.hostname = CANONICAL_HOST;
      url.port = '';
      const status = request.method === 'GET' || request.method === 'HEAD' ? 301 : 308;
      return Response.redirect(url.href, status);
    }
    return handle(request, env, ctx);
  },
  async scheduled(_controller, env, ctx) {
    const { runBackup } = await import('./lib/backup');
    const { cleanupChatLimits } = await import('./lib/chat');
    const { pruneChatVisitors } = await import('./lib/chat-stats');
    ctx.waitUntil(runBackup(env));
    ctx.waitUntil(cleanupChatLimits(env.DB));
    ctx.waitUntil(pruneChatVisitors(env.DB));
  },
} satisfies ExportedHandler<Env>;
