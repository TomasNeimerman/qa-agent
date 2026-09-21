---
phase: 04-edge-case-input-validation-quality
verified: 2026-09-18T10:30:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 4: Edge-Case & Input Validation Quality Verification Report

**Phase Goal:** Test cases the agent generates systematically cover input-validation
boundaries and negative/permission edge scenarios, grounded in the constraints discovered
in Phase 3, not just the happy path.
**Verified:** 2026-09-18
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A discovered two-sided CHECK bound (`BETWEEN a AND b`) yields exactly four boundary cases (min-1/min/max/max+1), a one-sided bound yields only that side, and an unconstrained field yields none (DISC-04) | ✓ VERIFIED | `parseCheckBounds('dia_cierre BETWEEN 0 AND 6')` → `{min:0,max:6}`; `discover-schema.mjs --project-root scripts/__fixtures__/mock-target-repo` reports the same on the real fixture; `scripts/__fixtures__/sample-test-cases.md` case-9..12 carry -1/0/6/7 with correct subcategory titles; `test-case-doc.mjs --file` on that fixture exits 0, `valid:true`, `counts.cases:14` |
| 2 | `parseCheckBounds` never invents a bound from an unrecognised or non-numeric CHECK shape, including the SQL `<>` (not-equal) operator (D-09/D-10) | ✓ VERIFIED | Code review found CR-01 (a real bug: `<>` was misread as `>`, inventing `{min:6,max:null}` from `estado <> 5`). Fix committed in `9eb2b42` — verified present in `scripts/discover-schema.mjs:216-224` (negative lookbehind/lookahead added around `<>`); manually re-ran `parseCheckBounds('estado <> 5')` → `null`; both new regression tests (`estado <> 5` → null, and `<>` not leaking into a real bound in a compound expression) pass by name (`npx vitest -t "not-equal"` → 2 passed) |
| 3 | Invalid-format cases are grounded in a discovered value set — an inline `CHECK (col IN (...))` or a declared `CREATE TYPE ... ENUM`, unified as `allowedValues` on every constraint record (DISC-04) | ✓ VERIFIED | `parseCheckEnum` exported at `scripts/discover-schema.mjs:260`; fixture JSON shows `usuarios.rol.allowedValues === ["admin","franquiciado"]`; every constraint record carries the `allowedValues` key (asserted by test and reconfirmed manually) |
| 4 | RLS policies (`CREATE POLICY`) become structured, cited records instead of a discarded count, and an RLS-free project reports an honest empty array (D-03) | ✓ VERIFIED | `extractPolicies` exported at `scripts/discover-schema.mjs:588`; fixture JSON: `policies.length === 3`, `policyWithCheckCount === 3`; `withCheckSkipped` fully renamed (no remaining occurrences under `scripts/`); e2e test asserts an empty-migrations project still returns `policies: []` |
| 5 | An in-code role guard is detected independent of how the project wraps its error response (not just the inline `NextResponse.json` shape) (D-03) | ✓ VERIFIED | `references/discovery-nextjs.md` `## Permission / role-guard detection` section present, keyed on the `.rol` comparison itself; `ROLE_GUARD_PATTERN`/`AUTHZ_STATUS_PATTERN` proven in `scripts/discovery-surfaces.test.mjs` against both the inline fixture guard and a synthetic helper-wrapped (`err(...)`) guard that the pre-existing `IMPERATIVE_ERROR_PATTERN` does **not** match — named test `helper-wrapped guard is matched...` passes |
| 6 | A permission case that can't run (no `QA_AGENT_TOKEN_SECONDARY`) is written into the document in a parseable, counted pending state and never silently dropped; a pending case still records its execution layer (D-01/D-02/D-04) | ✓ VERIFIED | `scripts/test-case-doc.mjs` implements option-b (qualified value): `Ejecución` stays `API`/`UI` and carries an optional `(pendiente — <motivo>)` qualifier (`splitEjecucion()`); `pendiente`/`pendienteMotivo` returned by `parseCaseBlock`/`findCase`; `counts.pendientes` distinct in `validateTestCasesDoc`; a document with a pending case exits 0; an out-of-set `Ejecución` still throws/exits 9 naming the case ID even with a qualifier attached; `FORBIDDEN_DISPATCH_FLAGS` still scans a pending case's block — all asserted by passing tests |
| 7 | A boolean `--secondary` flag resolves `QA_AGENT_TOKEN_SECONDARY` for dispatch as a second, lower-privilege identity; the credential's value never enters argv/output; two ways of "getting the identity wrong" (missing secondary token, `--secondary` + `--storage-state`) are loud exit-2 refusals; every case records `evidence.request.auth.credential` (D-01/D-05) | ✓ VERIFIED | `readConfig({useSecondary:true})` reads `QA_AGENT_TOKEN_SECONDARY` only, never falls back to `QA_AGENT_TOKEN`; the two-identities and missing-secondary-token refusals are both present (`scripts/api-client.mjs:120-171`); `runCase` writes `credential: 'secondary'|'primary'` into `evidence.request.auth` (line 336, 426); `format-report.mjs` renders it on the `Auth:` line; primary path's absent-credential message is byte-identical (pinned by `tracer.e2e.test.mjs`) |
| 8 | `## Case generation protocol` actually emits permission cases from both detection passes (RLS policies + role guards), each cited, with an empty-policies result reported as "no RLS policy matched this parser" rather than "no permission boundaries"; type-implied/wrong-type/out-of-range rules exist and injection payloads are explicitly out of scope, deferred to `security-audit` (DISC-05, D-03, D-12, D-13, D-14) | ✓ VERIFIED | `SKILL.md` `## Case generation protocol` (lines 413-514) contains all of: the two-independent-passes rule, per-source citation rule, the exact "no RLS policy matched this parser" phrase, the `Ejecución`-layer-for-permission-cases rule, the pending-decision rule referencing the presence-only check, the type-implied rule (D-12), the no-attack-payload rule naming `security-audit` (D-13), and the generic "debe rechazar la request" expectation rule (D-14). All drift-locked by `PERMISSION_GENERATION_MARKERS`/`TYPE_AND_RANGE_MARKERS` in `scripts/discovery-surfaces.test.mjs`, which pass |
| 9 | `## Running generated cases` step 4 refuses to dispatch a pending case by name (never as a test failure, never a silent skip) and dispatches a secondary-role permission case through `--secondary`, comparing two recorded runs via `auth.credential` for the role delta (D-02, D-05) | ✓ VERIFIED | `SKILL.md` lines 568-605: step 4 now branches pending-first (keyed on the `pendiente` field, names `QA_AGENT_TOKEN_SECONDARY`, continues with remaining cases), then `API`/`UI`; the two-run role-delta rule is stated, naming `evidence.request.auth.credential`. Drift-locked by `PENDING_DISPATCH_MARKERS`, which passes |

**Score:** 9/9 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/discover-schema.mjs` | `parseCheckBounds`, `parseCheckEnum`, `extractPolicies`, `bounds`/`allowedValues`/`policies`/`policyWithCheckCount` fields | ✓ VERIFIED | All three functions exported and confirmed via `node -e` invocations matching plan acceptance criteria exactly; CR-01 fix present |
| `scripts/discover-schema.test.mjs` | Unit coverage for every recognised/unrecognised CHECK shape, incl. `<>` | ✓ VERIFIED | `estado <> 5` regression tests present and passing |
| `scripts/discovery.e2e.test.mjs` | End-to-end lock: bounds → 4 cases → valid document; 3 policies; empty-policies case | ✓ VERIFIED | Part of the 340-passing test run |
| `scripts/__fixtures__/sample-test-cases.md` | Golden 14-case document with dia_cierre boundary quartet | ✓ VERIFIED | `test-case-doc.mjs --file` → `valid:true`, `counts.cases:14` |
| `references/test-case-format.md` | D-08 subcategory titling, D-09/D-10 Regla de límites, D-02/D-04 pending rule | ✓ VERIFIED | All grep markers present at expected counts |
| `references/discovery-nextjs.md` | Permission/role-guard detection + Required-field/format detection rubrics, DOM-01/CUIT scope note | ✓ VERIFIED | All grep markers present |
| `scripts/discovery-surfaces.test.mjs` | `ROLE_GUARD_PATTERN`, `AUTHZ_STATUS_PATTERN`, `PERMISSION_GENERATION_MARKERS`, `TYPE_AND_RANGE_MARKERS`, `PENDING_DISPATCH_MARKERS` and their anti-drift locks | ✓ VERIFIED | All constants present, all lock blocks pass |
| `scripts/test-case-doc.mjs` | Pending execution state (`splitEjecucion`, `pendiente`, `pendienteMotivo`, `counts.pendientes`) | ✓ VERIFIED | Implemented per option-b, all behaviors match 04-04-SUMMARY.md's claims |
| `scripts/api-client.mjs` | `useSecondary`, `--secondary`, two ConfigError refusals, `evidence.request.auth.credential` | ✓ VERIFIED | All present and correctly gated behind the confirmation/production checks |
| `scripts/format-report.mjs` | `Auth:` line names credential | ✓ VERIFIED | `credential` rendered, backward-compatible default to `primary` |
| `SKILL.md` | Boundary rule, permission-case generation rules, pending refusal + secondary dispatch wiring, `QA_AGENT_TOKEN_SECONDARY` configuration entry | ✓ VERIFIED | All sections present and internally consistent |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `discover-schema.mjs` | `discovery.e2e.test.mjs` | `bounds` field | ✓ WIRED | e2e test asserts on live JSON output |
| `SKILL.md` | `references/test-case-format.md` | boundary/pending rule cross-reference | ✓ WIRED | Both name D-08/D-09/D-10/D-02 consistently |
| `scripts/__fixtures__/sample-test-cases.md` | `scripts/test-case-doc.mjs` | `validateTestCasesDoc` | ✓ WIRED | Confirmed by direct CLI run, exit 0 |
| `discover-schema.mjs` (`policies`) | `discovery.e2e.test.mjs` | top-level `policies` array | ✓ WIRED | 3-policy fixture assertion passes |
| `references/discovery-nextjs.md` | `scripts/discovery-surfaces.test.mjs` | pattern-doc-agreement lock | ✓ WIRED | Lock test passes |
| `SKILL.md` `## Case generation protocol` | `discover-schema.mjs` (`policies`) | permission-case generation rule | ✓ WIRED | Text cites the real field names (`policyName`, `table`, `command`, `role`, `using`, `withCheck`, `source`) |
| `SKILL.md` `## Case generation protocol` | `references/discovery-nextjs.md` | role-guard rubric deferral | ✓ WIRED | Cited by name |
| `SKILL.md` `## Running generated cases` step 4 | `scripts/test-case-doc.mjs` | dispatch on `Ejecución`/`pendiente` | ✓ WIRED | Keys on the actual field the reader exposes (`pendiente`), matching plan 04-04's committed shape |
| `SKILL.md` `## Running generated cases` step 4 | `scripts/api-client.mjs` | `--secondary` dispatch | ✓ WIRED | Text names the exact flag and evidence field the script produces |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Boundary parser on real fixture | `node scripts/discover-schema.mjs --project-root scripts/__fixtures__/mock-target-repo` | `dia_cierre.bounds = {min:0,max:6}`, `policies.length=3`, `policyWithCheckCount=3`, `rol.allowedValues=["admin","franquiciado"]` | ✓ PASS |
| Golden document validates | `node scripts/test-case-doc.mjs --file scripts/__fixtures__/sample-test-cases.md` | `valid:true`, `counts.cases:14` | ✓ PASS |
| CR-01 fix (not-equal operator) | `parseCheckBounds('estado <> 5')` | `null` (was `{min:6,max:null}` before fix) | ✓ PASS |
| CR-01 regression tests exist and pass (named, not full suite) | `npx vitest run scripts/discover-schema.test.mjs -t "not-equal"` | 2 passed | ✓ PASS |
| Helper-wrapped role-guard detection (named test) | `npx vitest run scripts/discovery-surfaces.test.mjs -t "helper-wrapped"` | 1 passed | ✓ PASS |
| Full phase-relevant test suite | `npm test -- scripts/discover-schema.test.mjs scripts/discovery.e2e.test.mjs scripts/discovery-surfaces.test.mjs scripts/test-case-doc.test.mjs scripts/api-client.test.mjs scripts/format-report.test.mjs` | 263/264 passed (1 known pre-existing env-fragility failure, see below) | ✓ PASS |
| Full workspace suite (run once) | `npm test` | 340/342 passed | ✓ PASS |

**Note on the 2 full-suite failures:** `scripts/api-client.test.mjs` ("neither --base-url nor QA_AGENT_BASE_URL exits 2...") and `scripts/ui-login.test.mjs` ("exits 2, writes no file... names both variables") both fail with an unexpected higher exit code (4 and 7 respectively) instead of 2. This matches the task's documented pre-existing environment fragility: a local `.env.local` is re-injected by dotenv even after the tests strip the variable from the spawned subprocess's env, so the subprocess finds `QA_AGENT_TOKEN`/UI credentials configured and proceeds past the config-exit-2 check to a later (network) failure. Both failing tests predate phase 4 (they test Phase 1/2 config-loading behavior, not any file this phase modified) and are unrelated to any phase 4 code path. Not counted as a phase 4 regression, per the task's explicit instruction.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| DISC-04 | 04-01, 04-02, 04-03, 04-06 | Systematic form-validation coverage: required fields, invalid formats, boundary values | ✓ SATISFIED | Boundary quartet generation (04-01), value-set grounding (04-02), format-detection rubric + CUIT/CUIL scope note (04-03), type-implied rule (04-06) all present and tested |
| DISC-05 | 04-02, 04-03, 04-04, 04-05, 04-06 | Edge/negative cases beyond happy path: out-of-range, wrong types, permission/auth edge cases | ✓ SATISFIED | RLS policy + role-guard detection (04-02/04-03), pending-state document contract (04-04), `--secondary` credential mechanism (04-05), actual generation + dispatch wiring (04-06) all present and tested |

No orphaned requirements: `REQUIREMENTS.md`'s traceability table maps only DISC-04 and DISC-05 to Phase 4, and both are claimed by at least one plan's frontmatter.

### Anti-Patterns Found

None. Scanned all 14 phase-modified files (scripts + SKILL.md + reference docs + fixture) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and placeholder-language patterns — zero matches.

One genuine logic bug (CR-01) was found by code review during the phase and confirmed fixed in commit `9eb2b42`, verified present in the current codebase with passing regression tests (see Truth #2 above).

Five non-blocking warnings and one info item from `04-REVIEW.md` remain open (WR-01 IPv6-loopback dead code, WR-02 misleading 401/403 hint on a passing verdict, WR-03 `runCase` not independently re-checking the secondary/storage-state exclusion, WR-04 missing `return` after `process.exit`, WR-05 loose citation regex + no re-check at dispatch time; IN-01 unescaped backticks in report rendering). None of these block DISC-04/DISC-05 truths — they are either dead/unreachable code paths, cosmetic report-rendering issues, or defense-in-depth gaps in a path that today has only one caller that already enforces the invariant. Flagged here for potential follow-up, not as phase-4 gaps.

### Human Verification Required

None. All must-haves are backed by deterministic parser tests, anti-drift lock tests against `SKILL.md`/`references/*.md` protocol text, and direct CLI/manual reproduction matching plan acceptance criteria exactly. This phase's "orchestrator judgment" surfaces (role-guard detection rubric, case-generation protocol) are verified the same way prior phases in this project verify orchestrator-instruction correctness: via text-presence anti-drift locks plus a golden fixture proving one concrete end-to-end pipeline run — consistent with this project's established verification methodology, not a new gap introduced by this phase.

### Gaps Summary

No gaps found. All 9 derived observable truths (covering both ROADMAP success criteria and the more granular per-plan must-haves) are verified against the actual codebase, not just SUMMARY.md claims. The one critical bug found by code review (CR-01, `parseCheckBounds` misreading `<>` as a bound) was independently confirmed fixed in the codebase with passing regression tests, not merely claimed fixed.

---

_Verified: 2026-09-18_
_Verifier: Claude (gsd-verifier)_
