---
name: project-luxury-light-redesign
description: 2026-10-12 owner decision to restyle tqd.io.vn as "luxury + technology, light only" (ivory/champagne-gold, Cormorant display), dropping dark mode and the 5-accent picker
metadata:
  type: project
---

On 2026-10-12 the owner fixed two design decisions for the public site: no dark mode or dark surfaces at all, and one signature colour (champagne gold, link/button gold #8A6420) replacing the 5-accent picker. Brief and proposals: `plans/reports/ux-ax-261012-2351-luxury-light-redesign.md`.

**Why:** the target reader is a Vietnamese executive opening the link from Facebook/Zalo on a phone or an office laptop in daylight, judging credibility for AI consulting; the Tailwind-blue palette read as a SaaS template (brand-recall score 1/3).

**How to apply:** treat "no dark surface" and "single gold" as user decisions, not open questions. Kongming's 2026-10-12 counsel: keep `--color-accent` as the single gold (no parallel `--color-gold` token), champagne #B8935A is decorative only (2.7:1, never text or white-on-champagne icon tiles), load Cormorant Garamond at one weight (600, latin+vietnamese, normal only), keep the OG image/favicon in scope, put `X-Robots-Tag` in `markdownResponse`, JSON-LD via a BaseLayout prop (CSP has no script-src, so inline is fine). Related: [[user-review-style]].
