---
phase: 05-smoke-test-mode-cross-project-distribution
plan: 01
subsystem: testing
tags: [test-case-doc, cli, smoke-test, skill-protocol]

# Dependency graph
requires:
  - phase: 03-dual-discovery-test-case-generation
    provides: "test-cases.md document format, parseTestCasesDoc/findCase/validateTestCasesDoc readers, surface grouping (D-05), Ejecución API/UI field (D-03/D-04)"
  - phase: 04-edge-case-input-validation-quality
    provides: "pendiente/pendienteMotivo pending-execution shape on the Ejecución field (D-02/D-04 of Phase 4)"
provides:
  - "selectSmokeCases() — pure, exported deterministic smoke-set selector (one positivo case per surface)"
  - "--smoke CLI branch on scripts/test-case-doc.mjs, reusing exit codes 0/2/9"
  - "golden fixture sample-test-cases-smoke.md covering first-positivo-not-first-case, no-positivo-surface, and pending-first-positivo edges"
  - "SKILL.md ## Smoke-test protocol section + smoke trigger vocabulary in frontmatter description"
affects: [05-02-cross-project-validation, 05-03-packaging-distribution]

# Actuals (#2632)
actuals:
  tokens: 6500
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic-script vs. orchestrator-judgment split: smoke selection is a pure function over an already-parsed document, exported alongside parseTestCasesDoc/findCase/validateTestCasesDoc rather than a new sibling script"
    - "New CLI flags reuse the module's existing exit-code table (0/2/9) rather than introducing new codes — 'no new execution mechanism' framing carried through from D-07"

key-files:
  created:
    - scripts/__fixtures__/sample-test-cases-smoke.md
  modified:
    - scripts/test-case-doc.mjs
    - scripts/test-case-doc.test.mjs
    - SKILL.md

key-decisions:
  - "selectSmokeCases implemented as an export on the existing test-case-doc.mjs module (Claude's Discretion option A from 05-CONTEXT.md), not a new sibling script — mirrors the existing findCase/validateTestCasesDoc pattern exactly and needed no new CLI wrapper scaffolding"
  - "skipped-surface entries use a `surface` key (not `heading`) to mirror the `selected` array's own `surface` property, per the plan's acceptance_criteria wording, even though the <behavior> prose used the word 'heading' loosely"
  - "--smoke combined with --case exits 2 (not 9), following the same class of two-flag refusal api-client.mjs already makes for --secondary/--storage-state — a configuration conflict, not a document defect"

patterns-established:
  - "Tracer feedback gate observed live: Task 1 (type=tracer) was committed, verified end-to-end via its own <verify> commands, then paused at a checkpoint:human-verify before Task 2 (the expansion task) began, per the executor's interactive-run tracer protocol"

requirements-completed: [REP-03]

coverage:
  - id: D1
    description: "selectSmokeCases() selects exactly one positivo case per surface, in document order, for the four-surface golden document (case-1, case-6, case-8, case-13)"
    requirement: REP-03
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs#selectSmokeCases — the deterministic smoke rule (D-02) > selects one positivo case per surface, in document order, for the full-scan golden document"
        status: pass
      - kind: integration
        ref: "node scripts/test-case-doc.mjs --file scripts/__fixtures__/sample-test-cases.md --smoke"
        status: pass
    human_judgment: false
  - id: D2
    description: "A surface with no positivo case contributes nothing and is named by heading in the skipped array; a pending first-positivo stays selected and is never replaced by a later runnable positivo"
    requirement: REP-03
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs#selectSmokeCases — the deterministic smoke rule (D-02) > a surface with no positivo case contributes nothing and is named in skipped"
        status: pass
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs#selectSmokeCases — the deterministic smoke rule (D-02) > a pending first positivo stays selected and is never replaced by a later runnable positivo"
        status: pass
    human_judgment: false
  - id: D3
    description: "The --smoke CLI branch writes nothing back into the document read (no write-back) and exits 0/2/9 exactly as the existing --case branch does, including the two-flag conflict refusal"
    requirement: REP-03
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs#CLI > --smoke exits 0 for the golden document, selecting case-1, case-6, case-8, case-13"
        status: pass
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs#CLI > --smoke combined with --case exits 2, naming both flags on stderr"
        status: pass
      - kind: manual_procedural
        ref: "git diff --exit-code on the three fixtures after running --smoke against each — reported clean"
        status: pass
    human_judgment: false
  - id: D4
    description: "SKILL.md carries a ## Smoke-test protocol section, triggered by natural language with no new flag, that hands the selected set to ## Running generated cases steps 4-6 unchanged"
    requirement: REP-03
    verification:
      - kind: manual_procedural
        ref: "grep -c 'Smoke-test protocol' SKILL.md >= 1; grep -ci 'smoke' SKILL.md >= 5; grep confirms literal test-case-doc.mjs --file ... --smoke invocation and a reference to ## Running generated cases by name"
        status: pass
    human_judgment: false

# Metrics
duration: 30min
completed: 2026-09-21
status: complete
---

# Phase 5 Plan 1: Smoke-Test Selection & Protocol Summary

**Deterministic one-positivo-case-per-surface smoke selector (`selectSmokeCases` + `--smoke` CLI) wired into a new `SKILL.md` Smoke-test protocol that hands off to the existing Run protocol unchanged.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-21T10:00:00-03:00
- **Completed:** 2026-09-21T10:30:06-03:00
- **Tasks:** 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- `selectSmokeCases(parsedDoc)` exported from `scripts/test-case-doc.mjs`: a pure, deterministic reducer that takes the first `positivo` case per surface, names uncovered surfaces in `skipped`, and keeps a pending first-positivo selected (never silently replaced by a later runnable case).
- `--smoke` branch on the reader's CLI, printing `{ selected, skipped, counts }` as one JSON line, exiting 0/9 through the same codes the `--case` branch already uses; `--smoke` combined with `--case` exits 2 naming both flags.
- New golden fixture `scripts/__fixtures__/sample-test-cases-smoke.md` carrying all three selection edges (first-positivo-not-first-case, no-positivo surface, pending-first-positivo) in a document that also validates cleanly on its own.
- `SKILL.md`'s new `## Smoke-test protocol` section documents the natural-language trigger, the no-document discovery branch, the re-read/no-write-back rule, the CLI-resolved selection, the honest pre-dispatch summary, and the unchanged handoff to `## Running generated cases` steps 4-6 — with the frontmatter `description` extended to route smoke requests to this skill.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "one validated document becomes a smoke set" — selection only, no dispatch change** - `6f3539f` (feat, TDD tracer)
2. **Task 2: The `## Smoke-test protocol` section and its natural-language trigger** - `15e7de8` (docs)

_Task 1 was `type="tracer" tdd="true"`. Auto mode was confirmed inactive for this project (`workflow.auto_advance=false`, `workflow._auto_chain_active=false`, checked via `gsd-tools query config-get`), so per the executor's tracer feedback-gate protocol, execution paused at a `checkpoint:human-verify` immediately after committing Task 1 — the tracer's own `<verify>` had already been run and passed — and only resumed into Task 2 after the coordinator relayed the user's approval._

## Files Created/Modified
- `scripts/test-case-doc.mjs` - Added `selectSmokeCases()` export and the `--smoke` CLI branch; widened the head-comment exit-code table
- `scripts/test-case-doc.test.mjs` - 20 new tests: a `selectSmokeCases` describe block covering every `<behavior>` case, an `exports` assertion, and 7 new CLI tests for `--smoke`
- `scripts/__fixtures__/sample-test-cases-smoke.md` - New golden fixture (created) with 3 surfaces / 6 cases exercising the three selection edges
- `SKILL.md` - New `## Smoke-test protocol` section, smoke trigger phrases in frontmatter `description`, and a widened code-9 row in the `## Configuration` exit-code table

## Decisions Made
- `selectSmokeCases` lives inside `scripts/test-case-doc.mjs` rather than a new sibling script (Claude's Discretion, 05-CONTEXT.md) — it needed no CLI scaffolding of its own since the module's existing `main()`/`parseArgs()` block already dispatches by flag.
- Skipped-surface entries carry a `surface` key (matching `selected`'s own `surface` property) rather than `heading`, following the plan's `acceptance_criteria` wording literally over the looser `<behavior>` prose.
- `--smoke` + `--case` is a configuration conflict (exit 2), not a malformed-document problem (exit 9) — consistent with how `api-client.mjs` already refuses `--secondary` combined with `--storage-state`.

## Deviations from Plan

None - plan executed exactly as written. The tracer feedback-gate checkpoint (pausing after Task 1 for human confirmation before Task 2) was not a deviation — it is the executor's own mandatory protocol for `type="tracer"` tasks when auto mode is inactive, not a plan-authored checkpoint or an unplanned discovery.

## Issues Encountered

Two pre-existing, unrelated test failures were observed in `scripts/ui-login.test.mjs` on every `npm test` run during this plan (`exit status 7` instead of the expected `2` for the "missing UI credentials" test, twice). Reproduced against the pre-plan commit via `git stash` — confirmed these failures exist independently of this plan's changes, most likely caused by `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` being set in the ambient shell environment, leaking through and changing the script's exit code. Out of scope per the executor's scope-boundary rule (only auto-fix issues directly caused by the current task's changes) — not touched, logged here for visibility. `npm test -- scripts/test-case-doc.test.mjs` (this plan's own module) is 61/61 green; the full suite is 356/358 green with only the two pre-existing failures above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `selectSmokeCases()` and the `--smoke` CLI are ready for plan 05-02's cross-project validation pass (running the smoke test live against DATAX/dotax/franquix).
- `## Smoke-test protocol` is fully documented and cross-references `## Discovery protocol`/`## Case generation protocol`/`## Running generated cases` unchanged — no new mechanism for plan 05-03's packaging/distribution tightening to account for.
- No blockers. The two pre-existing `ui-login.test.mjs` failures noted above are unrelated to this plan's scope and should be triaged separately (likely an environment-variable leak in the test shell, not a code defect).

## Self-Check: PASSED

- FOUND: scripts/test-case-doc.mjs
- FOUND: scripts/test-case-doc.test.mjs
- FOUND: scripts/__fixtures__/sample-test-cases-smoke.md
- FOUND: SKILL.md
- FOUND commit: 6f3539f
- FOUND commit: 15e7de8

---
*Phase: 05-smoke-test-mode-cross-project-distribution*
*Completed: 2026-09-21*
