# Phase 2: Browser Execution Engine - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

The agent can autonomously drive a real browser to execute application flows described in natural language, authenticate as a test user, and reuse that session for related API checks. This phase adds UI capability on top of Phase 1's proven API execution engine and safety-gate pattern — it does not touch code-aware discovery (Phase 3) or systematic edge-case generation (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Browser Tooling
- **D-01:** Use Playwright MCP (Microsoft's official MCP server, accessibility-tree snapshots rather than screenshots) as the browser-control mechanism, per Phase 1 research's recommendation. — **Reversibility:** costly — switching away later means re-deriving element-interaction patterns across every UI task.
- **D-02:** A single Chromium context/browser for all UI testing in v1. Cross-browser (Firefox/WebKit) is out of scope, consistent with Phase 1 research and REQUIREMENTS.md's "Out of Scope" section.

### Login / Authentication
- **D-03:** The agent navigates autonomously to the login page and identifies username/password fields via accessibility role/label (not hardcoded CSS selectors) — same "no per-project setup" philosophy as Phase 1's zero-config API testing.
- **D-04:** New environment variables `QA_AGENT_UI_USER` / `QA_AGENT_UI_PASSWORD` hold the test user's login credentials for browser-based auth — distinct from Phase 1's `QA_AGENT_TOKEN` (a bearer token is a different credential shape than a login form's username/password). Same "never hardcoded, fail loudly if unset" discipline as D-06/D-09 from Phase 1's CONTEXT.md.

### Destructive Actions in the UI
- **D-05:** The same confirmation-gate philosophy from Phase 1 (SAFE-01–SAFE-04) extends to the browser: before clicking an element that looks destructive, the agent pauses and asks for explicit confirmation, exactly like the API's DELETE/mutating-method gate. No absolute blacklist — same "everything gated by in-the-moment confirmation" stance as Phase 1 D-02.
- **D-06:** Destructive UI elements are detected by their visible text / aria-label (keywords like "eliminar", "borrar", "cancelar", "confirmar pago", "dar de baja") — the UI-equivalent of Phase 1's HTTP-method-based classification, since there's no HTTP verb to inspect for a button click.

### UI→API Session Reuse
- **D-07:** After a successful browser login, export Playwright's `storageState` (cookies/localStorage) and reuse it when constructing the `APIRequestContext` for any API-01/API-02 calls made later in the same run — avoids a second, separate login for API checks that happen after a UI flow. This directly satisfies API-03 from REQUIREMENTS.md.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (Phase 1, still applicable)
- `.planning/research/STACK.md` — Playwright MCP recommendation, accessibility-tree rationale
- `.planning/research/ARCHITECTURE.md` — suggested build order placed "browser driver wiring" as step 1 of the post-Phase-1 work; UI↔API session reuse via `storageState()` was flagged as a research open question (auth/session portability)
- `.planning/research/PITFALLS.md` — flakiness of browser automation (Pitfall 5), destructive-action guardrails (Pitfall 3) — now extended to UI per D-05/D-06

### Phase 1 (prior phase, direct dependency)
- `.planning/phases/01-foundation-guardrails-api-testing/01-CONTEXT.md` — D-01–D-10, the confirmation-gate and evidence-capture philosophy this phase extends
- `.planning/phases/01-foundation-guardrails-api-testing/01-RESEARCH.md` — Architectural Responsibility Map (deterministic script layer vs. orchestrator judgment split) — same split should apply to browser actions
- `.planning/phases/01-foundation-guardrails-api-testing/01-UAT.md` — live UAT findings, including the unresolved PreToolUse-hook-firing gap (Test 4) — worth re-testing once Phase 2's own destructive UI actions exist
- `.planning/phases/01-foundation-guardrails-api-testing/scripts/api-client.mjs`, `destructive.mjs`, `confirm-destructive.mjs` — existing implementations this phase's browser executor should reuse/extend rather than duplicate

### Project-level
- `.planning/PROJECT.md` — Core Value, Constraints
- `.planning/REQUIREMENTS.md` — EXEC-01, EXEC-02, EXEC-03, API-03 (this phase's mapped requirements)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/destructive.mjs` (`requiresConfirmation`, `previewOf`): the method-based classifier from Phase 1. Phase 2 needs an analogous text/label-based classifier for UI elements (D-06) — likely a sibling function or module, not a full rewrite.
- `scripts/api-client.mjs`: already accepts `--base-url` and reads config via `readConfig()`. Phase 2's `storageState` reuse (D-07) should extend this rather than fork a second HTTP client.
- `scripts/format-report.mjs`: the three-state (passed/failed/blocked) report renderer already exists and should be reused for browser-driven cases, not rebuilt.

### Established Patterns
- Deterministic script layer vs. orchestrator judgment split (Phase 1 Architectural Responsibility Map) — browser actions should follow the same split: Playwright MCP calls are the deterministic layer, "is this element destructive" judgment stays with the orchestrator's reasoning (mirroring D-01 in Phase 1 CONTEXT.md).
- Confirmation-pause protocol already implemented in `SKILL.md`'s "Confirmation protocol" section — extend it to cover UI actions rather than writing a parallel protocol.

### Integration Points
- `qa-reports/*.md` output convention (Phase 1 D-07) — browser-driven test cases should render into the same report format/location, not a separate report type.
- Env var loading via `.env.local`/`.env` in the target project root (Phase 1 `readConfig`) — `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` should load the same way.

</code_context>

<specifics>
## Specific Ideas

No specific UI examples given beyond the decisions above — implementer discretion on exact Playwright MCP tool-call sequencing and storageState file naming/location.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Code-aware discovery of what flows/forms exist (Phase 3) and systematic edge-case generation for forms (Phase 4) were correctly not raised here.

</deferred>

---

*Phase: 2-Browser Execution Engine*
*Context gathered: 2026-08-11*
