#!/usr/bin/env node
/**
 * Builds every static asset the EzyPlatform pages load, into `api/v1/media/` with the `tqd-` prefix.
 *
 * Why the CSS is assembled from a compiled bundle instead of a Tailwind run: the design system
 * (`src/styles/global.css` + one `is:global` <style> per component + one Astro-scoped block whose
 * `data-astro-cid-*` hash is baked into the published markup) was removed from the working tree by
 * the edge-trimming phase. `site.compiled.css` is the exact bundle the live site serves; rebuilding
 * it with Tailwind cannot reproduce the scoped block, so this script treats it as the source of
 * truth and appends `extra.css` (hand-written additions, e.g. contact-form states).
 *
 * Sources are mirrored under `tools/build-assets/site/src/**` (recovered from HEAD). Bundle entries
 * are bundled by esbuild so each page loads one self-contained file and no `/_astro/` URL survives.
 *
 * Idempotent: running it twice produces byte-identical output.
 */
import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const media = path.join(root, 'api/v1/media');
const here = import.meta.dirname;

const FONT_RE = /"\/_astro\/fonts\/([0-9a-f]+\.woff2)"/g;
const MEDIA_FONT = '/api/v1/media/tqd-font-';

const entries = {
  'tqd-desktop.js': 'desktop.ts',
  'tqd-mobile.js': 'mobile-shell.ts',
  'tqd-effects.js': 'effects-menu.ts',
  'tqd-page-actions.js': 'page-actions.ts',
  'tqd-chat.js': 'chat-panel.ts',
  'tqd-cmdk.js': 'command-palette.ts',
  'tqd-tiktok.js': 'tiktok.ts',
  'tqd-shop.js': 'shop.ts',
  'tqd-tai-video.js': 'tai-video.ts',
  'tqd-contact.js': path.join(here, 'contact.ts'),
};

/** Rewrites asset paths that only exist on the old runtime to their media-library twins. */
const mediaPaths = {
  name: 'tqd-media-paths',
  setup(b) {
    b.onLoad({ filter: /\.(ts|tsx|mts|js)$/ }, async (args) => {
      const source = await readFile(args.path, 'utf8');
      if (!source.includes('/mascot/') && !source.includes("'/og/")) return { contents: source, loader: 'ts' };
      return {
        contents: source
          .replaceAll('/mascot/', '/api/v1/media/tqd-mascot-')
          .replaceAll("'/og/", "'/api/v1/media/tqd-og-"),
        loader: args.path.endsWith('.js') ? 'js' : 'ts',
      };
    });
  },
};

async function check(relative) {
  if (!existsSync(path.join(root, relative))) throw new Error(`missing source asset: ${relative}`);
}

async function copyMedia() {
  await mkdir(media, { recursive: true });
  // static files that already live in public/ (phase 3 did not touch them)
  await cp(path.join(root, 'public/favicon.svg'), path.join(media, 'tqd-favicon.svg'));
  await cp(path.join(root, 'public/og.png'), path.join(media, 'tqd-og.png'));
  await cp(path.join(root, 'public/og/tai-video.png'), path.join(media, 'tqd-og-tai-video.png'));
  for (const size of ['240', '480']) {
    await cp(path.join(root, `public/img/portrait-${size}.webp`), path.join(media, `tqd-portrait-${size}.webp`));
  }
  const poses = await readdir(path.join(root, 'public/mascot'));
  const present = [];
  for (const pose of poses.filter((f) => f.endsWith('.webp')).sort()) {
    await cp(path.join(root, 'public/mascot', pose), path.join(media, `tqd-mascot-${pose}`));
    present.push(pose);
  }
  return present;
}

async function fonts() {
  const fontsDir = path.join(root, 'tools/build-assets/fonts');
  await mkdir(fontsDir, { recursive: true });
  const files = (await readdir(fontsDir)).filter((f) => f.endsWith('.woff2')).sort();
  if (!files.length) {
    throw new Error(
      'no font files in tools/build-assets/fonts; download the woff2 files referenced by site.fonts.css first',
    );
  }
  for (const file of files) {
    await cp(path.join(fontsDir, file), path.join(media, `tqd-font-${file}`));
  }
  const css = await readFile(path.join(here, 'css/site.fonts.css'), 'utf8');
  // This platform build rejects CSS/JS/font uploads (Tika top-level text/* and unknown font binaries both
  // answer 400 {"fileType":"invalid"}), so the stylesheet embeds the woff2 files as data URLs and pages
  // inline it. Media copies are still written for VPS hosts that accept them.
  const embedded = css.replace(/url\("\/_astro\/fonts\/([0-9a-f]+\.woff2)"\)/g, (m, file) => {
    const data = readFileSync(path.join(fontsDir, file)).toString('base64');
    return `url("data:font/woff2;base64,${data}")`;
  });
  if (embedded.includes('/_astro/')) throw new Error('site.fonts.css still references /_astro fonts');
  return embedded;
}

async function css() {
  const compiled = await readFile(path.join(here, 'css/site.compiled.css'), 'utf8');
  // Astro inlines a per-route stylesheet, so /shop and /tai-video carry rules the index bundle lacks.
  const routes = await readFile(path.join(here, 'css/routes.css'), 'utf8');
  const extra = await readFile(path.join(here, 'css/extra.css'), 'utf8');
  if (compiled.includes('/_astro/')) throw new Error('site.compiled.css references /_astro (fonts must be externalized)');
  const out = `${await fonts()}\n${compiled}\n${routes}\n${extra}`;
  await writeFile(path.join(media, 'tqd-site.css'), out);
  return out.length;
}

async function scripts() {
  const outdir = media;
  const shared = path.join(here, 'site/src/scripts');
  for (const [out, entry] of Object.entries(entries)) {
    await build({
      entryPoints: [path.isAbsolute(entry) ? entry : path.join(shared, entry)],
      outfile: path.join(outdir, out),
      bundle: true,
      format: 'esm',
      minify: true,
      target: 'es2022',
      legalComments: 'none',
      logLevel: 'warning',
      plugins: [mediaPaths],
    });
  }
  // BaseLayout runs three modules; one bundle keeps a single request.
  await build({
    stdin: {
      contents: ["import './analytics-beacon.ts';", "import './consent.ts';", "import './webmcp.ts';", ''].join('\n'),
      resolveDir: shared,
      sourcefile: 'base.ts',
      loader: 'ts',
    },
    outfile: path.join(outdir, 'tqd-base.js'),
    bundle: true,
    format: 'esm',
    minify: true,
    target: 'es2022',
    legalComments: 'none',
    logLevel: 'warning',
    plugins: [mediaPaths],
  });
  const files = (await readdir(outdir)).filter((f) => /^tqd-.*\.js$/.test(f)).sort();
  const sizes = {};
  for (const f of files) sizes[f] = (await stat(path.join(outdir, f))).size;
  return sizes;
}

const poses = await copyMedia();
const cssBytes = await css();
const js = await scripts();
console.log(JSON.stringify({ cssBytes, poses, js }, null, 1));
