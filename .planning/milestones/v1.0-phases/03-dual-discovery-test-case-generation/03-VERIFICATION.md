---
phase: 03-dual-discovery-test-case-generation
verified: 2026-08-24T15:10:00Z
status: passed
score: 20/20 must-haves verified (across 03-01, 03-02, 03-03 truths)
behavior_unverified: 0
overrides_applied: 0
---

# Phase 3: Dual Discovery & Test-Case Generation Verification Report

**Phase Goal:** The agent can determine what to test either by reading the target project's code or from a plain natural-language instruction, and turn that into documented test cases ready for the executors from Phase 1 and Phase 2 to run.
**Verified:** 2026-08-24T15:10:00Z
**Status:** passed
**Re-verification:** No — initial verification (updated same session with live UAT evidence closing the one outstanding human-check item)

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | Pointing the agent at a project scans routes, forms, validation, and DB constraints to infer testable surfaces without being told what to test (DISC-01) | VERIFIED | `scripts/discover-schema.mjs` (668 lines) extracts every migration constraint form with data-CHECK vs. RLS-WITH-CHECK disambiguation, independently re-run against the fixture repo (`check-disambiguation-ok`, `withCheckSkipped: 3`). `references/discovery-nextjs.md` (170 lines) + `scripts/discovery-surfaces.test.mjs` (371 lines, part of 269-test suite) prove route/form/Server-Action/router-layout detection against fixtures in all 3 router layouts. Independently re-run live against `c:/franquix`: `discoverSchema` reports 30 migration files, 206 constraints, 14 policy predicates correctly excluded — matches 03-03-SUMMARY.md's claim exactly. |
| SC2 | From code, the agent produces documented test cases (title, preconditions, steps, expected result, type) the executors can run directly (DISC-02) | VERIFIED | `references/test-case-format.md` (232 lines) is the structure contract; `scripts/test-case-doc.mjs` (620 lines) parses/validates it (`parseTestCasesDoc`, `validateTestCasesDoc`, `findCase`). Golden fixture (`sample-test-cases.md`, 12 cases) and a real-repo-generated document (`2026-08-24-1100-franquix-test-cases.md`) both validate cleanly (`valid: true`, exit 0) when re-run in this verification pass. Citations in the franquix document were spot-checked directly against the live `c:/franquix` source (`app/api/categorias/route.ts`, `app/login/actions.ts`, `supabase/migrations/0005_franquicias_tipo_horario.sql`) — every cited line number matches the real file exactly (case-1 through case-12, all 12 checked). |
| SC3 | A one-off natural-language instruction produces documented cases for just that flow, with no whole-codebase scan (DISC-03) | VERIFIED | `SKILL.md`'s `## Discovery protocol` step 2 (scoped branch) explicitly stops-and-asks on zero/multiple matches and never falls back to a full scan. `scripts/__fixtures__/sample-test-cases-scoped.md` and the real scoped document generated against `c:/dotax` (`2026-08-24-1130-dotax-registro-test-cases.md`) both validate cleanly (re-run: exit 0, `valid: true`) and list exactly 2 individually-named files in `Alcance`, not a glob. |

### Plan-Level Must-Haves (03-01, 03-02, 03-03)

All 20 `must_haves.truths` entries across the three plans were checked against the codebase; every one is backed by either a passing automated test (re-run in this pass) or a direct independent reproduction. Representative direct verifications performed in this pass (not just re-reading SUMMARY claims):

| # | Truth (abbreviated) | Status | Evidence |
|---|---|---|---|
| 1 | `discover-schema.mjs` prints one JSON line disambiguating CHECK vs WITH CHECK | VERIFIED | Re-ran the plan's own acceptance command; printed `check-disambiguation-ok` |
| 2 | `withCheckSkipped` reports policy predicates deliberately excluded | VERIFIED | Same run: `withCheckSkipped` = 3 against fixture, 14 against real franquix |
| 3 | `references/test-case-format.md` is the canonical structure contract | VERIFIED | 232 lines on disk, referenced and enforced by `test-case-doc.mjs` |
| 4 | `parseTestCasesDoc`/`findCase` reads a conforming document | VERIFIED | `npx vitest run scripts/test-case-doc.test.mjs` → 37/37 passed |
| 5 | `discover-schema.mjs` refuses (exit 8) paths outside `--project-root` | VERIFIED | Re-ran plan's path-escape command; printed `path-escape-refused-ok` |
| 6 | `discover-schema.mjs` never writes to any path | VERIFIED | `grep` for write calls (`writeFileSync`, etc.) — none found |
| 7 | Server-Action vs. client-fetch form classification | VERIFIED | `scripts/discovery-surfaces.test.mjs` — part of green full-suite run |
| 8 | Router-layout detection (app/pages/both/unknown) | VERIFIED | Same file; live-confirmed both franquix and dotax detect as `app` |
| 9 | `case-1` vs `case-12` anchored, collision-proof lookup | VERIFIED | Independently re-ran: `anchored-lookup-ok` — `case-1`≠`case-12` titles |
| 10 | Malformed document rejected by name, exit 9, before any case acted on | VERIFIED | **Critical fix independently reproduced** — see below |
| 11 | Scoped instruction grounds cases only in resolved files | VERIFIED | Live dotax document: `Alcance` names exactly 2 files, not a glob |
| 12 | Zero/multiple-match scoped instruction stops and asks, never falls back to full scan | VERIFIED | `SKILL.md` step 2's explicit stop-and-ask rule; live dotax run confirmed by 03-03-SUMMARY's tool-call trace |
| 13 | Named case hands off to Phase 1/2 executors unchanged, re-reading doc from disk | VERIFIED | `SKILL.md` "## Running generated cases" steps 2–4; no Phase 1/2 execution file modified (confirmed via git log — none of `api-client.mjs`, `ui-case.mjs`, `confirm-destructive.mjs`, etc. touched by any Phase 3 commit) |
| 14 | Generated document never carries a pre-approving dispatch flag | VERIFIED | `FORBIDDEN_DISPATCH_FLAGS` scan now covers case blocks *and* metadata/surface headings (WR-04 fix independently reproduced below) |
| 15 | Generating a document ends the invocation (no case run in the same turn) | VERIFIED (present, protocol-documented) | `SKILL.md` "Case generation protocol" closing terminal-step rule; not independently runtime-observable (see human verification item) |

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/discover-schema.mjs` | Deterministic constraint extractor, ≥180 lines | VERIFIED | 668 lines; all 9 required exports present (checked via plan's own export-check one-liner) |
| `scripts/discover-schema.test.mjs` | Unit coverage | VERIFIED | 386 lines, part of green suite |
| `scripts/test-case-doc.mjs` | Reader/validator + CLI, ≥220 lines | VERIFIED | 620 lines; all 7 exports present (`parseTestCasesDoc`, `findCase`, `validateTestCasesDoc`, `FORBIDDEN_DISPATCH_FLAGS`, `CASE_HEADING_PATTERN`, `CASE_FIELDS`/`CASE_TYPES`/`EXECUTION_MODES` via header import, `TestCaseFormatError`) |
| `scripts/test-case-doc.test.mjs` | CLI + validation coverage | VERIFIED | 440 lines, 37 tests all passing |
| `references/test-case-format.md` | Structure contract, ≥80 lines | VERIFIED | 232 lines |
| `references/discovery-nextjs.md` | Detection-rule contract, ≥110 lines | VERIFIED | 170 lines |
| `scripts/discovery.e2e.test.mjs` | Tracer end-to-end lock | VERIFIED | 269 lines, part of green suite |
| `scripts/discovery-surfaces.test.mjs` | Pattern-to-doc anti-drift proof | VERIFIED | 371 lines, part of green suite |
| `scripts/__fixtures__/sample-test-cases.md` | 12-case golden document | VERIFIED | 107 lines, 12 sequential case IDs, validates `valid: true` |
| `scripts/__fixtures__/sample-test-cases-scoped.md` | Scoped-origin golden document | VERIFIED | 32 lines, validates `valid: true` |
| `SKILL.md` | Discovery/Case-generation/Running-generated-cases sections wired in, Phase 1/2 sections intact | VERIFIED | 11 `## ` headings present (8 pre-existing + 3 new); all three new sections read and confirmed substantive, not stubs |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `SKILL.md` Discovery protocol | `scripts/discover-schema.mjs` | Bash tool invocation, step 8 | WIRED | Explicit instruction to invoke via Bash, "never reading migration SQL by eye" |
| `SKILL.md` Discovery protocol | `references/discovery-nextjs.md` | deferred detection-rule detail | WIRED | Step 5 explicitly defers rather than restating |
| `SKILL.md` Case generation protocol | `references/test-case-format.md` | deferred document structure | WIRED | Explicit defer instruction |
| `qa-reports/<run-id>-test-cases.md` | `scripts/test-case-doc.mjs` | validate-before-report step | WIRED | "Validate the written file by parsing it back before telling the developer anything" |
| `SKILL.md` Running generated cases | `scripts/test-case-doc.mjs` CLI | `--file`/`--case` resolution | WIRED, and now safe | Independently reproduced: a hand-edited case containing `--confirmed --allow-non-local` now returns exit 9 (see CR-01 below), not exit 0 as originally found by code review |
| `SKILL.md` Running generated cases | `## Case construction`/`## Confirmation protocol` (API), `## UI run protocol`/`## UI confirmation protocol` (UI) | unchanged handoff | WIRED | No Phase 1/2 execution file modified by any Phase 3 commit (git log confirms) |

### Code Review Fix Verification (CR-01 and WR-01 through WR-04)

The phase directory includes `03-REVIEW.md` (1 critical + 4 warning findings) and `03-REVIEW-FIX.md` (all 5 claimed fixed at commit range `28ce1c8`..`fbf8768`). Per this task's explicit instruction, each fix was **independently reproduced against the live codebase**, not accepted on the SUMMARY/REVIEW-FIX narrative alone:

- **CR-01 (critical — confirmation-gate bypass)**: Reproduced the review's exact repro — wrote a copy of the golden document with case-1's `Pasos` field hand-edited to `DELETE /api/franquicias/1 --confirmed --allow-non-local`, then ran `node scripts/test-case-doc.mjs --file <path> --case case-1`. **Result: exit code 9**, stderr names the case and the flag (`Case "case-1" contains forbidden dispatch flag "--confirmed"...`), empty stdout. Before the fix this returned exit 0 with the flag verbatim in stdout. **Confirmed genuinely fixed.**
- **WR-01 (gap-cascade false errors)**: Reproduced by deleting case-5 from the 12-case golden document and running `validateTestCasesDoc`. Result: exactly one error reported (`expected "case-5", found "case-6"`), not a cascade. **Confirmed fixed.**
- **WR-02 (symlinked migrations silently dropped)**: Confirmed `listMigrations`'s filter now includes `e.isSymbolicLink()` in addition to `e.isFile()` (code inspection); the WR-02 fix commit `652194c` is present in `git log`.
- **WR-03 (missing `Origen del surface` line not caught)**: Reproduced by stripping the `Origen del surface` line from the golden document's first surface and running `validateTestCasesDoc`. Result: `["Surface \"POST /api/categorias\" is missing its required \"**Origen del surface:**\" line"]`. **Confirmed fixed.**
- **WR-04 (forbidden-flag scan didn't cover metadata)**: Reproduced by injecting `--confirmed` into the golden document's `**Instrucción:**` metadata line. Result: `valid: false`, error names `--confirmed` and "Document metadata contains forbidden dispatch flag". **Confirmed fixed.**

All five fixes are genuinely present and working, not just claimed.

### Real-Repo Validation (03-03 Task 3)

Independently re-verified rather than trusted from SUMMARY:

- Both generated documents (`2026-08-24-1100-franquix-test-cases.md`, `2026-08-24-1130-dotax-registro-test-cases.md`) exist at the claimed scratchpad path and both re-validate cleanly (`valid: true`, exit 0) against the current (post-review-fix) code.
- Spot-checked every citation in the franquix document's `POST /api/categorias`, `GET /api/categorias`, and `UI /login` surfaces against the live `c:/franquix` source directly (not from the SUMMARY's claim) — every line number cited (11, 15, 19, 21-22, 26, 28, 37, 39, 54, 75) matches the real file exactly, including the `dia_cierre BETWEEN 0 AND 6` constraint citation at `supabase/migrations/0005_franquicias_tipo_horario.sql:5`.
- `git status --porcelain` re-run directly in both `c:/franquix` and `c:/dotax`: dotax is clean; franquix shows only the pre-existing, unrelated `.gitignore` diff (`graphify-out`, `.env*.local` additions) that the SUMMARY explicitly disclosed as pre-dating this session — confirmed by diff content matching that description exactly. No write occurred outside `qa-reports/` (in fact, no write occurred inside either repo at all — Task 3 deliberately wrote both documents to the session scratchpad instead, a stricter-than-required outcome).
- No literal credential, token, or connection string found in either generated document on inspection.
- `case-12` (the one `edge`-typed case, DB-only constraint) correctly states the expectation is inferred from observed behavior and names its migration citation, matching the negativo-vs-edge labeling rule.

### Full Test Suite

`npx vitest run` (re-run in this pass): **267 passed, 2 failed, across 14 files.** The 2 failures (`api-client.test.mjs` exit-2-vs-4, `ui-login.test.mjs` exit-2-vs-7) are pre-existing, unrelated to Phase 3, and caused by a local `C:/qa-agent/.env.local` file (independently confirmed present on this machine via `Test-Path`) — exactly matching the root cause documented in `deferred-items.md` and both `03-02-SUMMARY.md`/`03-03-SUMMARY.md`. Not a Phase 3 regression.

### Anti-Patterns Found

None. `grep` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across `scripts/*.mjs` returned no matches. No stub returns, no empty handlers, no debt markers in any file this phase touched.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|---|---|---|---|
| DISC-01 | 03-01, 03-02 | SATISFIED | Schema extraction + route/form/router discovery, verified live against franquix and dotax |
| DISC-02 | 03-01, 03-03 | SATISFIED | Document format contract, parser/validator, dispatch-flag safety (post-fix) |
| DISC-03 | 03-03 | SATISFIED | Scoped generation, verified live against dotax with tool-call containment |

No orphaned requirements — REQUIREMENTS.md's traceability table maps exactly DISC-01/02/03 to Phase 3, matching what the three plans' frontmatter declare.

### Gaps Summary

No gaps found — every must-have truth, artifact, and key link is verified present, substantive, and wired, and the one critical code-review finding (CR-01) plus all four warnings were independently reproduced as genuinely fixed rather than accepted on narrative alone.

## Live UAT Addendum (2026-08-24)

The one outstanding human-check item (item 7 of 03-03-PLAN.md Task 3's `<human-check>` block — live confirmation-gate dispatch of a generated case) was executed live in this session and closed:

- Resolved `case-1` ("Alta de categoría con datos válidos") from the real franquix-generated document via the documented protocol: `node scripts/test-case-doc.mjs --file <path> --case case-1` — returned the case's `POST /api/categorias` step with its body.
- Dispatched it through `api-client.mjs` without `--confirmed`, exactly as `## Confirmation protocol` specifies. Result: `{"status":"needs_confirmation","preview":{"method":"POST","url":"http://127.0.0.1:59999/api/categorias","body":null},...}`, exit 3 — no network request was sent (confirmed: the confirmation refusal happens before dispatch, so this required no live franquix server).
- Showed the preview to the user via `AskUserQuestion` per protocol; user declined.
- Recorded the decline per D-04: `--declined --blocked-reason "..."`. Result: `{"status":"blocked",...,"verdict":"NOT EXECUTED — POST /api/categorias was declined; no request was sent"}`, exit 0.

This directly confirms the confirmation-gate pause fires correctly on the case-document-to-dispatch path, closing the last item the phase's own validation plan flagged as unautomatable. Status moves `human_needed` → `passed`.

---

_Verified: 2026-08-24T15:10:00Z_
_Verifier: Claude (gsd-verifier)_
