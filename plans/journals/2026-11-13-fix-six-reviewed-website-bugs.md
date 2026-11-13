---
title: Fix six reviewed website bugs
date: 2026-11-13
summary: "Protect Viral daily quota and cached transcript limits; repair mobile actions, engagement, path coverage and backup docs."
---

# Fix six reviewed website bugs

## What changed

Fixed six accepted findings from the codebase review. Rejected visitor/IP requests no longer consume shared Viral daily quota, and share validation precedes daily charging. Cached and fresh transcripts respect the caller's duration tier across transcribe/generate/share. Mobile injection initializes action controls and cleans old document listeners. Engagement accounting retains time before the idle cutoff, and knowledge coverage uses all stored viewed paths instead of the top list. Backup runbooks now match gzip/encrypted object names.

## Verification

All 232 tests in 39 files passed, including 19 new regressions. Astro checked 180 files with no errors, warnings or hints, and the production build passed. Real headless Chrome fixtures at 390x844 passed two injection/close cycles with Markdown copy, AI menu/Gemini, share fallback and code copy. The initial build caught a DOM/Workers type conflict that was fixed before the passing build. Scoped simplification found no useful changes.

## Operational limits

Old rollups must be replayed from available WAE data to recover paths previously discarded beyond top 50; this is documented. No production write, remote rollup, real AI/downloader call, restore, commit or deployment was performed. Browser checks used actual scripts with local fixtures, not a live Astro/D1 instance. Detailed evidence is in plans/2026-11-13-review-six-bug-fixes/reports/validation.md. AgentWiki publish skipped.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Final review follow-up

Independent review found three edge cases, all fixed and rechecked: release reserved daily quota on over-duration rejection or canonical cache reuse; abort old mobile action listeners before the loading placeholder detaches them; query knowledge paths independently of the 10,000-row dimensional aggregation. The reviewer then passed the current diff with no remaining concerns. The final full tests, build and stalled-fetch browser check all passed.
