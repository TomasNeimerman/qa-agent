---
phase: 03-dual-discovery-test-case-generation
plan: 03
subsystem: testing
tags: [node, vitest, markdown, test-case-generation, nextjs, supabase, discovery, real-repo-validation]

# Dependency graph
requires:
  - phase: 03-dual-discovery-test-case-generation
    plan: 01
    provides: scripts/test-case-doc.mjs's parseTestCasesDoc, references/test-case-format.md's D-01–D-05 structure contract, the 12-case golden document scripts/__fixtures__/sample-test-cases.md, SKILL.md's Discovery protocol / Case generation protocol sections
  - phase: 03-dual-discovery-test-case-generation
    plan: 02
    provides: references/discovery-nextjs.md's form-mechanism and router-layout detection rules, scripts/__fixtures__/mock-target-repo's login (Server Action) and registro (client-fetch) fixture surfaces
provides:
  - scripts/test-case-doc.mjs's findCase (anchored, collision-proof case-N lookup) and validateTestCasesDoc (full-document validation collecting every error) plus its CLI (--file/--case, exit 0/2/9)
  - FORBIDDEN_DISPATCH_FLAGS, derived from api-client.mjs's own --confirmed/--read-only-intent/--allow-non-local flags — the mechanical proof a generated document can never pre-approve a destructive dispatch
  - SKILL.md's scoped Discovery protocol branch (DISC-03/D-12) and new "## Running generated cases" section (D-11's handoff to the existing Phase 1/2 executors)
  - references/test-case-format.md's scoped-origin metadata variant and dispatch-flag prohibition
  - scripts/__fixtures__/sample-test-cases-scoped.md — the DISC-03 golden fixture
  - An off-by-one fix in scripts/discover-schema.mjs's CREATE TABLE column citation, found by this plan's real-repo validation against franquix/dotax
affects: []

# Actuals (#2632)
actuals:
  tokens: 13250
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-throwing scanCaseFields shared between the throwing parser (parseTestCasesDoc) and the error-collecting validator (validateTestCasesDoc) — one bullet-scanning implementation, two different failure policies layered on top, so the two can never silently disagree on what counts as a field"
    - "findCase reuses CASE_HEADING_PATTERN directly (the same anchored pattern parseTestCasesDoc scans with) instead of deriving a second lookup pattern — one collision-proofing mechanism, not two that could drift apart"

key-files:
  created:
    - scripts/test-case-doc.test.mjs
    - scripts/__fixtures__/sample-test-cases-scoped.md
  modified:
    - scripts/test-case-doc.mjs
    - references/test-case-format.md
    - SKILL.md
    - scripts/discover-schema.mjs
    - scripts/discover-schema.test.mjs
    - .planning/phases/03-dual-discovery-test-case-generation/deferred-items.md

key-decisions:
  - "findCase delegates its five-field parse to the same parseCaseBlock helper parseTestCasesDoc uses (refactored to share a non-throwing scanCaseFields core), rather than re-deriving field extraction — keeps the anchored-lookup guarantee (Pitfall 5) and the field-shape guarantee in one place"
  - "validateTestCasesDoc is a standalone, non-throwing scanner (not a wrapper around parseTestCasesDoc) so it can collect every error in one pass instead of stopping at the first — a developer fixing a hand-edited document needs the whole list"
  - "FORBIDDEN_DISPATCH_FLAGS scoped per case block (not whole-document) when reporting which case a forbidden flag was found in, matching the plan's own acceptance criterion that the error name 'which flag was found and in which case'"
  - "The scoped Discovery protocol branch was inserted as step 2 (immediately after the full-scan-vs-scoped decision in step 1), with the former steps 2–11 renumbered 3–12 — the scoped branch is self-contained (its own root/router-detection references plus its own hand-off) so a reader follows one branch instead of reading the full-scan procedure and mentally subtracting from it, per the plan's own placement instruction"
  - "Real-repo validation (Task 3) writes its two generated documents to the session scratchpad, not into c:/franquix or c:/dotax — the orchestrator's own execution context explicitly overrode the plan's normal qa-reports/ write target for this run, since franquix and dotax are the user's live, actively-developed projects and this is a validation exercise, not an actual invocation on the user's behalf. Schema discovery (discover-schema.mjs) and file reads against both repos are read-only regardless of write target."

patterns-established:
  - "Pattern 5: a document reader/validator that must both throw-on-first (for a caller that wants a single deterministic verdict) and collect-every-error (for a caller helping a human fix a document) shares one non-throwing scan primitive, with the two failure policies layered on top rather than duplicated"

requirements-completed: [DISC-02, DISC-03]

coverage:
  - id: D1
    description: "findCase resolves case-1 vs case-12 without collision (anchored on the heading delimiter, never a substring test), throws naming the requested ID and the document's actual IDs when not found, and throws rather than picking the first match when two headings claim the same ID"
    requirement: "DISC-02"
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs — 'findCase — anchored lookup, the collision case' (6 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "validateTestCasesDoc asserts every failure mode individually (missing field, out-of-set Tipo/Ejecución, duplicate ID, sequence gap, missing negativo/edge citation, forbidden dispatch flag) and collects every error in one pass rather than throwing on the first"
    requirement: "DISC-02"
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs — 'validateTestCasesDoc — one assertion per failure mode' (10 tests) + 'validateTestCasesDoc — the valid document' (1 test)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The test-case-doc.mjs CLI exits 0 for a valid document or a resolved --case, exits 2 when --file is absent or the path doesn't exist, and exits 9 for a malformed document (stderr names every offending case ID)"
    requirement: "DISC-02"
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs — 'CLI' describe block (5 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "FORBIDDEN_DISPATCH_FLAGS is derived from api-client.mjs's own three gate-bypassing flags, and any document containing one is rejected with exit 9 before any case is acted on"
    requirement: "DISC-02"
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs — 'a document containing a forbidden dispatch flag anywhere is invalid' + 'exports' describe block"
        status: pass
    human_judgment: false
  - id: D5
    description: "The scoped golden fixture (sample-test-cases-scoped.md) parses/validates cleanly, its metadata (Origen/Instrucción) differs from the full-scan golden document while its case structure is identical, and its Alcance line names individual files, never a glob"
    requirement: "DISC-03"
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs — 'the scoped golden document (DISC-03 metadata variant)' describe block (5 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "SKILL.md's Discovery protocol carries a scoped branch (D-12): resolves an instruction's nouns to specific files, asks rather than guessing on zero or multiple matches, never globs the repository, and hands off to Case generation protocol unchanged; '## Running generated cases' (D-11) re-reads the document from disk, resolves each case by ID through the CLI, and reaches the existing Case construction/Confirmation protocol or UI run protocol/UI confirmation protocol without introducing a new execution path"
    requirement: "DISC-03"
    verification:
      - kind: other
        ref: "node one-liners: skill-handoff-ok, skill-order-ok, handoff-reaches-executors-ok, scoped-fixture-ok (all pass); grep -c '^## ' SKILL.md returns 11"
        status: pass
    human_judgment: false
  - id: D7
    description: "The scoped Discovery protocol branch, run live against a real repo (c:/dotax, instruction 'probá el registro de nuevos usuarios'), resolves to exactly the two files the flow lives in via a path-fragment match — no whole-repository glob — and produces a document whose scope line names those two files"
    requirement: "DISC-03"
    verification:
      - kind: manual_procedural
        ref: "Task 3(c): find app -path '*registro*' -type f resolved app/registro/page.tsx + app/api/registro/route.ts only; generated document 2026-08-24-1130-dotax-registro-test-cases.md validates (exit 0, 5 cases, 1 surface); c:/dotax git status --porcelain is empty"
        status: pass
    human_judgment: true
    rationale: "DISC-03's containment property (a scoped instruction never widens into a full scan) is orchestrator behavior over live tool calls against a real, actively-developed repo — VALIDATION.md's own Manual-Only Verifications table designates this row manual, collected at the phase gate per workflow.human_verify_mode=end-of-phase."
  - id: D8
    description: "A full discovery-and-generation pass against c:/franquix produces a document naming at least one Server-Action-backed UI surface (login) and at least one API-route surface (categorias), with Router metadata reporting App Router, all citations grounded in files actually read"
    requirement: "DISC-01"
    verification:
      - kind: manual_procedural
        ref: "Task 3(b): 2026-08-24-1100-franquix-test-cases.md — 4 surfaces (2 API, 1 UI Server-Action, 1 DB-constraint), 12 cases, validates (exit 0); router layout confirmed App Router (38 route.ts, 22 page.tsx, no pages/ dir); c:/franquix git status --porcelain clean except one pre-existing, unrelated .gitignore edit predating this session"
        status: pass
    human_judgment: true
    rationale: "Document-structure conformance and citation accuracy against a real repo is VALIDATION.md's second Manual-Only Verifications row — a human must confirm each citation says what the case claims and that no full-project sweep produced noise; collected at the phase gate per workflow.human_verify_mode=end-of-phase. Not yet exercised: dispatching one franquix case by ID through '## Running generated cases' to confirm the confirmation gate still stops it (human-check item 7)."
  - id: D9
    description: "scripts/discover-schema.mjs's schema tier runs clean against both real repositories, reporting at least 10 migration files and a non-empty constraint set each, matching 03-RESEARCH.md's prior counts"
    requirement: "DISC-01"
    verification:
      - kind: e2e
        ref: "node scripts/discover-schema.mjs --project-root c:/franquix (30 files, 206 constraints, 14 policy predicates skipped, exit 0); --project-root c:/dotax (63 files, 381 constraints, 68 policy predicates skipped, exit 0)"
        status: pass
    human_judgment: false
  - id: D10
    description: "Three spot-checked constraints per repo cite the migration line that actually states them"
    requirement: "DISC-01"
    verification:
      - kind: manual_procedural
        ref: "franquix: dia_cierre CHECK at 0005_franquicias_tipo_horario.sql:5 (exact), tenants.nombre NOT NULL at 0001_init.sql:23 (off by one before this plan's fix), usuarios.rol enum at 0001_init.sql:45 (off by one before this plan's fix) — all three confirmed correct against the real file after the fix"
        status: pass
    human_judgment: false
  - id: D11
    description: "The STATE.md research flag ('no authoritative pattern exists for code-aware discovery scripts across Next.js App Router vs. Pages Router — validate against at least two of the three target repos') is closed with a recorded result: both franquix and dotax detect as App Router only (no pages/ directory in either), consistent with 03-RESEARCH.md's prior direct-search finding across all three target repos"
    requirement: "DISC-01"
    verification:
      - kind: other
        ref: "Task 3(a)/(b)/(c) router-layout detection against c:/franquix and c:/dotax, both App Router"
        status: pass
    human_judgment: false

duration: ~48min
completed: 2026-08-24
status: complete
---

# Phase 3 Plan 03: Execution Handoff & Real-Repo Validation Summary

**Anchored case-N lookup and full test-case document validation (FORBIDDEN_DISPATCH_FLAGS refuses a document that pre-approves a destructive dispatch), a scoped one-off-instruction Discovery branch and the "## Running generated cases" handoff to Phase 1/2's existing executors, plus a real off-by-one citation bug found and fixed by running the whole phase against franquix and dotax.**

## Performance

- **Duration:** ~48 min
- **Started:** 2026-08-24T13:20:00Z (approx., baseline reading before Task 1's first edit)
- **Completed:** 2026-08-24T14:08:00Z
- **Tasks:** 3
- **Files modified:** 9 (2 created, 7 modified; 2 additional documents written to the session scratchpad for Task 3, not committed — see Deviations)

## Accomplishments

- `scripts/test-case-doc.mjs` gained `findCase()` (anchored `case-N` lookup, collision-proof against `case-1`/`case-12`), `validateTestCasesDoc()` (collects every validation failure — missing field, bad `Tipo`/`Ejecución`, duplicate/gapped ID, missing citation, forbidden dispatch flag — instead of throwing on the first), `FORBIDDEN_DISPATCH_FLAGS` (derived from `api-client.mjs`'s own `--confirmed`/`--read-only-intent`/`--allow-non-local`), and a CLI (`--file`/`--case`, exit 0/2/9) — 29 new unit tests, each a single-variable mutation of the committed golden document.
- `references/test-case-format.md` gained the scoped-origin metadata variant (DISC-03) and the dispatch-flag prohibition, naming the validator that enforces it.
- `SKILL.md`'s Discovery protocol gained a self-contained scoped branch (step 2, D-12) — resolves an instruction's nouns to specific files, asks rather than guessing on zero or multiple matches, never falls back to a full scan — and a new `## Running generated cases` section (D-11) that re-reads the document from disk, resolves each case by ID through `test-case-doc.mjs`'s CLI, and hands off to `## Case construction`/`## Confirmation protocol` or `## UI run protocol`/`## UI confirmation protocol` with no new execution path.
- `scripts/__fixtures__/sample-test-cases-scoped.md` — the DISC-03 golden fixture (3-case login surface, scoped-origin metadata), derived from plan 03-02's `mock-target-repo` fixture.
- Real-repo validation (Task 3) against `c:/franquix` and `c:/dotax` found and fixed a genuine off-by-one bug in `scripts/discover-schema.mjs`: every column after the first in a multi-line `CREATE TABLE` cited the line above its real definition, because each entry's own leading newline was never counted. Fixed, regression-tested, and re-verified against both real repos' actual constraint citations.
- Both real-repo generated documents (a full-scan pass against franquix, a scoped pass against dotax) validate cleanly via `test-case-doc.mjs --file <path>` (exit 0), closing the STATE.md App-Router-vs-Pages-Router research flag with a direct result: both repos detect as App Router only, matching 03-RESEARCH.md's prior finding.

## Task Commits

1. **Task 1: Ask for case-1 and get case-1, not case-12 — anchored lookup and a document that is checked before it is acted on** - `29aabbb` (feat)
2. **Task 2: One instruction, one flow, no whole-repo scan** - `0920f36` (feat)
3. **Task 3: Prove the whole phase against the real repos it was built for** - `a1949d9` (fix — the citation off-by-one bug found during this task's own real-repo run; no further code commit was needed since the rest of the run was clean, see Deviations)

**Plan metadata:** (this commit)

## Files Created/Modified

- `scripts/test-case-doc.mjs` - `findCase`, `validateTestCasesDoc`, `FORBIDDEN_DISPATCH_FLAGS`, CLI (533 lines, up from 205)
- `scripts/test-case-doc.test.mjs` - 34 tests: anchored lookup, per-failure-mode validation, CLI exit codes, scoped-fixture assertions
- `references/test-case-format.md` - scoped-origin metadata variant, dispatch-flag prohibition (232 lines, up from 185)
- `SKILL.md` - scoped Discovery protocol branch, inferred-expectation and scope-honesty rules, `## Running generated cases` section, exit-9 table row updated
- `scripts/__fixtures__/sample-test-cases-scoped.md` - DISC-03 golden fixture (3 cases, login Server Action surface)
- `scripts/discover-schema.mjs` - fixed CREATE TABLE column citation off-by-one
- `scripts/discover-schema.test.mjs` - regression test for the citation fix
- `.planning/phases/03-dual-discovery-test-case-generation/deferred-items.md` - two new pre-existing, out-of-scope entries (see Issues Encountered)

## Decisions Made

- The scoped Discovery protocol branch was placed as step 2 — immediately after the full-scan-vs-scoped decision in step 1 — rather than after router-layout detection, per the plan's explicit placement instruction ("a reader follows one branch or the other"). The branch is self-contained: it cross-references the numbered steps of the full-scan branch for the pieces both share (root/run-id resolution, router detection, `discover-schema.mjs` invocation) rather than duplicating their prose, and ends at its own hand-off to `## Case generation protocol`.
- `findCase` and `parseTestCasesDoc` share one non-throwing `scanCaseFields` primitive (refactored out of the pre-existing `parseCaseBlock`), and `validateTestCasesDoc` is a fully independent, non-throwing scanner built on the same primitive — one field-shape definition, two different failure policies (throw-first vs. collect-all) layered on top, so they cannot drift apart on what counts as a field.
- Task 3's two generated documents were written to the session scratchpad, not into `c:/franquix/qa-reports/` or `c:/dotax/qa-reports/` — the orchestrator's own execution context for this run explicitly instructed "do not write into those repos," since franquix and dotax are the user's live, actively-developed projects rather than disposable test targets. All discovery reads (`Read`/`Bash find`/`discover-schema.mjs`) against both repos are read-only regardless; only the final document's *write location* differs from what `## Case generation protocol` would normally do for a real invocation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Off-by-one CREATE TABLE column citation, found via real-repo validation**
- **Found during:** Task 3(a), spot-checking three franquix constraints against their cited migration lines (the plan's own acceptance criterion).
- **Issue:** `parseCreateTableStatement` computed each column entry's absolute character offset from `bodyStartIndex + entry.startOffsetInBody`, without accounting for the entry's own leading whitespace/newline (the separator left over from the previous column's comma). Every column after the first in a multi-line `CREATE TABLE` therefore cited the line *above* its real definition. Verified against the real file: `usuarios.rol` (an enum-typed `NOT NULL` column) was reported at `0001_init.sql:44`; the actual line is `45`. `tenants.nombre` was reported at line `22`; the actual line is `23`. The single-line `ALTER TABLE ADD COLUMN` citation path (`dia_cierre`) was unaffected and already correct.
- **Fix:** `parseCreateTableStatement` now measures each entry's own leading-whitespace length and includes it before counting newlines to the entry's absolute offset.
- **Files modified:** `scripts/discover-schema.mjs`, `scripts/discover-schema.test.mjs` (new regression test pinning a synthetic 3-column table's citations)
- **Verification:** Regression test passes; re-ran `discover-schema.mjs --project-root c:/franquix` and confirmed `tenants.nombre` now cites line 23 and `usuarios.rol` now cites line 45, both matching the real file.
- **Commit:** `a1949d9`

This is exactly the class of defect the plan's Task 3 exists to catch: a rule that worked against every fixture (whose `discovery.e2e.test.mjs` golden document only exercises a single-column-per-line `ALTER TABLE` citation, never a multi-line `CREATE TABLE` with more than one column checked by line number) but was silently wrong against real, multi-column production schemas — and since a citation is "the whole basis for a generated case" (03-03-PLAN.md Task 3), every `edge`-typed case this project generates against a `CREATE TABLE`-declared constraint anywhere would have carried a wrong line number until this run caught it.

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug)
**Impact on plan:** The fix is essential correctness for DISC-01/DISC-02's citation guarantee and was outside this plan's own `<files>` list (`scripts/discover-schema.mjs` belongs to plan 03-01) but directly threatened this plan's Task 3 deliverable — proving the whole phase works against real repos. No scope creep beyond the one function the bug lived in.

## Issues Encountered

- **Pre-existing, unrelated `.env.local`-driven test failures** (`scripts/api-client.test.mjs`'s "neither --base-url nor QA_AGENT_BASE_URL exits 2" and `scripts/ui-login.test.mjs`'s "missing UI credentials (exit 2)"): both reproduce identically whether `scripts/test-case-doc.test.mjs` is included in the run or not, caused by a machine-local `.env.local` at the project root supplying config the tests expect absent. Logged to `deferred-items.md`, not fixed — out of scope and outside this plan's `<files>`.
- **franquix's `.gitignore` carries a pre-existing, uncommitted local edit** (adding `graphify-out` and `.env*.local` to the ignore list) that predates this session — confirmed by using only `Read`/`Bash find`/`ls` (no `Write`/`Edit`) against franquix throughout Task 3. Noted here so it is not mistaken for something this run caused; `git status --porcelain` inside franquix otherwise shows nothing outside that single pre-existing line.
- **Real-repo document write location overridden for safety**: per the orchestrator's explicit instruction not to write into franquix/dotax, Task 3's two generated documents live at the session scratchpad (`2026-08-24-1100-franquix-test-cases.md`, `2026-08-24-1130-dotax-registro-test-cases.md`) rather than at `<repo>/qa-reports/`. Both validate cleanly via `test-case-doc.mjs`; this is a one-time deviation for this validation exercise, not a change to `## Case generation protocol`'s documented write location for a real invocation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 3 is functionally complete: `DISC-01` (code discovery, validated live against two real repos), `DISC-02` (documented, validated, machine-checked test cases with a working execution handoff), and `DISC-03` (scoped one-off generation, containment proven live against dotax) are all implemented and tested — full suite `npx vitest run` is green at 258 tests (256 passed, 2 pre-existing unrelated failures unchanged from before this plan).
- The STATE.md research flag on App Router vs. Pages Router discovery is closed: both franquix and dotax detect as App Router only, live, this session — consistent with 03-01-RESEARCH.md's prior direct-search finding across all three target repos (DATAX-web included).
- **Outstanding for the phase gate** (per `workflow.human_verify_mode: end-of-phase`, `03-03-PLAN.md` Task 3's `<human-check>` block): a human should open both real-repo generated documents (`2026-08-24-1100-franquix-test-cases.md` and `2026-08-24-1130-dotax-registro-test-cases.md`, both in the session scratchpad) and confirm the seven items in Task 3's human-check — including running one franquix case by ID through `## Running generated cases` to confirm the confirmation gate still stops a mutating call. This was not exercised live in this session (no HTTP dispatch was made against franquix's real server), consistent with the plan's own note that the human check "is collected at the phase gate rather than blocking this task mid-execution."
- No blockers for closing the phase.

## Self-Check: PASSED

All claimed files verified present on disk (`scripts/test-case-doc.mjs`, `scripts/test-case-doc.test.mjs`, `references/test-case-format.md`, `SKILL.md`, `scripts/__fixtures__/sample-test-cases-scoped.md`, `scripts/discover-schema.mjs`, `scripts/discover-schema.test.mjs`, `.planning/phases/03-dual-discovery-test-case-generation/deferred-items.md`). All three task/fix commit hashes (`29aabbb`, `0920f36`, `a1949d9`) verified present in `git log --oneline --all`.

---
*Phase: 03-dual-discovery-test-case-generation*
*Completed: 2026-08-24*
