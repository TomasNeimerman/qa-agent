---
phase: 02-browser-execution-engine
plan: 04
subsystem: ui
tags: [playwright-mcp, results-json, markdown-report, accessibility-snapshot, natural-language-protocol]

# Dependency graph
requires:
  - phase: 02-browser-execution-engine
    provides: "02-01's scripts/ui-login.mjs + api-client.mjs --storage-state (session reuse), 02-02's scripts/ui-destructive.mjs + confirm-destructive-ui.mjs (the click gate), 02-03's .mcp.json Playwright MCP registration under the key `playwright` and the verified startup flags in references/mcp-setup.md"
provides:
  - "scripts/ui-case.mjs: buildUiCase()/UI_ACTIONS/UiEvidenceMissingError — the deterministic recorder that turns one observed browser step into a Phase-1-contract-compliant case (kind:'ui'), refusing a passed/failed verdict with no captured snapshot, sharing api-client.mjs's appendCase as its only results.json writer"
  - "scripts/format-report.mjs: renderUiCase()/deriveUiReproSteps() — a kind:'ui' rendering branch inside the existing renderCase, reusing EvidenceMissingError as the render-time evidence rule, plus evidence.request.auth.mechanism rendering on the (unchanged) API branch"
  - "SKILL.md ## UI run protocol — the eleven-step loop from a natural-language browser instruction to a rendered report: snapshot-driven role/name targeting, mandatory re-snapshot after every action, the confirmation gate from 02-02, evidence recorded only through ui-case.mjs, exactly one retry with an 'unconfirmed' (not reproducible) verdict, and a closing never-do list; allowed-tools extended with the nine mcp__playwright__ tools this protocol uses and no JavaScript-evaluation tool; Installation now points at references/mcp-setup.md"
affects: [03-dual-discovery-test-case-generation]

# Actuals (#2632)
actuals:
  tokens: 10500
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-layer evidence enforcement for browser verdicts: scripts/ui-case.mjs refuses construction (UiEvidenceMissingError) and scripts/format-report.mjs refuses render (EvidenceMissingError, reused rather than reinvented) — the same two-layer shape as the destructive-action confirmation gate, now applied to SAFE-03's browser side"
    - "kind-based case dispatch: renderCase branches on caseObj.kind === 'ui' before falling into the byte-unchanged API path, letting two case shapes share one results.json, one renderReport/summarise/chatSummary pipeline and one Markdown report"
    - "Snapshot-as-evidence: an accessibility snapshot captured immediately after an action is the browser's equivalent of an HTTP response — required for a passed/failed verdict, stored verbatim (capped at 20000 chars with an explicit truncation marker, never silently cut), and quoted in the report rather than merely referenced"

key-files:
  created:
    - scripts/ui-case.mjs
    - scripts/ui-case.test.mjs
  modified:
    - scripts/format-report.mjs
    - scripts/format-report.test.mjs
    - SKILL.md

key-decisions:
  - "buildUiCase takes a single `url` param rather than separate pre-/post-action URLs — the orchestrator only ever has one page URL per recorded step, so evidence.response.url mirrors evidence.request.url instead of tracking drift within a single action; deriveUiReproSteps still reads both fields independently for forward compatibility"
  - "SNAPSHOT_CHAR_CAP set to 20000 characters (not specified by the plan) with an explicit trailing truncation marker string, matching the 'never silent' discipline api-client.mjs/format-report.mjs already apply elsewhere in this project"
  - "UI case heading format is '## Case N — UI: <action> \"<element>\" — STATUS', deliberately different from the API heading's '<METHOD> <url>' shape so a mixed report is scannable at a glance, while still matching the '## Case N — ... — STATUS' pattern renderReport/summarise/chatSummary already rely on for both kinds"
  - "allowed-tools additions and the JS-evaluation-tool exclusion (T-02-22) are recorded as YAML comments directly above the allowed-tools line in SKILL.md's frontmatter, rather than in the prose body, so the constraint travels with the exact list it constrains"

patterns-established:
  - "Pattern: any future non-HTTP evidence source this skill adds (e.g. a future desktop/mobile driver) should follow the same two-part shape — a deterministic recorder script refusing construction without captured evidence, and a renderCase kind branch refusing render without it — rather than inventing a third results.json shape"

requirements-completed: [EXEC-01, EXEC-02]

coverage:
  - id: D1
    description: "buildUiCase refuses to construct a passed/failed UI case with no captured snapshot (UiEvidenceMissingError naming the title), and otherwise returns a case object carrying every key Phase 1's contract requires plus kind:'ui', with checks never empty and a verdict composed strictly from stored fields"
    requirement: EXEC-01
    verification:
      - kind: unit
        ref: "scripts/ui-case.test.mjs#buildUiCase — contract (all 11 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The ui-case.mjs CLI reads the snapshot from a file (never an inline argument), appends via api-client.mjs's appendCase (grep-confirmed, count 4), and maps outcomes to exit 0/2/5 exactly as specified — a bad/unrecognised --action or missing evidence never appends a case"
    requirement: EXEC-01
    verification:
      - kind: unit
        ref: "scripts/ui-case.test.mjs#CLI (all 4 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "renderCase (via the new renderUiCase branch) refuses to render a passed/failed UI case with no captured snapshot, reusing EvidenceMissingError rather than a second error class; a blocked UI case renders the action/element as not performed plus the blockedReason without throwing despite the null response; the API branch is unchanged for every case with no kind field"
    requirement: EXEC-01
    verification:
      - kind: unit
        ref: "scripts/format-report.test.mjs#renderCase — UI cases (kind: \"ui\") (all 7 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A results file holding both API and UI cases renders every case in original results.cases order and sums both kinds into one passed/failed/blocked count, in the same Markdown report — UI cases are not a parallel report type"
    requirement: "Phase 1 D-07"
    verification:
      - kind: unit
        ref: "scripts/format-report.test.mjs#renderReport — mixed API and UI cases"
        status: pass
      - kind: unit
        ref: "scripts/ui-case.test.mjs#CLI — a full invocation exits 0 and appends exactly one case, alongside an existing API case"
        status: pass
    human_judgment: false
  - id: D5
    description: "deriveUiReproSteps composes a failed UI case's reproduction steps strictly from stored evidence — the recorded URL, the recorded action and element, and the first failed check's observed-vs-expected values — never from a free-text field such as the case title, and refers to the authenticated session only by $QA_AGENT_UI_USER, never a credential value"
    requirement: EXEC-01
    verification:
      - kind: unit
        ref: "scripts/format-report.test.mjs#deriveUiReproSteps (both cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The API branch of renderCase renders evidence.request.auth.mechanism and the storage-state file's basename when present, with no cookie or token value ever rendered; cases carrying no auth field (every case Phase 1 ever wrote) render exactly as before"
    requirement: API-03
    verification:
      - kind: unit
        ref: "scripts/format-report.test.mjs#renderCase — API auth mechanism rendering (both cases)"
        status: pass
    human_judgment: false
  - id: D7
    description: "SKILL.md's new ## UI run protocol documents snapshot-driven role/accessible-name element targeting with a mandatory re-snapshot after every action (never a stale ref, never a CSS selector), the single-login/--storage-state session-reuse sequencing shared with API cases, and the exactly-one-retry/'unconfirmed' (not reproducible) verdict rule for a single-run UI failure; allowed-tools grants the nine mcp__playwright__ tools this protocol uses and no JavaScript-evaluation tool (T-02-22); all eight of the phase's section headings and all three PreToolUse matchers remain present"
    requirement: "EXEC-01, EXEC-02"
    verification:
      - kind: other
        ref: "node one-liners: skill-ui-run-ok, frontmatter-complete-ok, skill-sections-ok; grep -c matcher: SKILL.md == 3"
        status: pass
    human_judgment: false
  - id: D8
    description: "In a live installed session, a natural-language instruction with a base URL ('probá el alta de cliente') drives the agent through the documented protocol end to end — login, snapshot-driven navigate/fill/click actions, a pause on a destructive-looking control, and one report containing both the browser cases and any API cases from the same run, with exactly one login for the whole run"
    verification: []
    human_judgment: true
    rationale: "Requires a live Claude Code session with the skill installed, driving a real Playwright MCP browser against a real target app with a real login form and form flow — cannot be exercised by a unit test against hand-built case objects or mocked tool-call arguments. Per workflow.human_verify_mode=end-of-phase, deferred to end-of-phase UAT, matching how 02-01's and 02-02's own end-to-end truths were deferred."

duration: 30min
completed: 2026-08-12
status: complete
---

# Phase 2 Plan 4: UI Case Runner + Browser Run Protocol Summary

**`scripts/ui-case.mjs` turns one observed browser step into an evidence-backed `results.json` case (refusing a verdict with no captured snapshot), `format-report.mjs` renders it alongside API cases in the same report, and `SKILL.md`'s new `## UI run protocol` ties instruction, snapshot, gate, action, re-snapshot and record into the loop the phase exists to deliver.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-12T22:58:00Z
- **Completed:** 2026-08-12T23:14:39Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `scripts/ui-case.mjs`: `buildUiCase()` builds a case object satisfying Phase 1's `results.json` contract exactly, with an added `kind: 'ui'` field, `evidence.request` carrying the action/element/URL and `evidence.response` carrying the (capped, truncation-marked) accessibility snapshot, a screenshot path, and the post-action URL. Throws `UiEvidenceMissingError` — naming the case title — for a passed/failed status with no captured snapshot, and is exempt for a blocked case exactly like an API case. `checks` is never empty; `verdict` is composed by a private helper strictly from stored fields, never a free-text argument.
- The `ui-case.mjs` CLI reads the snapshot from a file at `--snapshot-file` (never an inline argument, so a multi-kilobyte accessibility tree never has to survive shell quoting) and appends via `api-client.mjs`'s `appendCase` — one results writer for both case kinds. Exit codes: 0 (recorded), 2 (bad/unrecognised `--action` or other bad argument), 5 (missing/absent snapshot evidence).
- `scripts/format-report.mjs`: `renderCase` now branches on `caseObj.kind === 'ui'` before the existing API logic, which is left byte-identical for every case with no `kind` field. The new `renderUiCase` renders the action, element, page URL, the quoted snapshot in a fenced block, the screenshot path when present, checks, and the verdict — throwing the existing `EvidenceMissingError` (not a second error class) under the same rule the HTTP path already enforces. A blocked UI case renders the action/element as not performed plus the `blockedReason`, without throwing despite the null response.
- `deriveUiReproSteps` composes a failed UI case's reproduction steps strictly from `evidence.request.url/action/element`, `evidence.response.url`, and the first failed check — never from a narrative field — and names the authenticated session only by `$QA_AGENT_UI_USER`, never a credential value.
- The (unchanged) API branch of `renderCase` now also renders `evidence.request.auth.mechanism` and the storage-state file's basename when present (API-03 visibility), with no cookie or token value ever rendered.
- A results file holding both API and UI cases renders every case in original run order and sums both kinds into one passed/failed/blocked count — proven directly by a mixed-report test, not merely assumed from the shared pipeline.
- `SKILL.md`: `allowed-tools` gains the nine `mcp__playwright__` tools this protocol actually uses (navigate, navigate_back, snapshot, click, fill_form, type, take_screenshot, wait_for, close), deliberately excluding any JavaScript-evaluation tool — documented inline as a YAML comment naming the exact routing-around-the-gate risk (T-02-22). `## Installation` gained a one-paragraph pointer to `references/mcp-setup.md` for the one-time Playwright MCP registration, without duplicating that procedure. The new `## UI run protocol` section spells out the eleven-step loop: deciding browser-vs-API, one run id, one login reused as `--storage-state` for both the browser session and later API calls, one case per user-visible outcome, the per-interaction step loop (navigate, snapshot, classify, one interaction, re-snapshot), recording every step through `ui-case.mjs` only, exactly one retry with an `unconfirmed` verdict on a single-run failure, preferring `browser_wait_for` over a fixed sleep, running API cases after the flow with no second login, rendering the shared report, and closing the browser — closed with a never-do list (no stale refs, no CSS-selector fallback, no JS-evaluation escape hatch, no batched destructive approvals, no verdict without a snapshot).
- Full suite: `npx vitest run` — 156/156 tests passing across 10 files (127 pre-existing + 29 new from this plan's `ui-case.test.mjs` and the `format-report.test.mjs` additions).

## Task Commits

Each task was committed atomically:

1. **Task 1: Record a browser step as an evidence-backed case** - `d30f656` (feat)
2. **Task 2: Render browser evidence in the existing report** - `bf26f37` (feat)
3. **Task 3: The natural-language browser run protocol** - `39071e4` (docs)

_No plan-metadata commit — per this run's instructions, STATE.md/ROADMAP.md updates are owned by the orchestrator, not this executor._

## Files Created/Modified
- `scripts/ui-case.mjs` - `UI_ACTIONS`, `buildUiCase`, `UiEvidenceMissingError`, CLI exit codes 0/2/5
- `scripts/ui-case.test.mjs` - construction contract, evidence enforcement, truncation, verdict composition, CLI exit-code coverage
- `scripts/format-report.mjs` - `renderUiCase` (private) branch of `renderCase`, `deriveUiReproSteps`, API-branch auth-mechanism rendering
- `scripts/format-report.test.mjs` - UI rendering, evidence enforcement, mixed API/UI report ordering + counts, auth-mechanism coverage
- `SKILL.md` - `allowed-tools` extended with 9 `mcp__playwright__` tools, `## Installation` pointer to `references/mcp-setup.md`, new `## UI run protocol` section

## Decisions Made
- `buildUiCase` takes a single `url` parameter (not separate pre-/post-action URLs), since the orchestrator only ever has one page URL per recorded step; `evidence.response.url` mirrors `evidence.request.url` for that reason.
- `SNAPSHOT_CHAR_CAP` set to 20000 characters with an explicit trailing truncation marker string — a value the plan left to implementer discretion, chosen to match the project's "never silent" evidence-capture discipline elsewhere.
- The UI case heading (`## Case N — UI: <action> "<element>" — STATUS`) deliberately differs from the API heading's `<METHOD> <url>` shape for readability in a mixed report, while preserving the `## Case N — ... — STATUS` pattern the rest of the rendering pipeline depends on for both kinds.
- The `allowed-tools` JS-evaluation-tool exclusion (T-02-22) is recorded as a YAML comment directly above the `allowed-tools` line in frontmatter, so the constraint travels with the exact tool list it constrains rather than living only in prose further down the file.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

One `npx vitest run` (full suite) invocation showed 3 failed / 4 tests failed on a spurious rerun immediately after Task 3's `SKILL.md`-only change — all four failures were e2e Chromium-process contention (`ui-login.test.mjs`/`ui-session.e2e.test.mjs` spawning multiple real browsers under Windows resource pressure), not a regression from this plan's changes (SKILL.md is documentation only, touches no test-exercised code path). A clean immediate re-run passed 156/156, confirmed before committing Task 3.

## User Setup Required

None - no external service configuration required. Playwright MCP server registration itself (per `references/mcp-setup.md`, from plan 02-03) remains a one-time, per-developer manual step, unchanged by this plan.

## Next Phase Readiness

- All four plans in Phase 2 (02-01 through 02-04) are now complete: script-driven login + session reuse (02-01), the UI destructive-action confirmation gate (02-02), the Playwright MCP registration with hands-on-verified flags (02-03), and this plan's UI case recorder, report renderer and run protocol (02-04).
- Every `must_have` truth in this plan's frontmatter is satisfied at the code/documentation layer: evidence-backed UI verdicts refused without a snapshot at both construction and render, UI and API cases sharing one `results.json`/report, session reuse wired through `--storage-state`, and the single-retry/"unconfirmed" rule documented in the protocol the orchestrator follows.
- The one remaining truth — a live end-to-end run against a real target app (login, a full UI flow, a destructive-control pause, one shared report) — is deferred to end-of-phase UAT per `workflow.human_verify_mode: end-of-phase`, consistent with how 02-01 and 02-02 deferred their own live-session truths. This is the natural point for that UAT: everything it needs (login, gate, MCP registration, recorder, renderer, protocol) is now in place.
- No blockers identified for Phase 3 (Dual Discovery & Test-Case Generation), which can build directly on `scripts/ui-case.mjs` and the report pipeline rather than inventing a second evidence shape.

---
*Phase: 02-browser-execution-engine*
*Completed: 2026-08-12*
