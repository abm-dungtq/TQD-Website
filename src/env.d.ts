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
  }
}

/** Set per build in astro.config.mjs. */
declare const __BUILD_ID__: string;
