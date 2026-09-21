---
phase: 02-browser-execution-engine
plan: 01
subsystem: auth
tags: [playwright, storageState, chromium, dotenv, vitest]

# Dependency graph
requires:
  - phase: 01-foundation-guardrails-api-testing
    provides: scripts/api-client.mjs's readConfig/preflight/runCase, the destructive-action gate, and the redactHeaders/evidence-capture discipline this plan extends
provides:
  - "scripts/ui-login.mjs: deterministic Playwright-core login script (D-08) — the only tier that ever sees QA_AGENT_UI_PASSWORD"
  - "scripts/__fixtures__/mock-login-app.mjs: dependency-free login-form fixture (dashboard + /api/me), dual-mode process launcher"
  - "scripts/api-client.mjs --storage-state flag: readConfig/preflight/runCase accept a storageState path as an alternative or companion to QA_AGENT_TOKEN"
  - "evidence.request.auth: { mechanism, storageStateFile } recorded on every case"
affects: [02-02-ui-destructive-actions, 02-03-playwright-mcp-setup, 02-04-ui-case-runner]

# Actuals (#2632)
actuals:
  tokens: 13500
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Credential-isolation-by-process: a plaintext secret (QA_AGENT_UI_PASSWORD) is read and used exclusively inside one deterministic script's process, never as an orchestrator tool-call argument — same discipline as Phase 1's QA_AGENT_TOKEN, now extended to a login-form credential shape"
    - "Dual-signal post-action confirmation: performLogin waits concurrently (Promise.all of two independently-caught promises) for either a URL change or a DOM-detached element before treating an action as successful, avoiding both a hard race condition and unhandled-rejection noise"
    - "Auth-mechanism union in readConfig: an increasingly common shape where two independent, non-exclusive auth mechanisms (bearer token, storageState path) are validated as 'at least one present', not 'this one specific var must be set'"

key-files:
  created:
    - scripts/ui-login.mjs
    - scripts/ui-login.test.mjs
    - scripts/__fixtures__/mock-login-app.mjs
    - scripts/ui-session.e2e.test.mjs
  modified:
    - scripts/api-client.mjs
    - scripts/api-client.test.mjs
    - SKILL.md
    - .gitignore

key-decisions:
  - "Kept readConfig's missing-auth ConfigError message containing the literal Phase 1 substring 'QA_AGENT_TOKEN is not configured' while also naming --storage-state, so the message satisfies both Task 2's new assertion and Phase 1's untouched tracer.e2e.test.mjs assertion without editing a file outside this plan's files_modified list"
  - "findLoginFields is async (awaits .count() before falling back) rather than a synchronous locator chain, since Playwright's role-based textbox locator would otherwise ambiguously double-match a plain input[type=text] fallback via .or()"
  - "The empty-context storage-state fixture in ui-session.e2e.test.mjs is a hand-written { cookies: [], origins: [] } JSON file (the documented minimal Playwright storageState shape) rather than launching a second throwaway browser context, trading one line of fidelity for meaningfully faster test runs"

patterns-established:
  - "Pattern: script-driven credential entry — any future login/credential-form flow in this skill should read secrets via process.env inside its own script process and export only non-secret artifacts (session state, not the secret itself)"

requirements-completed: [EXEC-03, API-03]

coverage:
  - id: D1
    description: "ui-login.mjs logs into a real login form as QA_AGENT_UI_USER in a real Chromium browser and writes a storageState file"
    requirement: EXEC-03
    verification:
      - kind: e2e
        ref: "scripts/ui-session.e2e.test.mjs#logs in as the QA_AGENT_UI_USER test user and writes a storageState file holding a qa_session cookie"
        status: pass
    human_judgment: false
  - id: D2
    description: "QA_AGENT_UI_PASSWORD never appears in ui-login.mjs's stdout/stderr, and readUiCredentials fails loudly naming both variables on missing/empty credentials"
    requirement: EXEC-03
    verification:
      - kind: e2e
        ref: "scripts/ui-session.e2e.test.mjs#neither stdout nor stderr of the login process contains the fixture password"
        status: pass
      - kind: unit
        ref: "scripts/ui-login.test.mjs#readUiCredentials (all four throw-cases)"
        status: pass
      - kind: unit
        ref: "scripts/ui-login.test.mjs#CLI — missing UI credentials (exit 2)"
        status: pass
      - kind: unit
        ref: "scripts/ui-login.test.mjs#CLI — rejected UI credentials (exit 7)"
        status: pass
    human_judgment: false
  - id: D3
    description: "api-client.mjs authenticates a case via --storage-state alone (no QA_AGENT_TOKEN), and evidence.request.auth records the mechanism + basename-only storage-state file"
    requirement: API-03
    verification:
      - kind: e2e
        ref: "scripts/ui-session.e2e.test.mjs#api-client.mjs authenticates GET /api/me as the UI-authenticated user via --storage-state, with QA_AGENT_TOKEN absent"
        status: pass
      - kind: unit
        ref: "scripts/api-client.test.mjs#runCase — evidence.request.auth mechanism (API-03) (all four cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "readConfig still refuses to run with neither auth mechanism, no longer requires QA_AGENT_TOKEN when storageStatePath is usable, and rejects a mistyped --storage-state path before falling back to an unauthenticated request"
    requirement: API-03
    verification:
      - kind: unit
        ref: "scripts/api-client.test.mjs#readConfig — auth-mechanism coverage (API-03, RESEARCH Pitfall 4) (all four cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "findLoginFields locates username/password/submit controls purely by accessibility role and input type, with no CSS selector keyed to a specific target project's markup"
    requirement: EXEC-03
    verification:
      - kind: unit
        ref: "scripts/ui-login.test.mjs#findLoginFields — resolves all three controls against the fixture's /login page"
        status: pass
    human_judgment: false
  - id: D6
    description: "SKILL.md documents QA_AGENT_UI_USER/PASSWORD, exit code 7, and the two-step login -> --storage-state reuse protocol including the credential-isolation rule"
    verification:
      - kind: other
        ref: "node one-liner: SKILL.md contains QA_AGENT_UI_USER, QA_AGENT_UI_PASSWORD, ui-login.mjs, --storage-state, 'UI authentication and session reuse' (skill-ui-auth-ok), frontmatter intact (frontmatter-intact-ok)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-08-12
status: complete
---

# Phase 2 Plan 1: UI Login + Session Reuse Summary

**Script-driven Playwright login (`ui-login.mjs`) that keeps `QA_AGENT_UI_PASSWORD` out of the orchestrator's context entirely, exports `storageState`, and lets `api-client.mjs --storage-state` authenticate follow-up API calls with no bearer token at all.**

## Performance

- **Duration:** 25 min (includes an ~2 min Chromium binary download)
- **Started:** 2026-08-12T19:34:00-03:00
- **Completed:** 2026-08-12T19:48:30-03:00
- **Tasks:** 3
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments
- `scripts/ui-login.mjs`: launches a real Chromium browser, resolves `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` inside its own process only, locates the login form's fields purely by accessibility role/input type (no per-project CSS selector), and writes a `storageState` file only after a confirmed post-login signal — never a partial file on failure.
- `scripts/__fixtures__/mock-login-app.mjs`: a dependency-free `node:http` fixture with a real login form (Spanish labels, `Usuario`/`Contraseña`/`Ingresar`), a cookie-gated `/dashboard`, and a cookie-gated `/api/me` JSON endpoint — the proving ground for the whole tracer.
- `scripts/api-client.mjs` now accepts `--storage-state <path>` end to end: `readConfig` requires at least one auth mechanism (not always `QA_AGENT_TOKEN`), `preflight`/`runCase` thread the path into `request.newContext({ storageState })`, and every case records `evidence.request.auth: { mechanism, storageStateFile }` (basename only, never a full path or cookie value).
- End-to-end proof (`scripts/ui-session.e2e.test.mjs`) that the whole chain works with `QA_AGENT_TOKEN` absent from the environment for its entire duration: login → `storageState` file with a `qa_session` cookie → `api-client.mjs GET /api/me` returns `passed`/200/the fixture user.
- Two credential shapes (`QA_AGENT_UI_USER`/`PASSWORD` vs. `QA_AGENT_TOKEN`/`--storage-state`) each fail loudly and independently: missing UI creds (exit 2, names both vars), rejected UI creds (exit 7, leaks neither password), unreachable target (exit 4, distinguishable from exit 7), missing all API auth (exit 2), and a mistyped `--storage-state` path (`ConfigError` naming the path, never silently unauthenticated).
- `SKILL.md` documents the two-step login → session-reuse protocol and the credential-isolation rule as something the orchestrator must follow, not background detail.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "log in as the test user, then call the API as that user"** - `7ae1da0` (feat)
2. **Task 2: Two credential shapes, both failing loudly and independently** - `b03fce1` (test)
3. **Task 3: Document the UI authentication and session-reuse protocol in the skill** - `1c6b4c2` (docs)

_No plan-metadata commit — per this run's instructions, STATE.md/ROADMAP.md updates are owned by the orchestrator, not this executor._

## Files Created/Modified
- `scripts/ui-login.mjs` - deterministic login script: `readUiCredentials`, `findLoginFields`, `performLogin`, `UiConfigError`, `LoginFailedError`, CLI exit codes 0/2/4/7
- `scripts/ui-login.test.mjs` - credential resolution, field location, and CLI exit-code coverage
- `scripts/__fixtures__/mock-login-app.mjs` - login-form + cookie-gated dashboard/API fixture, dual-mode process launcher
- `scripts/ui-session.e2e.test.mjs` - the tracer lock: login → storageState → authenticated API call
- `scripts/api-client.mjs` - `--storage-state` flag, `readConfig`/`preflight`/`runCase` auth-mechanism union, `evidence.request.auth`
- `scripts/api-client.test.mjs` - auth-mechanism coverage (bearer/storageState/both, mistyped path, cookie-value secrecy)
- `SKILL.md` - `QA_AGENT_UI_USER`/`PASSWORD` docs, exit code 7, new `## UI authentication and session reuse` section
- `.gitignore` - `*storage-state.json`

## Decisions Made
- Kept the missing-auth `ConfigError` message's Phase 1 substring (`QA_AGENT_TOKEN is not configured`) intact while adding the `--storage-state` mention, so Phase 1's `tracer.e2e.test.mjs` assertion (a file outside this plan's `files_modified` scope) kept passing without needing to touch it.
- `findLoginFields` is `async` (checks `.count()` before falling back to `input[type=email]`/`input[type=text]`) rather than a `.or()` locator chain, avoiding an ambiguous double-match a role-based `textbox` locator would otherwise create against its own fallback.
- The "empty storage-state" test fixture is a hand-written `{ cookies: [], origins: [] }` JSON file (Playwright's documented minimal shape) instead of a second throwaway browser context — same fidelity, meaningfully faster test run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `node_modules` was missing entirely — ran `npm install`**
- **Found during:** Task 1, before any code changes (pre-flight check)
- **Issue:** `npx vitest run` failed immediately with `ERR_MODULE_NOT_FOUND: Cannot find package 'dotenv'` — `node_modules/` did not exist on disk even though `package.json`/`package-lock.json` were present and unchanged from Phase 1.
- **Fix:** Ran `npm install` (all packages already declared and legitimacy-approved in Phase 1's own audit — not a new/unverified package, so this does not require the Rule 3 package-legitimacy checkpoint). This is also Task 1's own stated `<precondition>`.
- **Files modified:** none (only restored `node_modules/`, which is gitignored)
- **Verification:** `npx vitest run` went from 3 files crashing at import time to all 5 Phase 1 files passing (81 tests) before any Phase 2 code was written.
- **Committed in:** n/a (gitignored; not part of any commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to run any test in the repo at all; no scope creep — no code was changed by this fix.

## Issues Encountered
None beyond the deviation above.

## User Setup Required

None - no external service configuration required. The Chromium binary was downloaded locally via `npx playwright install chromium` (Task 1's own action item, not a manual step) and is present in the local Playwright cache going forward.

## Next Phase Readiness
- `scripts/ui-login.mjs` and `scripts/api-client.mjs --storage-state` are both ready for plan 02-02 (UI destructive-action confirmation) and plan 02-04 (the UI case runner) to build on.
- Plan 02-03 (Playwright MCP setup) can proceed independently — this plan deliberately did not touch `.mcp.json` or any MCP tool wiring, per the plan's own scope boundary.
- No blockers identified for the remaining Wave 1/2/3 plans in this phase.

---
*Phase: 02-browser-execution-engine*
*Completed: 2026-08-12*

## Self-Check: PASSED

All 9 created/modified files confirmed present on disk; all 3 task commit hashes (`7ae1da0`, `b03fce1`, `1c6b4c2`) confirmed present in `git log`.
