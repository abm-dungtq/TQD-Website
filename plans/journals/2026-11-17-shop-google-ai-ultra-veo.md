---
title: Build /shop and /shop.md channel for 30 Google AI Ultra & Veo SKUs
date: 2026-11-17
summary: "Added interactive 4-tier configurator, Markdown twin, site-wide navigation, discovery metadata, and Tailscale preview support for /shop on tqd.me."
---

# Build /shop and /shop.md channel for 30 Google AI Ultra & Veo SKUs

## What changed

Created a dedicated `/shop` route (`src/pages/shop.astro`), bundled TypeScript state controller (`src/scripts/shop.ts`), and Markdown twin (`src/pages/shop.md.ts`) backed by the typed 30-SKU catalog in `src/lib/shop-catalog.ts`. The page renders a 4-tier Ivory Atelier configurator (`Ultra 20x` / `Ultra 5x`, `Full Family` / `Slot Family` / `Trực tiếp chính chủ`, credit tiers, and duration), a sticky order summary with direct Zalo messaging and clipboard copy, curated quick presets, comparison FAQs using `<details>`, and a filterable 30-SKU catalog table.

Integrated `/shop` across header navigation (`BaseLayout.astro`), macOS desktop menubar and dock (`DesktopShell.astro`), mobile app grid and search (`MobileShell.astro`, `index.astro`, `search.json.ts`), sitemap (`sitemap.xml.ts`), `llms.txt` / `llms-full.txt` (`profile-markdown.ts`), `/catalog.json` (`catalog.ts`), `/.well-known/agent.json` (`agent-card.ts`), WebMCP tools (`webmcp-tools.ts`), analytics route normalization (`analytics/normalize.ts`), and `vite.server.allowedHosts` in `astro.config.mjs` for remote Tailscale Serve dev access.

## Verification

- `npm test`: 46 test files passed (46), 277 tests passed (277), including new `src/lib/shop-catalog.test.ts` and updated integration contract tests.
- `npm run check:privacy` / `node scripts/check-no-post-text.mjs http://127.0.0.1:4321`: passed (`OK no post text (672 fingerprints) over 23 live targets`).
- `npm run build` (`astro check && astro build`): 201 files checked with 0 errors, 0 warnings, and 0 hints; production server build completed.
- `viet-pro gate plans/261117-shop-veo-ultra/shop-products.md`: passed (`ai_score=11/100`, `rhythm=2.44`), reviewed independently by `content-reviewer` (`DUYỆT NỘI DUNG`).
- Headless Chrome (`agent-browser`) over `https://tqd.tail496c36.ts.net:8446/shop`: HTTP 200, 30 catalog rows rendered, preset click (`veo-25k-12m-ultra-20x`), ArrowRight keyboard selection + focus retention (`Google Ultra 5x`), plan filter toggling, zero console/CSP errors, and zero horizontal overflow at `1440x900`, `375x812`, and `1024x768` on `/`.
- Final `kongming` review checkpoint: `PASS`.

## Operational limits

Changes remain uncommitted and un-deployed in `/Volumes/2/TQD-Website`; dev server (`http://127.0.0.1:4321`) and Tailscale Serve (`https://tqd.tail496c36.ts.net:8446/shop`) are left running for live inspection. Advisory supervision ran as same-model counsel (`inherit`) rather than external Fable/Astra engines.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
