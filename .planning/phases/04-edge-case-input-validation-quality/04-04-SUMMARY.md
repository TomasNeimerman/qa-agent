---
phase: 04-edge-case-input-validation-quality
plan: 04
subsystem: testing
tags: [test-case-generation, document-contract, permission-boundary, vitest]

# Dependency graph
requires:
  - phase: 03-dual-discovery-test-case-generation
    provides: test-case-doc.mjs's document schema/validator, the five-field case schema, EXECUTION_MODES, FORBIDDEN_DISPATCH_FLAGS
  - phase: 04-01
    provides: the boundary-generation tracer establishing discover-schema.mjs -> test-case-doc.mjs -> references/test-case-format.md as one contract that must never drift apart
provides:
  - "Qualified-value pending-execution state on Ejecución: '<API|UI> (pendiente — <motivo>)' — a permission case generated without QA_AGENT_TOKEN_SECONDARY is parseable, still records its layer (D-04), and is never silently dropped (D-02)"
  - "splitEjecucion() helper in scripts/test-case-doc.mjs splitting the pending qualifier off before the unchanged two-value EXECUTION_MODES enum check runs"
  - "pendiente (boolean) and pendienteMotivo (string|null) fields on every parsed case, returned by parseTestCasesDoc, findCase and the CLI's --case JSON"
  - "counts.pendientes in validateTestCasesDoc's return value, distinct from counts.byEjecucion"
  - "### Regla de ejecución pendiente (D-02/D-04) section in references/test-case-format.md, plus a pending case-4 in the Worked example block"
affects: [04-06]

actuals:
  tokens: 4737
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Qualifier-on-enum-value parsing (splitEjecucion): a regex splits an optional parenthesised marker off a field's value before the unchanged enum check runs, rather than widening the enum itself — keeps the checked set stable while letting the field carry an orthogonal fact"

key-files:
  created: []
  modified:
    - scripts/test-case-doc.mjs
    - scripts/test-case-doc.test.mjs
    - references/test-case-format.md

key-decisions:
  - "Task 1 checkpoint (option-b, qualified value): Ejecución stays API or UI and carries an optional '(pendiente — <motivo>)' qualifier, rather than a third literal (option-a) or a separate sixth field (option-c). Selected by the user after the checkpoint was reported in a prior interrupted dispatch (zero commits/writes from that dispatch — nothing lost). Reasoning: option-b is the only representation that keeps both D-02 ('pendiente — falta 2do usuario' marking) and D-04 (the field still records which layer the case belongs to) fully intact simultaneously. The reason string is parsed, not lost, so a future dispatch step (SKILL.md's '## Running generated cases', wired in 04-06) can refuse a pending case by name with the document's own explanation rather than attempting it and discovering the missing credential at request time. Becoming runnable later is a smaller hand-edit (delete the qualifier) than option-a's full value replacement. This matches the planner's own recommendation in 04-04-PLAN.md's resume-signal, which explicitly noted 04-RESEARCH.md had recommended option-a on lowest-diff grounds but the planner overrode that in favor of keeping both locked decisions intact."
  - "counts.pendientes chosen as a sibling total rather than a third key inside counts.byEjecucion — a pending case is still counted under its own API/UI key (so the pre-existing 'byEjecucion sums to counts.cases' test and invariant needed zero changes), with pendientes giving a reader the distinct 'how many could not run' figure without re-parsing the document."
  - "EXECUTION_MODES itself was left unchanged (['API', 'UI']) — the pending qualifier is stripped off by splitEjecucion() before the enum check runs, so the existing 'EXECUTION_MODES pinned to two values' test in the exports describe block needed no update, and every out-of-set-layer refusal (with or without a pending qualifier attached) still throws/collects unchanged."

requirements-completed: [DISC-05]

coverage:
  - id: D1
    description: "A permission case generated while QA_AGENT_TOKEN_SECONDARY is not configured is written into the document as 'API (pendiente — <motivo>)' (or UI), parses successfully via parseTestCasesDoc/findCase with pendiente:true and pendienteMotivo populated, and is never silently dropped"
    requirement: "DISC-05"
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs#describe('Ejecución pending-execution state (D-02/D-04)') > 'parses a pending case successfully, carrying its layer, pendiente flag and reason'"
        status: pass
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs#describe('Ejecución pending-execution state (D-02/D-04)') > 'findCase resolves the same pending shape as parseTestCasesDoc'"
        status: pass
    human_judgment: false
  - id: D2
    description: "node scripts/test-case-doc.mjs --file <path> exits 0 on a document containing a pending permission case, and its JSON counts distinguishes the pending case from runnable API/UI cases via counts.pendientes"
    requirement: "DISC-05"
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs#describe('Ejecución pending-execution state (D-02/D-04)') > '`node scripts/test-case-doc.mjs --file <path>` exits 0 on a document containing a pending case'"
        status: pass
      - kind: other
        ref: "node scripts/test-case-doc.mjs --file <manually constructed pending doc> — exit 0, counts.pendientes:1"
        status: pass
    human_judgment: false
  - id: D3
    description: "A pending case still records which execution layer it belongs to (D-04) — ejecucion stays 'API' or 'UI' on the parsed object even when pendiente is true"
    requirement: "DISC-05"
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs#describe('Ejecución pending-execution state (D-02/D-04)') > 'parses a pending case successfully, carrying its layer, pendiente flag and reason'"
        status: pass
    human_judgment: false
  - id: D4
    description: "An Ejecución value outside the allowed set — with or without a pending qualifier attached — still throws TestCaseFormatError (parseCaseBlock/findCase) or is collected as an error (validateTestCasesDoc), naming the offending case ID and value; widening the set to accept a qualifier does not turn it into a free-text field"
    requirement: "DISC-05"
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs#describe('Ejecución pending-execution state (D-02/D-04)') > 'an Ejecución value outside the allowed set still throws even with a pending qualifier attached, naming the case ID'"
        status: pass
      - kind: other
        ref: "node scripts/test-case-doc.mjs --file <doc with Ejecución: MOVIL> — exit 9, stderr names case-1 and MOVIL"
        status: pass
    human_judgment: false
  - id: D5
    description: "A pending case's block is still scanned for FORBIDDEN_DISPATCH_FLAGS with no new code path skipping it — a pending case carrying a forbidden dispatch flag in its Pasos still exits 9 / throws, naming the flag and case ID"
    requirement: "DISC-05"
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs#describe('Ejecución pending-execution state (D-02/D-04)') > 'a pending case whose Pasos contains a forbidden dispatch flag is still rejected, naming the flag'"
        status: pass
    human_judgment: false
  - id: D6
    description: "references/test-case-format.md and scripts/test-case-doc.mjs state the same allowed Ejecución set; the format doc's ### Allowed values, new ### Regla de ejecución pendiente (D-02/D-04) section (stating all five rules: always generated, marked in the documented shape, a fact about configuration not the application, made runnable by hand-edit or regeneration, never dispatched) and Worked example block are all updated to match Task 2's committed shape"
    requirement: "DISC-05"
    verification:
      - kind: other
        ref: "grep -c 'Regla de ejecución pendiente' references/test-case-format.md == 1; grep -c 'D-02' references/test-case-format.md == 4; grep -c 'ejecución pendiente' references/test-case-format.md == 1"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-18
status: complete
---

# Phase 4 Plan 4: Pending-Execution State for Ungeneratable Permission Cases Summary

**`Ejecución` now carries an optional `(pendiente — <motivo>)` qualifier after its unchanged `API`/`UI` layer literal — a permission case generated without `QA_AGENT_TOKEN_SECONDARY` configured is parsed, counted and validated without losing D-04's layer or weakening any existing refusal.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-18
- **Tasks:** 3 (1 checkpoint:decision, 2 auto)
- **Files modified:** 3

## Task 1: Checkpoint Decision (resumed, not re-asked)

This plan's Task 1 was a `checkpoint:decision` gate reached by a prior, interrupted dispatch of this exact plan (zero commits, zero file writes from that dispatch — confirmed via git log/git status before this dispatch started, so nothing was lost). The user's answer — **option-b (qualified value)** — was relayed into this dispatch's prompt and is recorded here per the plan's own resume-signal instruction, without re-prompting.

**Selected:** option-b — `Ejecución` stays `API` or `UI` and carries a pending qualifier.

**Why:** Option-b is the only one of the three offered options that keeps both locked decisions fully intact at once — D-04 ("the field still records which layer the case belongs to") stays true even for a pending case, and D-02 ("pendiente — falta 2do usuario" marking) is still visibly present with its reason. The reason string is parsed rather than lost, so a later dispatch step (`SKILL.md`'s `## Running generated cases`, wired in plan 04-06) can refuse a pending case by name using the document's own explanation, instead of attempting it and discovering the missing credential at request time. Becoming runnable later is also a smaller hand-edit (delete the qualifier) than option-a's full value replacement. `04-04-PLAN.md`'s resume-signal named option-b as the planner's own recommendation, explicitly noting that `04-RESEARCH.md` had recommended option-a on lowest-diff grounds but that the planner overrode that recommendation in favor of keeping both D-02 and D-04 fully intact.

**Rejected:**
- **option-a** (third literal `pendiente`) — smallest diff, but the pending case stops recording which layer it belongs to (loses D-04 readability) and the reason has nowhere structured to live.
- **option-c** (separate sixth field) — keeps `Ejecución` untouched, but breaks the five-field case schema Phase 3 locked as D-02 of that phase, which `CASE_FIELDS` and every existing generated document assume.

## Accomplishments

- Implemented `splitEjecucion()` in `scripts/test-case-doc.mjs` — splits an optional `(pendiente — <motivo>)` qualifier off the `Ejecución` field's value before the unchanged two-value `EXECUTION_MODES` enum check runs, so `EXECUTION_MODES` itself stays exactly `['API', 'UI']`.
- Wired `pendiente` (boolean) and `pendienteMotivo` (string or `null`) onto every parsed case object returned by `parseCaseBlock`, `parseTestCasesDoc` and `findCase`, and onto the CLI's `--case` JSON output.
- Added `counts.pendientes` to `validateTestCasesDoc`'s return value as a sibling of `counts.byEjecucion` — a pending case is still counted under its own `API`/`UI` key (preserving the existing "byEjecucion sums to counts.cases" invariant) and also counted here so a reader can see how many cases the run could not execute without re-parsing.
- Preserved every existing guarantee unchanged: `scanCaseFields` never throws; `parseCaseBlock` still throws `TestCaseFormatError` naming the case ID for any layer value outside `EXECUTION_MODES` (pending qualifier or not); `validateTestCasesDoc` still collects instead of throwing; and the `FORBIDDEN_DISPATCH_FLAGS` scan in both `findCase` and `validateTestCasesDoc` runs over a pending case's own block with no new branch skipping it.
- Added 8 new tests to `scripts/test-case-doc.test.mjs` covering: successful pending-case parsing (layer/pendiente/motivo), `findCase` parity, non-pending cases reporting `pendiente: false`/`pendienteMotivo: null`, `counts.pendientes` distinctness, CLI exit 0 on a pending document (full validate and `--case`), an out-of-set layer still throwing/collecting even with a qualifier attached, and a pending case carrying a forbidden dispatch flag still being rejected.
- Updated `references/test-case-format.md`: rewrote `### Allowed values` to state the qualified-value contract, added `### Regla de ejecución pendiente (D-02/D-04)` stating all five required rules (always generated regardless of credential availability; marked in the documented `(pendiente — <motivo>)` shape; the marker is a fact about this run's configuration, never a claim about the application; made runnable by hand-edit or regeneration; never dispatched — `SKILL.md`'s `## Running generated cases` refuses it by name, wired in 04-06), and added a pending permission case (`case-4`) to the `## Worked example` block beside the existing positivo/negativo/edge examples.

## Task Commits

Each task was committed atomically:

1. **Task 1: Decide how `Ejecución` records a generated-but-not-runnable permission case** — checkpoint:decision, resolved by the user (option-b) in a prior interrupted dispatch and relayed into this dispatch's prompt; no code change, no commit (decision recorded here).
2. **Task 2: Implement the selected pending state in the document reader** — `c12d412` (feat)
3. **Task 3: Publish the pending-execution rule in the format contract** — `701cd8e` (docs)

## Files Created/Modified

- `scripts/test-case-doc.mjs` — Added `PENDING_QUALIFIER_RE`/`splitEjecucion()`, wired `pendiente`/`pendienteMotivo` into `parseCaseBlock`, `parseTestCasesDoc`, `findCase`, added `counts.pendientes` to `validateTestCasesDoc`, updated JSDoc comments on `parseTestCasesDoc`, `findCase` and `validateTestCasesDoc`
- `scripts/test-case-doc.test.mjs` — Added `describe('Ejecución pending-execution state (D-02/D-04)')` with 8 new tests
- `references/test-case-format.md` — Rewrote `### Allowed values`, added `### Regla de ejecución pendiente (D-02/D-04)`, added pending `case-4` to `## Worked example`

## Decisions Made

See "Task 1: Checkpoint Decision" above for the primary decision (option-b) and its full reasoning. Additional implementation decisions:

- `counts.pendientes` as a sibling total rather than a third key inside `counts.byEjecucion` — keeps the pre-existing "byEjecucion sums to counts.cases" test and invariant untouched while still exposing the pending count distinctly.
- `EXECUTION_MODES` left unchanged at `['API', 'UI']` — the qualifier is stripped before the enum check, so the pre-existing test pinning `EXECUTION_MODES` to exactly two values needed no update, and no out-of-set-layer refusal was weakened.

## Deviations from Plan

None - plan executed exactly as written (Task 1's checkpoint answer was supplied by the orchestrator's dispatch prompt rather than re-solicited, per the plan's own resume-signal instruction and this dispatch's explicit checkpoint-decision-already-made context).

## Issues Encountered

None. Manual CLI verification (`node scripts/test-case-doc.mjs --file <constructed doc>`, both full-validate and `--case case-1` forms) confirmed exit 0 with `counts.pendientes` set correctly on a pending document, exit 9 naming the case ID and offending value on an out-of-set layer, and matched the automated test assertions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The pending-execution state is a first-class, parseable, counted part of the document contract, matching what `references/test-case-format.md` publishes. Plan 04-06 (which wires `SKILL.md`'s `## Running generated cases` step 4 to dispatch on `Ejecución`) can now read `pendiente`/`pendienteMotivo` off any parsed case (via `parseTestCasesDoc`, `findCase`, or the CLI's `--case` JSON) to refuse a pending case by name with its own recorded reason, rather than attempting it. No blockers identified.

## Self-Check: PASSED

All 3 modified files and both commit hashes (c12d412, 701cd8e) verified present.

---
*Phase: 04-edge-case-input-validation-quality*
*Completed: 2026-09-18*
