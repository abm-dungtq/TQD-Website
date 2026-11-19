/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/types.d.ts" />

declare namespace App {
  interface Locals {
    admin?: boolean;
  }
}

/** Secrets set with `wrangler secret put`; `wrangler types` only sees vars. */
declare namespace Cloudflare {
  interface Env {
    GOCLAW_API_KEY?: string;
    DL_API_KEY?: string;
    DL_HMAC_SECRET?: string;
    OPENCODE_GO_API_KEY?: string;
    ANALYTICS_SALT?: string;
    CF_ANALYTICS_TOKEN?: string;
    BACKUP_ENCRYPTION_KEY?: string;
    REVIEWWEB_API_KEY?: string;
    GSC_SERVICE_ACCOUNT_JSON?: string;
    GSC_CLIENT_ID?: string;
    GSC_CLIENT_SECRET?: string;
    GSC_REFRESH_TOKEN?: string;
    GSC_SITE_URL?: string;
  }
}

interface Env extends Cloudflare.Env {}

/** Set per build in astro.config.mjs. */
declare const __BUILD_ID__: string;
