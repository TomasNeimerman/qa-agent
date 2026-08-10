# Phase 1: Foundation, Guardrails & API Testing - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A developer can invoke the QA agent as an installed Claude Code skill and get a reliable, evidence-backed API test run against a local or staging target, with destructive actions safely gated behind confirmation. No browser automation, no code-aware discovery, no test-case generation yet — those are later phases. This phase delivers the smallest complete loop: invoke → run HTTP test(s) against an API → report, with the safety guardrail that governs the whole project built in from day one.

</domain>

<decisions>
## Implementation Decisions

### Destructive Action Detection
- **D-01:** Destructive-action detection is based primarily on HTTP method — `DELETE` always requires confirmation; `POST`/`PUT`/`PATCH` require confirmation unless the endpoint is clearly read-only (e.g., a search/filter POST). No pre-configured allowlist/denylist is needed per project.
- **D-02:** No absolute blacklist — every destructive action can be executed if the user explicitly confirms it in the moment. There is no action that is permanently blocked at the code/config level in v1.

### Confirmation Mechanism
- **D-03:** When a destructive action is detected, the agent pauses execution at that exact point, shows the user what it's about to do (method, URL, body), and waits for an explicit yes/no before proceeding — no pre-run approval list.
- **D-04:** If the user declines a confirmation, the agent skips only that specific case, marks it in the report as "blocked by user," and continues running the rest of the test cases in the same session.

### API Test Case Source (Phase 1 scope)
- **D-05:** Phase 1 has no automated discovery yet (that's Phase 3). The user tells the agent what to test via natural language, one or more endpoints per request (e.g., "probá GET /api/clients y POST /api/clients" or "testeá el CRUD de facturas"). No requirement to supply an OpenAPI spec or Postman collection in v1 — natural language is the only input method for Phase 1.
- **D-06:** Authentication against the target API uses a test-user token/API key supplied via environment variable, sent in the `Authorization` header on each request. Never hardcoded in the skill. Session-based auth via browser login doesn't exist until Phase 2 (API-03 in REQUIREMENTS.md) — Phase 1 only supports token-based auth.

### Reporting
- **D-07:** The report is delivered two ways: a summary shown in the chat, and a full Markdown file with evidence written to a local folder inside the tested project's repo (e.g. `qa-reports/`). — **Reversibility:** costly — the report file location becomes a convention the team will expect; changing it later means updating any tooling/gitignore rules built around it.
- **D-08:** Each test case in the report includes the full request (method, URL, body) and the full response (status, body, relevant headers) — not just a status code and short message. Applies to both pass and fail cases.

### Environment Variables & Validation Strictness (added after research review)
- **D-09:** The skill uses a fixed, documented env var convention across all target projects: `QA_AGENT_TOKEN` (test-user auth token) and `QA_AGENT_BASE_URL` (optional; base URL can also be passed as a skill argument). If unset when a run needs them, the skill fails loudly with a specific "not configured" message — never proceeds with a missing/empty Authorization header.
- **D-10:** Response-shape validation in Phase 1 is intentionally loose ("shape observed," not "contract validated"): checks status code, valid-JSON parseability, and any fields the user explicitly named in their natural-language instruction. The report must label these checks as "shape observed" rather than implying formal contract validation, since no OpenAPI/Postman spec exists yet (that's out of scope until later phases).

### Claude's Discretion
- Exact report filename/timestamp convention inside `qa-reports/` is left to the implementer.
- Whether `qa-reports/` needs a default `.gitignore` entry (to avoid committing test evidence to the tested project's repo) is left to the implementer's judgment — lean toward gitignoring by default since these are ephemeral run artifacts, not team-reviewed docs.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (this project)
- `.planning/research/STACK.md` — recommends Playwright's `APIRequestContext` (not a separate HTTP client) plus `zod` for lightweight response/schema validation
- `.planning/research/PITFALLS.md` — Pitfall 1 (hallucinated success / evidence-backed reporting) and Pitfall 3 (destructive-action guardrails) are foundation-phase concerns directly addressed by this phase's decisions
- `.planning/research/ARCHITECTURE.md` — suggests API test component as an early, lower-complexity, browser-independent build step; recommends a shared `results.json`-style contract for reporting so Phase 2's browser executor can reuse the same report format

### Project-level
- `.planning/PROJECT.md` — Core Value, Constraints (manual on-demand, dual environment)
- `.planning/REQUIREMENTS.md` — PKG-01, SAFE-01/02/03, API-01/02, EXEC-04, REP-01/02 (this phase's mapped requirements)

</canonical_refs>

<code_context>
## Existing Code Insights

This is a greenfield project — no application code exists yet, only `.planning/` and `.claude/` directories. No reusable assets, established patterns, or integration points to note. The planner should build directly from PROJECT.md, REQUIREMENTS.md, and the research files.

</code_context>

<specifics>
## Specific Ideas

No specific UI/output examples given beyond the decisions above — the user deferred format specifics (exact Markdown layout, filename convention) to implementer discretion.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Items explicitly out of scope for Phase 1 (browser auth reuse for API calls, code-aware discovery, OpenAPI/Postman spec ingestion) are already tracked in ROADMAP.md as later-phase requirements (API-03 → Phase 2; DISC-01/02/03 → Phase 3) and REQUIREMENTS.md's "Out of Scope" section — not new deferrals from this discussion.

</deferred>

---

*Phase: 1-Foundation, Guardrails & API Testing*
*Context gathered: 2026-08-10*
