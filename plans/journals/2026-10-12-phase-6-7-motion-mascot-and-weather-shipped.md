---
title: "Phase 6-7: motion, mascot and weather shipped"
date: 2026-10-12
summary: "OS-style motion, Ctrl K palette, mobile sheets, Codex-generated mascot and Hanoi weather live on tqd.io.vn; Lighthouse 0.98-0.99"
---

# Phase 6-7: motion, mascot and weather shipped

## What happened
- Phase 6 (motion): Lighthouse first scored 0.87/0.86. Kongming traced it to the render-blocking Google Fonts stylesheet plus 3 CSS files. Fix: self-hosted fonts through the Astro Fonts API, `inlineStylesheets: 'always'`, `fetchpriority` on the article cover. Now home 0.98 and article 0.99-1.0, accessibility 1.0 on two runs.
- Phase 6 go/no-go: GO. Then fixed the skip link while a sheet is open, a typing guard for desktop shortcuts, cmdk ARIA, and closing the sheet when the viewport widens to desktop.
- Phase 7: no image-generation API key was in the environment, and the multix config file is blocked by the privacy hook. At the user's request the 6 mascot poses were generated with Codex CLI through Paseo; the user approved the set.
- Mascot click test timed out: Playwright never saw the button as stable because of the infinite breathing animation on it. Moved the animation to the inner images using the separate `translate`/`scale` properties, so the hit target stays still.
- First production deploy of Phase 7 failed silently (grep filtered the error, version unchanged); the re-deploy succeeded. Lesson: check the "Current Version ID" line, not just the exit code.

## Decision
- Weather is fetched client-side (Open-Meteo, 30 min sessionStorage) because pages are cached for 24h.
- Open-Meteo CC BY 4.0 credit is in the label title and the README.

## Next steps
- Task 4.9: waiting on TikTok links from the user.
- Product call: should the mascot sit above windows (currently z 950)?
- Later: aurora on transform, keyboard selection in Exposé, theme-color following the chosen theme, stopping mascot/canvas below 1024px.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
