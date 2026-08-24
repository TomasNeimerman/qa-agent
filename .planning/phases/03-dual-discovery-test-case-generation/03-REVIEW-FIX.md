---
phase: 03-dual-discovery-test-case-generation
fixed_at: 2026-08-24T11:31:00-03:00
review_path: C:/qa-agent/.planning/phases/03-dual-discovery-test-case-generation/03-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-08-24T11:31:00-03:00
**Source review:** C:/qa-agent/.planning/phases/03-dual-discovery-test-case-generation/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (CR-01, WR-01, WR-02, WR-03, WR-04 — `fix_scope: critical_warning`; IN-01 explicitly out of scope for this pass)
- Fixed: 5
- Skipped: 0

**Verification environment:** All fixes were applied, syntax-checked, and test-verified inside an isolated git worktree (`.claude/worktrees/rf-03-237-1787581147`, branch `gsd-reviewfix/03-237`), then fast-forwarded onto `main`. `npm test` results below are reproducible from `main` at the current HEAD — the worktree environment did not differ from the main checkout in any way relevant to these results (same `node_modules`, same working directory layout).

## Fixed Issues

### CR-01: `--case` lookup path never checks `FORBIDDEN_DISPATCH_FLAGS` — the dispatch-flag prohibition is bypassed at exactly the moment it exists to guard

**Files modified:** `scripts/test-case-doc.mjs`, `scripts/test-case-doc.test.mjs`
**Commit:** `28ce1c8`
**Applied fix:** Implemented the review's preferred option — `findCase` itself now scans the resolved case's own block text for every `FORBIDDEN_DISPATCH_FLAGS` literal (mirroring the check `validateTestCasesDoc` already runs per case block) and throws `TestCaseFormatError` if one is found. This closes the gap at the layer shared by every caller: the CLI's documented `--case` branch (which already catches `TestCaseFormatError` and exits 9) and any future direct caller of `findCase`, independent of whether the caller also chose to run `validateTestCasesDoc` over the whole document first. Added two tests: a unit test on `findCase` directly, and a CLI-level test reproducing the review's exact verified repro (`--file <path> --case case-1` against a document whose Pasos field was hand-edited to `DELETE /api/franquicias/1 --confirmed --allow-non-local`) — asserting exit code 9, empty stdout, and stderr naming the case and the flag (previously: exit 0, the flag returned verbatim in stdout).

### WR-01: `validateTestCasesDoc`'s ID-sequence-gap check cascades false errors after the first real gap

**Files modified:** `scripts/test-case-doc.mjs`, `scripts/test-case-doc.test.mjs`
**Commit:** `d48008c`
**Applied fix:** `expectedIndex` now resyncs from the ID actually found (`Number(id.slice('case-'.length)) + 1`) rather than blindly incrementing every case, exactly as the review's suggested fix specified. Added a test reproducing the review's exact scenario (case-5 deleted from the golden 12-case document, leaving 1,2,3,4,6,7,...) asserting exactly one `sequence gap` error is reported (naming case-5/case-6), not a cascade of false gaps for every case after the deletion point.

### WR-02: `discover-schema.mjs` silently drops symlinked `.sql` migration files, and the per-file symlink-escape check the doc comment describes is unreachable for them

**Files modified:** `scripts/discover-schema.mjs`, `scripts/discover-schema.test.mjs`
**Commit:** `652194c`
**Applied fix:** Took the review's first suggested option — `listMigrations`'s filter now admits `Dirent.isSymbolicLink()` entries (not just `isFile()`) whose name ends in `.sql`, letting the existing per-file `resolveWithinRoot` call (which runs `realpathSync` and checks containment against the *resolved* target) actually run on symlinked migrations, restoring the module's own documented "symlink target resolved outside the project root" guarantee. Went one step further than the literal suggestion to avoid a new failure mode the broadened filter would otherwise introduce: since symlinks are no longer filtered out before the read, a broken symlink or one pointing at a directory could previously have crashed `statSync`/`readFileSync` uncaught — now both cases are caught and reported in `skipped` (`reason: 'unreadable'` / `'not-a-file'`) rather than crashing discovery. Added three tests: a symlinked `.sql` file resolving inside the root is read and its constraints extracted; one resolving outside the root throws `PathEscapeError` (not silently dropped); a broken symlink is reported in `skipped` rather than crashing. Tests degrade gracefully (skip their assertions with a console warning) if `symlinkSync` is unsupported in the CI environment — verified working and exercised on this Windows machine without elevated privileges.

### WR-03: `validateTestCasesDoc` never checks for the required `**Origen del surface:**` line

**Files modified:** `scripts/test-case-doc.mjs`, `scripts/test-case-doc.test.mjs`, `scripts/discovery.e2e.test.mjs`
**Commit:** `4ce9baa`
**Applied fix:** Both `parseTestCasesDoc` (throws `TestCaseFormatError` naming the surface) and `validateTestCasesDoc` (collects an error naming the surface) now treat a `##` surface heading with no following `**Origen del surface:**` line as a structural violation, per `references/test-case-format.md`'s "Section order" item 3. Adapted the fix beyond the review's literal suggestion after discovering — via the golden fixture itself — that `references/test-case-format.md`'s own worked example places a blank line between the surface heading and the Origen line; a naive "check the very next line" implementation would have broken the passing golden document. Both functions now skip blank lines before checking for the Origen line, mirroring how every other block-scan in this module already treats blank lines as insignificant. This also surfaced (and fixed as a necessary side effect) a latent bug: the *original* code's off-by-one meant `surface.origen` was silently `''` for every surface in the golden document, even though validation reported `valid: true` — this is now correctly populated. Two pre-existing minimal fixtures in `scripts/discovery.e2e.test.mjs` (`rejects a document whose second case heading has a gap`, `rejects a case block missing its Ejecución bullet`) were also missing the required Origen line — an unrelated latent gap in those fixtures that the WR-03 fix now correctly catches before reaching the behavior each test actually means to exercise; fixed both fixtures to include the required line so each test isolates the one thing it tests. Added a `parseTestCasesDoc` throw test, a `validateTestCasesDoc` error test, and a regression test asserting the golden document's `surface.origen` is now populated correctly for every surface.

### WR-04: `FORBIDDEN_DISPATCH_FLAGS` scan does not cover the document's metadata block (in particular the verbatim `**Instrucción:**` field)

**Files modified:** `scripts/test-case-doc.mjs`, `scripts/test-case-doc.test.mjs`
**Commit:** `fbf8768`
**Applied fix:** `validateTestCasesDoc` now additionally scans the metadata block (everything from the H1 through the first surface heading — covers `**Instrucción:**` and the other four metadata lines) and each surface heading + its `Origen del surface` line for `FORBIDDEN_DISPATCH_FLAGS` literals, closing the gap between the implementation and `SKILL.md`'s own broader, unqualified promise ("`validateTestCasesDoc` refuses any document carrying a literal from `FORBIDDEN_DISPATCH_FLAGS`" — no "within a case block" qualifier). The existing per-case-block scan (which names the specific case ID) is preserved unchanged for case-scoped violations. Added tests for a forbidden flag inside `**Instrucción:**` and inside a surface heading, each asserting `valid: false` with an error naming the flag and its location.

## Skipped Issues

None — all in-scope findings (CR-01, WR-01 through WR-04) were fixed. IN-01 was explicitly out of scope for this pass per the fix_scope instruction (`critical_warning`) and was not attempted.

## Test Suite Status

`npm test` was run after every individual fix and once more at the end of the pass. Final state: **269 tests passed, 0 failed, across 14 test files.**

The task instructions noted 2 pre-existing unrelated `ui-login.test.mjs` failures (caused by a stray `.env.local` in the project root, per `deferred-items.md`). This run's environment had **no such failures** — all `ui-login.test.mjs` tests passed cleanly both before and after this pass's fixes, confirming no `.env.local` was present in this worktree/checkout. This is a difference from the environment `deferred-items.md` describes, not a regression introduced by this pass; no action was taken since those tests are out of scope for this review-fix pass regardless of pass/fail state.

Baseline (before any fix in this pass): 258 passed, 0 failed, 14 files.
Final (after all 5 fixes): 269 passed, 0 failed, 14 files. (+11 tests added across the 5 fixes, 0 regressions.)

---

_Fixed: 2026-08-24T11:31:00-03:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
