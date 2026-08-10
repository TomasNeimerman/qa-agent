# Walking Skeleton — QA Agent

**Phase:** 1 (Foundation, Guardrails & API Testing)
**Generated:** 2026-08-10

> This project is a Claude Code Agent Skill — `SKILL.md` plus Node scripts — not a web application. The generic Walking Skeleton checklist (scaffold + routing + DB read/write + UI interaction + deployment) is adapted below to this project's real shape. There is no database and no browser UI in Phase 1; the equivalent layers are the slash-command entry point, the deterministic script tier, the evidence artifact, and the report delivered into the target project.

## Capability Proven End-to-End

A developer installs the skill, runs `/qa-agent http://localhost:3000 "probá GET /api/clients"` inside any of their projects, and gets back a chat summary plus a Markdown file under that project's `qa-reports/` whose single case quotes the real HTTP request and the real HTTP response behind its verdict.

That is the whole stack: invocation → argument parsing → credential resolution → real network I/O → evidence capture → structured results → rendered report → delivery. Every later slice in this phase and every later phase widens one of those layers without changing the shape.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Packaging / distribution | Claude Code Agent Skill: `SKILL.md` frontmatter + body, installed by copying or symlinking this repo to `~/.claude/skills/qa-agent/` | PROJECT.md constrains this to run inside Claude Code, not as a standalone app or service. Skills are the only supported way to ship a slash-command-invocable capability (PKG-01) |
| Invocation contract | `/qa-agent <base-url> "<natural-language instruction>"`, `argument-hint: [base-url] [instruction]`; the body instructs Claude to take the first whitespace-delimited token of `$ARGUMENTS` as the base URL and the remainder as the instruction | RESEARCH Assumption A3: positional argument substitution does not split these automatically, so the parsing is stated explicitly rather than assumed |
| Reasoning / execution split | The LLM orchestrator decides *what* to test and *whether a POST is read-only*; a deterministic Node script performs every HTTP call, every assertion and every evidence write | RESEARCH Architectural Responsibility Map, and the project's own Anti-Pattern 3 — an LLM eyeballing raw HTTP output to decide pass/fail is non-deterministic and burns reasoning budget on JSON parsing |
| HTTP client | Playwright `APIRequestContext` (`playwright@1.62.1`), not `fetch`, not `curl`, not `@playwright/test` | One toolchain covers Phase 1's API testing and Phase 2's browser engine, and `APIRequestContext.storageState()` is the documented interop path for Phase 2's API-03 session reuse. Installing the test runner is unnecessary for request contexts |
| Response validation | `zod@4.4.3` `safeParse`, deliberately loose: status code, JSON parseability, and only fields the developer explicitly named | No OpenAPI or Postman source exists in v1 (D-05), so a schema inferred from one observed response is a hint. Reported as `shape observed`, never as contract validation (D-10) |
| Auth | Test-user bearer token from `QA_AGENT_TOKEN`, read inside the script process only, injected into `extraHTTPHeaders`, redacted to `[REDACTED]` in every stored artifact | D-06 and D-09. The plaintext token must never enter the LLM's context, `results.json`, or the Markdown report |
| Environment targeting | Base URL from the first skill argument, falling back to `QA_AGENT_BASE_URL`; unset and unresolvable means a loud exit-2 configuration error, never an empty header | EXEC-04 and D-09. RESEARCH pitfall 3: a silent auth misconfiguration produces a run of misleading 401 "failures" |
| Destructive-action safety | Two layers — `api-client.mjs` exits 3 and sends nothing unless that exact invocation carries `--confirmed`; a `PreToolUse` hook escalates every destructive invocation to Claude Code's permission dialog | SAFE-01 and D-01 through D-04. The script-level refusal is the guarantee; the hook is the layer that survives `--dangerously-skip-permissions` |
| Run state | Plain files: `results.json` is the single source of truth, the Markdown report is derived from it, and the pair is written into the *target* project's `qa-reports/` | D-07. The system is stateless between invocations; there is no database and no server. The formatter reading only `results.json` is what makes an evidence-free verdict structurally unrenderable (SAFE-03) |
| Report location | `<target-project>/qa-reports/<YYYY-MM-DD-HHmm>-<slug>.md` plus a sibling `.results.json`, with a `.gitignore` containing `*` written on directory creation | D-07 (rated **costly** to reverse — the location becomes a team convention). Gitignoring by default is the CONTEXT.md discretion call: run evidence is ephemeral, not a reviewed document |
| Directory layout | `SKILL.md` at the package root; `scripts/*.mjs` for anything deterministic; `references/*.md` for long-form material loaded only when needed; per-run artifacts never inside the skill package | RESEARCH `### Recommended Project Structure` and the progressive-disclosure convention: the always-loaded orchestrator body stays short |
| Runtime | Node.js >= 22, ESM (`"type": "module"`) | Playwright 1.62.x supports Node 22/24/26 only; 22.14.0 verified installed |

## Stack Touched in Phase 1

Adapted from the generic checklist to this project's actual layers:

- [ ] **Package scaffold** — `package.json` with pinned `playwright`, `zod`, `dotenv` and dev `vitest`; `.gitignore`; `vitest` as the test runner (plan 01-01)
- [ ] **Entry point / "routing"** — `SKILL.md` frontmatter and body making `/qa-agent` invocable and parsing `<base-url>` + instruction (plan 01-01)
- [ ] **Real external I/O** — one genuine HTTP GET dispatched to a real running target via `APIRequestContext`, replacing the generic "one real DB read/write" (plan 01-01), widened to POST/PUT/PATCH/DELETE with bodies (plan 01-04)
- [ ] **Real persisted artifact** — `results.json` written at the moment of the call, and the derived Markdown report written into the target project (plan 01-01, extended in plan 01-03)
- [ ] **Real user interaction** — the confirmation pause: method, URL and body shown to the developer, yes/no awaited, decline recorded as `blocked` and the run continues (plan 01-02), replacing the generic "one UI interaction wired to the API"
- [ ] **"Deployment"** — installed at `~/.claude/skills/qa-agent/` and invoked from a real Claude Code session against a real running project, verified by the manual end-to-end checks in plans 01-01 and 01-04

## Out of Scope (Deferred to Later Slices)

Explicitly not in this skeleton, so later phases do not re-litigate Phase 1's minimalism:

- Any browser automation — no Chromium download, no `npx playwright install`, no accessibility snapshots (Phase 2: EXEC-01, EXEC-02)
- Login via a browser form and reuse of that session for API calls (Phase 2: EXEC-03, API-03)
- Reading the target project's code to infer what to test — routes, forms, validation schemas, database constraints (Phase 3: DISC-01, DISC-02, DISC-03)
- Generated test-case documents (`test-plan.md`), and systematic boundary / negative / permission edge-case generation (Phase 3 and Phase 4: DISC-02, DISC-04, DISC-05)
- A fast "smoke test" mode distinct from a full pass (Phase 5: REP-03)
- Verified portability across DATAX, dotax and franquix, and team distribution (Phase 5: PKG-02, PKG-03)
- OpenAPI or Postman ingestion, and any strict contract validation built on it (out of scope for v1 entirely per D-05 and D-10)
- Subagent decomposition of executors — Phase 1's case volume runs in the orchestrator's own context; RESEARCH scaling notes promote to subagents only once case counts grow
- Committed Playwright or pytest test files in the target repo (REQUIREMENTS.md "Out of Scope")

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering the decisions above. In particular, the `results.json` case contract, the redaction rule, the confirmation gate and the `qa-reports/` location are inherited unchanged.

- **Phase 2 — Browser Execution Engine:** a `qa-executor-ui` path drives Chromium through a natural-language flow and writes cases into the *same* `results.json` schema; browser auth via `storageState` is then reused by `APIRequestContext` for related API calls.
- **Phase 3 — Dual Discovery & Test-Case Generation:** discovery scripts emit structured testable surfaces, which become documented test cases feeding the Phase 1 and Phase 2 executors — the executors themselves do not change.
- **Phase 4 — Edge-Case & Input Validation Quality:** case generation widens to boundary, negative and permission scenarios grounded in Phase 3's discovered constraints; every generated destructive case still passes through this skeleton's confirmation gate.
- **Phase 5 — Smoke-Test Mode & Cross-Project Distribution:** a fast subset mode over the same loop, plus verified unmodified operation across DATAX, dotax and franquix and a copy-in install for teammates.
