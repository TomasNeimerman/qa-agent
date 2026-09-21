---
phase: 05-smoke-test-mode-cross-project-distribution
plan: 02
subsystem: testing
tags: [cross-project-validation, pkg-02, smoke-test, discovery, franquix]

requires:
  - phase: 05-smoke-test-mode-cross-project-distribution
    provides: "selectSmokeCases + --smoke CLI + Smoke-test protocol (plan 05-01)"
  - phase: 03-dual-discovery-test-case-generation
    provides: "discover-schema.mjs, router-layout detection (D-08), test-case document format"
provides:
  - "05-CROSS-PROJECT-VALIDATION.md: per-project evidence that the unmodified skill runs discovery, generation and --smoke selection against DATAX-web, dotax and franquix"
  - "Live smoke evidence on franquix (localhost:3000), classified per D-10 into credential-type error, case-construction artifact, and passes"
  - "Explicit scope record: DATAX-web not re-run, dotax descoped, C:\\DATAX outside the declared stack"
affects: [05-03-packaging-distribution, phase-05-verification]

actuals:
  tokens: 6500
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Validation evidence quotes the scripts' own JSON instead of retyped summaries"
    - "A closure decided by the user is recorded as a scoped closure, never as a wider pass"

key-files:
  created:
    - .planning/phases/05-smoke-test-mode-cross-project-distribution/05-CROSS-PROJECT-VALIDATION.md
  modified: []

key-decisions:
  - "Task 2 closed on franquix live evidence only, by user decision: DATAX-web not re-run this phase, dotax descoped (no fixed environment), neither counted as failed"
  - "Validation scoped to one bounded named surface per project (full scans of 39/39/28 handlers are disproportionate for a validation pass), with the scoping stated in each generated document"

requirements-completed: [PKG-02]

coverage:
  - id: D1
    description: "discover-schema.mjs exits 0 on all three repos and router layout detects as App Router on all three, live"
    requirement: PKG-02
    verification:
      - kind: integration
        ref: "node scripts/discover-schema.mjs --project-root C:/DATAX-web | C:/dotax | C:/franquix (exit 0 each; policies 30/126/29)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Generated test-case documents validate (valid:true) and --smoke selects one positivo case per surface on all three repos"
    requirement: PKG-02
    verification:
      - kind: integration
        ref: "node scripts/test-case-doc.mjs --file <repo>/qa-reports/2026-09-21-1500-cross-project-uat-test-cases.md [--smoke]"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live smoke run against franquix's own local dev server needed no project-specific configuration or skill-code change"
    requirement: PKG-02
    verification:
      - kind: manual_procedural
        ref: "C:/franquix/qa-reports/2026-09-21-1238-2026-09-21-1245-api-v1-fixed.md (3 passed, 2 failed as empty-body construction artifact)"
        status: pass
    human_judgment: true
  - id: D4
    description: "Live smoke run against DATAX-web and dotax"
    requirement: PKG-02
    verification:
      - kind: manual_procedural
        ref: "not run: DATAX-web not re-run this phase, dotax descoped (no fixed environment)"
        status: not_run
    human_judgment: true

duration: ~2h (spans the checkpoint and the user's live runs)
completed: 2026-09-21
status: complete
---

# Phase 5 Plan 2: Cross-Project Validation Summary

**The unmodified skill ran discovery, generation and `--smoke` selection against DATAX-web, dotax and franquix with no skill-code change, and a live smoke run on franquix confirmed the path end to end. The live half is franquix only: DATAX-web was not re-run and dotax was descoped.**

## Accomplishments
- `discover-schema.mjs` exited 0 on all three repos (11 / 140 / 38 migration files; 30 / 126 / 29 policy records) and router detection returned App Router on all three, live. This pays Phase 3's research-flag debt against real repos rather than only fixtures.
- One bounded, named surface per project was generated (`GET /api/ext/capabilities`, `GET /api/v1/ping`, `POST /api/v1/heartbeat`). Each document validates `true` and `--smoke` selects exactly one `positivo` case, zero skipped, zero pending.
- Live evidence on franquix (`http://localhost:3000`), read from the two reports in `C:/franquix/qa-reports/`:
  - Run 1: 0 passed, 3 failed. All three were `401 "API key inválida o revocada"`: a wrong credential type (franquix `/api/v1/*` validates its own API keys, not Supabase JWTs). Not an app defect, not a PKG-02 failure.
  - Run 2: 3 passed, 2 failed. The two failures were `POST /ventas` and `POST /heartbeat` sent with an empty body (`400 "Body JSON inválido"`), a case-construction artifact; the same endpoints returned 201 / 200 once sent with a body.
- `C:\DATAX` (Bejerman/Express desktop) is recorded as outside PKG-02's declared Next.js/Supabase stack, with `C:\DATAX-web` named as the DATAX-side target.

## Task Commits
1. **Task 1: discovery, generation and smoke selection against the three repos, read-only** - `a5f7b6b`
2. **Task 2: live smoke run, closed on franquix evidence by user decision** - validation document updated in this plan's final docs commit (see below)
- STATE.md blocker and session record during the checkpoint - `49e986d`

## Files Created/Modified
- `.planning/phases/05-smoke-test-mode-cross-project-distribution/05-CROSS-PROJECT-VALIDATION.md` - per-project evidence, scope decision, verdict
- `scripts/discover-schema.mjs`, `scripts/discover-schema.test.mjs`, `references/discovery-nextjs.md` - unchanged (no generalization defect surfaced)
- Outside this repo, not committed by design: `qa-reports/2026-09-21-1500-cross-project-uat-test-cases.md` in each of the three target repos (gitignored)

## Deviations from Plan

### Scope decisions

**1. [User decision] Task 2 closed on franquix evidence only**
- **Found during:** Task 2
- **Issue:** Task 2's precondition (QA_AGENT_TOKEN in every target's `.env.local`) was unmet for dotax (no `.env.local`) and franquix (no token line at check time). Independently, this plan-executor holds neither `AskUserQuestion` nor the Playwright MCP tools the live-dispatch protocol needs, so it did not dispatch anything itself.
- **Resolution:** The user ran the franquix live smoke themselves and decided Task 2 closes on that evidence: DATAX-web recorded as not re-run this phase, dotax recorded as descoped (no fixed environment, nothing touched in dotax Supabase or Vercel). This executor did not run any live request.
- **Files modified:** 05-CROSS-PROJECT-VALIDATION.md

**2. [Scope] One surface per project instead of a full scan**
- Allowed by the plan's own scope-discipline clause; the scoping is stated in each generated document's `Alcance` line and in the validation doc.

**3. [Note] Live cases were not dispatched verbatim from the `--smoke` JSON**
- The franquix live cases were hand-built (`GET /franquicias`, `POST /ventas`, `POST /heartbeat`). Run 2's heartbeat case is the live counterpart of the generated `case-1`; the other two are additional. Recorded in the validation doc rather than left to read as if the smoke set had been dispatched as printed.

## Issues Encountered
- **Side effect on the franquix dev database (not cleaned up):** run 2's `POST /api/v1/ventas` wrote a real venta `Z-QA-TEST-1` (id `e52a32e3-9867-4f2a-8357-2e27702f1e15`, franquicia `QA Sucursal 04899900`) and the heartbeat recorded a health signal for it. The owner of that database should delete the test venta if they do not want it kept.
- Two pre-existing failures in `npm test` (`api-client.test.mjs` exit 4 vs 2 and `ui-login.test.mjs` exit 7 vs 2, 356/358 green), already documented in 05-01's summary as an ambient-shell environment leak and unrelated to this plan. Not touched.

## Known Stubs
None. This plan added no code.

## User Setup Required
None for this plan. If PKG-02 should later be confirmed live on DATAX-web or dotax: configure the project's own credential and a fixed local/staging target, then run `/qa-agent` directly against it.

## Next Phase Readiness
- Plan 05-03 (installation wording and dry run) is independent of this evidence.
- The PKG-02 requirement is marked complete on the strength of a scoped closure: discovery/generation/selection on three repos, live dispatch on one. A verifier reading this should treat the live half as franquix-only.

## Self-Check: PASSED
- FOUND: .planning/phases/05-smoke-test-mode-cross-project-distribution/05-CROSS-PROJECT-VALIDATION.md
- FOUND commit: a5f7b6b
- FOUND commit: 49e986d
- FOUND: C:/franquix/qa-reports/2026-09-21-1232-2026-09-21-1500-api-v1.md
- FOUND: C:/franquix/qa-reports/2026-09-21-1238-2026-09-21-1245-api-v1-fixed.md
