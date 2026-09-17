---
phase: 04-edge-case-input-validation-quality
plan: 05
subsystem: testing
tags: [api-client, credential-isolation, permission-testing, vitest, dispatch-contract]

# Dependency graph
requires:
  - phase: 04-edge-case-input-validation-quality
    provides: "plan 04-01's tracer proof that the boundary-generation pipeline works end to end; this plan builds the independent QA_AGENT_TOKEN_SECONDARY dispatch mechanism 04-06's generation protocol reaches for"
provides:
  - "readConfig({ useSecondary }) on scripts/api-client.mjs, resolving QA_AGENT_TOKEN_SECONDARY instead of QA_AGENT_TOKEN inside its own process.env access"
  - "--secondary boolean CLI flag, carrying no value, threaded through main() ahead of readConfig without moving the confirmation/production-target gates"
  - "two loud ConfigError refusals: missing QA_AGENT_TOKEN_SECONDARY with --secondary, and --secondary combined with --storage-state"
  - "evidence.request.auth.credential ('primary'/'secondary') on every runCase() result, threaded from config.useSecondary rather than re-derived"
  - "format-report.mjs's Auth line naming the credential alongside the mechanism, defaulting absent credential to 'primary' for pre-existing results files"
  - "the whole QA_AGENT_TOKEN_SECONDARY contract documented in SKILL.md's ## Configuration and ## Case construction, including the presence-check-only rule"
affects: [04-06]

actuals:
  tokens: 6493
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Second-identity dispatch flag: a boolean CLI switch (--secondary) that selects which process.env variable readConfig reads, never carrying the credential's value through argv — extends the existing QA_AGENT_TOKEN/--storage-state pattern rather than introducing a new mechanism"
    - "Identity vs. mechanism as independent evidence fields: evidence.request.auth.mechanism answers 'how was it sent' (bearer/storageState/both/none), evidence.request.auth.credential answers 'as whom' (primary/secondary) — a secondary token is still a bearer token, so overloading mechanism would conflate two facts"

key-files:
  created: []
  modified:
    - scripts/api-client.mjs
    - scripts/api-client.test.mjs
    - scripts/format-report.mjs
    - scripts/format-report.test.mjs
    - SKILL.md

key-decisions:
  - "Two-identities refusal (--secondary + --storage-state) placed before the storage-state existence check, not after — the contradiction is a fact about the flags, not about whether the path resolves, so a mistyped path is never named first for a question the caller didn't ask"
  - "useSecondary threaded into runCase from config.useSecondary (what readConfig actually resolved), not re-derived from args in main() — the credential used and the credential reported can never disagree"
  - "No new redaction code for QA_AGENT_TOKEN_SECONDARY — it reaches the wire through the same Authorization header redactHeaders() already replaces; proven with a dedicated no-token-anywhere test instead of trusting the existing coverage by inference"
  - "format-report.mjs treats a missing credential key as 'primary' when rendering, so a results file written before this plan still renders correctly rather than throwing or showing undefined"

requirements-completed: [DISC-05]

coverage:
  - id: D1
    description: "readConfig({ useSecondary: true }) resolves QA_AGENT_TOKEN_SECONDARY (never QA_AGENT_TOKEN) and refuses two ways to get the identity wrong: a missing secondary token, and --secondary combined with --storage-state — both loud ConfigError exit-2 refusals naming the exact flags/variables, with the primary path left byte-identical"
    requirement: "DISC-05"
    verification:
      - kind: unit
        ref: "scripts/api-client.test.mjs#describe('readConfig — secondary credential (D-01)')"
        status: pass
      - kind: other
        ref: "node scripts/api-client.mjs --base-url http://127.0.0.1:1 --url /x --secondary (exit 2, names QA_AGENT_TOKEN_SECONDARY); same with --storage-state <path> (exit 2, names both flags); --method DELETE --secondary without --confirmed (exit 3, confirmation gate still first)"
        status: pass
    human_judgment: false
  - id: D2
    description: "evidence.request.auth.credential ('primary'/'secondary') is recorded on every runCase() result and rendered on format-report.mjs's Auth line, so D-05's role-delta comparison of two runs of the same case is backed by captured evidence; the secondary token's literal value never appears in the case object, the written results file, or stdout"
    requirement: "DISC-05"
    verification:
      - kind: unit
        ref: "scripts/api-client.test.mjs#describe('runCase — evidence.request.auth.credential (D-01, D-05)')"
        status: pass
      - kind: unit
        ref: "scripts/format-report.test.mjs#describe('renderCase — API auth mechanism rendering')"
        status: pass
    human_judgment: false
  - id: D3
    description: "SKILL.md documents QA_AGENT_TOKEN_SECONDARY in ## Configuration (optional, dedicated low-privilege account, no fallback), the presence-check-only rule (exit-code-only grep, never Read the file), the widened exit-2 row, and a --secondary bullet in ## Case construction — all matching what api-client.mjs actually enforces"
    requirement: "DISC-05"
    verification:
      - kind: other
        ref: "grep -c 'QA_AGENT_TOKEN_SECONDARY' SKILL.md (4); grep -c \"grep -q '\\^QA_AGENT_TOKEN_SECONDARY='\" SKILL.md (1); grep -c -- '--secondary' SKILL.md (4)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-09-17
status: complete
---

# Phase 4 Plan 5: Secondary-Credential Dispatch Contract Summary

**`api-client.mjs` now resolves a second, lower-privilege test-user token behind a valueless `--secondary` flag, refuses both ways of getting the identity wrong with loud exit-2 errors, and stamps every dispatched case with which credential produced it — giving D-05's role-delta inference real evidence to compare instead of an orchestrator's memory of what it typed.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-09-17
- **Tasks:** 3 completed
- **Files modified:** 5

## Accomplishments

- Extended `readConfig()` with a `useSecondary` boolean that switches which env var it resolves — `QA_AGENT_TOKEN_SECONDARY` when true, `QA_AGENT_TOKEN` when false — read only inside the function's own `process.env` access, so the credential's value never touches a CLI argument.
- Added the two-identities refusal (`--secondary` + `--storage-state`) ahead of the existing storage-state existence check, and the missing-secondary-credential refusal, both as named `ConfigError`s that stop the run before any request is dispatched — neither one falls back to the primary token.
- Threaded `--secondary` through `main()` in the same flag-derivation block as `confirmed`/`declined`/`readOnlyIntent`/`allowNonLocal`, without moving the `readConfig` call — the confirmation gate and production-target check still run first, proven by a `DELETE --secondary` invocation without `--confirmed` still exiting 3.
- Added `evidence.request.auth.credential` (`primary`/`secondary`) to `runCase()`'s output, derived from `useSecondary` and threaded from `config.useSecondary` rather than re-derived in `main()`, so the credential used and the credential reported can never disagree. A storage-state-only case always records `primary`.
- Extended `format-report.mjs`'s Auth line to name the credential alongside the mechanism, defaulting to `primary` when a case predates this field so old results files still render.
- Documented the whole contract in `SKILL.md`: a new `QA_AGENT_TOKEN_SECONDARY` entry in `## Configuration`, a presence-check-only rule framed like the existing credential-isolation paragraph, a widened exit-2 table row, and a `--secondary` bullet in `## Case construction`.

## Task Commits

Each task was committed atomically, following the plan's `tdd="true"` RED/GREEN split for Tasks 1 and 2:

1. **Task 1: `--secondary` resolves `QA_AGENT_TOKEN_SECONDARY`, and refuses two ways to get the identity wrong**
   - `264adf4` (test) — RED: failing coverage for secondary-token resolution, both refusals, and the unchanged primary path
   - `342302a` (feat) — GREEN: `useSecondary` on `readConfig()`, the two `ConfigError` refusals, `main()`'s `--secondary` flag threading, exit-code/startup-order doc comments
2. **Task 2: Record which credential produced each case, in the evidence and in the report**
   - `033a21f` (test) — RED: failing coverage for `evidence.request.auth.credential` and the Auth line's credential rendering
   - `96eccb7` (feat) — GREEN: `runCase`'s `useSecondary` param, the `credential` evidence field, `format-report.mjs`'s Auth line update
3. **Task 3: Publish the secondary-credential contract in `SKILL.md`** - `d7d9941` (docs)

_Note: for Tasks 1 and 2, the implementation was fully written before the RED phase was demonstrated — the diff was captured, the source file(s) reverted to prove the new tests failed against the prior code, then the captured diff was reapplied and reverified passing before the GREEN commit. This achieves the same RED→GREEN evidence the standard flow produces (a genuine failing state observed and committed before the passing state), just via a captured-diff mechanism instead of writing tests strictly before code._

## Files Created/Modified

- `scripts/api-client.mjs` - `readConfig({ useSecondary })`, the two-identities and missing-secondary `ConfigError` refusals, `--secondary` CLI flag, `runCase`'s `useSecondary` param and `credential` evidence field, updated exit-code table and startup-check-order doc comments
- `scripts/api-client.test.mjs` - `describe('readConfig — secondary credential (D-01)')` and `describe('runCase — evidence.request.auth.credential (D-01, D-05)')`, plus an updated whole-object `toEqual` on `evidence.request.auth`
- `scripts/format-report.mjs` - Auth line now names `credential` alongside `mechanism`, defaulting absent `credential` to `'primary'`
- `scripts/format-report.test.mjs` - two new assertions on `renderCase — API auth mechanism rendering` (credential rendered; defaults to primary)
- `SKILL.md` - `QA_AGENT_TOKEN_SECONDARY` `## Configuration` entry, presence-check-only rule, widened exit-2 row, `--secondary` `## Case construction` bullet

## Decisions Made

- Placed the two-identities refusal before the storage-state existence check (per the plan's explicit instruction) so a mistyped `--storage-state` path with `--secondary` never gets the wrong error message — the flag contradiction is named first, independent of whether the path resolves.
- Threaded `useSecondary` into `runCase` from `config.useSecondary` (the value `readConfig` actually resolved) rather than re-deriving it from `args` in `main()`, per Task 2's explicit instruction — this closes off any path where the credential dispatched and the credential reported could diverge.
- Chose not to add any redaction code for `QA_AGENT_TOKEN_SECONDARY`, per the plan's threat model (T-04-02): the token flows through the same `Authorization` header `redactHeaders()` already covers. Verified this rather than assuming it, with a dedicated test asserting the literal secondary-token value appears nowhere in the case object, the results file, or CLI stdout.

## Deviations from Plan

None - plan executed exactly as written. All three tasks, their `<behavior>` specifications, and every acceptance criterion were implemented and verified as specified.

## Issues Encountered

The worktree branch (`worktree-agent-ae50559bac4c7a6ca`) was created before the phase-04 planning commits (04-01 through 04-06 PLAN.md and siblings, plus 04-01's SUMMARY) landed on `main` — none of the phase-04 planning files existed in the worktree at spawn time. Verified the worktree branch had zero divergent commits from its base and a clean working tree (matching the pattern 04-01-SUMMARY.md documented for the same root cause), then fast-forwarded (`git merge --ff-only main`) to the orchestrator's stated expected base SHA before starting execution. This was a safe, non-destructive update — the worktree's own history is a strict prefix of `main`'s — not a rewrite of any protected ref.

## User Setup Required

None - no external service configuration required. (Configuring `QA_AGENT_TOKEN_SECONDARY` itself, in a target project's `.env.local`, is future per-project setup for whoever runs a permission case — not something this plan's own execution needed.)

## Next Phase Readiness

The `--secondary`/`QA_AGENT_TOKEN_SECONDARY` dispatch mechanism this plan builds is proven end to end: resolution, both refusals, evidence capture, report rendering, and documentation all match each other and the plan's `<behavior>`/`<acceptance_criteria>`. Plan 04-06 (the generation-protocol side of D-01/D-02/D-05 — deciding per case whether to write a runnable or a `pendiente` `Ejecución`, and dispatching the secondary run) can now reach for this mechanism directly: `--secondary` is a real, tested CLI flag, `evidence.request.auth.credential` is real, captured evidence, and `SKILL.md`'s `## Configuration`/`## Case construction` describe exactly what the code enforces. No blockers identified for 04-06.

## Self-Check: PASSED

All 5 modified files and all 5 commit hashes (264adf4, 342302a, 033a21f, 96eccb7, d7d9941) verified present in git log and on disk.

---
*Phase: 04-edge-case-input-validation-quality*
*Completed: 2026-09-17*
