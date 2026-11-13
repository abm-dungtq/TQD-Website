# Production deployment — 2026-11-13

## Initial deployment and provider state

- Application revision: `d880e98` on `main`.
- Commits: `ae142af` (Viral quota/cache), `7d71c1d` (mobile/analytics),
  `d880e98` (documentation and validation records).
- Target: Cloudflare Worker `tqd-website`, account `b243f38bff984ce1741c379547e97a75`.
- Production URL: https://tqd.me
- Command: `env -u CLOUDFLARE_ENV CLOUDFLARE_ACCOUNT_ID=b243f38bff984ce1741c379547e97a75 npm run deploy -- --tag d880e98 --message "Fix Viral quota and cache limits, mobile actions and analytics coverage"`.
- Worker version: `5e1c5305-dd7c-44a0-8f2d-0b639dd4f4cb`, version number 45.
- Deployment: `cf3f9ea7-7dab-4cbd-bed2-67adde57bb47`, created
  `2026-11-13T08:19:34.119796Z` (15:19:34 Vietnam time), 100% traffic.
- Prior version for rollback: `4661b6e7-2558-46f3-880e-fa648162bd0e`.
- State: healthy for the verified public routes and APIs; admin/WAE coverage
  verification has the limitations below.

## Verification

- Fresh `npm test`: 232 tests in 39 files passed before deployment.
- Deploy script privacy gate passed; Astro checked 180 files with 0 errors,
  warnings or hints, and the production build succeeded.
- `scripts/verify/site.mjs https://tqd.me`: passed, including chat/daemon health.
- `scripts/verify/live.mjs https://tqd.me`: passed.
- `npm run check:privacy -- https://tqd.me`: passed, 672 fingerprints over
  55 live targets.
- `scripts/verify/cache.mjs https://tqd.me`: three `HIT@104` responses.
- Cloudflare version/deployment metadata confirmed tag `d880e98`, production
  bindings and 100% traffic to the new version.
- Deployed MobileShell and page-actions asset SHA-256 checksums match local build.

### Viral APIs against production D1

A unique short transcript, long transcript and dedicated visitor-limit fixtures
were created in D1 for this bounded verification. No downloader transcription or
AI generation was requested; the transcribe limit test reached daemon health only.

- Blocked share and transcribe visitors: `429 rate_limited`.
- Missing share transcript: `404 not_found`.
- Long cached transcript: `400 video_too_long` from transcribe, generate and share.
- Allowed cached transcript: `200`, cached flag and 120-second duration confirmed.
- Shared daily count remained `0` through rejected and cached requests.
- One valid share: `200`, daily count increased by exactly one.
- All temporary transcript/share rows and dedicated visitor counters were removed
  in `finally`. The single test share's daily increment was released atomically.
  No global counters or unrelated user rows were reset.
- The public-IP hourly counters naturally include these few verification requests.

### Production browser and engagement script

- Actual Chrome at the mobile breakpoint: profile and products section sheets
  loaded; Markdown copy showed success, the AI menu expanded, and share copied
  the canonical URL. Controls remained bound after closing and opening another
  section. Temporary viewport overrides were reset and test tabs closed.
- The exact inline engagement module fetched from production was replayed in a
  local VM: 31 seconds idle produced one `page_end` with `ms=30000`; the actual
  production `/api/t` accepted that payload with HTTP 204.
- Browser Network inspection observed page views and HTTP 204 responses. A real
  browser visibility transition producing the 30-second delta was not established;
  this is distinct from the passing deployed-script replay and regression tests.

### Backup

- Downloaded the actual R2 object `backups/2026-11-13.json.gz` using the corrected
  runbook path, validated gzip/JSON and array-valued table data.
- `scripts/restore-backup.mjs` generated 166 SQL statements from that object.
  The SQL was not executed against any database.
- Private downloaded backup and generated SQL files were deleted after checking.
- No encrypted object was tested on production; encryption/decryption remains
  covered by the existing passing local tests.

## Admin and WAE limitations

- Production version metadata has no `CF_ANALYTICS_TOKEN` binding, and remote
  `analytics_daily` contains no rows. Live WAE rollup and knowledge coverage
  therefore cannot be validated with the current production configuration.
- One attempt with the existing local password returned 401. No repeated password
  attempts, credential changes or fabricated admin sessions were performed.
- After the user signed in through Chrome, authenticated analytics pages for both
  sites and the backup listing loaded successfully. The corrected knowledge coverage
  label shows `182 / 182` with the currently empty rollup data. Clicking the WAE
  refresh button returned `rollup=missing_token` and the expected explanatory message.
- The live admin check found a stale explanatory query count after adding the fifth
  rollup query: two days now require 10 WAE SQL requests, not 8. The UI hint was
  corrected before the final deployment described below.

## Rollback

`npx wrangler rollback 4661b6e7-2558-46f3-880e-fa648162bd0e --name tqd-website`

No schema migration was performed. Rollback changes Worker code, not D1/R2 data.
No Git push was requested or performed.

## Final deployment and repeated verification

- Final application revision: `62ae6f6` (adds the corrected 10-query admin hint and
  operational documentation to the three initial commits).
- Worker version: `11615ce3-14b7-4a21-8da6-4013f9d0b826`.
- Deployment: `efa0b2d1-08a7-4a73-8fe7-53dd04e933cf`, created
  `2026-11-13T08:39:12.742448Z` (15:39:12 Vietnam time), 100% traffic.
- Provider metadata confirmed tag `62ae6f6`; no `CF_ANALYTICS_TOKEN` is configured.
- Final deploy command used the same production route with `--tag 62ae6f6`.
  Privacy gate, Astro checks (180 files; zero diagnostics) and build passed.
- Repeated `npm test`: 232/232 tests, 39/39 files passed.
- Repeated site, live, cache and production privacy checks all passed; cache remained
  `HIT@104`, privacy checked 672 fingerprints over 55 targets.
- Repeated all eight bounded Viral API checks on the final deployment: passed;
  daily quota stayed zero for rejected/cache requests, a valid share charged once,
  and temporary rows/counters were cleaned up again.
- Reloaded the authenticated production admin page and observed the corrected
  text: two days require 10 WAE SQL queries.
- Admin login handoff completed successfully. Temporary browser overrides were
  reset and agent-created verification tabs closed; the user's session was not
  logged out. No production data restore or real AI generation was performed.

Final state: **healthy**, with live WAE data/coverage validation blocked by the
missing analytics token and empty rollup table. The user-visible missing-token
behavior and the coverage label were verified. Full non-empty coverage computation
remains covered by the passing regression suite, rather than a live WAE query.

For a rollback to the immediately preceding deployment, use
`npx wrangler rollback 5e1c5305-dd7c-44a0-8f2d-0b639dd4f4cb --name tqd-website`.
The pre-task rollback version remains `4661b6e7-2558-46f3-880e-fa648162bd0e`.
