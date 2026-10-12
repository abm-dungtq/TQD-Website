---
name: user-review-style
description: How the TQD-Website owner wants kongming go/no-go and review verdicts shaped (must-fix vs later, file:line, Status line, Vietnamese user relayed by an orchestrator)
metadata:
  type: user
---

The user is Vietnamese (timezone Asia/Saigon); an orchestrator relays kongming's English output to them. Reviews are requested as phase go/no-go checkpoints against `plans/<plan>/phase-NN-*.md`, read-only.

Preferred verdict shape: separate **must-fix** from **later**, cite `file:line`, address the numbered questions in order, end with `Status: DONE | DONE_WITH_CONCERNS | BLOCKED` plus a one-sentence summary. They value evidence already measured (verify scripts, deploy results) and want speculation labelled.

Site context that stays true across phases: Astro SSR on Cloudflare Workers, Free plan assumed (10 ms CPU, D1 ~100k writes/day), preview and production share the same D1/R2, so test slugs must self-clean.
