---
phase: 04-edge-case-input-validation-quality
plan: 01
subsystem: testing
tags: [test-case-generation, sql-parsing, discovery, vitest, boundary-testing]

# Dependency graph
requires:
  - phase: 03-dual-discovery-test-case-generation
    provides: discover-schema.mjs's CHECK-constraint extraction (extractConstraints), test-case-doc.mjs's document schema/validator, the 5-field case schema and Origen del surface citation rule
provides:
  - "parseCheckBounds() — pure parser turning a SQL CHECK expression string into {min,max} or null"
  - "constraint.bounds field on every record discoverSchema() returns"
  - "the four-case boundary-generation rule (min-1/min/max/max+1) documented in SKILL.md's Case generation protocol"
  - "the D-08 subcategory-titling convention (campo requerido faltante, formato inválido, valor límite) in references/test-case-format.md"
  - "the D-09/D-10 Regla de límites cardinality rule (4/one-pair/0) in references/test-case-format.md"
  - "a 14-case golden fixture (scripts/__fixtures__/sample-test-cases.md) proving the whole pipeline end to end"
affects: [04-02, 04-03, 04-04, 04-05, 04-06]

actuals:
  tokens: 4953
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Numeric CHECK-bound extraction as a pure regex-based parser (parseCheckBounds), mirroring the file's existing pure-helper style (stripSqlComments, extractBalancedParens) rather than a general SQL expression evaluator"
    - "Exclusive-to-inclusive bound normalization at parse time (a > 0 -> min:1) so downstream boundary-case generation never needs to know whether the source CHECK was inclusive or exclusive"

key-files:
  created: []
  modified:
    - scripts/discover-schema.mjs
    - scripts/discover-schema.test.mjs
    - scripts/discovery.e2e.test.mjs
    - scripts/test-case-doc.test.mjs
    - scripts/__fixtures__/sample-test-cases.md
    - SKILL.md
    - references/test-case-format.md

key-decisions:
  - "parseCheckBounds precedence: two-sided BETWEEN is tried first, then >=/<=/>/<, with bare > and < guarded by a negative lookahead so they never also match the >=/<= forms"
  - "Bounded digit-count regex classes (\\d{1,15}) used throughout parseCheckBounds instead of unbounded \\d+, per the plan's T-04-03 DoS-mitigation instruction for untrusted migration text"
  - "dia_cierre boundary quartet titled without dash characters (\"dia_cierre limite inferior menos 1\", etc.) so the heading's own em-dash delimiter (case-N — title) stays unambiguous"

requirements-completed: [DISC-04]

coverage:
  - id: D1
    description: "parseCheckBounds() recognizes BETWEEN and >=/<=/>/< numeric CHECK shapes, normalizing an exclusive bound to the adjacent inclusive integer, and returns null for any unrecognized shape (value-set IN, multi-column business rules)"
    requirement: "DISC-04"
    verification:
      - kind: unit
        ref: "scripts/discover-schema.test.mjs#describe('parseCheckBounds')"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every constraint record discoverSchema() returns carries a bounds field ({min,max} or null), derived from its own check expression"
    requirement: "DISC-04"
    verification:
      - kind: unit
        ref: "scripts/discover-schema.test.mjs#describe('discoverSchema — bounds attachment')"
        status: pass
      - kind: e2e
        ref: "scripts/discovery.e2e.test.mjs#'reports a machine-readable bounds object on the dia_cierre constraint record (D-09)'"
        status: pass
    human_judgment: false
  - id: D3
    description: "One discovered two-sided CHECK constraint (dia_cierre BETWEEN 0 AND 6) produces exactly four boundary cases (-1, 0, 6, 7) in min-1/min/max/max+1 order, each appearing in exactly one case's Pasos, in a document that validates back through test-case-doc.mjs"
    requirement: "DISC-04"
    verification:
      - kind: e2e
        ref: "scripts/discovery.e2e.test.mjs#'turns the discovered dia_cierre bounds into exactly four boundary cases (min-1/min/max/max+1), each appearing in exactly one case Pasos'"
        status: pass
      - kind: e2e
        ref: "scripts/discovery.e2e.test.mjs#'validates the golden document back through validateTestCasesDoc as valid, carrying 14 cases'"
        status: pass
      - kind: other
        ref: "node scripts/test-case-doc.mjs --file scripts/__fixtures__/sample-test-cases.md (counts.cases: 14, valid: true)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The four-case boundary rule is stated in SKILL.md's Case generation protocol and references/test-case-format.md's Regla de límites section, and the D-08 subcategory-titling convention (campo requerido faltante, formato inválido, valor límite) is documented with worked examples"
    requirement: "DISC-04"
    verification:
      - kind: other
        ref: "grep -c 'min-1' SKILL.md references/test-case-format.md; grep -c 'Subcategoría de caso'/'Regla de límites'/'campo requerido faltante'/'formato inválido'/'valor límite' references/test-case-format.md"
        status: pass
    human_judgment: false

duration: ~25min
completed: 2026-09-17
status: complete
---

# Phase 4 Plan 1: Boundary-Value Discovery-to-Generation Tracer Summary

**A discovered two-sided SQL CHECK constraint now travels deterministically from `discover-schema.mjs`'s JSON to exactly four correctly-titled, correctly-cited boundary cases, proving DISC-04's whole pipeline end to end before the phase's other five plans expand outward from it.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-09-17
- **Tasks:** 2 completed
- **Files modified:** 7

## Accomplishments

- Added `parseCheckBounds(checkExpr)` to `scripts/discover-schema.mjs` — a pure, bounded-regex parser recognizing `BETWEEN`, `>=`, `<=`, `>`, `<` numeric CHECK shapes, normalizing an exclusive bound to the adjacent inclusive integer, and returning `null` for any shape it doesn't recognize (never guessing).
- Attached a `bounds` field to every constraint record `discoverSchema()` returns, derived from that record's own `check` expression in the same post-loop pass that already fills `enumValues`.
- Rewrote the `dia_cierre` boundary quartet in the golden fixture (`scripts/__fixtures__/sample-test-cases.md`) to carry the exact four values the discovered bound implies (-1, 0, 6, 7) in min-1/min/max/max+1 order, with human-readable Spanish subcategory titles, and renumbered the trailing `usuarios` cases to keep the document gapless (case-1..case-14).
- Locked the whole path with an end-to-end test: `discover-schema.mjs`'s JSON → the four boundary values → each value's unique appearance in the golden document's `Pasos` → `validateTestCasesDoc` returning `valid: true` with `counts.cases: 14`.
- Documented the D-08 subcategory-titling convention (campo requerido faltante, formato inválido, valor límite) and the D-09/D-10 four-case/one-pair/zero-case boundary cardinality rule in `references/test-case-format.md`, and extended `SKILL.md`'s coverage-honesty bullet so the chat summary must disclose the generated case count (broken down by boundary expansion) before the developer acts on the document.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "one discovered bound becomes four boundary cases"** - `356bfa8` (feat)
2. **Task 2: Subcategory titling convention and the never-invent-a-boundary rule** - `04cc112` (feat)

_Note: this plan's tasks combined test and implementation changes into one commit each rather than separate RED/GREEN commits — Task 1 is `type="tracer"`, whose execution_flow instructs "execute and commit exactly like `type=auto`... atomic commit," which takes precedence over the generic `tdd="true"` RED/GREEN split for tracer tasks specifically._

## Files Created/Modified

- `scripts/discover-schema.mjs` - Added `parseCheckBounds()` and the `bounds` field attachment in `discoverSchema()`
- `scripts/discover-schema.test.mjs` - Unit coverage for every recognized/unrecognized `parseCheckBounds` shape, plus `discoverSchema` bounds-attachment coverage
- `scripts/discovery.e2e.test.mjs` - Schema-tier `bounds` assertion, document-tier counts bumped 12→14, new cross-tier boundary-quartet and `validateTestCasesDoc` assertions
- `scripts/test-case-doc.test.mjs` - Fixed 3 pre-existing assertions (case count 12→14, case-12's expected title) broken as a direct consequence of the fixture rewrite (Rule 1 auto-fix, not in the plan's `files_modified` list)
- `scripts/__fixtures__/sample-test-cases.md` - Rewrote the `dia_cierre` boundary quartet (case-9..case-12) and renumbered `usuarios` cases to case-13/case-14
- `SKILL.md` - Added the four-case boundary-generation bullet and extended the coverage-honesty bullet in `## Case generation protocol`
- `references/test-case-format.md` - Added `### Subcategoría de caso (D-08)` and `### Regla de límites (D-09/D-10)` sections

## Decisions Made

- Treated Task 1 (`type="tracer"`, `tdd="true"`) as a single atomic commit per the tracer execution rule, rather than splitting into separate RED/GREEN commits — the plan's own `<execution_flow>` guidance for `type="tracer"` explicitly says "execute and commit exactly like `type=auto`."
- Chose `\d{1,15}` bounded digit-count classes throughout `parseCheckBounds`'s regexes (not unbounded `\d+`) to satisfy the plan's threat-model mitigation for T-04-03 (untrusted migration text, DoS via catastrophic backtracking).
- Titled the four `dia_cierre` boundary cases without any dash character (`dia_cierre limite inferior menos 1`, etc.), matching the plan's explicit instruction to keep the case heading's own em-dash delimiter unambiguous.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 3 pre-existing `test-case-doc.test.mjs` assertions broken by the fixture rewrite**
- **Found during:** Task 2 (running the full `npm test` verification step)
- **Issue:** `scripts/test-case-doc.test.mjs` (not in this plan's `files_modified` list) hard-coded the golden fixture's old case count (12) in two tests and the old case-12 title (`Rol fuera del dominio enumerado`) in a third — all three broke as a direct, mechanical consequence of Task 1 rewriting `sample-test-cases.md` to carry 14 cases with a new case-12.
- **Fix:** Updated the two count assertions to 14 and the title assertion to `dia_cierre limite superior mas 1` (case-12's new title).
- **Files modified:** `scripts/test-case-doc.test.mjs`
- **Verification:** `npm test` — full suite green (283/283) after the fix.
- **Committed in:** `04cc112` (part of Task 2's commit)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Necessary for correctness — an untouched pre-existing test file would have left the full suite red after a change the plan itself required. No scope creep beyond the three assertions the fixture rewrite directly invalidated.

## Issues Encountered

The worktree branch (`worktree-agent-ac71c34bb2449da7b`) was created before the phase-04 planning commits (04-01-PLAN.md and siblings) landed on `main` — the plan file did not exist in the worktree at spawn time. Verified the worktree branch had zero divergent commits from its base and a clean working tree, then fast-forwarded (`git merge --ff-only main`) to pick up the phase-04 planning artifacts before starting execution. This was a safe, non-destructive update (the worktree's own history is a strict prefix of `main`'s), not a rewrite of any protected ref.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The boundary-generation pipeline (`parseCheckBounds` → `bounds` field → four-case rule → subcategory titling) is proven end to end and documented in both `SKILL.md` and `references/test-case-format.md`. Plans 04-02 through 04-06 (enum-based edge cases, RLS/permission-boundary discovery, `QA_AGENT_TOKEN_SECONDARY` dispatch, and the remaining DISC-05 surfaces) can build on this tracer's established pattern — a pure parser in `discover-schema.mjs` feeding a documented, human-titled case-generation rule — without re-deriving the discovery-to-generation contract from scratch. No blockers identified for the next plan in the wave.

## Self-Check: PASSED

All 7 created/modified files and all 3 commit hashes (356bfa8, 04cc112, 89bc012) verified present.

---
*Phase: 04-edge-case-input-validation-quality*
*Completed: 2026-09-17*
