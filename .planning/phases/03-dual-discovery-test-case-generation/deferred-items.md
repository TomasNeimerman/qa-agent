# Deferred Items — Phase 3

Out-of-scope discoveries logged during plan execution, not fixed per the
scope-boundary rule (only auto-fix issues directly caused by the current
task's changes).

## 03-02: Pre-existing `ui-login.test.mjs` failures (unrelated to this plan)

- **Found during:** Task 1 baseline `npx vitest run` (before any 03-02
  change was made).
- **Symptom:** 2 of 203 baseline tests in `scripts/ui-login.test.mjs` fail
  (`expect(err.status).toBe(2)` assertions around
  `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` configuration-error handling).
- **Scope:** `ui-login.mjs` is Phase 2 (browser execution engine)
  territory — untouched by 03-01 or 03-02. The failure count (2 failed,
  201 passed → 2 failed, 226 passed after 03-02's 25 new tests) is
  unchanged across both of 03-02's task commits, confirming no regression
  was introduced here.
- **Action:** Not fixed — out of scope for this plan. Left for whichever
  future phase/plan owns `ui-login.mjs`'s test suite.

## 03-03 Task 1: Pre-existing config-error test failures caused by a local `.env.local` (unrelated to this plan)

- **Found during:** Task 1's `npx vitest run` (full suite) after committing
  `scripts/test-case-doc.mjs`/`scripts/test-case-doc.test.mjs` changes.
- **Symptom:** `scripts/api-client.test.mjs`'s "neither --base-url nor
  QA_AGENT_BASE_URL exits 2" test gets exit 4 instead of 2, and
  `scripts/ui-login.test.mjs`'s "missing UI credentials (exit 2)" test gets
  exit 7 instead of 2.
- **Root cause (observed, not fixed):** A machine-local `.env.local` exists
  at the project root (`C:/qa-agent/.env.local`, present before this
  session started) that both scripts' `readConfig()`/env-loading paths pick
  up, supplying a base URL and/or credentials the test expects to be
  absent — turning an expected "not configured" (exit 2) into a real
  network/login attempt that then fails for a different reason (exit 4
  target-unreachable, exit 7 login-failed).
- **Scope:** Both failures reproduce identically whether
  `scripts/test-case-doc.test.mjs` is included in the run or not (confirmed
  by running `scripts/api-client.test.mjs scripts/ui-login.test.mjs` in
  isolation) — neither file this plan touches. This is a local-environment
  artifact (a stray `.env.local`), not a code defect this plan's changes
  introduced or can fix without deleting a file outside this plan's
  `<files>` scope.
- **Action:** Not fixed — out of scope for this plan and outside the
  `<files>` this task is permitted to touch. Flagged here so the phase gate
  doesn't mistake it for a regression caused by Task 1.
