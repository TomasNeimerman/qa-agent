# Project Research Summary

**Project:** qa-agent
**Domain:** AI-powered QA testing agent packaged as a Claude Code Skill (web UI testing + API testing + test-case generation)
**Researched:** 2026-08-10
**Confidence:** MEDIUM

## Executive Summary

This project builds an internal Claude Code skill that autonomously explores and tests Next.js/Supabase apps (DATAX, dotax, franquix) — driving a real browser, hitting API endpoints, and generating documented test cases — then produces a human-readable report. It is not a SaaS competitor to QA Wolf/Momentic/Testim; it's a single-user, on-demand, self-hosted equivalent of their AI-authoring engine, distributed as `~/.claude/skills/qa-agent/` with zero extra infrastructure. The core technical foundation is well-established and low-risk: Microsoft's official `@playwright/mcp` server gives Claude a real browser driven via accessibility-tree snapshots (cheap, reliable, no vision model needed), while API testing uses a thin deterministic HTTP client (`fetch`/`APIRequestContext` + zod) rather than a second tool. Its biggest differentiator — and biggest engineering lift — is "dual discovery": reading the target repo's routes, forms, and Supabase migrations to infer what should be tested, combined with accepting natural-language flow instructions, so it works unmodified across projects without a recording/onboarding step.

The recommended architecture is a layered Skill: an orchestrator (SKILL.md, Plan→Act→Verify) that dispatches to specialized subagents (Discovery/Explorer, UI Executor, API Executor, Reporting), each with narrow structured input/output contracts, writing to a stateless, run-scoped artifact directory (`.qa-agent/runs/<ts>-<flow>/`). This decomposition exists specifically to avoid context-window bloat from noisy tool-call sequences (browser actions, HTTP calls) and to keep deterministic work (discovery scans, API assertions, report formatting) in scripts rather than LLM freehand reasoning.

The dominant risk in this domain is not technical feasibility but agent trustworthiness and safety: LLM agents will confidently narrate false "PASSED" results without real verification, generate test oracles that trivially pass because they were derived from the code under test rather than actual requirements, and — most severely — documented industry incidents show autonomous agents taking irreversible destructive actions (deleting production data) when unblocking themselves. Mitigating these (evidence-backed reporting, environment/credential guardrails, a hard block on direct DB access, human confirmation before destructive actions) must be architectural decisions made in the foundation phase, not retrofitted later.

## Key Findings

### Recommended Stack

The stack is deliberately minimal and Node/TypeScript-oriented, matching the team's existing stack. `@playwright/mcp` (Microsoft, official) is the single most important dependency — it gives Claude real-browser control via accessibility-tree snapshots rather than screenshots, which is cheaper in tokens and far less flaky than vision-based approaches. Everything else layers on top: Node 22+ LTS as the runtime baseline, `playwright` core library (`APIRequestContext`/`fetch`) doubling as the API-testing toolchain so no second HTTP client is needed, and zod for runtime contract validation of API responses. Chrome DevTools MCP is an optional, complementary diagnostic add-on for root-causing UI failures — not the primary driver.

**Core technologies:**
- `@playwright/mcp` (0.0.79+): browser control via accessibility-tree snapshots — first-party Microsoft MCP server, de facto standard for LLM browser automation
- Node.js 22 LTS+: runtime for MCP server/helper scripts — required by Playwright 1.62.x compatibility
- Playwright core (`playwright` npm, 1.62.1): underlying engine + `APIRequestContext` for API testing — one toolchain covers UI and API, avoids a second HTTP client
- zod (4.4.3): schema validation for API contract/response-shape checks
- Claude Code Agent Skills (SKILL.md format): packaging/distribution mechanism, near-free in context until invoked

### Expected Features

The MVP centers on the explicitly stated core pain point (repetitive manual regression/form testing) and the "dual discovery" differentiator. Explicitly out of scope for v1: generating versioned test code committed to the repo, CI/CD-triggered runs, persisted cross-run self-healing, multi-user dashboards, cross-browser matrices, and full visual regression — all called out as anti-features that represent a different product shape than an on-demand, single-user skill.

**Must have (table stakes):**
- Autonomous browser exploration/navigation (Playwright MCP, single Chromium context)
- Natural-language-directed testing + auth/login handling for protected flows
- Form validation coverage (required/format/boundary) and negative/edge-case testing
- API/endpoint testing (status codes, schema/contract, error responses) — independent of the browser engine
- Documented test-case output (steps, expected result, type) + readable pass/fail report with evidence
- Dual environment targeting (localhost/staging) and smoke-test-post-deploy mode
- Code-aware discovery (routes, forms, Supabase migrations) combined with NL instructions

**Should have (competitive differentiators, v1.x):**
- Root-cause-oriented failure diagnosis (correlate console/network errors with source code)
- Self-healing-lite via accessibility-tree/semantic matching (stateless, single-run only)
- Explicit depth/mode control (quick/standard/deep)
- Domain-specific edge-case libraries (CUIT/CUIL, multi-tenant role scoping)

**Defer (v2+):**
- Persisted versioned test code generation, CI/CD-triggered runs
- Cross-browser/device matrix, full visual regression (pixel-diff baselines)
- Persisted/learned self-healing, multi-user dashboards/shared history

### Architecture Approach

The system runs entirely inside a Claude Code session — "components" are Skill instruction files, reference docs, scripts, and MCP tool calls, not separate processes. A three-layer pattern (orchestration / execution / knowledge) is adapted to Claude Code's Skill+Subagent primitives: an orchestrator plans and dispatches, specialized subagents isolate noisy tool-call sequences into their own context windows and return condensed structured results, and deterministic scripts (discovery scans, API client, report formatter) do anything that shouldn't be LLM freehand work. All run state lives in a stateless, per-run filesystem directory outside the skill package, so the skill stays portable across projects.

**Major components:**
1. Orchestrator (SKILL.md) — Plan→Act→Verify loop; decides discovery mode, dispatches subagents, owns the run's artifact directory
2. Discovery/Exploration subagent — dual-mode: static code scan (routes, forms, Supabase migrations) or NL-scoped targeted search; outputs structured JSON of testable surfaces
3. Test-Case Generation (in-context or planner subagent) — turns discovered surfaces + NL instructions into `test-plan.md` (happy/edge/negative cases)
4. UI/API Executor subagents — drive Playwright MCP / a deterministic HTTP client script respectively, both writing to a shared `results.json` schema
5. Reporting — formatter reads `test-plan.md` + `results.json` → human-readable `REPORT.md` with evidence

### Critical Pitfalls

1. **Hallucinated "PASSED" without real verification** — require every verdict to be backed by a captured artifact (screenshot/DOM snapshot/HTTP response) taken at the moment of the claim, not reconstructed from memory; quote evidence in the report.
2. **Destructive/irreversible actions against real data** — never default to production; hard-block direct DB/service-role access as a "workaround"; require explicit human confirmation before any destructive action (delete, bulk update, payment, email).
3. **Trivial/tautological test oracles (oracle problem)** — flag exploration-inferred expected-outcomes as unverified; prefer human NL instructions as the authoritative oracle; favor objective smoke checks (crashed/500'd) over subjective value checks.
4. **Credential/session mishandling** — dedicated test/service accounts injected via env vars only, never in skill markdown/CLAUDE.md/transcripts; role-scoped accounts for permission-boundary testing.
5. **Browser flakiness treated as ground truth** — distinguish "reproducible failure" from "single-run anomaly"; a single UI run is not authoritative like a scripted deterministic suite.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Skill scaffold, safety guardrails, and API testing engine
**Rationale:** Guardrails (destructive-action blocking, credential isolation, environment allowlisting) and evidence-backed reporting are structural properties that are expensive to retrofit — per PITFALLS.md they must ship before any execution capability. API testing is architecturally independent of the browser engine and lower complexity, making it a fast, safe first vertical slice.
**Delivers:** Installable skill package structure (`SKILL.md`, `references/`, `scripts/`, `agents/`), `.mcp.json` Playwright MCP registration, dedicated test-account credential convention, environment/domain allowlist (refuse production-looking URLs), deterministic `api-client.mjs` + zod contract checks, `results.json`/`REPORT.md` schema with mandatory evidence linkage.
**Addresses:** API/endpoint testing, dual environment targeting, credential handling, documented report deliverable (FEATURES.md P1 items)
**Avoids:** Pitfall 1 (hallucinated pass), Pitfall 3 (destructive actions), Pitfall 4 (credential mishandling), Pitfall 6 (token blowup — scoping conventions decided here)

### Phase 2: Browser Execution Engine — UI testing via Playwright MCP
**Rationale:** Depends on Phase 1's guardrails and report/evidence schema already existing; this is the highest-complexity, highest-risk-of-flakiness capability, so it should build on a proven safety foundation rather than ship guardrails and browser control simultaneously.
**Delivers:** UI Executor subagent driving Playwright MCP via accessibility-tree snapshots, auth/login handling with `storageState` reuse, retry/confirmation convention for flaky single-run results, screenshot-on-failure evidence capture, test-data namespacing/cleanup tracking.
**Uses:** `@playwright/mcp`, Playwright core, accessibility-snapshot-first pattern (Architecture Pattern 2)
**Implements:** UI Execution component, Orchestrator↔Executor subagent boundary (Architecture Pattern 3)

### Phase 3: Dual Discovery — Code-aware exploration + natural-language flows
**Rationale:** This is the project's key differentiator (FEATURES.md) but is high complexity and depends on having both executors already working to be useful — discovery output only matters once something can act on it.
**Delivers:** Discovery/Explorer subagent with static scan scripts (`discover-routes.mjs`, `discover-schema.mjs`) scoped to targeted reads, NL-flow-scoped search path, structured JSON "testable surfaces" contract feeding test-case generation.
**Addresses:** Code-aware discovery, natural-language-directed testing, hybrid discovery differentiator (FEATURES.md)
**Avoids:** Pitfall 6 (token/cost blowup from unbounded exploration — must ship scoped by default)

### Phase 4: Test-Case Generation & Edge-Case Quality
**Rationale:** Depends on Phase 3's discovery output (form/schema constraints) as ground truth; generating meaningful edge cases before discovery exists produces generic, low-value cases (Pitfall 7).
**Delivers:** Form validation + negative/edge-case generation grounded in actual Zod schemas/Supabase constraints, documented test-case output (`test-plan.md`) with oracle-source labeling (inferred vs. human-specified).
**Addresses:** Form validation coverage, negative/edge-case testing, documented test cases (FEATURES.md P1)
**Avoids:** Pitfall 2 (tautological oracles), Pitfall 7 (edge-case coverage theater)

### Phase 5: Reporting Polish, Smoke-Test Mode & Root-Cause Diagnosis
**Rationale:** Smoke-test mode is a scoped/fast configuration of the full engine, not a separate build — sequence last once the core loop (explore→generate→execute→report) is proven. Root-cause diagnosis is an explicit v1.x enhancement per FEATURES.md.
**Delivers:** Scoped smoke-test invocation (top-N critical flows), root-cause-oriented failure reporting (correlate console/network errors with source), final packaging/distribution polish and cross-project portability verification.
**Addresses:** Smoke-test-post-deploy mode, root-cause-oriented failure reporting (FEATURES.md differentiators)

### Phase Ordering Rationale

- Safety guardrails and the evidence/report schema come first because retrofitting them after execution capability exists is far riskier (PITFALLS.md: "must be addressed in the foundation phase" appears repeatedly for guardrails, credentials, and evidence-backed reporting).
- API testing precedes UI testing because it's architecturally independent and lower-risk (no browser flakiness, no destructive-click risk), giving an early validated slice before tackling the harder, higher-risk browser engine.
- Discovery is sequenced after both executors exist because its output (testable surfaces) has no consumer until execution/generation can act on it, and unscoped discovery is a major cost trap that needs the report/scoping conventions from Phase 1 already in place.
- Test-case generation depends on discovery's schema/constraint output to avoid generic "coverage theater" edge cases.
- Smoke-test mode and root-cause diagnosis are explicitly scoped configurations/enhancements of the core loop per FEATURES.md dependency notes, so they land last.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Browser Execution Engine):** Auth/session handling across localhost vs. staging, `storageState` reuse patterns, and flaky-vs-real-failure conventions are non-trivial and only loosely documented (LOW confidence sources in STACK.md/PITFALLS.md) — worth a `--research-phase` pass on Playwright MCP auth patterns specifically.
- **Phase 3 (Dual Discovery):** No authoritative source exists for "code-aware discovery scripts for Next.js/Supabase" as a pattern — this is synthesized/inferred, not documented practice (ARCHITECTURE.md confidence explicitly MEDIUM due to no single authoritative spec).

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation/API testing):** Playwright `APIRequestContext`/zod patterns, MCP registration, and Claude Code Skill packaging are well-documented, verified against npm registry and official docs.
- **Phase 4/5 (Test-case generation, reporting):** Primarily a prompting/workflow-design problem per STACK.md ("resist the urge to add a test generation library dependency") — no new tooling research needed.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core package versions verified live against npm registry (@playwright/mcp, playwright, zod); broader ecosystem comparisons (browser-use, Stagehand, Chrome DevTools MCP) sourced from LOW-confidence web aggregates, cross-checked across multiple articles |
| Features | MEDIUM | Commercial landscape (QA Wolf, Momentic, Testim, Reflect) cross-corroborated across vendor + independent sources; no single-source claims presented as authoritative; dollar/percentage figures are directional only |
| Architecture | MEDIUM | No single authoritative spec exists for "QA agent as a Claude Code Skill" — pattern synthesized from adjacent, well-established practices (Playwright MCP, browser-use, Claude Code Skills docs, multi-agent E2E test-gen case studies), cross-referenced across 10+ sources |
| Pitfalls | MEDIUM | Web-sourced, cross-checked across multiple independent reports including documented real-world incidents (production DB deletion cases); no first-party benchmark run against this specific project |

**Overall confidence:** MEDIUM

### Gaps to Address

- **Auth/session portability across localhost vs. staging:** Not deeply validated — plan to prototype `storageState` sharing early in Phase 2 and adjust if it doesn't hold up across environments.
- **Discovery script robustness across App Router vs. Pages Router and non-standard project layouts:** Architecture assumes convention detection with graceful fallback; validate against at least two of the three target repos (DATAX, dotax, franquix) before considering Phase 3 done.
- **Concrete destructive-action classification list:** PITFALLS.md establishes the principle (require confirmation for delete/bulk/payment/email) but the exact taxonomy per target app needs to be defined during Phase 1 planning, not left implicit.
- **Exact token/cost budget for a "scoped single-flow" run:** No hard numbers were found; treat as an empirical question to calibrate once Phase 1/2 are running, not something to over-specify now.

## Sources

### Primary (HIGH confidence)
- None — no context7/official-docs live fetch was performed in this research pass; recommend a follow-up direct fetch of https://playwright.dev/docs/api-testing before finalizing helper-script code (noted in STACK.md)

### Secondary (MEDIUM confidence)
- npm registry (live-verified): @playwright/mcp, playwright, zod current versions
- microsoft/playwright-mcp GitHub repo and Playwright official docs (capabilities framing)
- QA Wolf, Momentic, Testim, Reflect.run, browser-use official sites/blogs, cross-corroborated with independent reviews (GeeksforGeeks, Bug0, TheCTOClub, G2)
- Claude Code Docs: Extend Claude with skills; Agent Skills — Claude Platform Docs; Steering Claude Code (Anthropic blog)
- Documented incident reports: Eon, Zenity, Live Science, SAP Community, Penligent, AOL/Fortune (AI agent destructive-action case studies)

### Tertiary (LOW confidence)
- Web search aggregates on browser-use vs. Playwright MCP, Chrome DevTools MCP comparisons, Claude Code Agent Skills format, Stagehand status — cross-checked across multiple articles but not fetched from single authoritative sources
- Web search aggregates on token/cost blowup figures (context window management, agentic inference cost) — treated as directional only

---
*Research completed: 2026-08-10*
*Ready for roadmap: yes*
