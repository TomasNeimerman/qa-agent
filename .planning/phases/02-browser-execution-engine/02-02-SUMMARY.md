---
phase: 02-browser-execution-engine
plan: 02
subsystem: security
tags: [playwright-mcp, pretooluse-hook, destructive-classification, spanish-keywords]

# Dependency graph
requires:
  - phase: 02-browser-execution-engine
    provides: "02-01's scripts/ui-login.mjs and storageState reuse — this plan builds the destructive-click gate that must exist before 02-04 lets the orchestrator click anything"
provides:
  - "scripts/ui-destructive.mjs: requiresConfirmationForElement/previewOfElement — Spanish-first keyword classifier for UI element text/aria-label, fails closed on an unnamed element (D-06)"
  - "scripts/confirm-destructive-ui.mjs: decideForUiToolCall — PreToolUse hook backstop matching mcp__playwright__browser_click/browser_fill_form/browser_type by name, never reading field.value or toolInput.text"
  - "references/ui-destructive-classification.md: the orchestrator's per-click judgment rubric"
  - "SKILL.md ## UI confirmation protocol: the seven-step per-interaction loop extending the existing API confirmation protocol to the browser"
affects: [02-04-ui-case-runner]

# Actuals (#2632)
actuals:
  tokens: 6100
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sibling-module classification: ui-destructive.mjs mirrors destructive.mjs's shape (pure predicate + explicit-field-assignment preview builder) rather than being a rewrite, keeping the two classifiers structurally interchangeable for a future reader"
    - "MCP tool-name PreToolUse matcher: confirm-destructive-ui.mjs reads tool_input fields directly instead of regex-parsing a Bash command string, since MCP tool calls arrive as structured arguments rather than a shell command"
    - "Field-name-only extraction: decideForUiToolCall builds its classification material from field.name/field.element only, never field.value or toolInput.text, so a fill-form call during a re-auth prompt can never leak a typed credential into a hook decision reason"

key-files:
  created:
    - scripts/ui-destructive.mjs
    - scripts/ui-destructive.test.mjs
    - scripts/confirm-destructive-ui.mjs
    - scripts/confirm-destructive-ui.test.mjs
    - references/ui-destructive-classification.md
  modified:
    - SKILL.md

key-decisions:
  - "Extended UI_DESTRUCTIVE_KEYWORDS beyond D-06's five literal keywords with Spanish siblings across all five destructive categories (deletion, account lifecycle, financial mutation, permission/role change, outbound messaging) plus an English supplement, per the plan's explicit discretion grant — 'dar de alta' deliberately excluded as a creation action already covered by the API gate"
  - "Used truncated stems ('enviar notificaci') so both accented and unaccented Spanish spellings match without adding a normalisation step"
  - "The Cancelar/dismiss-button ambiguity is documented as an intentional over-gate in references/ui-destructive-classification.md rather than special-cased away — a harmless modal dismiss labelled 'Cancelar' still pauses, and the orchestrator is instructed to say so in its chat summary rather than silence the keyword"
  - "SKILL.md's new UI confirmation protocol section states plainly, per 01-UAT.md Test 4's unresolved finding, that the PreToolUse hook's live-session firing is unverified — the orchestrator-level pause is documented as the actual guarantee, not the hook's mere presence in frontmatter"

patterns-established:
  - "Pattern: browser destructive-action gating — any future MCP interaction tool this skill adds should extend UI_GATED_TOOLS and reuse requiresConfirmationForElement rather than inventing a parallel keyword list"

requirements-completed: [EXEC-01]

coverage:
  - id: D1
    description: "requiresConfirmationForElement recognizes Spanish-language destructive keywords (D-06's five literal keywords plus siblings) case-insensitively on visible text and/or aria-label, and does not gate benign labels"
    requirement: EXEC-01
    verification:
      - kind: unit
        ref: "scripts/ui-destructive.test.mjs#requiresConfirmationForElement (all cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An element with no accessible name (empty, whitespace-only, undefined or null text/aria-label) is gated rather than waved through — unrecognised means gated"
    requirement: EXEC-01
    verification:
      - kind: unit
        ref: "scripts/ui-destructive.test.mjs#requiresConfirmationForElement fails closed for an empty string, a whitespace-only string, undefined and null — text position / ariaLabel position"
        status: pass
    human_judgment: false
  - id: D3
    description: "previewOfElement and decideForUiToolCall never surface a typed field value (e.g. a password) in the confirmation preview or the PreToolUse hook decision reason, asserted with a distinctive literal"
    requirement: EXEC-01
    verification:
      - kind: unit
        ref: "scripts/ui-destructive.test.mjs#previewOfElement still has no value property when the input object also carries one (hunter2 literal)"
        status: pass
      - kind: unit
        ref: "scripts/confirm-destructive-ui.test.mjs#never leaks a field value into the decision reason for any browser_fill_form input (s3cr3t-value literal)"
        status: pass
    human_judgment: false
  - id: D4
    description: "decideForUiToolCall escalates mcp__playwright__browser_click/browser_fill_form/browser_type calls on destructive-looking elements to an 'ask' PreToolUse decision, ignores read-only/navigation tools and non-Playwright tools, and the stdin/stdout hook protocol fails open on malformed input"
    requirement: EXEC-01
    verification:
      - kind: unit
        ref: "scripts/confirm-destructive-ui.test.mjs#decideForUiToolCall (all cases)"
        status: pass
      - kind: unit
        ref: "scripts/confirm-destructive-ui.test.mjs#confirm-destructive-ui.mjs stdin/stdout hook protocol (all cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "SKILL.md registers both new PreToolUse matchers alongside the untouched Bash entry, and documents a seven-step per-interaction confirmation loop (## UI confirmation protocol) extending the existing API confirmation protocol to the browser, including the never-show-a-typed-value and never-route-around-a-gate-via-JS-evaluation rules"
    requirement: EXEC-01
    verification:
      - kind: other
        ref: "node one-liners: skill-ui-gate-ok, frontmatter-bash-hook-intact-ok, rubric-length-ok, rubric-keywords-ok, grep -c matcher SKILL.md == 3"
        status: pass
    human_judgment: false
  - id: D6
    description: "In a live installed session, driving a real browser to a page with an Eliminar button pauses the agent before clicking it, declining skips only that step, and the Phase 1 UAT Test 4 PreToolUse-hook-firing gap is re-tested in its browser form"
    verification: []
    human_judgment: true
    rationale: "Requires a live Claude Code session driving a real Playwright MCP browser against a real target app — cannot be exercised by a unit test against mocked tool-call arguments. Per workflow.human_verify_mode=end-of-phase, deferred to end-of-phase UAT, matching how 01-UAT.md Test 4 itself was verified."

duration: 15min
completed: 2026-08-12
status: complete
---

# Phase 2 Plan 2: UI Destructive-Action Guardrails Summary

**Spanish-first keyword classifier (`ui-destructive.mjs`) plus a Playwright-MCP-tool-name `PreToolUse` hook (`confirm-destructive-ui.mjs`) that gates every browser click/type/form-fill aimed at a destructive-looking element, mirroring Phase 1's API confirmation gate one wave ahead of the case runner that will actually click things.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-12T19:40:00-03:00
- **Completed:** 2026-08-12T19:54:50-03:00
- **Tasks:** 3
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `scripts/ui-destructive.mjs`: `requiresConfirmationForElement(text, { ariaLabel })` — one lowercased haystack from text + aria-label, gated by a Spanish-first keyword list (D-06's five literal keywords plus siblings across deletion, account lifecycle, financial mutation, permission/role change and outbound messaging, with an English supplement), and fails closed on an empty/whitespace/undefined/null haystack. `previewOfElement` builds the developer-facing preview by explicit field assignment so a `value`/`fields` key on the input object can never leak through.
- `scripts/confirm-destructive-ui.mjs`: `decideForUiToolCall(toolName, toolInput)` — the PreToolUse hardening layer, retargeted from Phase 1's Bash-command regex to Playwright MCP's structured `tool_input` shape. Gates `mcp__playwright__browser_click`/`browser_fill_form`/`browser_type` by name; for a fill-form it classifies on `field.name`/`field.element` only, never `field.value`; fails open (exit 0, no output) on any parse error.
- `references/ui-destructive-classification.md`: the orchestrator's judgment rubric — keyword table by category, worked gated/not-gated examples, an explicit note on the `Cancelar`-as-dismiss-button ambiguity (intentionally over-gated, not special-cased away), the tie-breaker, and the closing note that the rubric never permanently bars an action.
- `SKILL.md`: two new `PreToolUse` matchers (`mcp__playwright__browser_click`, `mcp__playwright__browser_fill_form`) registered alongside the existing, byte-unchanged `Bash` entry, and a new `## UI confirmation protocol` section spelling out the seven-step per-interaction loop, including the explicit statement that the hook layer's live-session firing is unverified per Phase 1's UAT Test 4 gap.
- Full suite: `npx vitest run` — 127/127 tests passing across 9 files (114 pre-existing + 13 new from this plan's two test files, with `ui-destructive.test.mjs`'s 11 tests already committed separately).

## Task Commits

Each task was committed atomically:

1. **Task 1: Classify a UI element as destructive from its accessible name** - `1bc26f1` (feat)
2. **Task 2: PreToolUse hook backstop for Playwright MCP interaction tools** - `2c4c3da` (feat)
3. **Task 3: The UI rubric and the orchestrator's per-click confirmation protocol** - `bad3ef1` (docs)

_No plan-metadata commit — per this run's instructions, STATE.md/ROADMAP.md updates are owned by the orchestrator, not this executor._

## Files Created/Modified
- `scripts/ui-destructive.mjs` - `UI_DESTRUCTIVE_KEYWORDS`, `requiresConfirmationForElement`, `previewOfElement`
- `scripts/ui-destructive.test.mjs` - keyword, fail-closed, case-insensitivity and value-exclusion coverage
- `scripts/confirm-destructive-ui.mjs` - `UI_GATED_TOOLS`, `decideForUiToolCall`, stdin/stdout PreToolUse JSON protocol
- `scripts/confirm-destructive-ui.test.mjs` - tool-name matcher and hook protocol coverage, including a distinctive-literal leak check
- `references/ui-destructive-classification.md` - the element-text judgment rubric
- `SKILL.md` - two new `PreToolUse` matcher entries, new `## UI confirmation protocol` section

## Decisions Made
- Extended `UI_DESTRUCTIVE_KEYWORDS` well beyond D-06's five literal keywords, per the plan's explicit discretion grant, deliberately excluding `dar de alta` (a creation action the API gate already covers).
- Used truncated stems (`enviar notificaci`) instead of Unicode normalisation to match both accented and unaccented Spanish spellings.
- Documented the `Cancelar`-as-dismiss-button over-gate as an intentional trade in the rubric rather than adding logic to special-case it away.
- Stated the PreToolUse hook's unverified live-session status directly in `SKILL.md`'s new protocol section, per 01-UAT.md Test 4, so its presence in frontmatter is never mistaken for proof of enforcement.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `scripts/ui-destructive.mjs` and `scripts/confirm-destructive-ui.mjs` are both ready for plan 02-04 (the UI case runner), which is the first plan that will actually issue `browser_click`/`browser_fill_form` calls — the gate is in place one wave ahead, per this plan's own success criteria.
- Plan 02-03 (Playwright MCP setup) can proceed independently — this plan did not touch `.mcp.json`, and the `UI_GATED_TOOLS` comment flags that its tool-name strings depend on whatever server key 02-03 registers.
- Deferred to end-of-phase UAT (workflow.human_verify_mode=end-of-phase): a live run against a real `Eliminar` button, and a re-test of the Phase 1 UAT Test 4 PreToolUse-hook-firing gap in its browser form.

---
*Phase: 02-browser-execution-engine*
*Completed: 2026-08-12*

## Self-Check: PASSED

All 6 created/modified files confirmed present on disk; all 3 task commit hashes (`1bc26f1`, `2c4c3da`, `bad3ef1`) confirmed present in `git log`.
