---
phase: 3
slug: dual-discovery-test-case-generation
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-20
updated: 2026-08-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 |
| **Config file** | none — `npm test` runs `vitest run` with no `vitest.config.*` present |
| **Quick run command** | `npx vitest run scripts/discover-schema.test.mjs` |
| **Full suite command** | `npm test` (`vitest run`) |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run scripts/discover-schema.test.mjs`
- **After every plan wave:** Run `npm test` (full suite, including Phase 1/2's existing scripts — `discover-schema.mjs` must not regress them)
- **Before `/gsd-verify-work`:** Full suite must be green, plus the manual UAT checklist below (this phase is unusually manual-UAT-heavy since its two most important behaviors — route/form discovery quality and generated document quality — are not unit-testable by design)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 03-01 | 1 | DISC-01, DISC-02 | T-03-03 (write into target repo), T-03-06 (policy predicate read as data constraint) | No write path in the extractor; explicit named predicate plus `CREATE POLICY` context tracking, exact-count assertion | e2e | `npx vitest run scripts/discovery.e2e.test.mjs` | ❌ W0 | ⬜ pending |
| 03-01-02 | 03-01 | 1 | DISC-01 | T-03-01 (path traversal via project path), T-03-02 (oversized/pathological SQL file) | `resolveWithinRoot` refuses non-descendants with exit 8; `statSync` size cap before read, skip-and-report | unit | `npx vitest run scripts/discover-schema.test.mjs` | ❌ W0 | ⬜ pending |
| 03-02-01 | 03-02 | 2 | DISC-01 | T-03-10 (form labelled with the wrong submission mechanism) | Ordered colocated-action check before any fetch assumption; resolved API path asserted to exist | unit | `npx vitest run scripts/discovery-surfaces.test.mjs` | ❌ W0 | ⬜ pending |
| 03-02-02 | 03-02 | 2 | DISC-01 | T-03-08 (unscoped glob), T-03-11 (unrecognised layout reported as untestable) | Exclusion list asserted in doc, skill and a synthetic-tree test; `unknown` asserted as a distinct named outcome | unit | `npx vitest run scripts/discovery-surfaces.test.mjs` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03-03 | 3 | DISC-02 | T-03-12 (dispatch flag pre-approving an action), T-03-14 (short ID resolving to a longer case) | `FORBIDDEN_DISPATCH_FLAGS` rejection with exit 9; anchored heading lookup proven against a 12-case document | unit | `npx vitest run scripts/test-case-doc.test.mjs` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03-03 | 3 | DISC-02, DISC-03 | T-03-16 (scoped instruction widening into a whole-repo read) | Scoped document's scope line lists individual files; asserted against the scoped golden fixture | unit | `npx vitest run scripts/test-case-doc.test.mjs` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03-03 | 3 | DISC-01, DISC-02, DISC-03 | T-03-03 (write into target repo) | Real-repo run leaves both working trees clean outside `qa-reports/` | e2e + manual | `node scripts/discover-schema.mjs --project-root c:/franquix` and `--project-root c:/dotax` (both exit 0, non-empty constraint sets) plus the `<human-check>` in 03-03 Task 3 | ✅ (script from 03-01) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs assigned by the planner as `{plan}-{task ordinal}`. Row `03-01-02` closes both threat rows the original seed carried.*

---

## Wave 0 Requirements

- [ ] `scripts/discovery.e2e.test.mjs` — new (plan 03-01 Task 1), the tracer's end-to-end lock: fixture repo → schema JSON → conforming document that cites the discovered constraint
- [ ] `scripts/discover-schema.test.mjs` — new (plan 03-01 Task 2), covers DISC-01's migration-constraint extraction, including a fixture with both a real `CHECK (` and a `WITH CHECK (` in the same file to assert the disambiguation
- [ ] `scripts/__fixtures__/mock-target-repo/` — new fixture directory (plan 03-01 Task 1 seeds one `route.ts` and two `.sql` migrations; plan 03-02 Task 1 adds the `actions.ts` + `page.tsx` pair and the client-fetch pair) so the tests don't depend on the real DATAX/dotax/franquix repos being present on disk at test time
- [ ] `scripts/__fixtures__/mock-target-repo-pages/` and `scripts/__fixtures__/mock-target-repo-hybrid/` — new (plan 03-02 Task 2), subjects for the Pages Router and both-present branches of D-08
- [ ] `scripts/discovery-surfaces.test.mjs` — new (plan 03-02), proves each documented detection pattern finds the surfaces it claims and that the reference doc has not drifted from the test
- [ ] `scripts/__fixtures__/sample-test-cases.md` (12 cases, plan 03-01) and `scripts/__fixtures__/sample-test-cases-scoped.md` (plan 03-03) — golden documents; the 12-case count is required so the `case-1` / `case-12` lookup collision is real rather than synthetic
- [ ] `scripts/test-case-doc.test.mjs` — new (plan 03-03 Task 1), lookup-collision, validation-failure and CLI exit-code coverage

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Route/form discovery via Glob+Grep finds real routes/forms across App Router repos, including franquix's Server Actions form pattern | DISC-01 | Orchestrator-level reasoning over live tool calls against real repos, not testable code | Point the agent at franquix and at one of dotax/DATAX-web; confirm discovered surfaces include at least one Server Action form (franquix) and one client-fetch form (dotax/DATAX-web) |
| Generated test-cases.md matches the D-01–D-06 structure (5 fields + ejecución, case-N IDs, grouped by surface, editable) for a real discovered surface | DISC-02 | Output is a human-reviewed document, not an assertable unit | Run discovery against one real target repo, inspect the generated test-cases.md against CONTEXT.md's decisions D-01 through D-06 |
| A one-off NL instruction naming a specific route produces cases grounded only in that route's file(s), with no full-repo scan triggered | DISC-03 | Orchestrator behavior over live tool calls; distinguishing "read the named file" from "scanned everything" isn't unit-testable | Give the agent a specific-flow instruction, confirm (by observing tool calls) it reads only the named surface, not the whole repo |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every one of the seven tasks carries at least one `<automated>` command
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — no gap at all; every task runs the full suite plus its own focused file
- [x] Wave 0 covers all MISSING references — each new test file is created by the task that first needs it, listed above with its owning plan and task
- [x] No watch-mode flags — every command is `vitest run` or a one-shot `node -e` check
- [x] Feedback latency < 15s — the focused per-task commands run a single file; the full suite is the per-wave gate
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner sign-off 2026-08-20. Two of this phase's three behaviours that RESEARCH called manual-only were converted to automated coverage rather than left to UAT: document-structure conformance is now asserted by `parseTestCasesDoc`/`validateTestCasesDoc` against golden fixtures, and detection-pattern correctness is asserted by `scripts/discovery-surfaces.test.mjs` against fixture repos in all three router layouts. What genuinely remains manual is the real-repo run in 03-03 Task 3, collected at the phase gate per `workflow.human_verify_mode: end-of-phase`.
