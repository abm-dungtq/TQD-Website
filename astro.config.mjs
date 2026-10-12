// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://tqd.io.vn',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  vite: { plugins: [tailwindcss()] },
});
