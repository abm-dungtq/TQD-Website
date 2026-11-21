// Worker entry: Astro serves the remaining tooling routes (chat, downloader, Viral Lab, X-ray, media).
// The nightly D1 backup, chat/downloader cache cleanup, analytics rollup and GSC sync moved out with the admin
// surface: this Worker no longer owns a cron trigger (see wrangler.jsonc).
import { handle } from '@astrojs/cloudflare/handler';

export default {
  fetch(request, env, ctx) {
    return handle(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
