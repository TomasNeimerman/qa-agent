---
phase: 05-smoke-test-mode-cross-project-distribution
plan: 04
subsystem: testing
tags: [smoke-test, safety-gate, cli, vitest, gap-closure]
status: complete

requires:
  - phase: 05-smoke-test-mode-cross-project-distribution
    provides: "05-01 --smoke selection branch and selectSmokeCases"
provides:
  - "--smoke branch validates the whole test-cases document (FORBIDDEN_DISPATCH_FLAGS scan included) before selecting any case; exit 9, empty stdout"
  - "CLI regression tests locking CR-01 on the smoke path"
  - "SKILL.md Smoke-test protocol step 5 (refusal before dispatch) and widened exit-code row 9"
affects: [phase-05-verification, REP-03]

plan_head_before: 456a67512b83153008311700e6f0e91e486e8bf9
commits: 2
actuals:
  tokens: 6000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: ["gate at the CLI branch that skips the downstream per-case scan; reuse exit 9 and plain-validate stderr rendering"]

key-files:
  created: []
  modified:
    - scripts/test-case-doc.mjs
    - scripts/test-case-doc.test.mjs
    - SKILL.md

key-decisions:
  - "Gate placed as first statement of the --smoke branch, after the exit-2 config checks, so configuration errors still outrank document errors"
  - "selectSmokeCases left untouched (throws nothing); doc comment records that the guarantee lives in the CLI branch"
  - "Smoke path now applies the full validation contract (e.g. missing citation exits 9) - deliberate tightening, locked by a test"

patterns-established:
  - "Smoke and plain-validate paths read one document contract"

requirements-completed: [REP-03]

duration: 12min
completed: 2026-09-21
---

# Phase 5 Plan 4: Smoke-path forbidden-flag gate (CR-01) Summary

The `--smoke` CLI branch now runs `validateTestCasesDoc` over the whole document before selecting anything, so a hand-edited case carrying `--confirmed` or `--allow-non-local` exits 9 with empty stdout instead of 0.

## Accomplishments

- Task 1 (commit 3678938): guard added at the top of `main()`'s `--smoke` branch reusing the plain-validate stderr rendering and exit 9; head-comment exit-code table and `selectSmokeCases` doc comment updated. Six new CLI tests in `describe('CLI')`: the verifier's repro (flagged selected case-5, names case and both flags), plain-vs-smoke agreement, flag in a never-selected case, flag in metadata `Instrucción`, missing-citation document (deliberate tightening), and `--smoke --case` on a flagged doc still exit 2.
- Task 2 (commit f56bc48): `SKILL.md` `## Smoke-test protocol` gained step 5 (refusal before dispatch, names `FORBIDDEN_DISPATCH_FLAGS`, exit 9, explains why step-3 scan is skipped on this path); handoff is now step 7 and notes the scan already ran; `## Configuration` row 9 widened. Steps 1-4 keep their numbers.
- RED confirmed: the pre-fix module exits 0 on the repro; the fixed module exits 9.

## Verification

- `npx vitest run scripts/test-case-doc.test.mjs`: 67 passed.
- Golden / scoped / smoke fixtures via `--smoke` still exit 0 with unchanged selections; `git diff --exit-code scripts/__fixtures__/` clean.
- SKILL.md: 7 numbered steps in the smoke section, `FORBIDDEN_DISPATCH_FLAGS` named in the section and in the row-9 line.

## Deviations from Plan

None - plan executed as written. (The verify command `npm test -- <file>` was run as `npx vitest run <file>`, equivalent.)

## Known Stubs

None.

## Threat Flags

None.

## Out of scope (carried forward)

PKG-03 teammate dry run and the live natural-language smoke run remain human verification items (unchanged); WR-01..WR-07 review warnings untouched.

## Self-Check: PASSED

Commits 3678938 and f56bc48 exist; modified files present; tests green.
