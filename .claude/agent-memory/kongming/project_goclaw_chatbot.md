---
name: project-goclaw-chatbot
description: 2026-10-13 mascot chatbot via owner's self-hosted GoClaw (agent dungtq-web); fixed user decisions and the counsel kongming gave
metadata:
  type: project
---

Feature decided 2026-10-13: desktop mascot + phone round button open a chat panel backed by GoClaw (https://goclaw.tqd.io.vn, Cloudflare tunnel to the owner's Windows PC, only up when PC is on). Fixed user decisions: dedicated agent `dungtq-web` (datetime tool only, `tqd` untouched, backup first); knowledge = live site markdown (/llms.txt + .md twins) with a rerunnable sync; no login, ~20 msg/h per visitor, 1000 chars, global daily cap, over-limit suggests Zalo; Vietnamese UI, light palette, Lighthouse >= 0.95.

**Why:** owner wants an "Agent version of DũngTQ" that shares AI knowledge; must never invent prices/commitments.

**How to apply:** GoClaw admin scripts (gateway token, WS RPC `agents.files.set` on localhost) belong on the PC under `D:/Goclaw/plans/<date>-dungtq-web/`, never in the website repo. Rate limits reuse `src/lib/rate-limit.ts` + `rate_limits` D1 table (Workers Rate Limiting binding only supports 10/60 s windows). Worker should pipe GoClaw SSE through untouched (CPU 10 ms free plan). Disable GoClaw memory extraction for the web agent so visitor text never enters shared knowledge. Visitor id namespace `web:<uuid>`. See [[user-review-style]].

2026-10-13 Phases 2-4 (client panel, mascot entry, docs) reviewed GO with two one-line fixes: hide the streaming bubble from AT (aria-busy alone is not honoured everywhere) and do not pushState a second `chat` entry when history.state already has one (reload/Forward made close need two taps). Real-phone keyboard check (Chrome Android resizes-visual, iOS) was still unverified at review time.

2026-10-13 Phase 1 (`/api/chat`, `/api/chat/status`) reviewed GO. Counsel given: gate on cached `/health` before charging limits so an offline PC does not burn the shared daily cap; put the single Free-plan WAF rate-limiting rule (IP, 10 s) on `/api/chat*` because every flood request costs 2 D1 writes and D1 Free allows 100k rows/day; make every non-2xx body `{error, message}`; Phase 2 client treats first delta starting `Error: ` and a close without `[DONE]` as failures.
