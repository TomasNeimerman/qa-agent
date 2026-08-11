---
phase: 01-foundation-guardrails-api-testing
plan: 02
subsystem: testing
tags: [destructive-action-gate, confirmation, pretooluse-hook, claude-code-skill, vitest]

requires:
  - phase: 01-foundation-guardrails-api-testing
    provides: "scripts/api-client.mjs (runCase/appendCase/RESULTS_SCHEMA_VERSION, exit code 0/2/4), results.json case-object contract, exit code 3 reserved"
provides:
  - "scripts/destructive.mjs — requiresConfirmation() and previewOf(), the mechanical method-based half of the destructive-action gate (D-01, D-02)"
  - "Confirmation gate wired into scripts/api-client.mjs: --confirmed / --declined / --read-only-intent / --blocked-reason, exit code 3 (needs_confirmation, nothing sent)"
  - "scripts/confirm-destructive.mjs — PreToolUse hook backstop (decideForCommand) that escalates any destructive api-client.mjs Bash invocation to Claude Code's permission dialog, deliberately ignoring the caller's own --confirmed"
  - "references/destructive-classification.md — the read-only judgment rubric the orchestrator applies before choosing --read-only-intent"
  - "SKILL.md: hooks: PreToolUse frontmatter registration + ## Confirmation protocol body section documenting the ask-per-call loop"
  - "The blocked third result state (SAFE-02): --declined writes a first-class case with status: blocked, a non-empty blockedReason, and null evidence.response"
affects: [01-03-report-and-summary, 01-04-full-dispatch]

actuals:
  tokens: 7842
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Destructive-action gate evaluated before readConfig() resolves the auth token — an unconfirmed or declined destructive call never causes a credential read"
    - "Mechanical method-based classification (destructive.mjs) holds zero project configuration; the orchestrator supplies the only judgment call (is this POST read-only?) via --read-only-intent, per the classification rubric"
    - "Two independent enforcement layers for every destructive call: the script's own exit-3 refusal (primary block) plus a PreToolUse hook escalation to Claude Code's permission dialog (hardening layer), the hook deliberately ignoring the caller's own --confirmed flag since its entire value is firing anyway"
    - "Test fixture (mock-server.mjs) extended with an in-memory request log (GET /__requests, POST /__reset) so tests assert zero HTTP traffic actually reached the target, not just that the script printed the right status"
    - "Strict TDD RED→GREEN commit separation for both tasks: a test(...) commit that fails for the right reason (module not found), followed by a feat(...) commit that makes it pass"

key-files:
  created:
    - scripts/destructive.mjs
    - scripts/destructive.test.mjs
    - scripts/confirm-destructive.mjs
    - scripts/confirm-destructive.test.mjs
    - references/destructive-classification.md
  modified:
    - scripts/api-client.mjs
    - SKILL.md
    - scripts/__fixtures__/mock-server.mjs

key-decisions:
  - "Evaluated both the --declined short-circuit and the needs_confirmation check before readConfig() in api-client.mjs, so neither path ever resolves QA_AGENT_TOKEN/QA_AGENT_BASE_URL from config — not just the needs_confirmation path the plan text called out explicitly"
  - "Extended scripts/__fixtures__/mock-server.mjs (a shared 01-01 test fixture, not in this plan's files_modified list) with GET /__requests and POST /__reset, since the plan's own Task 1 behavior block requires asserting 'zero HTTP requests' against the mock server's request log and no such mechanism existed yet (Rule 2 — missing critical test infrastructure)"
  - "Verified RESEARCH.md Assumption A2 live this session against code.claude.com/docs/en/hooks.md and /skills.md (fetched via curl, since no WebFetch/context7 tool was available to this agent): the hooks: frontmatter field, its PreToolUse/matcher/hooks/type/command nesting shape, and the ${CLAUDE_SKILL_DIR} substitution all match RESEARCH's proposed pattern exactly. A2 is upgraded from LOW confidence to confirmed; the plan's conditional ## Hardening settings.json fallback was not needed"
  - "confirm-destructive.mjs parses --method/--url out of the raw command string via regex rather than re-invoking the CLI parser, since a PreToolUse hook only receives the shell command as a string on stdin, not structured argv"

patterns-established:
  - "The destructive-action gate is checked on every invocation with no bypass mechanism (no env var, no config file, no bulk/session-wide approval) — SKILL.md's Confirmation protocol explicitly forbids batching or session-wide approval requests"
  - "A hook script fails open (exit 0, print nothing) on any malformed input, because the script-level gate — not the hook — is the primary guarantee; the hook is documented as a hardening layer, not the sole enforcement point"

requirements-completed: [SAFE-01, SAFE-02]

coverage:
  - id: D1
    description: "requiresConfirmation() mechanically gates DELETE always (even with looksReadOnly), gates POST/PUT/PATCH unless looksReadOnly, waves through GET/HEAD/OPTIONS, and gates unrecognised methods; api-client.mjs refuses to dispatch an unconfirmed destructive call (exit 3, needs_confirmation payload with a matching preview, zero HTTP requests reached the mock server, nothing appended to results.json)"
    requirement: "SAFE-01"
    verification:
      - kind: unit
        ref: "scripts/destructive.test.mjs — requiresConfirmation / previewOf describe blocks (5 tests)"
        status: pass
      - kind: integration
        ref: "scripts/destructive.test.mjs — 'refuses an unconfirmed DELETE' and 'still gates an unconfirmed DELETE even with --read-only-intent' (mock-server request-log assertion)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A confirmed destructive call (--confirmed) dispatches normally and an unconfirmed read-only-intent POST dispatches via the search/filter carve-out — the read-only escape never applies to DELETE"
    requirement: "SAFE-01"
    verification:
      - kind: integration
        ref: "scripts/destructive.test.mjs — 'dispatches a confirmed DELETE' and 'dispatches an unconfirmed POST carrying --read-only-intent'"
        status: pass
    human_judgment: false
  - id: D3
    description: "--declined writes a distinct blocked case (status: blocked, non-null blockedReason, null evidence.response, evidence.request.method preserved) before any network work, sends zero HTTP requests, and a subsequent normal case against the same results file still appends and exits 0 — declining never poisons the run"
    requirement: "SAFE-02"
    verification:
      - kind: integration
        ref: "scripts/destructive.test.mjs — 'records a declined case as blocked, sends zero requests, and does not poison the run'"
        status: pass
    human_judgment: false
  - id: D4
    description: "scripts/confirm-destructive.mjs's decideForCommand() matches any Bash command invoking api-client.mjs for a destructive method (including one that already carries --confirmed) and returns permissionDecision: ask; stays out of the way for GET, read-only-intent POST, format-report.mjs, and unrelated commands; the stdin/stdout hook protocol fails open (exit 0, no output) on malformed JSON"
    requirement: "SAFE-01"
    verification:
      - kind: unit
        ref: "scripts/confirm-destructive.test.mjs — decideForCommand describe block (6 tests) and stdin/stdout protocol describe block (3 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The PreToolUse hook is actually registered and fires inside a live, installed Claude Code session — including surviving --dangerously-skip-permissions as the hooks documentation states — for a real destructive api-client.mjs Bash invocation"
    requirement: "SAFE-01"
    verification: []
    human_judgment: true
    rationale: "This is a live-session behavioral claim about Claude Code's own hook-dispatch and permission-escalation machinery, not something scripts/confirm-destructive.mjs's own unit tests can exercise in isolation (no running Claude Code session exists inside vitest). RESEARCH's frontmatter/field-shape assumption (A2) was verified live against the docs this session, but the end-to-end 'the hook actually pauses a real destructive call' claim needs a live installed skill session — deferred to end-of-phase UAT per workflow.human_verify_mode: end-of-phase, same deferral pattern 01-01-SUMMARY.md used for PKG-01."

duration: 67min
completed: 2026-08-11
status: complete
---

# Phase 1 Plan 2: Destructive-Action Confirmation Gate Summary

**Two independent enforcement layers block every destructive API call — `api-client.mjs` mechanically refuses to dispatch DELETE or a non-read-only POST/PUT/PATCH without a per-call `--confirmed` flag (exit 3, zero HTTP requests), and a `PreToolUse` hook escalates the same commands to Claude Code's own permission dialog regardless of what flags the caller already claims — with declined cases recorded as a first-class `blocked` state that never stalls the rest of the run.**

## Performance

- **Duration:** 67 min
- **Started:** 2026-08-11T09:29:00-03:00
- **Completed:** 2026-08-11T10:36:57-03:00
- **Tasks:** 2
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- `scripts/destructive.mjs`: `requiresConfirmation()` (DELETE always gated regardless of `looksReadOnly`; POST/PUT/PATCH gated unless `looksReadOnly`; GET/HEAD/OPTIONS never gated; unknown methods gated) and `previewOf()` (uppercased method, resolved absolute URL, body — no `headers` key, ever)
- `scripts/api-client.mjs` wired with `--confirmed`, `--declined`, `--read-only-intent`, `--blocked-reason` CLI flags; the gate check runs before `readConfig()`, so an unconfirmed or declined destructive call never triggers a credential read; exit code 3 documented alongside 0/2/4 in the file's header comment
- `scripts/confirm-destructive.mjs`: `decideForCommand()` parses `--method`/`--url` out of a raw Bash command string, reuses `requiresConfirmation()`, and returns a `permissionDecision: "ask"` `hookSpecificOutput` object — ignoring `--confirmed` on purpose, since the hook's entire reason to exist is to fire anyway; the stdin/stdout main guard fails open (exit 0, no output) on any parse error
- `SKILL.md` frontmatter now registers a skill-scoped `hooks: PreToolUse` entry (field name, nesting shape, and `${CLAUDE_SKILL_DIR}` confirmed live against the official docs this session) and a new `## Confirmation protocol` section spells out the six-step ask-per-call loop
- `references/destructive-classification.md`: the method table, read-only vs. counter-example pairs (search/filter POSTs vs. invoice-creation/role-change/notification-send/payments-path POSTs), the uncertainty tie-breaker, and the closing D-02 note that this rubric only decides whether to pause, never whether an action is permitted
- Extended the shared `scripts/__fixtures__/mock-server.mjs` test fixture with an in-memory request log (`GET /__requests`, `POST /__reset`) so tests can assert "zero HTTP requests reached the target" directly, not just infer it from the script's own exit code
- Full suite: 23/23 vitest tests pass across `destructive.test.mjs` (10), `confirm-destructive.test.mjs` (9), and `tracer.e2e.test.mjs` (4, unaffected by this plan's changes)

## Task Commits

Each task followed strict TDD RED → GREEN commit separation:

1. **Task 1 RED: failing test for destructive-action confirmation gate** - `f6d1e57` (test)
2. **Task 1 GREEN: classify destructive calls and refuse to dispatch them unconfirmed** - `f532a2f` (feat)
3. **Task 2 RED: failing test for PreToolUse hook backstop** - `2e65f51` (test)
4. **Task 2 GREEN: PreToolUse hook backstop and orchestrator confirmation protocol** - `4cc8196` (feat)

**Plan metadata:** (pending — final `docs(01-02)` commit created immediately after this SUMMARY)

_No REFACTOR commits were needed — each GREEN implementation passed cleanly on the first run with no follow-up cleanup required._

## Files Created/Modified
- `scripts/destructive.mjs` - `requiresConfirmation()`, `previewOf()`, `SAFE_METHODS`, `DESTRUCTIVE_METHODS` — the mechanical (D-01) half of the gate
- `scripts/destructive.test.mjs` - unit + integration coverage: classifier/preview unit tests, plus CLI integration tests spawning `api-client.mjs` against a sibling-process mock server to assert exit codes, results.json contents, and the mock server's request log
- `scripts/api-client.mjs` - wires the gate in before `readConfig()`; adds `--confirmed`/`--declined`/`--read-only-intent`/`--blocked-reason`; documents the exit-code convention (0/2/3/4) in a header comment
- `scripts/confirm-destructive.mjs` - `decideForCommand()` (pure decision function) plus a stdin/stdout `PreToolUse` hook main guard that fails open on malformed input
- `scripts/confirm-destructive.test.mjs` - unit coverage for `decideForCommand()` and the stdin/stdout hook protocol
- `SKILL.md` - adds `hooks: PreToolUse` frontmatter registering `confirm-destructive.mjs`, and a `## Confirmation protocol` body section (the six-step ask-per-call loop)
- `references/destructive-classification.md` - the read-only judgment rubric: method table, worked examples/counter-examples, uncertainty tie-breaker, D-02 closing note
- `scripts/__fixtures__/mock-server.mjs` - unplanned addition: `GET /__requests` / `POST /__reset` in-memory request log so tests can assert zero HTTP traffic

## Decisions Made
- Evaluated both the `--declined` short-circuit and the `needs_confirmation` check before `readConfig()`, not just the path the plan text explicitly called out — neither branch should ever resolve the auth token or base URL from config, since neither sends a request
- Extended the shared `mock-server.mjs` fixture (not in this plan's `files_modified`) rather than building a parallel test-only server, since the plan's own Task 1 `<behavior>` block requires asserting "issues zero HTTP requests" against "the mock server's request log" — that assertion mechanism didn't exist yet and is squarely Rule 2 (missing critical test infrastructure), not scope creep
- Verified RESEARCH Assumption A2 live this session (curl-fetched `code.claude.com/docs/en/hooks.md` and `/skills.md`, since no WebFetch/context7 tool was available to this agent) rather than treating it as still-LOW-confidence: the `hooks:` frontmatter field, the `PreToolUse`/`matcher`/`hooks`/`type: command`/`command` nesting, and `${CLAUDE_SKILL_DIR}` substitution all matched RESEARCH's proposed pattern exactly, so the plan's conditional `## Hardening` settings.json fallback was not needed
- Kept `confirm-destructive.mjs`'s method/URL extraction as a small regex over the raw command string rather than re-implementing `api-client.mjs`'s CLI parser, since a `PreToolUse` hook only ever receives the shell command as a flat string on stdin

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Test Infrastructure] Extended mock-server.mjs with a request log**
- **Found during:** Task 1 (writing `scripts/destructive.test.mjs`)
- **Issue:** The plan's Task 1 `<behavior>` block requires that an unconfirmed destructive invocation be verified as issuing zero HTTP requests, "asserted against the mock server's request log" — but the existing `scripts/__fixtures__/mock-server.mjs` (built in 01-01) had no request-log or introspection capability at all
- **Fix:** Added an in-memory `requestLog` array to `startMockServer()`, logging every request except two new introspection routes (`GET /__requests` returns the log as JSON, `POST /__reset` clears it), backward-compatible with all existing 01-01 usage
- **Files modified:** `scripts/__fixtures__/mock-server.mjs`
- **Verification:** `npx vitest run scripts/tracer.e2e.test.mjs` still passes 4/4 unchanged; `scripts/destructive.test.mjs`'s zero-request and exactly-one-request assertions pass using the new endpoints
- **Committed in:** `f6d1e57` (Task 1 RED commit, alongside the new test file)

---

**Total deviations:** 1 auto-fixed (1 missing critical test infrastructure)
**Impact on plan:** Necessary to make the plan's own specified test behavior executable; no functional change to the mock server's existing route-matching behavior, no scope creep into this plan's actual deliverables.

## Issues Encountered
None — both tasks' TDD RED phases failed for the expected reason (module not found), and both GREEN phases passed on the first implementation attempt with no debugging iterations needed.

## User Setup Required
None - no external service configuration required. The `hooks:` frontmatter and `references/destructive-classification.md` are packaged inside the skill itself; nothing new is required in the target project under test.

## Next Phase Readiness
- The `blocked` third result state (`status: "blocked"`, `blockedReason`, null `evidence.response`) is now proven end-to-end via `--declined` — plan 01-03's report renderer can rely on this shape being real, not just documented in the 01-01 case-object contract
- Exit code 3 (`needs_confirmation`) is now the fourth documented exit code alongside 0/2/4 — sibling plans extending `api-client.mjs`'s CLI should preserve this convention
- `references/destructive-classification.md` and `SKILL.md`'s `## Confirmation protocol` are ready for the orchestrator to follow verbatim once 01-04 wires up full multi-method dispatch
- Outstanding: whether the `PreToolUse` hook actually fires and escalates inside a real, installed Claude Code session (surviving `--dangerously-skip-permissions` as the hooks docs state) has not been exercised live — deferred to end-of-phase UAT per `workflow.human_verify_mode: "end-of-phase"`, same as 01-01's PKG-01 deferral. This should be exercised once, together with 01-01's outstanding live-install check, before Phase 1 is declared fully done.

---
*Phase: 01-foundation-guardrails-api-testing*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 9 files verified present: `scripts/destructive.mjs`, `scripts/destructive.test.mjs`, `scripts/confirm-destructive.mjs`, `scripts/confirm-destructive.test.mjs`, `references/destructive-classification.md`, `scripts/api-client.mjs`, `SKILL.md`, `scripts/__fixtures__/mock-server.mjs`, this SUMMARY.md — and all 4 task commits (`f6d1e57`, `f532a2f`, `2e65f51`, `4cc8196`) confirmed present in git history.
