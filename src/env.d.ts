/// <reference types="astro/client" />
/// <reference types="@astrojs/cloudflare/types.d.ts" />

declare namespace App {
  interface Locals {
    admin?: boolean;
  }
}

/** Set per build in astro.config.mjs. */
declare const __BUILD_ID__: string;
