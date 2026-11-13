# UI and analytics

Modify `src/scripts/page-actions.ts`, `src/scripts/mobile-shell.ts`,
`src/scripts/analytics-beacon.ts`, `src/lib/analytics/rollup.ts` and
`src/pages/admin/thong-ke.astro`, plus regression tests. Reuse action initialization
after mobile injection and avoid retaining detached action bars via global listeners.
Clamp engagement accumulation at the idle deadline. Store all observed path counts
and expose those separately from the top list to calculate knowledge coverage.

Validation: injected actions bind once; idle/hidden/resume events preserve deltas;
coverage remains correct beyond both 20 and 50 paths. Existing rollups require
refresh to recover previously discarded path counts. No schema migration is needed.
Rollback: revert scoped edits; existing metric rows remain compatible.
