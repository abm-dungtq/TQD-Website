---
title: Optimize /shop configurator, mobile table, and conversion UX
date: 2026-11-17
summary: "Fixed mobile stacked caption layout, raised all controls to >=44x44px touch targets, compacted desktop sticky summary to fit 900px viewports, added mobile sticky bar, and deployed to tqd.me."
---

# Optimize /shop configurator, mobile table, and conversion UX

## What changed

1. **Accessible full-card radio touch targets (`src/pages/shop.astro`, `src/scripts/shop.ts`):** Replaced `.shop-vh` with full-card `.shop-radio-input` overlays (`opacity: 0; inset: 0; inline-size: 100%; block-size: 100%`) across Steps 01–04, resolving small touch target warnings while preserving keyboard `:focus-visible` outlines and Arrow-key focus retention.
2. **Compact desktop summary card (`src/pages/shop.astro`, `src/scripts/shop.ts`):** Refactored `#sum-specs` into a 6-cell bento grid and moved the 3 Gmail pre-upgrade checks into a collapsible `<details class="shop-prereq-details">` accordion (`44px` summary row), shrinking the sticky card height at `1440×900` from `1049px` to `789px` so the Zalo CTA sits cleanly in view without scrolling.
3. **Sticky mobile/tablet bar (`src/pages/shop.astro`, `src/scripts/shop.ts`):** Added `#shop-mobile-bar` (`<= 960px`) with `>= 44×44px` `Chi tiết` and `Đặt Zalo` buttons, price-update flash (`260ms`, disabled under reduced motion), `.chat-fab` vertical clearance (`bottom: calc(86px + env(safe-area-inset-bottom))`), footer bottom safe padding, and `IntersectionObserver` auto-hide when `#shop-summary-card` enters the viewport.
4. **Responsive 30-SKU catalog table & search (`src/pages/shop.astro`, `src/scripts/shop.ts`):** Included `.shop-table caption` in `display: block; inline-size: 100%` inside `@container (width < 760px)` to fix the narrow vertical caption collision on mobile, rendered 1-col (`375px`) and 2-col (`768px`) card grids for `tbody`, replaced clipped `.sr-only` search label with a visible `.shop-search-box` pill, updated button states (`✓ Đang chọn` / `.is-selected`), and bumped filter/row buttons to `>= 44×44px`.

## Verification

- `npm test`: **46/46** test files passed (`277/277` tests).
- `npm run build` (`astro check && astro build`): `201` files checked with `0` errors, `0` warnings, and `0` hints; Cloudflare server bundle built cleanly.
- `render-check.mjs` across `375×812`, `768×1024`, and `1440×900` on both `http://localhost:4321/shop` (`render-audit-shop-after`) and live `https://tqd.me/shop` (`render-audit-shop-live`): **`Summary: 0 errors, 0 warnings.`** (`no findings` on all 3 viewports; screenshots visually inspected).
- `agent-browser` over `https://tqd.tail496c36.ts.net:8446/shop` at `375×812`: confirmed `#shop-mobile-bar` visible at top, hidden when `#shop-summary-card` enters view, ArrowRight switches `Google Ultra 20x -> Google Ultra 5x` retaining radio focus and syncing mobile bar price/title, and 0 console errors.
- Live production deploy (`npm run deploy` -> Version ID `fa151ec0-9353-4ddd-955d-28e71e6c5170`): `node scripts/verify/site.mjs https://tqd.me` (`OK site`), `npm run check:privacy -- https://tqd.me` (`OK no post text (672 fingerprints) over 57 live targets`).
- Final `kongming` review checkpoint: `PASS`.

## Operational limits

Two minor non-blocking follow-up polish items noted by `kongming`: toggling `inert` / `visibility: hidden` when `.shop-mobile-bar.is-docked-hidden` hides the bar for keyboard Tab order, and gating `selectBySlug` smooth scroll by `prefers-reduced-motion`. Changes remain uncommitted in the local workspace after deploying to Cloudflare Workers.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
