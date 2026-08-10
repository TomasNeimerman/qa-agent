# Stack Research

**Domain:** AI-powered QA testing agent, packaged as a Claude Code Skill/subagent (web UI testing + API testing + test-case generation)
**Researched:** 2026-08-10
**Confidence:** MEDIUM

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **@playwright/mcp** (Microsoft, official) | 0.0.79+ (verified against npm registry) | Gives Claude real-browser control (navigate, click, fill forms, assert) as an MCP server | First-party Microsoft MCP server, already the de facto standard for LLM browser control in Claude Code/Desktop, Cursor, VS Code, Windsurf, Gemini CLI. Drives the browser via **accessibility-tree snapshots** instead of screenshots — cheaper in tokens, no vision model needed, and far less flaky than pixel/vision-based agents. This is the single most important dependency for the "drive a real browser" requirement. |
| **Claude Code Agent Skills** (SKILL.md format) | Current Claude Code skills spec (2026) | Packaging mechanism: `.claude/skills/qa-agent/SKILL.md` + supporting files, installable per-project or user-wide | Matches the explicit constraint "must run as a skill/subagent inside Claude Code, not a standalone app." Skills are near-free in context (~100 tokens until invoked) and are the mechanism the team already uses to distribute reusable workflows internally. |
| **Node.js** | 22 LTS or newer (22.x / 24.x / 26.x) | Runtime for the MCP server and any helper scripts the skill ships | Playwright 1.62.x (the engine `@playwright/mcp` is built on) only supports Node 22/24/26; Playwright's own Docker images moved off Node 20 to Node 24 LTS. Anything older risks silent incompatibility as Playwright drops support. |
| **Playwright** (core library, npm `playwright`) | 1.62.1 (verified against npm registry) | Underlying engine behind `@playwright/mcp`; also usable directly for **API testing** via `APIRequestContext` if the skill ships small helper scripts instead of relying purely on MCP tool calls | One toolchain covers both UI and API testing needs (browser automation + `request.get/post/put/delete`, GraphQL support, `storageState()` to share auth between API and browser contexts). Avoids introducing a second HTTP client/toolchain just for API testing. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **zod** | 4.4.3 (verified against npm registry) | Runtime schema validation + TS type inference for API contract checks | When the agent needs to assert an endpoint's actual JSON response matches an expected/documented shape (contract drift detection) rather than just eyeballing status codes. Define the expected schema once, get both validation and typing. |
| **Chrome DevTools MCP** (Google, official) | Latest (optional, complementary) | Console errors, network inspection, performance traces during a UI test run | Add only when a UI test fails and the agent needs to explain *why* (console error, failed network call, slow render) — Playwright MCP is the driver, Chrome DevTools MCP is the diagnostic add-on. Not required for v1's core loop. |
| **Node global `fetch`** | Built into Node 22+ | Lightweight direct HTTP calls for pure API-only test cases | Use instead of spinning up a full Playwright `APIRequestContext` when a test case is a simple one-off request/response check and doesn't need shared storage state with a browser session — keeps token/tool overhead minimal. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `.mcp.json` (project or user scope) | Registers `@playwright/mcp` (and optionally Chrome DevTools MCP) as available MCP servers for Claude Code | Ship a recommended `.mcp.json` snippet inside the skill's docs so every team member gets identical setup with one copy-paste — this is the "distributable to team, no infra" mechanism. |
| `npx @playwright/mcp@latest` | Zero-install verification / ad-hoc invocation | Useful for confirming the MCP server works before wiring it into `.mcp.json`; also how Playwright docs recommend running it. |
| TypeScript + `tsx` (dev-only) | Type-checked helper scripts (contract validators, report templating) if the skill ships any | Only needed if the skill includes small standalone scripts beyond markdown instructions — keep this minimal; most of the "logic" should live in the SKILL.md prompt/workflow, not in code, per the skill philosophy. |

## Installation

```bash
# Verify/install the official Playwright MCP server (Microsoft)
npx @playwright/mcp@latest --version

# Recommended .mcp.json entry (ship this in the skill's setup docs):
# {
#   "mcpServers": {
#     "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"] }
#   }
# }

# If the skill ships any helper scripts (contract validation, report templates)
npm install zod

# Dev dependencies (only if shipping TS helper scripts)
npm install -D typescript tsx @types/node
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Playwright MCP (accessibility-snapshot driven, Claude does the reasoning) | **browser-use** (Python, agent-first: LLM decides actions internally) | Only if you wanted a standalone, non-Claude-Code browser agent (e.g. embedded in a separate Python service). For a Claude Code skill, Claude is already the planning/reasoning agent — browser-use would duplicate that reasoning loop in a second LLM-in-the-loop process and add a Python runtime dependency the project doesn't otherwise need. |
| Playwright MCP | **Stagehand** (Browserbase, CDP-based, natural-language + code hybrid, now has a REST API usable from Claude Code) | Consider if the team later wants a *standalone* natural-language browser automation SDK outside the MCP ecosystem (e.g. for a future non-Claude integration). Inside Claude Code, it's a redundant extra runtime next to the first-party Microsoft MCP server. |
| Playwright MCP | **Chrome DevTools MCP** (Google, debugging/performance focused, more tools but Chrome-only) | Add *alongside* Playwright MCP (not instead of) when a test failure needs root-causing via console/network/performance data. Don't use it as the primary driver — it's built for debugging, not for asserting flows across browsers. |
| Playwright `APIRequestContext` / native `fetch` | **Postman/Newman**, **RestAssured**, or a standalone HTTP client library | Only if the team already has Postman collections they want to reuse. Otherwise adds a second tool/process to manage credentials and environments for, which conflicts with the "no extra infra" constraint. |
| zod for contract validation | **OpenAPI/Swagger spec validation tools** (e.g. `openapi-validator`) | Use if/when the target apps (DATAX, dotax) ship formal OpenAPI specs to validate against. Today they don't, so a spec-driven validator has nothing authoritative to check against — zod schemas the agent infers from code/docs are the pragmatic fallback. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| **Selenium WebDriver** | Legacy tooling: no native accessibility-snapshot interface for LLMs, more flaky element location, slower setup, weaker auto-waiting than Playwright. Not what modern AI-agent browser control is built on in 2025/2026. | Playwright MCP |
| **browser-use or other Python agent-loop libraries as the primary driver** | Introduces a second LLM decision loop and a Python runtime the rest of this Node/TS-oriented, Next.js-centric team doesn't otherwise need — adds cost, latency, and a dependency surface for no functional gain when Claude Code is already the orchestrating agent. | Playwright MCP, orchestrated directly by Claude via the skill's instructions |
| **Vision/screenshot-based UI assertion as the default mechanism** | Slower, more expensive (extra vision model calls), and more error-prone than reading the accessibility tree. Screenshots should be a fallback (e.g. canvas/chart content), not the default. | Accessibility-tree snapshots via Playwright MCP; use screenshots only for genuinely visual-only elements |
| **Standalone Postman/Newman collections or a separate API-testing CLI** | Requires managing a second tool, its own credential storage, and its own execution step outside Claude Code — conflicts with the "runs as a skill, no extra infra" constraint. | Playwright `APIRequestContext` or native `fetch` + zod, invoked inline by the skill |
| **Generating/committing Playwright or pytest test files into the target repo** | Explicitly out of scope for v1 per PROJECT.md — v1 delivers reports and documented test cases only, not versioned test suites. | Markdown/structured test-case documents and a human-readable report as the skill's output artifacts |
| **A custom standalone MCP server built from scratch for browser control** | Reinventing what Microsoft already ships and actively maintains; higher maintenance burden for zero functional gain. | `@playwright/mcp` (official) |

## Stack Patterns by Variant

**If the target app requires authentication (most DATAX/dotax flows will):**
- Have the agent perform the login flow once via Playwright MCP and reuse the resulting browser/storage state for the rest of the session, or accept a pre-authenticated `storageState` file/session cookie the user supplies for staging environments.
- Because `APIRequestContext.storageState()` can share auth between API and browser contexts, the same authenticated session can back both UI and API test cases in one run.

**If a test case is API-only (no UI involved):**
- Skip the Playwright MCP browser tools entirely and use direct `fetch` (or Playwright's `APIRequestContext` if the case needs shared storage state) plus a zod schema for contract checking — this keeps token usage and tool-call overhead down for cases that don't need a browser at all.

**If running against localhost vs. a staging URL:**
- No special-casing needed at the tooling level — both are just a base URL parameter passed into the skill/workflow. Document in the skill that the user supplies `--target=http://localhost:3000` or `--target=https://staging.example.com` and everything downstream (Playwright MCP navigation, API calls) is agnostic to which.

**If test-case generation needs to explore code (not just accept natural-language instructions):**
- No dedicated library is needed here — this is Claude's own reasoning over the repo using its existing Read/Grep/Glob tools, guided by explicit instructions in SKILL.md (e.g. "look for Zod/Next.js API route handlers, form components, and Supabase RLS policies to infer edge/negative cases"). Treat this as a prompting/workflow-design problem, not a tooling problem — resist the urge to add a "test generation library" dependency.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@playwright/mcp@0.0.79` | `playwright@1.62.1` (bundled/matching engine) | The MCP server tracks the core Playwright engine closely; pin or `@latest` both together to avoid protocol/snapshot-format drift. |
| `playwright@1.62.1` | Node.js `22.x`, `24.x`, `26.x` | Confirmed via Playwright's own docs/release notes; do not target Node < 22 for anything in this stack. |
| `zod@4.4.3` | TypeScript 5.x | Standard peer expectation for current zod; not a hard blocker but worth aligning if helper scripts are added. |

## Sources

- [@playwright/mcp — npm](https://www.npmjs.com/package/@playwright/mcp) — version/description verified live against npm registry (0.0.79), confidence: MEDIUM
- [microsoft/playwright-mcp — GitHub](https://github.com/microsoft/playwright-mcp) — official repo, capabilities and client compatibility, confidence: MEDIUM
- [Playwright MCP | Playwright](https://playwright.dev/mcp/introduction) — official docs framing, confidence: MEDIUM
- [playwright — npm registry](https://registry.npmjs.org/playwright/latest) — version verified live (1.62.1), confidence: MEDIUM
- [zod — npm registry](https://registry.npmjs.org/zod/latest) — version verified live (4.4.3), confidence: MEDIUM
- Web search: "browser-use vs Playwright MCP" (webfuse.com, fp8.co, bytetunnels.com aggregate) — design-philosophy comparison, confidence: LOW (unverified web aggregate, cross-checked across multiple independent articles)
- Web search: "Chrome DevTools MCP vs Playwright MCP" (test-lab.ai, mcp.directory aggregate) — tool-count and focus comparison, confidence: LOW
- Web search: "Playwright APIRequestContext API testing" (playwright.dev-adjacent guides) — API testing capability confirmation, confidence: LOW (not fetched directly from playwright.dev due to no MCP/context7 access this run; recommend a follow-up direct fetch of https://playwright.dev/docs/api-testing before finalizing helper-script code)
- Web search: "Claude Code Agent Skills SKILL.md format" (code.claude.com, systemprompt.io aggregate) — skills/subagents/MCP distinction, confidence: LOW
- Web search: "Claude Agent SDK vs Claude Code subagents" (platform.claude.com/docs referenced) — confirms Claude Code (not the Agent SDK) is the correct target for a human-invoked skill, confidence: LOW
- Web search: "Node.js LTS 2026 Playwright compatibility" — Node 22/24/26 support window, confidence: LOW (cross-checked against direct npm registry version fetch, raising effective confidence to MEDIUM for the version number itself)
- Web search: "Stagehand Browserbase current status" (browserbase.com blog/changelog, github.com/browserbase/stagehand) — v3 status and REST API for Claude Code, confidence: LOW

---
*Stack research for: AI-powered QA testing agent (Claude Code skill)*
*Researched: 2026-08-10*
