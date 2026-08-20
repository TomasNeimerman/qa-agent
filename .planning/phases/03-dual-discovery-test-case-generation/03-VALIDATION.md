---
phase: 3
slug: dual-discovery-test-case-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-20
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
| 03-01-01 | 03-01 | 1 | DISC-01 | Path traversal via malicious project path | Resolve supplied project root to absolute path, refuse files outside it | unit | `npx vitest run scripts/discover-schema.test.mjs` | ❌ W0 | ⬜ pending |
| 03-01-02 | 03-01 | 1 | DISC-01 | Oversized/pathological SQL migration file | Cap per-file read size, skip-and-report instead of parsing | unit | `npx vitest run scripts/discover-schema.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Note: the planner assigns final task IDs — this row set is seeded from RESEARCH.md's Phase Requirements → Test Map and may be extended per plan.*

---

## Wave 0 Requirements

- [ ] `scripts/discover-schema.test.mjs` — new, covers DISC-01's migration-constraint extraction, including a fixture with both a real `CHECK (` and a `WITH CHECK (` in the same file to assert the disambiguation
- [ ] `scripts/__fixtures__/mock-target-repo/` — new fixture directory (a few `route.ts`, one `actions.ts` + `page.tsx` pair, 2-3 `.sql` migration files) so `discover-schema.mjs`'s tests don't depend on the real DATAX/dotax/franquix repos being present on disk at test time

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Route/form discovery via Glob+Grep finds real routes/forms across App Router repos, including franquix's Server Actions form pattern | DISC-01 | Orchestrator-level reasoning over live tool calls against real repos, not testable code | Point the agent at franquix and at one of dotax/DATAX-web; confirm discovered surfaces include at least one Server Action form (franquix) and one client-fetch form (dotax/DATAX-web) |
| Generated test-cases.md matches the D-01–D-06 structure (5 fields + ejecución, case-N IDs, grouped by surface, editable) for a real discovered surface | DISC-02 | Output is a human-reviewed document, not an assertable unit | Run discovery against one real target repo, inspect the generated test-cases.md against CONTEXT.md's decisions D-01 through D-06 |
| A one-off NL instruction naming a specific route produces cases grounded only in that route's file(s), with no full-repo scan triggered | DISC-03 | Orchestrator behavior over live tool calls; distinguishing "read the named file" from "scanned everything" isn't unit-testable | Give the agent a specific-flow instruction, confirm (by observing tool calls) it reads only the named surface, not the whole repo |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
