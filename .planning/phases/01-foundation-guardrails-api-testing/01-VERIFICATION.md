---
phase: 01-foundation-guardrails-api-testing
verified: 2026-08-11T18:21:11Z
uat_completed: 2026-08-11T18:55:00Z
status: passed
score: 4/4 must-haves verified (live UAT — see 01-UAT.md)
behavior_unverified: 0
overrides_applied: 0
known_gaps:
  - "PreToolUse hook (SAFE-01 secondary hardening layer) did not visibly fire during a live confirmed-DELETE Bash call in this session. Script-level gate (Layer 1, the actual hard guarantee per D-01–D-04) is fully verified live and unaffected. Tracked as a non-blocking follow-up in 01-UAT.md Gaps."
---

# Phase 1: Foundation, Guardrails & API Testing Verification Report

**Phase Goal:** A developer can invoke the QA agent as an installed Claude Code skill and get a reliable, evidence-backed API test run against a local or staging target, with destructive actions safely gated behind confirmation.
**Verified:** 2026-08-11T18:21:11Z
**Status:** passed (initial automated pass: human_needed → resolved via live UAT session, see addendum below and `01-UAT.md`)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can invoke the skill via a slash command in Claude Code and it runs against a target project with no prior project-specific setup (PKG-01) | ✓ VERIFIED (live) | Installed via Windows junction (`mklink /J ~/.claude/skills/qa-agent C:/qa-agent`), invoked via `Skill(skill="qa-agent", ...)`, ran a real GET against DATAX-web (`localhost:3000/api/ext/capabilities`) — 200, evidence captured, `qa-reports/*.md` written into the target project. **Found and fixed one real bug in this pass**: `isMain` module-entrypoint check didn't resolve symlinks/junctions, so the skill silently no-op'd when installed the documented way; fixed via `realpathSync` comparison (commit `a51ab32`), re-verified passing, 81/81 tests still green. See `01-UAT.md` Test 1. |
| 2 | User can point the agent at localhost or a staging URL (base-URL parameter) and it runs GET/POST/PUT/DELETE against that target, validating status codes and response shape/errors (API-01, API-02, EXEC-04) | ✓ VERIFIED | `scripts/api-client.mjs:45-52` (`DISPATCH` map covering GET/POST/PUT/PATCH/DELETE/HEAD), `:81-106` (`readConfig` resolves `--base-url` / `QA_AGENT_BASE_URL`), `:288-323` (status + `shape-observed` field checks via `buildShapeSchema`). Proven by 81/81 passing `npx vitest run` tests (`scripts/api-client.test.mjs`, 35 tests) and my own independent spot check: a confirmed `DELETE` dispatched a real HTTP request to a sibling mock-server process and returned a captured 204 response (see Behavioral Spot-Checks). |
| 3 | Destructive actions (delete, payment, role/permission change, real email) stop and require explicit confirmation before proceeding; the report distinguishes executed vs. blocked actions (SAFE-01, SAFE-02) | ✓ VERIFIED | `scripts/destructive.mjs:26-35` (`requiresConfirmation` — DELETE always gated, POST/PUT/PATCH gated unless `looksReadOnly`); `scripts/api-client.mjs:445-499` (gate runs before `readConfig`, exit 3 on unconfirmed, `--declined` writes a `status: "blocked"` case with `blockedReason` and null `evidence.response`, before any network call). My own spot check confirmed an unconfirmed DELETE returns exit 3 with zero dispatch, a confirmed DELETE dispatches and is recorded `passed`, and a declined DELETE is recorded `blocked` with the supplied reason — and the rendered report shows one `## Blocked pending confirmation` line plus a full `Case 2 ... BLOCKED` section distinct from the executed `Case 1 ... PASSED` section. The secondary hardening layer (`scripts/confirm-destructive.mjs` `PreToolUse` hook, registered in `SKILL.md:6-11`) is unit-tested (`decideForCommand` returns `permissionDecision: "ask"` for a destructive command even when `--confirmed` is present) but its live firing inside an installed Claude Code session is unverified — see Human Verification #2. |
| 4 | After a run, the user receives a readable report with evidence (HTTP request/response) and reproduction steps on every failing case (SAFE-03, REP-01, REP-02) | ✓ VERIFIED | `scripts/format-report.mjs:106-163` (`renderCase` throws `EvidenceMissingError` for any passed/failed case with no `evidence.response`, exempting blocked); `:70-98` (`deriveReproSteps` composes steps only from `evidence.request`/`checks`/`run.baseUrl`, never a narrative field, token referenced only as literal `$QA_AGENT_TOKEN`); `:231-259` (`chatSummary`, capped ≤15 lines, printed to stdout by the CLI at `:317`). Proven by `scripts/format-report.test.mjs` (22 tests) plus `scripts/tracer.e2e.test.mjs`'s exit-5 `EVIDENCE_MISSING` case and my own spot check's rendered Markdown (full Request/Response/Checks/Verdict blocks, redacted `Authorization: [REDACTED]`, token string absent from both `results.json` and the `.md` file). |

**Score:** 3/4 truths verified programmatically (1 requires human confirmation of a live installed-skill session)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `SKILL.md` | Skill entry point: frontmatter + Installation/Configuration/Run protocol/Confirmation protocol/Case construction | ✓ VERIFIED | 141 lines; `hooks: PreToolUse` frontmatter present; documents `QA_AGENT_TOKEN`/`QA_AGENT_BASE_URL`, the full 0/2/3/4/5/6 exit-code table, and the six-step ask-per-call confirmation loop. |
| `package.json` | Dependency manifest | ✓ VERIFIED | `playwright@^1.62.1`, `zod@^4.4.3`, `dotenv@^17.4.2`, devDep `vitest@^4.1.10`; no `@playwright/test` (confirmed intentional — `APIRequestContext` only, no browser binaries needed, consistent with an API-only Phase 1). |
| `scripts/api-client.mjs` | Deterministic HTTP execution + evidence capture | ✓ VERIFIED | 554 lines; exports `runCase`, `redactHeaders`, `readConfig`, `appendCase`, `RESULTS_SCHEMA_VERSION`, `DISPATCH`, `buildShapeSchema`, `looksLikeProduction`, `preflight`, `ConfigError`; wired as the CLI entry point invoked from `SKILL.md`. |
| `scripts/destructive.mjs` | Method-based destructive classification | ✓ VERIFIED | 53 lines; exports `requiresConfirmation`, `previewOf`, `SAFE_METHODS`, `DESTRUCTIVE_METHODS`; imported by both `api-client.mjs` and `confirm-destructive.mjs`. |
| `scripts/confirm-destructive.mjs` | PreToolUse hook backstop | ✓ VERIFIED | 92 lines; exports `decideForCommand`; registered in `SKILL.md` frontmatter `hooks.PreToolUse[0].hooks[0].command`; fails open on malformed stdin. |
| `scripts/format-report.mjs` | results.json -> Markdown renderer | ✓ VERIFIED | 328 lines; exports `renderReport`, `renderCase`, `EvidenceMissingError`, `reportFileName`, `summarise`, `deriveReproSteps`, `chatSummary`; matches `references/report-template.md`'s structure contract exactly (H1, metadata block, conditional Blocked section, per-case PASSED/FAILED/BLOCKED). |
| `references/destructive-classification.md` | Read-only judgment rubric | ✓ VERIFIED | Method table, worked examples/counter-examples, uncertainty tie-breaker, D-02 closing note — referenced from `SKILL.md`'s Confirmation protocol step 1. |
| `scripts/__fixtures__/mock-server.mjs` + `mock-server-process.mjs` | Dependency-free HTTP test fixture | ✓ VERIFIED | Used by all four test files and confirmed working in my own independent spot check (sibling OS process, real loopback HTTP traffic, `DEFAULT_ROUTES` for every method + error cases). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SKILL.md` | `scripts/api-client.mjs` | Bash tool invocation documented in `## Run protocol` step 4 | ✓ WIRED | `node <skill-dir>/scripts/api-client.mjs --method ... --base-url ... --results ...` template present at `SKILL.md:70-74`. |
| `SKILL.md` | `scripts/format-report.mjs` | Bash tool invocation documented in `## Run protocol` step 5 | ✓ WIRED | `SKILL.md:76-81`. |
| `SKILL.md` frontmatter | `scripts/confirm-destructive.mjs` | `hooks.PreToolUse[0].hooks[0].command` | ✓ WIRED | `SKILL.md:6-11`; matches `code.claude.com/docs/en/hooks.md`'s documented shape per 01-02-SUMMARY's live verification (not independently re-verified by this agent — see note below). |
| `scripts/api-client.mjs` | `scripts/destructive.mjs` | `import { previewOf, requiresConfirmation } from './destructive.mjs'` | ✓ WIRED | `api-client.mjs:35`, called at `:475` before `readConfig()`. |
| `scripts/confirm-destructive.mjs` | `scripts/destructive.mjs` | `import { requiresConfirmation } from './destructive.mjs'` | ✓ WIRED | `confirm-destructive.mjs:23`. |
| `scripts/api-client.mjs` | `results.json` | `appendCase` writes the structured case record | ✓ WIRED | `api-client.mjs:369-393`, called at `:469` (declined) and `:537` (normal dispatch). |
| `scripts/format-report.mjs` | `qa-reports/*.md` | reads `results.json`, writes `<ts>-<slug>.md` + seeds `.gitignore` | ✓ WIRED | `format-report.mjs:279-319`. |

### Behavioral Spot-Checks

Full `npx vitest run` executed once (see below); all remaining checks are my own independent, out-of-suite spot checks against a live sibling-process mock server (no suite re-runs).

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite is green | `npx vitest run` (run once, in `C:/qa-agent`) | `5 test files, 81 tests — all passed` | ✓ PASS |
| Unconfirmed DELETE is refused, zero dispatch | `node scripts/api-client.mjs --method DELETE --url /api/clients/1 --base-url <mock> --title t` (no `--confirmed`) | exit code `3`, `{"status":"needs_confirmation", ...}` | ✓ PASS |
| Confirmed DELETE dispatches for real | same command + `--confirmed` | exit `0`, real HTTP DELETE reached the mock server, response `204` captured as evidence, `status: "passed"` | ✓ PASS |
| Declined DELETE records a distinct blocked case | same command + `--declined --blocked-reason "user said no"` | exit `0`, `status: "blocked"`, `evidence.response: null`, `blockedReason: "user said no"` | ✓ PASS |
| `decideForCommand` flags a confirmed destructive command anyway | `decideForCommand("... --method DELETE ... --confirmed")` | returned `permissionDecision: "ask"` object (ignores `--confirmed` on purpose) | ✓ PASS |
| Rendered report distinguishes executed vs. blocked, redacts token | `node scripts/format-report.mjs --results ... --out-dir ...` | Markdown contains a `## Blocked pending confirmation` summary line plus a separate `Case 2 ... BLOCKED` section and a `Case 1 ... PASSED` section; `Authorization: [REDACTED]` present; the literal token string `spot-check-secret-token` absent from both `results.json` and the `.md` file | ✓ PASS |

Scratch files used for the spot check (`scratch-spotcheck.mjs`, `scratch-results.json`, `scratch-qa-reports/`) were deleted after verification — `git status --short` confirms a clean working tree.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| PKG-01 | 01-01 | Skill installable, invocable via slash command | ? NEEDS HUMAN | Code/docs correct; live invocation unverified (Human Verification #1) |
| SAFE-01 | 01-02 | Never executes destructive action without confirmation | ✓ SATISFIED | `destructive.mjs` + gate in `api-client.mjs`, spot-checked |
| SAFE-02 | 01-02, 01-03 | Report distinguishes executed vs. blocked | ✓ SATISFIED | Three-state rendering, spot-checked |
| SAFE-03 | 01-01, 01-03 | Every verdict backed by captured evidence | ✓ SATISFIED | `EvidenceMissingError` enforcement, spot-checked |
| API-01 | 01-01, 01-04 | Direct HTTP GET/POST/PUT/DELETE against target | ✓ SATISFIED | `DISPATCH` map, spot-checked |
| API-02 | 01-04 | Validates status codes and response shape/errors | ✓ SATISFIED | `buildShapeSchema`, status checks, tests pass |
| EXEC-04 | 01-01, 01-04 | Targets localhost or staging via base-URL param | ✓ SATISFIED | `readConfig`, `looksLikeProduction`, tests pass |
| REP-01 | 01-01, 01-03 | Readable report, what was tested/passed/failed | ✓ SATISFIED | `renderReport`, `chatSummary`, spot-checked |
| REP-02 | 01-03 | Reproduction steps on every failing case | ✓ SATISFIED | `deriveReproSteps`, tests pass |

No orphaned requirements — ROADMAP.md's Phase 1 requirement list (`PKG-01, SAFE-01, SAFE-02, SAFE-03, API-01, API-02, EXEC-04, REP-01, REP-02`) is fully covered by the union of the four plans' declared `requirements` fields.

### Anti-Patterns Found

None. Scanned every file under `scripts/*.mjs`, `SKILL.md`, and `references/*.md` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and common stub phrasing (`placeholder`, `coming soon`, `not yet implemented`, `not available`) — the only match was the identifier `placeholderHeaders` in `scripts/api-client.mjs:447`, a real variable holding a genuine (non-secret) display string for the `--declined` path, not a stub or debt marker.

### Human Verification Required

#### 1. Live installed-skill invocation (PKG-01)

**Test:** Copy/symlink `C:/qa-agent` into `~/.claude/skills/qa-agent`, run `npm install` once, then invoke `/qa-agent <base-url> "<instruction>"` from a live Claude Code session against a real running target (DATAX, dotax, or franquix on localhost, or a staging URL) with a real `QA_AGENT_TOKEN` exported.
**Expected:** The slash command is discovered and runs with zero project-specific setup inside the target repo; it dispatches real HTTP requests, ends with a chat summary, and writes `qa-reports/*.md` into the target project.
**Why human:** This is a property of a live installed Claude Code session against a real target app — not observable from vitest. Every one of the four SUMMARYs (01-01 through 01-04) explicitly defers this to end-of-phase UAT per `workflow.human_verify_mode: "end-of-phase"`, and none of the four executor sessions has actually performed it.

#### 2. Live PreToolUse hook firing (SAFE-01 hardening layer)

**Test:** With the skill installed per #1, trigger a destructive call (e.g. a DELETE) via the live Bash tool inside Claude Code and observe whether Claude Code's own permission dialog fires (including a check that it still fires with `--dangerously-skip-permissions` set, per the hooks documentation's stated guarantee).
**Expected:** Claude Code pauses and asks for permission via its own dialog, independent of and in addition to `api-client.mjs`'s own exit-3 script-level refusal (which is independently proven — see Truth #3 above).
**Why human:** `confirm-destructive.test.mjs` only proves `decideForCommand()`'s pure logic and the stdin/stdout hook protocol in isolation; no running Claude Code session exists inside vitest to prove the hook is actually dispatched and honored. 01-02-SUMMARY.md (coverage item D5) explicitly flags this as unexercised.

### Gaps Summary

No blocking gaps. All four success criteria are code-complete, tested (81/81 `vitest` green), and now also confirmed live end-to-end — both automated-verification spot checks and a full human UAT session (see `01-UAT.md`) against a real running target. One non-blocking gap remains: the `PreToolUse` hook (SAFE-01's *secondary* hardening layer) did not visibly fire during a live confirmed-DELETE Bash call; the actual hard guarantee (the script-level gate, Layer 1, D-01–D-04) is fully proven live and unaffected by this. Tracked in `01-UAT.md` Gaps for follow-up investigation, not a Phase 1 blocker.

## Live UAT Addendum (2026-08-11T18:55:00Z)

Both previously-open human-verification items were exercised live in this session, following the manual UAT trail recorded in full in `01-UAT.md`:

1. **PKG-01 live install + invoke** — ✓ PASS, one real bug found and fixed (isMain/symlink resolution, commit `a51ab32`). See `01-UAT.md` Test 1.
2. **Real API dispatch against a live target** — ✓ PASS. GET against DATAX-web (`localhost:3000`), full evidence, report written, token redacted. See `01-UAT.md` Test 2.
3. **Live destructive-action confirmation pause** — ✓ PASS. Unconfirmed DELETE refused (exit 3, zero dispatch) → developer confirmed via `AskUserQuestion` per `SKILL.md`'s protocol → re-invoked with `--confirmed` → real DELETE dispatched, evidence captured. See `01-UAT.md` Test 3.
4. **`PreToolUse` hook firing** — ⚠ UNCONFIRMED. No additional Claude Code permission dialog was observed beyond the orchestrator-driven pause in #3. Root cause not diagnosed (possible causes: skill-frontmatter hooks needing separate settings.json registration, or a Claude Code version/runtime limitation). Does not affect the phase's core safety guarantee — see `01-UAT.md` Test 4 and Gaps.

**Revised status: passed.** Phase 1 delivers its stated goal with one documented, non-blocking follow-up item (hook-firing investigation) carried forward rather than blocking phase completion.

---

_Verified: 2026-08-11T18:21:11Z (automated) / 2026-08-11T18:55:00Z (live UAT addendum)_
_Verifier: Claude (gsd-verifier + live UAT session)_
