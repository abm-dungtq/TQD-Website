// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://tqd.io.vn',
  output: 'server',
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  trailingSlash: 'never',
  build: { format: 'file' },
  vite: { plugins: [tailwindcss()] },
});
