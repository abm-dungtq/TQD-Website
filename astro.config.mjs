// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://tqd.io.vn',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  trailingSlash: 'never',
  // Inline the small CSS bundles so the first paint needs no extra request.
  build: { format: 'file', inlineStylesheets: 'always' },
  // Self-hosted fonts (no render-blocking request to Google), with a size-adjusted fallback.
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Be Vietnam Pro',
      cssVariable: '--font-be-vietnam-pro',
      weights: [400, 600, 700],
      styles: ['normal'],
      subsets: ['latin', 'vietnamese'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.google(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains-mono',
      weights: [500],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
    // Part of the page cache key, so a deploy never serves HTML rendered by the previous build.
    define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  },
});
