---
phase: 04-edge-case-input-validation-quality
plan: 03
subsystem: discovery
tags: [discovery, role-guards, permission-detection, format-detection, vitest, anti-drift]

# Dependency graph
requires:
  - phase: 04-edge-case-input-validation-quality
    plan: 04-01
    provides: the boundary-generation tracer pattern (parseCheckBounds, discovery-to-generation contract) this plan's sibling detection surface builds alongside
provides:
  - "## Permission / role-guard detection rubric section in references/discovery-nextjs.md — greps the .rol comparison itself, independent of response-wrapper shape"
  - "## Required-field and format detection rubric section in references/discovery-nextjs.md — the DISC-04 format-signal scope boundary, naming DOM-01 as the deferred-formats tracker"
  - "ROLE_GUARD_PATTERN and AUTHZ_STATUS_PATTERN pattern constants in scripts/discovery-surfaces.test.mjs, locked by the pattern-doc-agreement anti-drift block"
affects: [04-06]

actuals:
  tokens: 2989
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Role-comparison-anchored detection (grep the `.rol` comparison operator, not the response wrapper) — mirrors the project's existing 'primary detection path is the observable code shape, not an assumed library/wrapper' discipline already established for schema-less validation detection"
    - "Doc-agreement anti-drift lock extended to a new pattern pair (ROLE_GUARD_PATTERN/AUTHZ_STATUS_PATTERN) plus a prose-scope lock (four format signals + DOM-01), following the same describe-block convention as every prior pattern in the file"

key-files:
  created: []
  modified:
    - references/discovery-nextjs.md
    - scripts/discovery-surfaces.test.mjs

key-decisions:
  - "AUTHZ_STATUS_PATTERN (`\\b40[13]\\b|no autorizado|solo\\s+\\S+`) corroborates near the role-comparison match rather than requiring both signals in the identical matched substring — the plan's own worked examples show the status/message living a line or two after the comparison, not inline with it"
  - "The helper-wrapped-guard proof test combines two separately-verified dotax shapes (the `!perfil || perfil.rol !== \"admin\"` comparison from app/api/bejerman/sync/route.ts and the `err(message, status)` helper from app/api/usuarios/route.ts) into one synthetic fixture written to a temp directory, per the plan's explicit instruction not to add a permanent fixture file"
  - "Format-detection section names `allowedValues` as the allowed-value-set field, forward-referencing the field name plan 04-02 (sibling wave-2 plan) introduces on discover-schema.mjs's constraint records — the field does not exist in this worktree's discover-schema.mjs yet, but this plan's scope is documentation only, not the parser"

requirements-completed: [DISC-04, DISC-05]

coverage:
  - id: D1
    description: "ROLE_GUARD_PATTERN matches a .rol comparison (strict equality or inequality against a quoted word literal) independent of the response wrapper that follows it, and the doc states plainly why the comparison is the anchor and the response shape is not"
    requirement: "DISC-05"
    verification:
      - kind: unit
        ref: "scripts/discovery-surfaces.test.mjs#describe('role-guard detection')#'matches the inline guard in the categorias fixture...'"
        status: pass
      - kind: unit
        ref: "scripts/discovery-surfaces.test.mjs#describe('role-guard detection')#'matches a helper-wrapped guard...that IMPERATIVE_ERROR_PATTERN does not match'"
        status: pass
    human_judgment: false
  - id: D2
    description: "A handler with no role comparison yields zero role-guard matches, and the rubric's closing rule states that no match means 'no role guard was detected by these named patterns,' never that the endpoint is unprotected"
    requirement: "DISC-05"
    verification:
      - kind: unit
        ref: "scripts/discovery-surfaces.test.mjs#describe('role-guard detection')#'yields zero matches for a handler with no role comparison at all'"
        status: pass
      - kind: other
        ref: "references/discovery-nextjs.md ## Permission / role-guard detection closing paragraph, manually verified present"
        status: pass
    human_judgment: false
  - id: D3
    description: "Required-field and format detection is limited to four named in-scope signals (email validator, regex validator, SQL CHECK pattern, allowed-value set), with CUIT/CUIL/Argentine-phone formats explicitly named as out of scope and tracked at DOM-01"
    requirement: "DISC-04"
    verification:
      - kind: unit
        ref: "scripts/discovery-surfaces.test.mjs#describe('required-field and format detection')"
        status: pass
      - kind: other
        ref: "grep -c 'DOM-01' / 'CUIT' references/discovery-nextjs.md, both >= 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "The pattern-doc-agreement anti-drift block fails if either new pattern source or the new prose scope statements are removed from the doc"
    requirement: "DISC-04, DISC-05"
    verification:
      - kind: unit
        ref: "scripts/discovery-surfaces.test.mjs#describe('pattern doc agreement (anti-drift lock)')#'states the role-guard and authz-status pattern sources'"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-09-17
status: complete
---

# Phase 4 Plan 3: Role-Guard and Format-Detection Rubric Summary

**The orchestrator now has a written, test-proven rule for finding a role/permission guard in a route handler regardless of how the project wraps its error response — including the helper-wrapped shape the existing imperative-error pattern silently misses — plus a named scope boundary for which input-format signals it may act on.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-17
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- Added `## Permission / role-guard detection` to `references/discovery-nextjs.md`: a primary detection path (`\.rol\s*[!=]==\s*['"]\w+['"]`) anchored on the role comparison itself, a secondary corroborating grep (`\b40[13]\b|no autorizado|solo\s+\S+`) for a nearby authorization-status signal, worked examples for both the inline `NextResponse.json` shape (fixture `categorias/route.ts`) and a helper-wrapped shape grounded in the dotax handlers 04-RESEARCH.md verified, and a closing "finding nothing" honesty rule.
- Added `## Required-field and format detection` naming the exact detectable signals for DISC-04's three subcategories, and explicitly deferring CUIT/CUIL/Argentine-phone formats to `DOM-01` in `.planning/REQUIREMENTS.md`'s v2 section.
- Added `ROLE_GUARD_PATTERN` and `AUTHZ_STATUS_PATTERN` to `scripts/discovery-surfaces.test.mjs`'s pattern-constants block, locked into the existing pattern-doc-agreement anti-drift describe block (both the regex sources and the new prose-scope statements).
- Added a `describe('role-guard detection', ...)` block proving: the inline categorias-fixture match plus its nearby authz-status corroboration; a synthetic helper-wrapped guard (temp-directory fixture, cleaned up in `afterEach`) matched by `ROLE_GUARD_PATTERN` but not by the existing `IMPERATIVE_ERROR_PATTERN` — the specific under-reporting gap this rule exists to close; and a zero-match assertion for a handler with no role comparison.
- Added a `describe('required-field and format detection', ...)` block locking the doc's four in-scope format signals and its `DOM-01` out-of-scope statement.

## Task Commits

Each task was committed atomically:

1. **Task 1: Role-guard and format-detection rubric sections** - `7899618` (feat)
2. **Task 2: Prove both rubric sections against real and synthetic handler shapes** - `8c43f12` (test)

## Files Created/Modified

- `references/discovery-nextjs.md` - Added `## Permission / role-guard detection` and `## Required-field and format detection` sections after `## Validation detection`
- `scripts/discovery-surfaces.test.mjs` - Added `ROLE_GUARD_PATTERN`/`AUTHZ_STATUS_PATTERN` constants, two new doc-agreement assertions, and two new `describe` blocks (`role-guard detection`, `required-field and format detection`)

## Decisions Made

- Anchored the role-guard pattern on the comparison operator (`.rol !== '<value>'` / `.rol === '<value>'`) rather than the response call, exactly matching the plan's instruction and 04-RESEARCH.md Pattern 4's finding that `dotax` mixes inline `NextResponse.json` and a project-local `err(message, status)` helper for the same kind of guard.
- Built the helper-wrapped-guard test fixture as a synthesis of two separately-verified dotax code shapes rather than quoting either file verbatim, satisfying the plan's explicit "do not add a permanent fixture file" constraint by writing it to a `mkdtempSync` temp directory cleaned up in `afterEach`, following the existing exclusion test's pattern.
- Documented `allowedValues` as the format section's allowed-value-set field name, even though `scripts/discover-schema.mjs` in this worktree does not yet expose that field — the plan's action text explicitly names `allowedValues` as the field sibling plan 04-02 (parallel wave-2 plan) introduces, and this plan's scope is the documentation/rubric layer, not the parser.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

This worktree's branch (`worktree-agent-a4f2312b03c2ba332`) was spawned before the wave's expected-base merge commit (`4510195`, "chore: merge executor worktree (worktree-agent-ac71c34bb2449da7b)") landed on `main` — the phase-04 planning artifacts (04-CONTEXT.md, 04-RESEARCH.md, 04-03-PLAN.md, and siblings) did not exist in this worktree at spawn time. Verified `git merge-base 4510195 HEAD` equaled this worktree's own `HEAD` exactly (a strict-prefix, zero-divergent-commits relationship) and the working tree was clean, then fast-forwarded (`git merge --ff-only 4510195...`) to pick up the phase-04 planning commits before starting execution. This mirrors the identical situation plan 04-01's executor documented and resolved the same way; it is a safe, non-destructive update, not a rewrite of any protected ref.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The role-guard and format-detection rubric is written and test-proven. Plan 04-06 (permission-case generation, per its `affects` edge from this plan) can now derive generated permission cases from this rubric's detection rule without re-deriving the response-wrapper-independence heuristic from scratch. This plan's format-detection section names `allowedValues` as a field name that sibling plan 04-02 introduces on `discover-schema.mjs`'s constraint records — once 04-02 merges, that field will exist and this plan's documentation reference resolves without further action. No blockers identified for downstream plans in this phase.

## Self-Check: PASSED

All 2 modified files and both commit hashes (7899618, 8c43f12) verified present below.

---
*Phase: 04-edge-case-input-validation-quality*
*Completed: 2026-09-17*
