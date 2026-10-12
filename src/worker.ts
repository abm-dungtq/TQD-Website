// Worker entry: Astro handles HTTP; the cron trigger runs the nightly D1 backup.
import { handle } from '@astrojs/cloudflare/handler';

export default {
  fetch: handle,
  async scheduled(_controller, env, ctx) {
    const { runBackup } = await import('./lib/backup');
    ctx.waitUntil(runBackup(env));
  },
} satisfies ExportedHandler<Env>;
