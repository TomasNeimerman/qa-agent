# Architecture Research

**Domain:** AI QA testing agent, packaged as a Claude Code Skill (UI + API testing, test-case generation, reporting)
**Researched:** 2026-08-10
**Confidence:** MEDIUM (cross-referenced across 10 web sources; no single authoritative spec exists yet for "QA agent as a Claude Code Skill" — pattern is synthesized from adjacent, well-established practices: Playwright MCP architecture, browser-use agent-loop architecture, Claude Code Skills/Subagents architecture, and multi-agent E2E test-generation case studies)

## Standard Architecture

### System Overview

This is not a standalone service — it runs *inside* a Claude Code session. "Components" below are Skill instruction files, reference docs, helper scripts, and MCP tool calls, not separate processes. The shape mirrors the "Agentic QA" three-layer pattern (orchestration / execution / knowledge) found across the industry, adapted to the Skill+Subagent primitives Claude Code actually offers.

```
┌──────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATION LAYER (SKILL.md)                    │
│  Plan → Act → Verify loop. Branches on input type (NL flow vs blank   │
│  invocation). Dispatches work to subagents, assembles final report.   │
├───────────────┬───────────────┬───────────────┬───────────────────────┤
│  DISCOVERY /   │  TEST-CASE     │  EXECUTION     │  REPORTING            │
│  EXPLORATION   │  GENERATION    │  (dual-mode)   │                      │
│  subagent      │  (reasoning,   │                │                      │
│                │  no subagent   │  ┌───────────┐ │  formatter script /  │
│  - code scan   │  needed —      │  │ UI Exec   │ │  LLM pass reads      │
│    (routes,    │  runs in       │  │ subagent  │ │  results.json +      │
│    forms, API  │  orchestrator  │  │ (Playwright│ │  test-plan.md →     │
│    handlers)   │  or a "planner"│  │  MCP)     │ │  REPORT.md           │
│  - schema scan │  subagent)     │  └───────────┘ │                      │
│    (Supabase   │                │  ┌───────────┐ │                      │
│    migrations) │  outputs:      │  │ API Exec  │ │                      │
│  - NL flow     │  test-plan.md  │  │ subagent  │ │                      │
│    parsing     │  (structured   │  │ (HTTP     │ │                      │
│                │  test cases)   │  │  client   │ │                      │
│                │                │  │  script)  │ │                      │
│                │                │  └───────────┘ │                      │
├───────────────┴───────────────┴───────────────┴───────────────────────┤
│                    EXTERNAL INTEGRATION LAYER                          │
│  Playwright MCP server (browser control via accessibility tree)        │
│  Target app under test — localhost:PORT or staging URL                 │
│  Target repo source (read-only: routes, migrations) — NOT the DB       │
├──────────────────────────────────────────────────────────────────────┤
│                        ARTIFACT LAYER (filesystem)                     │
│  .qa-agent/runs/<timestamp>-<flow>/                                    │
│  ├── test-plan.md   ├── results.json   ├── screenshots/  ├── REPORT.md │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|-------------------------|
| Orchestrator (SKILL.md) | Entry point; decides discovery mode, sequences subagent dispatch, owns the run's artifact directory, triggers reporting | Markdown instructions with a Plan → Act → Verify loop; YAML frontmatter describing "Use when testing a flow/form/API" |
| Discovery/Exploration | Finds what to test — either by scanning target code (Next.js routes/pages/API handlers, Supabase migrations for constraints) or scoping a user's NL description to relevant files | Dedicated subagent + small Node/bash scripts (`discover-routes.mjs`, `discover-schema.mjs`) that output structured JSON, not prose, to keep context cheap |
| Test-Case Generation | Turns discovered surfaces (or NL flow) into documented test cases: happy path, edge cases, negative cases, validation boundaries | Pure LLM reasoning against a checklist reference file (form-validation checklist, API-contract checklist); optionally reviewed by a "Test Reviewer" pass before execution |
| UI Execution (browser driver) | Drives a real browser against localhost/staging, executes each UI test case, captures pass/fail + evidence | Playwright MCP server (`@playwright/mcp`) invoked via MCP tool calls; agent reads accessibility-tree snapshots, not raw screenshots, to decide next action |
| API Execution | Sends HTTP requests to target API/backend routes, validates status codes, response shape, and error contracts | A thin, deterministic HTTP client script (Node `fetch` or `curl` wrapper) invoked via Bash tool — NOT the LLM eyeballing raw curl text; script does the assertion, returns structured pass/fail |
| Reporting | Aggregates results into a single human-readable summary: what was tested, what passed/failed, why, with repro steps and evidence | A formatter script (or final LLM pass) that reads `results.json` + `test-plan.md` and writes `REPORT.md` |
| Artifact Store | Holds the ephemeral state of a single run so components can hand off data without sharing a live process | Plain filesystem directory per run (`.qa-agent/runs/<ts>-<flow>/`), not a database — the whole system is stateless between invocations |

## Recommended Skill Structure

```
qa-agent/                              # ~/.claude/skills/qa-agent/ (installable, versioned)
├── SKILL.md                           # orchestrator: frontmatter + Plan-Act-Verify workflow
├── references/                        # loaded on demand, not part of every context window
│   ├── discovery-nextjs.md            # conventions for app/ and pages/ routers, API handlers
│   ├── discovery-supabase.md          # how to read migrations for NOT NULL/CHECK/FK/RLS
│   ├── test-case-checklist.md         # required field / format / boundary / negative-case checklist
│   ├── api-contract-checklist.md      # status codes, error shapes, auth-required cases to always probe
│   └── report-template.md             # REPORT.md structure the formatter/LLM must follow
├── scripts/                           # deterministic helpers — output consumes tokens, logic doesn't
│   ├── discover-routes.mjs            # static scan → JSON list of routes/forms/API endpoints
│   ├── discover-schema.mjs            # parse Supabase migrations → JSON schema/constraints
│   ├── api-client.mjs                 # send request, assert status/schema → structured result
│   └── format-report.mjs              # results.json + test-plan.md → REPORT.md
├── agents/                            # subagent definitions the skill dispatches to
│   ├── qa-explorer.md                 # runs discovery scripts, summarizes testable surfaces
│   ├── qa-planner.md                  # (optional) turns surfaces/NL flow into test-plan.md
│   ├── qa-executor-ui.md              # drives Playwright MCP through a list of UI test cases
│   ├── qa-executor-api.md             # drives api-client.mjs through a list of API test cases
│   └── qa-reviewer.md                 # critiques generated test cases/results before final report
└── mcp/
    └── playwright.json                # MCP server registration for Playwright MCP
```

Per-run artifacts live in the *target* repo's scratch space (or an OS temp dir), never inside the skill package itself:

```
.qa-agent/runs/2026-08-10-1432-client-signup/
├── test-plan.md       # documented cases: id, description, steps, expected, type=ui|api
├── results.json        # one structured entry per case: id, status, duration, evidence, error
├── screenshots/         # failure screenshots captured by Playwright MCP
└── REPORT.md            # final human-readable summary
```

### Structure Rationale

- **`references/` separate from `SKILL.md`:** keeps the always-loaded orchestrator body short; checklists and discovery conventions are large and only needed at specific steps, so they're pulled in on demand (this is the documented Claude Code Skills pattern — reference files for anything long-form).
- **`scripts/` for anything deterministic:** discovery (file scanning), API assertions, and report formatting should be scripts, not LLM freehand work — only script *output* consumes tokens, and results are reproducible instead of vibes-based (critical for a "reads raw curl text and decides pass/fail" anti-pattern to avoid).
- **`agents/` (subagents) isolate noisy tool-call sequences:** browser interaction and repeated HTTP calls produce a lot of intermediate tool output that would otherwise bloat the main conversation. Each subagent gets its own context window and reports back a condensed result, matching the "Orchestrator + specialized subagents" pattern used in multi-agent E2E test-generation systems.
- **Artifacts live outside the skill package, inside a run-scoped directory:** the skill must be installable and reusable across projects (DATAX, dotax, franquix) without per-project setup — nothing project-specific should be written into `~/.claude/skills/qa-agent/`.

## Architectural Patterns

### Pattern 1: Dual-mode discovery (explore-code vs parse-NL)

**What:** The Discovery component has two entry paths that converge on the same output shape (a JSON list of "testable surfaces": route, component, form fields, API endpoint + method). Path A statically scans the target repo (Next.js `app/`/`pages/` routers, API route handlers, Supabase migration files for field constraints). Path B takes a user's natural-language flow description ("probá el alta de cliente") and scopes a targeted search (grep for matching route/component names) instead of a full repo scan.
**When to use:** Path A when the user invokes the skill with no specific flow (broad/exploratory or smoke-test mode). Path B when the user names a specific flow — this is both cheaper (bounded search) and more accurate (uses the user's own vocabulary for the flow).
**Trade-offs:** Path A is thorough but expensive in tokens/time for large repos — must be scoped (e.g., only routes matching changed files, or capped to top-N recently modified routes) or it becomes a bottleneck. Path B is fast but depends on the user naming things consistently with the codebase.

### Pattern 2: Accessibility-snapshot-first browser perception

**What:** Instead of relying on screenshots for the LLM to interpret, Playwright MCP returns a text accessibility-tree snapshot where every interactive element has a stable reference (e.g., `e5` for a textbox). The agent reads structured element references, not pixels.
**When to use:** Always as the default execution mode for UI test cases — navigating, filling forms, clicking. Fall back to screenshots only for failure evidence (attach to the report) or when visual regression matters.
**Trade-offs:** Far more token-efficient and reliable than vision-based screenshot interpretation; less useful for pure visual/layout bugs (spacing, overlap, color) — those still need an occasional real screenshot pass.

```
Agent → MCP tool call: browser_snapshot()
MCP server → Playwright → accessibility tree → structured text (e5: textbox "Email")
Agent → MCP tool call: browser_fill(ref="e5", value="test@x.com")
```

### Pattern 3: Orchestrator + specialized executor subagents, shared result schema

**What:** A single orchestrator (the Skill's main flow) never calls Playwright MCP or the API client directly for every test case — it dispatches a batch of test cases to a `qa-executor-ui` subagent and a `qa-executor-api` subagent, each of which executes its list and returns a condensed structured summary. Both subagents write to the *same* `results.json` schema (`id, type, status, duration_ms, evidence, error`) so the Reporting component doesn't need to know which executor produced a given result.
**When to use:** Any run with more than a handful of test cases, or whenever UI and API testing need to happen for the same flow (e.g., "create client" — API call to validate the endpoint directly, plus a UI run through the form).
**Trade-offs:** Subagent isolation costs a bit of orchestration overhead (context handoff, spawning) but prevents the main thread from drowning in tool-call noise across dozens of test cases — the documented reason Claude Code subagents exist.

### Pattern 4: Test Reviewer pass before/after execution

**What:** A dedicated `qa-reviewer` subagent critiques the generated `test-plan.md` (coverage gaps, missing negative cases, weak assertions) before execution, and/or critiques `results.json` interpretation before the final report is written (distinguishing real defects from flaky/environmental noise).
**When to use:** Worth adding once the core discovery → generate → execute → report loop works end-to-end; case studies on multi-agent E2E generation found a dedicated reviewer subagent produced materially higher-quality tests than folding the same review criteria into the generator's prompt.
**Trade-offs:** Adds a full extra reasoning pass (cost/time); best introduced after the core loop is validated, not in the first build.

## Data Flow

### Request Flow (single QA run)

```
[User invokes skill: NL flow OR bare "test this app"]
    ↓
[Orchestrator] → decide discovery mode → [Discovery/Explorer subagent]
    ↓ (JSON: testable surfaces — routes, forms, endpoints, schema constraints)
[Orchestrator / Planner] → generate documented test cases (happy/edge/negative)
    ↓ (test-plan.md — structured cases tagged type=ui|api)
[Orchestrator] → split by type, dispatch in parallel or sequence
    ├─→ [UI Executor subagent] → Playwright MCP → target app (localhost/staging)
    │       ↓ (per-case: pass/fail, accessibility snapshot diff, screenshot on failure)
    └─→ [API Executor subagent] → api-client.mjs → target app HTTP endpoints
            ↓ (per-case: pass/fail, status code, response body, assertion detail)
    ↓ (both write to results.json, shared schema)
[Reporting] → read test-plan.md + results.json → REPORT.md
    ↓
[User] ← REPORT.md summary surfaced in chat + file path
```

### Key Data Flows

1. **Discovery → Generation:** structured JSON (never prose) describing testable surfaces — route path, form field list with inferred type/required-ness, API endpoint + method + expected auth. This is the contract that lets test-case generation be domain-agnostic (works the same on DATAX, dotax, franquix).
2. **Generation → Execution:** `test-plan.md` with one row per case: id, flow, type (`ui`/`api`), steps or request spec, expected result. Both executors consume the same document, filtered by `type`.
3. **Execution → Reporting:** `results.json`, one entry per case, identical schema regardless of executor — this decoupling is what lets Reporting stay simple and executor-agnostic.
4. **Schema (Supabase) → Generation:** migration-derived constraints (NOT NULL, CHECK, unique, FK, RLS policy hints) feed directly into edge/negative case generation (e.g., "email UNIQUE constraint" → generate a duplicate-email negative case). This is read-only reconnaissance against migration files, never a live DB query, to avoid side effects on real data.

## Scaling Considerations

There are no "users" in the traditional sense — the relevant scale axis is **run size** (number of flows/test cases per invocation) and **frequency** (manual today, possibly scheduled later, per PROJECT.md's stated out-of-scope-for-v1 CI trigger).

| Scale | Architecture Adjustments |
|-------|---------------------------|
| Single flow, <10 cases (typical v1 usage: "test the client signup form") | Everything can run in the orchestrator's main thread; subagent dispatch is optional overhead |
| Multiple flows / smoke-test mode, 10s of cases | Subagent dispatch (UI/API executors) becomes necessary to avoid context bloat; batch cases per subagent call rather than one dispatch per case |
| Full regression sweep across many pages + endpoints (future) | Needs a run manifest with resumability (checkpoint `results.json` incrementally so a crashed run can resume), parallel Playwright browser contexts, and a test-data cleanup strategy so repeated runs don't pollute the real Supabase DB with leftover test records |

### Scaling Priorities

1. **First bottleneck: context window bloat from tool-call noise.** A single flow with 15 UI steps and several API calls, executed directly in the orchestrator, will consume most of the working context on raw tool output. Fix: subagent isolation (Pattern 3) as soon as case counts grow past a handful.
2. **Second bottleneck: test-data pollution on staging/local Supabase.** Repeated runs that create real records (e.g., "create client" flow) without cleanup will corrupt the target environment over time. Fix: require generated test cases involving mutations to use clearly-tagged/disposable data (e.g., `qa-test-*` naming) and, where feasible, a teardown step — this should be an explicit requirement in the test-case-generation checklist, not an afterthought.

## Anti-Patterns

### Anti-Pattern 1: Screenshot-only perception for every action

**What people do:** Have the agent take a screenshot and visually reason about every click/fill action.
**Why it's wrong:** Token-heavy, slower, and less reliable than structured accessibility data — this is explicitly why Playwright MCP defaults to accessibility-tree snapshots instead of screenshots.
**Do this instead:** Use accessibility snapshots for navigation/interaction; reserve screenshots for failure evidence attached to the report.

### Anti-Pattern 2: One monolithic agent doing discovery + generation + execution + reporting in a single context

**What people do:** Write a single giant SKILL.md/prompt that tries to explore the codebase, write test cases, drive the browser, call APIs, and format a report all in one continuous context.
**Why it's wrong:** Burns the context window on intermediate tool noise, makes failures hard to isolate (which stage broke?), and mirrors the exact problem Claude Code subagents exist to solve.
**Do this instead:** Decompose into Discovery / (optional Planner) / UI Executor / API Executor / Reporting, each with a narrow, structured input/output contract (Pattern 3).

### Anti-Pattern 3: LLM eyeballing raw HTTP/curl output to decide pass/fail

**What people do:** Have the agent run `curl` and freehand-read the response text to judge correctness.
**Why it's wrong:** Non-deterministic, inconsistent across runs, and wastes reasoning budget on parsing rather than judgment.
**Do this instead:** A small deterministic script (`api-client.mjs`) sends the request and returns a structured pass/fail + diff against expected status/shape; the LLM only reasons about *what* to test and *why* something failed, not about JSON parsing.

### Anti-Pattern 4: Coupling the skill to one target project's exact structure

**What people do:** Hardcode paths like `app/api/` or specific component names during development against one repo (e.g., dotax) and ship that as "generic."
**Why it's wrong:** PROJECT.md explicitly requires the skill to work unmodified across DATAX, dotax, franquix, and future projects — hardcoding breaks that.
**Do this instead:** Discovery scripts detect conventions (App Router vs Pages Router, presence of `supabase/migrations/`) rather than assuming one layout; fall back gracefully (ask the user, or widen the NL-scoped search) when conventions aren't detected.

### Anti-Pattern 5: Generating versioned test suite code as the primary output

**What people do:** Have the agent emit `.spec.ts` Playwright files or pytest files as the deliverable of every run.
**Why it's wrong:** PROJECT.md explicitly scopes v1 to reports and documented test cases, not committed test code — treating code generation as the goal adds scope, review burden, and staleness risk (generated suites rot if not maintained) that v1 doesn't need.
**Do this instead:** Keep execution agent-driven and ephemeral per run; the durable output is `REPORT.md` and `test-plan.md`, not source files in the target repo.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|----------------------|-------|
| Playwright MCP (`@playwright/mcp`) | MCP server, stdio transport, registered in Claude Code MCP config; agent calls tools like `browser_navigate`, `browser_snapshot`, `browser_fill`, `browser_click` | Official Microsoft server; works with any MCP-capable client including Claude Code. Needs headless/headed toggle for local debugging and a way to persist auth state (`storageState`) across a session so login doesn't need to be repeated per test case |
| Target app (localhost) | Direct HTTP for API tests; browser navigation for UI tests, pointed at `http://localhost:<port>` | Port must be discoverable/configurable (not assumed) since each project may run on a different port |
| Target app (staging URL) | Same as localhost but with a configurable base URL and possibly different auth requirements | Must not assume localhost-only; PROJECT.md explicitly requires dual access support |
| Target repo source (read-only) | Filesystem read for discovery scripts (routes, API handlers, Supabase migration SQL) | Read-only — never write into the target repo except the isolated `.qa-agent/runs/` scratch directory; never query the live Supabase DB directly for schema (use migration files) to avoid side effects |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|----------------|-------|
| Orchestrator ↔ Discovery/Explorer subagent | Task dispatch in, structured JSON (testable surfaces) out | Discovery subagent should never leak raw file contents back to the orchestrator — only the extracted, structured findings |
| Orchestrator ↔ Test-Case Generation | In-context reasoning (often no subagent needed) consuming discovery JSON + checklist reference files, producing `test-plan.md` | Keep this step in the orchestrator's own context if case volume is low; promote to a subagent only if generation reasoning is heavy (e.g., cross-referencing large schema files) |
| Orchestrator ↔ UI/API Executor subagents | Batched test-case list in, structured `results.json` entries out | Executors must not summarize/interpret failures — that's the Reporting/Reviewer's job; executors only report what happened |
| Executors ↔ Playwright MCP / api-client.mjs | MCP tool calls / Bash tool script invocation | This is the only place actual browser or HTTP I/O happens |
| Orchestrator/Reporting ↔ Artifact directory | Filesystem read/write | Single source of truth for a run's state; enables resumability and post-hoc inspection without re-running |

## Sources

- [Playwright and Playwright MCP: A Field Guide for Agentic Browser Automation (Medium)](https://medium.com/@adnanmasood/playwright-and-playwright-mcp-a-field-guide-for-agentic-browser-automation-f11b9daa3627)
- [6 most popular Playwright MCP servers for AI testing in 2026 (Bug0)](https://bug0.com/blog/playwright-mcp-servers-ai-testing)
- [How to Use Playwright MCP Server with Claude Code (Builder.io)](https://www.builder.io/blog/playwright-mcp-server-claude-code)
- [Extend Claude with skills (Claude Code Docs)](https://code.claude.com/docs/en/skills)
- [Agent Skills — Claude Platform Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview)
- [Steering Claude Code: when to use CLAUDE.md, skills, hooks, and subagents (Anthropic)](https://claude.com/blog/steering-claude-code-skills-hooks-rules-subagents-and-more)
- [Browser-Use: Open-Source AI Agent For Web Automation (Labellerr)](https://www.labellerr.com/blog/browser-use-agent/)
- [How to Give an LLM Agent a Browser (Towards Data Science)](https://towardsdatascience.com/giving-an-llm-agent-a-browser/)
- [Beyond the hype: Building a multi-agent system for E2E test generation (Metropolis)](https://www.metropolis.io/blog/beyond-the-hype-building-a-multi-agent-system-for-e2e-test-generation)
- [Agentic QA Architecture: Reasoning Loops, Self-Healing DOM & Autonomous Testing (TestQuality)](https://testquality.com/agentic-qa-architecture-autonomous-testing-2026/)
- [LogiAgent: LLM Logical API Testing (Emergent Mind)](https://www.emergentmind.com/topics/logiagent)
- [Test Amplification for REST APIs via Single and Multi-Agent LLM Systems (arXiv)](https://arxiv.org/html/2504.08113)

---
*Architecture research for: AI QA testing agent packaged as a Claude Code Skill*
*Researched: 2026-08-10*
