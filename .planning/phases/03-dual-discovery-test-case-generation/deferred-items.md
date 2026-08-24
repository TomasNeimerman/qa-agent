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
