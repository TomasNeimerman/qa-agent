---
phase: 01-foundation-guardrails-api-testing
plan: 04
subsystem: testing
tags: [playwright, apirequestcontext, zod, dispatch, preflight, ssrf-guard, vitest]

requires:
  - phase: 01-foundation-guardrails-api-testing
    provides: "scripts/api-client.mjs (readConfig/runCase/appendCase, GET-only tracer), scripts/destructive.mjs (requiresConfirmation/previewOf) and the confirmation gate wired into api-client.mjs (--confirmed/--declined/--read-only-intent, exit 3), scripts/format-report.mjs (three-state rendering, shape-observed label)"
provides:
  - "scripts/api-client.mjs: DISPATCH map (GET/POST/PUT/PATCH/DELETE/HEAD) replacing dynamic method lookup; runCase dispatches bodies through Playwright's `data` option, resolves evidence.request.url to an absolute URL, and emits status + json-parseable + (optional) fields-present shape-observed checks"
  - "buildShapeSchema(fieldNames) — loose, never-.strict() zod schema (D-05/D-10)"
  - "looksLikeProduction(baseUrl) — SSRF-adjacent target-safety heuristic (T-01-16), safe default under uncertainty is production"
  - "preflight(baseUrl, token) — single HEAD-then-GET reachability probe run once per CLI invocation before the first dispatch"
  - "CLI: --expect-status, --expect-fields, --allow-non-local; startup order confirmation gate -> production check (exit 6) -> readConfig (exit 2) -> preflight (exit 4) -> dispatch; exit-code table now 0/2/3/4/5/6"
  - "scripts/api-client.test.mjs — new test file: method dispatch, baseURL targeting, status/shape checks, preflight, production-target refusal, loud misconfiguration"
  - "scripts/__fixtures__/mock-server.mjs — default routes for every method + echo/204/500/404/text-plain, plus an in-process requests/reset() surface alongside the existing HTTP /__requests /__reset introspection"
  - "SKILL.md: '## Case construction' section and the full exit-code table under '## Configuration'"
affects: [phase-2-browser-engine, phase-3-dual-discovery]

actuals:
  tokens: 11700
  tasks: 3
  commits: 7

tech-stack:
  added: []
  patterns:
    - "Explicit DISPATCH map is the only path from a method string to the Playwright context — an unmapped method throws before any network activity, never a dynamic context[method] lookup (T-01-20)"
    - "evidence.request.url is always the absolute URL resolved against the run's baseUrl, so a case can be traced back to exactly which host it targeted regardless of whether that host was localhost or an arbitrary staging domain (EXEC-04)"
    - "CLI startup check order is fixed and documented once in a file-header comment: confirmation gate, then production-target refusal, then readConfig, then preflight, then dispatch — each earlier step runs before any credential is read or request is sent"
    - "A shape check is always three-tiered at most (status, json-parseable, fields-present) and every field-derived check carries kind: 'shape-observed', never implying contract/specification conformance (D-10)"
    - "preflight() answers 'is something listening and speaking HTTP', not 'is the app healthy' — it resolves on any HTTP response including 4xx and only rejects on a genuine transport failure"

key-files:
  created:
    - scripts/api-client.test.mjs
  modified:
    - scripts/api-client.mjs
    - scripts/__fixtures__/mock-server.mjs
    - scripts/destructive.test.mjs
    - SKILL.md

key-decisions:
  - "evidence.request.url now stores the absolute URL (new URL(url, baseUrl)) rather than the raw relative path, so a case's evidence self-documents which host it actually targeted — matches what previewOf already did for the confirmation preview"
  - "The '--allow-non-local proceeds normally' behavior is tested by pointing at a guaranteed-DNS-failing .invalid host and asserting the exit code is no longer 6 (production refusal), rather than dispatching to a live external domain from the test suite — proves the gate was bypassed without any real outbound traffic to a third party"
  - "preflight() runs once per CLI process invocation (per the plan's own 'call it once per process' instruction), which means every real dispatch now also issues one HEAD / probe first — this is an intentional behavior, not a bug"
  - "CLI-spawn tests use a sibling mock-server-process.mjs instance (cliMock), matching the pattern already established in destructive.test.mjs and tracer.e2e.test.mjs, since a child process cannot reliably reach a socket held by its own direct parent in every sandboxed execution environment; direct runCase()/buildShapeSchema()/preflight() unit calls use an in-process mock instead"

patterns-established:
  - "mock-server.mjs's DEFAULT_ROUTES give every future plan a full method+error-case fixture for free (GET/POST/PUT/PATCH/DELETE, 500, 404, text/plain) without needing to redeclare routes per test file; caller-supplied routes still win on key collision"

requirements-completed: [API-01, API-02, EXEC-04]

coverage:
  - id: D1
    description: "runCase dispatches GET/POST/PUT/PATCH/DELETE (and HEAD via preflight) with request bodies against a real HTTP target via Playwright's APIRequestContext, with an unmapped method throwing before any network call and a 404/500 response recorded as a failed verdict rather than a thrown exception"
    requirement: "API-01"
    verification:
      - kind: unit
        ref: "scripts/api-client.test.mjs — 'DISPATCH' and 'runCase — method dispatch' describe blocks"
        status: pass
      - kind: integration
        ref: "scripts/api-client.test.mjs — 'confirmation gate still fires first after the method set widened' (CLI-level POST dispatch)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each case validates the response status against an expectation (default 2xx or an explicit --expect-status) and, when the developer named fields, checks their presence via a loose zod schema (buildShapeSchema) — labelled shape-observed, never contract-validated, and a mismatch is a structured failing check rather than a thrown exception"
    requirement: "API-02"
    verification:
      - kind: unit
        ref: "scripts/api-client.test.mjs — 'buildShapeSchema', 'runCase — status expectations', 'runCase — shape observation (expectFields)' describe blocks"
        status: pass
      - kind: integration
        ref: "scripts/api-client.test.mjs — 'CLI — --expect-status and --expect-fields'"
        status: pass
    human_judgment: false
  - id: D3
    description: "The same api-client.mjs invocation targets localhost or an arbitrary staging host via --base-url/QA_AGENT_BASE_URL (argument wins), with evidence.request.url resolved to the absolute URL against whichever host was supplied, and a production-looking host is refused (exit 6) unless --allow-non-local is passed"
    requirement: "EXEC-04"
    verification:
      - kind: unit
        ref: "scripts/api-client.test.mjs — 'runCase — baseURL behaviour (EXEC-04)', 'readConfig — baseUrlArg vs QA_AGENT_BASE_URL (D-09)', 'looksLikeProduction' describe blocks"
        status: pass
      - kind: integration
        ref: "scripts/api-client.test.mjs — 'CLI — production-target refusal (exit 6)'"
        status: pass
    human_judgment: false
  - id: D4
    description: "A down target or a missing QA_AGENT_TOKEN/QA_AGENT_BASE_URL halts the run with a specific diagnostic (exit 4 / exit 2) before any request is sent, instead of producing a report full of misleading per-case failures"
    verification:
      - kind: unit
        ref: "scripts/api-client.test.mjs — 'preflight' describe block"
        status: pass
      - kind: integration
        ref: "scripts/api-client.test.mjs — 'CLI — loud misconfiguration (exit 2), before any network activity' and the CLI-level exit-4 preflight test"
        status: pass
    human_judgment: false
  - id: D5
    description: "The confirmation gate installed in plan 01-02 still fires first for every destructive method now that the full method set is dispatchable — an unconfirmed POST/PUT/PATCH/DELETE via the CLI exits 3 with zero requests sent, verified against both this plan's own new mock server and plan 01-02's pre-existing test file (updated to account for the new preflight probe)"
    requirement: "SAFE-01 (regression check, not newly delivered by this plan)"
    verification:
      - kind: integration
        ref: "scripts/api-client.test.mjs — 'confirmation gate still fires first after the method set widened'; scripts/destructive.test.mjs (updated) — 'confirmation gate wired into api-client.mjs' describe block, full file green"
        status: pass
    human_judgment: false
  - id: D6
    description: "A live installed Claude Code session (with the confirmation-pause UX, decline-and-continue behavior, and both a localhost and a staging target) runs the full skill end-to-end"
    verification: []
    human_judgment: true
    rationale: "The confirmation pause is an interactive exchange between Claude Code and the developer, and dual-environment targeting needs two real hosts — neither is observable from a unit or integration test. Deferred to end-of-phase UAT per workflow.human_verify_mode: end-of-phase, same deferral pattern used by 01-01 (PKG-01), 01-02 (live PreToolUse hook firing), and 01-03 (nothing new deferred)."

duration: 27min
completed: 2026-08-11
status: complete
---

# Phase 1 Plan 4: Full API Execution Engine Summary

**`api-client.mjs` now dispatches GET/POST/PUT/PATCH/DELETE with bodies through an explicit method map, validates status and zod-backed "shape observed" field checks, refuses a production-looking `--base-url` without `--allow-non-local`, and fails fast with a `preflight()` reachability probe before ever touching the confirmation-gated dispatch path — closing out Phase 1's API-01/API-02/EXEC-04 requirements.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-08-11T17:39:17Z
- **Completed:** 2026-08-11T18:06:43Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- `DISPATCH` map (`GET/POST/PUT/PATCH/DELETE/HEAD`) replaces the prior dynamic `context[method]` lookup — an unmapped method (e.g. `PURGE`) throws `Unsupported HTTP method` before any network activity, never after a wrapped connection attempt
- `runCase` sends bodies via Playwright's `data` option for POST/PUT/PATCH, handles a 204 DELETE's empty body without crashing `JSON.parse`, and resolves `evidence.request.url` to the absolute URL against whichever `baseUrl` was supplied (proving localhost vs. an arbitrary staging host both work, EXEC-04)
- `buildShapeSchema(fieldNames)` — `z.unknown()` with no names, a never-`.strict()` `z.object()` with names — backs a third `fields present: <names>` check (`kind: "shape-observed"`) that `safeParse`s rather than throws, so a shape mismatch fails one case without aborting the run
- `looksLikeProduction(baseUrl)` refuses any host that isn't recognisably local/private-range/named-non-production, defaulting to "looks like production" under uncertainty (T-01-16); the CLI exits `6` naming the host and `--allow-non-local`, evaluated before the token is ever read
- `preflight(baseUrl, token)` issues one HEAD-then-GET-fallback probe per CLI invocation before the first dispatch, mapping a down target to exit `4` with a `target unreachable: <url>` message instead of letting the run produce a report full of misleading per-case failures
- `scripts/__fixtures__/mock-server.mjs` gained default routes for every method plus 500/404/text-plain edge cases and an in-process `requests`/`reset()` surface, available to every future plan's tests for free
- `SKILL.md` documents the orchestrator's case-construction judgment calls (`## Case construction`) and the full six-code exit table under `## Configuration`
- Full suite: 81/81 vitest tests pass across `api-client.test.mjs` (35, new), `destructive.test.mjs` (10, 2 assertions updated for the new preflight probe), `confirm-destructive.test.mjs` (9), `format-report.test.mjs` (22), `tracer.e2e.test.mjs` (4)

## Task Commits

Each task followed strict TDD RED → GREEN commit separation:

1. **Task 1 RED: failing test for full method dispatch and baseURL targeting** — `77df234` (test)
2. **Task 1 GREEN: full GET/POST/PUT/PATCH/DELETE dispatch with bodies** — `e036df8` (feat)
3. **Task 2 RED: failing test for status expectations and shape observation** — `40820fb` (test)
4. **Task 2 GREEN: status expectations and zod-backed shape observation** — `1bde84f` (feat)
5. **Task 3 RED: failing test for preflight, production-target refusal, and loud misconfiguration** — `220c18d` (test)
6. **Task 3 GREEN: preflight reachability, loud misconfiguration, and production-target refusal** — `4c468b4` (feat)
7. **Additional test coverage: explicit CLI-level exit-4 assertion** — `737bf00` (test) — closes a gap in the plan's own broader `<verification>` bullet ("invocations that exit 2/3/4/6 leave the mock server's request log empty") that the `preflight()` unit tests alone didn't cover at the CLI-invocation level; added after Task 3's GREEN commit rather than as its own RED/GREEN cycle since no implementation change was needed

**Plan metadata:** (pending — final `docs(01-04)` commit created immediately after this SUMMARY)

_No REFACTOR commits were needed for any task — each GREEN implementation passed cleanly on the first run with no follow-up cleanup required._

## Files Created/Modified

- `scripts/api-client.mjs` - `DISPATCH`, `buildShapeSchema`, `looksLikeProduction`, `preflight`, `composeVerdict`; `runCase` extended with `expectFields` and absolute-URL evidence; CLI gained `--expect-status`, `--expect-fields`, `--allow-non-local`; exit-code header comment and startup-order comment updated (0/2/3/4/5/6)
- `scripts/api-client.test.mjs` - new file: 35 tests covering method dispatch, baseURL targeting, `readConfig` precedence, `buildShapeSchema`, status/shape checks, `looksLikeProduction`, `preflight`, production-target refusal, loud misconfiguration, and the confirmation gate still firing first
- `scripts/__fixtures__/mock-server.mjs` - `DEFAULT_ROUTES` (GET/POST-echo/PUT-echo/PATCH-echo/DELETE-204/500/404/text-plain), request bodies now captured, in-process `requests`/`reset()` alongside the existing `/__requests`/`/__reset` HTTP introspection (kept byte-compatible in shape for existing sibling-plan consumers)
- `scripts/destructive.test.mjs` - two exact-request-count assertions updated to account for the new preflight HEAD probe that now precedes every real dispatch (see Deviations)
- `SKILL.md` - new `## Case construction` section; `## Configuration` extended with the full six-code exit table and the "a configuration error stops the run, never a reported test failure" statement (D-09)

## Decisions Made

- `evidence.request.url` now stores the absolute URL (`new URL(url, baseUrl)`) instead of the raw relative path — matches `previewOf`'s existing resolution and makes a case self-documenting about which host it actually targeted, which the plan's own baseURL-behaviour test required
- Tested "`--allow-non-local` proceeds normally" by pointing at a `.invalid` (RFC 2606, guaranteed-DNS-failing) host and asserting the exit code is no longer `6`, rather than dispatching to a live external domain from the test suite — proves the production gate was bypassed without sending real traffic to a third party
- Split CLI-spawn tests onto a sibling `mock-server-process.mjs` instance (`cliMockUrl`) separate from the in-process `mock` used for direct `runCase()`/`preflight()`/`buildShapeSchema()` calls, since a child process spawned via `execFileSync` cannot reliably reach a socket held by its own direct parent in every sandboxed environment — the same pattern already established by `destructive.test.mjs` and `tracer.e2e.test.mjs`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/Required Consequence] Updated two exact-request-count assertions in destructive.test.mjs**
- **Found during:** Task 3 (`npx vitest run` after wiring `preflight()` into the CLI)
- **Issue:** Task 3's own `<action>` (c)/(d) requires `preflight()` to run once per CLI invocation before every dispatch. Two pre-existing tests in `scripts/destructive.test.mjs` (not in this plan's `files_modified`) asserted the mock server's request log held exactly one entry — the dispatched method itself — for a confirmed destructive call. With `preflight()` now issuing a HEAD `/` probe first, both tests' request-log counted two entries instead of one.
- **Fix:** Updated both assertions (`dispatches a confirmed DELETE`, `dispatches an unconfirmed POST carrying --read-only-intent`) to expect two log entries and to assert the specific dispatched-method entry exists via `.filter()` rather than a positional `log[0]` equality, since ordering now includes the preflight HEAD ahead of the real dispatch.
- **Files modified:** `scripts/destructive.test.mjs`
- **Verification:** `npx vitest run` — full suite 81/81 green, including the two updated assertions and every other unaffected test in that file
- **Committed in:** `4c468b4` (Task 3 GREEN commit, alongside the implementation that caused the behavior change)

---

**Total deviations:** 1 auto-fixed (1 required consequence of Task 3's own specified behavior)
**Impact on plan:** Necessary to keep the plan's own acceptance criterion ("`npx vitest run` full suite exits 0") true after implementing Task 3's specified preflight-before-every-dispatch behavior. No functional change to `destructive.mjs`'s classification logic or the confirmation gate itself — both remain untouched and fully passing.

## Issues Encountered

None — every TDD RED phase failed for the expected reason (missing export, missing behavior, or a type-coercion mismatch caught during RED itself), and every GREEN phase passed on the first implementation attempt with no debugging iterations needed.

## User Setup Required

None - no external service configuration required. `--expect-status`, `--expect-fields`, and `--allow-non-local` are per-invocation CLI flags the orchestrator supplies at run time, documented in `SKILL.md`'s new `## Case construction` section.

## Next Phase Readiness

- Phase 1's three success criteria are now all functionally complete: SC1 (skill package + guardrails, 01-01/01-02), SC2 (full method dispatch + status/shape validation + dual-environment targeting, this plan), SC3 (confirmation gate still fires first, verified as a regression here)
- `results.json`'s case-object contract is unchanged in shape — `checks[]` can now carry up to three entries (`status`, `json-parseable`, `fields present: ...`) but every entry is still `{ name, kind, expected, actual, passed }`, so `format-report.mjs` (01-03) renders them with zero changes required
- `preflight()` and `looksLikeProduction()` are new, stable exports future phases (Phase 2's browser engine, in particular) can reuse for any HTTP-target-safety concern rather than re-deriving the SSRF-adjacent heuristic
- Outstanding: the live end-to-end UAT check (installed skill, real localhost + staging targets, live confirmation pause, decline-and-continue, `PreToolUse` hook firing) remains deferred to end-of-phase UAT per `workflow.human_verify_mode: "end-of-phase"` — this is the last plan in Phase 1, so this check should now be exercised before Phase 1 is declared fully done, combining the outstanding items already noted in 01-01-SUMMARY.md and 01-02-SUMMARY.md

---
*Phase: 01-foundation-guardrails-api-testing*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 5 files verified present: `scripts/api-client.mjs`, `scripts/api-client.test.mjs`, `scripts/__fixtures__/mock-server.mjs`, `scripts/destructive.test.mjs`, `SKILL.md`, this SUMMARY.md — and all 7 task commits (`77df234`, `e036df8`, `40820fb`, `1bde84f`, `220c18d`, `4c468b4`, `737bf00`) confirmed present in git history.
