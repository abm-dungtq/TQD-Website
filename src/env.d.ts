/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/types.d.ts" />

/** Secrets set with `wrangler secret put`; `wrangler types` only sees vars. */
declare namespace Cloudflare {
  interface Env {
    GOCLAW_API_KEY?: string;
    DL_API_KEY?: string;
    DL_HMAC_SECRET?: string;
    OPENCODE_GO_API_KEY?: string;
    ANALYTICS_SALT?: string;
    CF_ANALYTICS_TOKEN?: string;
    /** Only referenced by `tools/build-assets/site` (the UI asset builder); not used by the tooling Worker. */
    BACKUP_ENCRYPTION_KEY?: string;
    GA4_MEASUREMENT_ID?: string;
    CLARITY_PROJECT_ID?: string;
    GOOGLE_SITE_VERIFICATION?: string;
  }
}
interface Env extends Cloudflare.Env {}

/** Set per build in astro.config.mjs. */
declare const __BUILD_ID__: string;
