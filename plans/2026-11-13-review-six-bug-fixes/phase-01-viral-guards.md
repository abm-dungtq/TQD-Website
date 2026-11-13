# Viral request guards

Read and modify `src/pages/api/viral/{transcribe,share,generate}.ts` and
`src/lib/viral.ts`; add route-level regression tests using existing Vitest patterns.
First separate per-caller checks from daily quota charging; validate share metadata
before charging daily quota. Enforce the existing duration limits on cached and
fresh transcripts, including generate/share consumers. Preserve free cache hits,
admin limits, API response shape and all configured quota values.

Validation: rejected visitor/IP attempts and invalid shares leave daily counters
unchanged; allowed work charges once; public cached long videos fail while admin
and public in-limit videos succeed; canonical cache lookup is also covered.
Rollback: revert the scoped code changes; no data migration is needed.
