// Worker entry: Astro handles HTTP; the cron trigger runs the nightly D1 backup and limit cleanup.
import { handle } from '@astrojs/cloudflare/handler';

export default {
  fetch: handle,
  async scheduled(_controller, env, ctx) {
    const { runBackup } = await import('./lib/backup');
    const { cleanupChatLimits } = await import('./lib/chat');
    ctx.waitUntil(runBackup(env));
    ctx.waitUntil(cleanupChatLimits(env.DB));
  },
} satisfies ExportedHandler<Env>;
