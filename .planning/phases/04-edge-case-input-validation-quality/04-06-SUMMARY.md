---
phase: 04-edge-case-input-validation-quality
plan: 06
subsystem: testing
tags: [test-case-generation, permission-cases, dispatch-wiring, rls, role-guards, anti-drift]

# Dependency graph
requires:
  - phase: 04-edge-case-input-validation-quality
    plan: 04-02
    provides: "discover-schema.mjs's top-level policies array ({ policyName, table, command, role, using, withCheck, source })"
  - phase: 04-edge-case-input-validation-quality
    plan: 04-03
    provides: "references/discovery-nextjs.md's ## Permission / role-guard detection rubric (ROLE_GUARD_PATTERN/AUTHZ_STATUS_PATTERN)"
  - phase: 04-edge-case-input-validation-quality
    plan: 04-04
    provides: "the qualified-value pending-execution shape on Ejecución (<Layer> (pendiente — <motivo>)), and the pendiente/pendienteMotivo fields test-case-doc.mjs's --case JSON exposes"
  - phase: 04-edge-case-input-validation-quality
    plan: 04-05
    provides: "the --secondary CLI flag and evidence.request.auth.credential on api-client.mjs's runCase() output"
provides:
  - "SKILL.md's ## Case generation protocol: permission-case generation from both the policies array and the role-guard rubric, each case cited to its source, an empty policies array reported as 'no RLS policy matched this parser'"
  - "the runnable-versus-pending decision wired to a presence-only check of QA_AGENT_TOKEN_SECONDARY, writing plan 04-04's committed pending shape"
  - "the type-implied (D-12), wrong-type/no-attack-payload (D-13), and generic-rejection-expectation (D-14) case rules in ## Case generation protocol"
  - "SKILL.md's ## Running generated cases step 4, rewritten to three branches: pending refusal (keyed on the pendiente field), API dispatch extended with --secondary and the two-run role-delta comparison, and the unchanged UI branch"
  - "the D-07 run offer wired symmetrically in both ## Case generation protocol's closing bullet and ## Running generated cases's closing note"
  - "PERMISSION_GENERATION_MARKERS, TYPE_AND_RANGE_MARKERS and PENDING_DISPATCH_MARKERS anti-drift locks in scripts/discovery-surfaces.test.mjs"
affects: []

actuals:
  tokens: 4020
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Anti-drift marker-array lock, extended a third time in one plan: each task's prose additions to SKILL.md get a matching exported marker array plus a describe block asserting every marker's literal presence — the same shape 04-03 established, applied three times in sequence within a single plan"
    - "Three-way dispatch branch (pending / API / UI) replacing a two-way branch, with the new branch ordered first so a refusal is read before any construction rule can fire"

key-files:
  created: []
  modified:
    - SKILL.md
    - scripts/discovery-surfaces.test.mjs

key-decisions:
  - "Permission-case group (Task 1) placed between the existing Tipo bullet and the D-09/D-10 boundary bullet, and the type/range group (Task 2) placed immediately after the boundary bullet — both land before the coverage-honesty bullet as the plan required, and the two orderings compose without contradiction"
  - "The pending shape from 04-04 already carries the layer as its own prefix (`<Layer> (pendiente — <motivo>)`), so the protocol states that fact explicitly rather than adding a title requirement — resolving the plan's either/or instruction (name the layer in the title only if the pending shape doesn't already carry it) in favor of 'it does carry it, say so and add nothing'"
  - "The pending-case dispatch refusal keys on the `pendiente` boolean field `test-case-doc.mjs`'s `--case` JSON output exposes (confirmed by reading the committed reader, not assumed) — never on `ejecucion`'s raw string or a text match against '(pendiente'"
  - "Two independent findings during Task 1/3 drafting: the literal marker strings 'no RLS policy matched this parser' and 'pendiente: true' initially landed split across a Markdown line wrap, so `toContain()` failed on the wrapped substring — both bullets were reflowed so the full marker phrase sits on one line before the marker was accepted as present"

requirements-completed: [DISC-04, DISC-05]

coverage:
  - id: D1
    description: "## Case generation protocol generates permission cases from both the policies array and the role-guard rubric independently, citing each case's source (policy: migration file/line + withCheck/using; role guard: handler file/line + literal message/status), and reports an empty policies array as 'no RLS policy matched this parser' without skipping the in-code pass"
    requirement: "DISC-05"
    verification:
      - kind: other
        ref: "grep -c 'no RLS policy matched this parser' SKILL.md == 1; manual re-read of the committed bullets against 04-CONTEXT.md's D-03/D-04 verbatim"
        status: pass
    human_judgment: false
  - id: D2
    description: "The runnable-versus-pending decision for a permission case is a presence-only check of QA_AGENT_TOKEN_SECONDARY (the exit-code-only grep ## Configuration documents), and the pending shape written matches character-for-character what plan 04-04 committed in references/test-case-format.md"
    requirement: "DISC-05"
    verification:
      - kind: other
        ref: "manual comparison of SKILL.md's pending-shape bullet against references/test-case-format.md's '### Regla de ejecución pendiente' section as committed by 04-04"
        status: pass
    human_judgment: false
  - id: D3
    description: "The type-implied (D-12), wrong-type/no-attack-payload (D-13), and generic-rejection-expectation (D-14) rules are stated in ## Case generation protocol, distinguished from D-10's never-invent-a-threshold rule, and name security-audit as where injection testing belongs"
    requirement: "DISC-04, DISC-05"
    verification:
      - kind: other
        ref: "grep -c 'debe rechazar la request' SKILL.md == 1; grep -c 'security-audit' SKILL.md == 1"
        status: pass
    human_judgment: false
  - id: D4
    description: "## Running generated cases step 4 refuses a pending case by name before either dispatch branch (keyed on the pendiente field), and the API branch dispatches a permission case's second run through --secondary, comparing evidence.request.auth.credential-tagged results for the role delta"
    requirement: "DISC-05"
    verification:
      - kind: unit
        ref: "scripts/test-case-doc.test.mjs (45/45 passing — the pendiente/pendienteMotivo contract this step depends on)"
        status: pass
      - kind: other
        ref: "grep -c -- '--secondary' SKILL.md == 6 (>= 4 required); manual re-read of step 4's three branches against D-02/D-05/D-06/D-07 verbatim"
        status: pass
    human_judgment: false
  - id: D5
    description: "All three anti-drift lock blocks (permission cases, type/range rules, pending refusal + secondary dispatch) pass, proving every literal each group names is actually present in SKILL.md"
    requirement: "DISC-04, DISC-05"
    verification:
      - kind: unit
        ref: "scripts/discovery-surfaces.test.mjs (35/35 passing, including the three new describe blocks)"
        status: pass
    human_judgment: false

duration: ~45min
completed: 2026-09-18
status: complete
---

# Phase 4 Plan 6: Case Generation Protocol Integration — Permission Cases, Type/Range Rules, Dispatch Wiring Summary

**Every discovered RLS policy and in-code role guard now becomes at least one cited, sourced permission case — written runnable or pending from a presence-only credential check that never reads the secret's value — and `## Running generated cases` refuses a pending case by name before ever reaching a dispatch branch, wiring together the five prior plans' independently-built pieces into one behavior a developer can actually see.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-18
- **Tasks:** 3 completed
- **Files modified:** 2 (`SKILL.md`, `scripts/discovery-surfaces.test.mjs`)

## Accomplishments

- Added a permission-case generation group to `SKILL.md`'s `## Case generation protocol`: both the `policies` array (04-02) and the role-guard rubric (04-03) always run independently, generate at least one cited case per record/guard, and an empty `policies` array is reported honestly ("no RLS policy matched this parser") rather than as a claim about the project's permission model — closing DISC-05's core "genera casos de permisos/auth" deliverable.
- Wired the runnable-versus-pending decision (D-01/D-02) to the exit-code-only presence check of `QA_AGENT_TOKEN_SECONDARY` `## Configuration` already documents, writing plan 04-04's committed `<Layer> (pendiente — <motivo>)` shape verbatim when the credential is absent.
- Added the type-implied (D-12), wrong-type/no-attack-payload (D-13), and generic-rejection-expectation (D-14) rules immediately after 04-01's boundary-generation bullet, explicitly distinguishing D-12's "read a fact the type declares" from D-10's "never invent a threshold," and naming `security-audit` as the scope boundary for injection testing.
- Rewrote `## Running generated cases` step 4 into three branches — pending refusal (keyed on the `pendiente` field `test-case-doc.mjs`'s `--case` JSON exposes, read before either dispatch branch), an extended `API` branch dispatching a permission case's second run through `--secondary` and comparing `evidence.request.auth.credential`-tagged results, and the unchanged `UI` branch.
- Wired D-07's run offer symmetrically: `## Case generation protocol`'s closing terminal-step bullet may now close with `¿Corro estos N casos ahora?`, and `## Running generated cases`'s closing note states that accepting that offer is an ordinary, confirmation-gated run from step 1 in a new turn.
- Added `PERMISSION_GENERATION_MARKERS`, `TYPE_AND_RANGE_MARKERS` and `PENDING_DISPATCH_MARKERS` to `scripts/discovery-surfaces.test.mjs`, each locked by its own anti-drift `describe` block following the file's existing pattern-doc-agreement shape.

## Task Commits

Each task was committed atomically:

1. **Task 1: Permission-case generation — one case per discovered policy and per discovered role guard** - `1a8cbb2` (feat)
2. **Task 2: Type-implied, wrong-type and out-of-range case rules** - `956166a` (feat)
3. **Task 3: Dispatch wiring — refuse a pending case, run the secondary pair, offer the run** - `9579425` (feat)

## Files Created/Modified

- `SKILL.md` — Added the permission-case generation group and the type/range rule group to `## Case generation protocol`; rewrote `## Running generated cases` step 4 into three branches and extended step 5's note; added the D-07 run-offer clause to both sections' closing text
- `scripts/discovery-surfaces.test.mjs` — Added `PERMISSION_GENERATION_MARKERS`, `TYPE_AND_RANGE_MARKERS`, `PENDING_DISPATCH_MARKERS` and their three anti-drift `describe` blocks

## Decisions Made

- Ordered the two new `## Case generation protocol` bullet groups as: `Tipo` bullet → permission-case group (Task 1) → D-09/D-10 boundary bullet (04-01) → type/range group (Task 2) → coverage-honesty bullet — satisfying Task 1's "after `Tipo`, before coverage-honesty" instruction and Task 2's "immediately after the boundary bullet" instruction simultaneously, since both land before coverage-honesty either way.
- Read 04-04's committed pending shape before writing the runnable-versus-pending bullet, per the plan's explicit instruction: confirmed the shape (`<Layer> (pendiente — <motivo>)`) already carries the layer as its own prefix, so the protocol states that fact and adds no title requirement, rather than the alternative branch the plan offered for a shape that doesn't carry the layer.
- Keyed the pending-case dispatch refusal on the `pendiente` boolean field, confirmed by reading `scripts/test-case-doc.mjs`'s committed `parseCaseBlock`/`findCase` output shape rather than assuming a field name — the CLI's `--case` JSON exposes `pendiente` (boolean) and `pendienteMotivo` (string|null), both used in the new step 4 pending branch.
- Chose the marker literal `pendiente: true` (matching the exact JSON-field phrasing used in the new SKILL.md prose) for `PENDING_DISPATCH_MARKERS`, and `valor implicado por el tipo` (a Spanish subcategory-style phrase matching D-08's existing title convention) for `TYPE_AND_RANGE_MARKERS`'s type-implied marker.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two anti-drift marker phrases initially split across a Markdown line wrap, breaking their own lock test**
- **Found during:** Task 1 verification (`npx vitest run scripts/discovery-surfaces.test.mjs`), and again during Task 3 verification
- **Issue:** The bullet text for "no RLS policy matched this parser" and, separately, "pendiente: true" were written with the literal marker phrase wrapped across a line break for readability (matching the file's ~72-column prose style) — but `readFileSync(...).includes(marker)` compares against the raw file text including the newline, so the wrapped phrase failed its own `toContain()` assertion even though the *rendered* Markdown reads identically.
- **Fix:** Reflowed both bullets so each marker literal sits entirely on one line, with no substantive wording change.
- **Files modified:** `SKILL.md` (both fixes landed inside the same task's original edit before that task's commit, not as a separate follow-up commit)
- **Verification:** `npx vitest run scripts/discovery-surfaces.test.mjs` — 33/33 then 35/35 passing after each fix, confirmed with a targeted `node -e` substring check isolating exactly which marker failed before each fix.
- **Committed in:** `1a8cbb2` (Task 1) and `9579425` (Task 3) — each fix landed before that task's own commit, so no commit in the history ever contains the broken wrap.

---

**Total deviations:** 1 auto-fixed pattern (Rule 1), occurring twice across two of the three tasks.
**Impact on plan:** No scope change — both fixes were pure text-reflow corrections to satisfy the plan's own anti-drift lock mechanism (`toContain()` substring matching), never a change to what the protocol actually states.

## Issues Encountered

None beyond the two line-wrap fixes documented above. This plan ran sequentially on `main` (not a worktree) per the orchestrator's explicit instruction, since all five prerequisite plans (04-01 through 04-05) were already merged — no fast-forward or worktree-staleness handling was needed.

**Pre-existing, unrelated test failures (documented in the dispatch prompt, not a regression from this plan):** `npm test` reports 2 failures in `scripts/api-client.test.mjs` ("neither --base-url nor QA_AGENT_BASE_URL exits 2") and `scripts/ui-login.test.mjs` ("missing UI credentials (exit 2)") — both caused by a real `.env.local` in this project supplying values that `dotenv` re-injects even after the test explicitly deletes them, so the "missing config" path can never trigger in this environment. Confirmed present identically before this plan's first commit (335/337 passing at baseline) and after its last commit (338/340 passing) — the pass count grew by exactly the 3 new tests this plan added, and the 2 failing tests are unchanged in identity and cause. Neither touches `SKILL.md` or `scripts/discovery-surfaces.test.mjs`, this plan's only `files_modified`.

## User Setup Required

None — no external service configuration required. (Configuring `QA_AGENT_TOKEN_SECONDARY` itself, in a target project's `.env.local`, remains future per-project setup for whoever runs a generated permission case — unchanged from 04-05.)

## REQUIREMENTS.md Note

Per the dispatch prompt's flag: `.planning/REQUIREMENTS.md` showed `DISC-05` already marked `[x]`/`Complete` before this plan ran, set by 04-04's execution (04-04-SUMMARY.md's `requirements-completed: [DISC-05]`). `DISC-04` was still `[ ]`/`Pending`. This plan's frontmatter lists `requirements: [DISC-04, DISC-05]` and this plan is the one that actually wires the permission-case generation behavior end to end (the piece DISC-05's "casos de permisos/auth" describes), plus the D-12 type-implied rule that closes out DISC-04's remaining scope. Both are now genuinely true on disk — `requirements mark-complete` was run for both IDs as part of this plan's state update, which is idempotent for the already-checked DISC-05 and newly checks DISC-04.

## Next Phase Readiness

This is the sixth and final plan in Phase 4 (edge-case-input-validation-quality). All six plans (04-01 through 04-06) are now complete: `parseCheckBounds`/boundary generation (04-01), `parseCheckEnum`/`extractPolicies` (04-02), the role-guard and format-detection rubric (04-03), the pending-execution document shape (04-04), the `--secondary`/`QA_AGENT_TOKEN_SECONDARY` dispatch contract (04-05), and this plan's integration of all of the above into `## Case generation protocol` and `## Running generated cases`. No blockers identified for phase completion or milestone transition.

## Self-Check: PASSED

Both modified files and all three commit hashes (`1a8cbb2`, `956166a`, `9579425`) verified present in `git log --oneline --all` and on disk.

---
*Phase: 04-edge-case-input-validation-quality*
*Completed: 2026-09-18*
