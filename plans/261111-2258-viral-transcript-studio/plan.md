# Implementation Plan: TQD Viral Lab — Transcript, X-Quang Viral & Nhân Bản Kịch Bản Đa Kênh (`opencode-go` + `viet-pro`)

- **Date**: 2026-11-11
- **Status**: Completed & Deployed Live (`https://tqd.me/tai-video`)
- **Brainstorm Reference**: `plans/reports/brainstorm-261111-1758-viral-transcript-studio.md`

## Phases
- [x] **Phase 1**: D1 migration `0006_viral_lab.sql`, `wrangler.jsonc` & `worker-configuration.d.ts` bindings (`AI`, `OPENCODE_GO_*`), URL canonicalizer in `src/lib/dl-platforms.ts`, analytics route allowlist in `src/lib/analytics/normalize.ts`.
- [x] **Phase 2**: VPS daemon `POST /transcribe` (subtitle parser + `ffmpeg` 32kbps MP3 fallback + instant cleanup + mock mode) in `scripts/ytdlp-daemon.mjs`.
- [x] **Phase 3**: `src/lib/viet-pro-lint.ts` (21 anti-AI-slop rules, score calculator, `.srt` & CapCut helpers) + `src/lib/viral.ts` (`viet-pro` prompts, Whisper normalizer, D1 cache & rate limits).
- [x] **Phase 4**: Worker API endpoints (`/api/viral/transcribe`, `/api/viral/generate`, `/api/viral/share`) + shareable report page `/xray/[id].astro` + nightly cleanup in `src/worker.ts`.
- [x] **Phase 5**: UI & client controller on `/tai-video` (`src/pages/tai-video.astro`, `src/scripts/tai-video.ts`, `src/scripts/viral-lab.ts`).
- [x] **Phase 6**: Unit tests (`src/lib/viral.test.ts` — 112/112 tests passing), `npm run build` (0 errors), remote D1 migration, VPS `tqd-dl-daemon.service` v1.1 deployment, Cloudflare Worker deployment & live E2E verification.
