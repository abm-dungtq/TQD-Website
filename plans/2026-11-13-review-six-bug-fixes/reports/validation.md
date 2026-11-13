# Validation — 2026-11-13

## Implemented behavior

- Public Viral transcribe/share requests check visitor and IP limits before charging
  the daily bucket. Share metadata/content validation also precedes daily charging.
- For daemon work, daily quota is reserved before the call and released for over-duration
  rejection or canonical cache reuse. Duration validation applies to input and canonical transcript cache hits, fresh
  daemon results, and the generate/share consumers. Existing 300/1800-second limits
  remain unchanged; valid initial cache hits remain free.
- Mobile sheet injection initializes page actions and code-copy controls. Replacing
  sheet content aborts the previous content's document listeners.
- Engagement is accumulated through the idle deadline instead of discarding the
  preceding active interval. Hidden intervals and duplicate flushes are excluded.
- Rollups store observed path counts and query knowledge paths separately from
  referrer/UTM/country/device dimensions, avoiding dimensional query truncation. Coverage uses the full viewed-path set;
  the top-path display still contains 20 rows and engagement detail still uses top 50.
- Backup docs use `.json.gz` / `.json.gz.enc`, link to the source-owned table lists,
  and explain supplying the existing encryption key without putting it in history.

## Checks

- Focused Viral tests: 21 passed initially; an additional IP-specific share regression
  was subsequently added and is covered by the final full run.
- Focused engagement and rollup tests: 7 passed.
- Final `npm test`: 39 files, 232 tests passed (19 more tests than baseline).
- `npm run build`: Astro checked 180 files with 0 errors, 0 warnings and 0 hints;
  Worker and assets built successfully.
- `git diff --check`: passed.
- Real headless Chrome at 390×844, reduced motion: two mobile sheet open/close
  cycles; Markdown copy, AI menu/Gemini, URL share fallback and code copy passed
  each cycle (8 clipboard writes, 2 Gemini opens, no page errors). A further stalled
  section-fetch check confirmed old document listeners are aborted before detaching
  their action bar.
  This isolated check bundled the actual mobile/page-action scripts and supplied
  section/Markdown fixtures plus clipboard/window-open adapters. It did not use
  production data or prove system clipboard permissions on a physical phone.
  Command: `node /tmp/tqd-website-browser-check/check-mobile.mjs`.
  Browser was closed in `finally`; no server was started.
- simplifier ran clean: no changes recommended or applied.
- Added Vietnamese documentation prose: lint clean; editorial gate passed at
  2.070/3 with no flagged defects after two focused revisions.

The first build exposed a DOM/Cloudflare `ParentNode` type conflict and deprecated
test transpiler mode. Both were corrected before the successful final build.

## Limitations

Existing stored rollups may lack paths previously discarded beyond top 50. The
admin runbook explains replaying the dates still available in WAE. No remote
rollup, production write, real downloader/AI call, backup restore, deployment or
commit was performed. Browser verification used Chrome fixtures, not a full live
Astro/D1 session or Safari.

## Independent review

PASS after follow-up fixes. The independent reviewer confirmed the atomic quota
refund, listener cleanup before loading, dedicated knowledge query, and associated
regressions. No concerns remained in that recheck.
