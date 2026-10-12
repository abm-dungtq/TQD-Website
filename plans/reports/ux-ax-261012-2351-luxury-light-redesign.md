# UX/AX review and proposals — luxury + technology, light only

Date: 2026-10-12. Scope: public site tqd.io.vn (home desktop shell, phone shell, `/{mục}`, `/bai-viet/*`, ⌘K, admin token inheritance). Stack: Astro 7 SSR on Cloudflare Workers, Tailwind 4 tokens in `src/styles/global.css`.

User decisions (2026-10-12): remove dark mode and every dark surface; ink-coloured text stays for readability. One signature colour (champagne gold); remove the 5-accent picker.

## Baseline evidence

- Screenshots: `C:/Users/ABM/.cache/tqd-verify/luxe-baseline/{home,ho-so,bai-viet}/{375x812,768x1024,1440x900}.png` (render-check: 0 errors; warnings are the intended open "Hồ sơ" window).
- Discovery scan (`check-discovery-surfaces.mjs https://tqd.io.vn`): 0 errors, 17 warnings, 18 info. No JSON-LD on any page; `.md` twins and `llms.txt` lack `X-Robots-Tag: noindex`; no `og:image:alt`; no `llms-full.txt`.

## Rubric (0–3)

| Area | Score | Evidence |
|---|---|---|
| Brand recall | 1 | Blue Tailwind-default palette, no signature; `ho-so/1440x900.png` reads like a SaaS template |
| First impression | 2 | Desktop shell is distinctive; plain pages are generic |
| Content punch | 2 | Real content, but headings have no hierarchy beyond weight |
| Hierarchy | 1 | One sans family, h1 3xl bold, section list cards all equal |
| Motion | 3 | Phase 6–7 motion, reduced-motion verified |
| Responsive | 2 | Phone home screen fine; blue icon tiles clash with the brief |
| Trust | 2 | Real photo and links; no structured data |
| Accessibility | 3 | Lighthouse a11y 1.0 |

## Design brief (fixed for all iterations)

```text
Register:  Brand
Scene:     Vietnamese business owners and managers open the link from Facebook/Zalo on a phone, or on an office laptop in daylight, to judge whether DũngTQ is credible enough to hire for AI training and consulting.
Direction: "Ivory atelier, precision instruments" — editorial luxury (serif display, champagne hairlines, generous space) with a technical layer (mono indices, fine grid, glass chrome) because he sells high-value AI work to executives.
Color:     Restrained, light only; bg ivory #FAF7F1, panel #FFFFFF, text ink #1B2030, muted #6A6253 (5.6:1), accent deep gold #8A6420 (5.0:1, links/focus/buttons), accent-ink #5E4413, champagne #B8935A decorative only (hairlines, glyphs, glows; never text).
Type:      Cormorant Garamond 500/600 (display, Vietnamese subset) + Be Vietnam Pro (body) + JetBrains Mono (indices, data); contrast axis: high-contrast serif vs geometric grotesque.
Signature: Champagne hairline frames with mono section indices (01–07) and a pearl/champagne aurora on the desktop.
Dials:     variance 5, motion 5, density 3.
```

## Proposals

### Must
1. **Tokens and palette** — `global.css`: replace blue/slate with the brief palette; add `--font-display`, `--color-gold`, `--shadow-*`; delete every `data-theme="dark"` and `data-accent` block. Check: `grep -c 'data-theme="dark"\|data-accent' src` = 0; contrast table above holds.
2. **Remove dark mode and accent picker** — `BaseLayout.astro` inline script and theme-color, `theme.ts`, `ThemeMenu.astro` (keep only the effect switches, renamed menu "Hiệu ứng", desktop only), `motion.css` theme cross-fade. Check: no `tqd-theme`/`tqd-accent` reads; menu shows only Linh vật / Hiệu ứng thời tiết; `motion-check` theme case replaced by an "effects menu" case.
3. **No dark surfaces** — TikTok facade gradient, `.prose-article pre`, any `bg-ink`; phone/desktop chrome stays light. Check: rendered screenshots at 3 viewports contain no large dark area (vision review) and `grep` finds no dark backgrounds.
4. **Display typography and editorial hierarchy** — serif h1/h2 on pages, sections, articles, window titles; mono eyebrow index (`01 · Hồ sơ`); champagne hairline under headers. Check: 1440/768/375 screenshots, no clipped Vietnamese diacritics.
5. **Components restyle** — header, footer, ItemCard, StatGrid, section list, ⌘K, desktop menubar/windows/dock/launcher, phone home icons (champagne-on-ivory, not blue tiles), mascot tip, admin inherits tokens. Check: render-check 0 errors at 3 viewports on `/`, `/ho-so`, `/san-pham`, `/so-lieu`, `/bai-viet`.

### Amendments after kongming review (2026-10-13)
- Display serif: Cormorant Garamond **600 only**, ≥ 20px, line-height ≥ 1.15, no `tracking-tight`; chrome (titlebars, menubar, dock, sheet title) stays Be Vietnam Pro. Mono only for digits in the eyebrow (`01`). Fallback face: Newsreader.
- Tints come from champagne (10–14% over white); deep gold only for text, strokes, fills. Panels: warm hairline `#E6DFD2` + warm shadow. Phone icons: gold glyph on champagne tint (never white on champagne).
- Primary button gold fill + white text, double focus ring; `::selection`, `accent-color`, universal `:focus-visible`; prose links underlined with champagne.
- Added to Must: OG image + favicon in the new palette; `weather.ts` fixed light colours; aurora pearl/champagne; README; warm scrims and light dock tooltip.
- JSON-LD via a `jsonLd` prop on BaseLayout (WebSite + WebPage everywhere; Person on `/`, ProfilePage on `/ho-so`, Article on posts); `X-Robots-Tag: noindex` in `markdownResponse`.

### Should
6. **JSON-LD** — `Person` + `WebSite` on `/`, `ProfilePage` on `/ho-so`, `Article` on `/bai-viet/{slug}`. Check: scan shows no `json-ld` warning on sampled pages.
7. **Noindex markdown twins and llms.txt** — `X-Robots-Tag: noindex` on `*.md` and `/llms.txt`. Check: scan shows no `markdown-variant` warnings.
8. **`og:image:alt`** — Check: scan info item gone.

### Could (not in this delivery)
- `llms-full.txt`; markdown content negotiation; aurora on `transform`.

## Project DONE contract

- `npm test` and `astro check` pass; `npm run build` exit 0.
- render-check 0 errors at 375/768/1440 on `/`, `/ho-so`, `/san-pham`, `/so-lieu`, `/bai-viet`, one article; vision review of after-screenshots finds no dark surface, no clipping, no overflow.
- Discovery scan: 0 errors and no `json-ld`, `markdown-variant` or `open-graph` findings on sampled pages.
- `motion-check.mjs` and `mascot-weather-check.mjs` ALL PASS (theme case updated, not deleted) on preview and production.
- Lighthouse mobile ≥ 0.9 performance and accessibility, home + article, two runs (target ≥ 0.95 to match current 0.98).
- `scripts/verify/site.mjs` OK and `check:privacy` OK on production.

## Unresolved questions

- None blocking. Cormorant Garamond Vietnamese diacritic quality is verified on render, not assumed; verified on render: Cormorant diacritics are clean at 375–1440 px, so no fallback face was needed (font stack falls back to Georgia).
