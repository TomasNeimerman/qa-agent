# Phase 1: Foundation, Guardrails & API Testing - Research

**Researched:** 2026-08-10
**Domain:** Claude Code Agent Skill packaging + Playwright `APIRequestContext`-based HTTP testing + destructive-action confirmation gating + evidence-backed Markdown reporting
**Confidence:** MEDIUM (SKILL.md frontmatter table and Playwright API confirmed via official docs; confirmation-flow and report-convention claims are cross-checked web aggregates, not single-sourced against a first-party spec for "pause mid-skill for confirmation" since no such spec exists yet)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Destructive Action Detection**
- **D-01:** Destructive-action detection is based primarily on HTTP method — `DELETE` always requires confirmation; `POST`/`PUT`/`PATCH` require confirmation unless the endpoint is clearly read-only (e.g., a search/filter POST). No pre-configured allowlist/denylist is needed per project.
- **D-02:** No absolute blacklist — every destructive action can be executed if the user explicitly confirms it in the moment. There is no action that is permanently blocked at the code/config level in v1.

**Confirmation Mechanism**
- **D-03:** When a destructive action is detected, the agent pauses execution at that exact point, shows the user what it's about to do (method, URL, body), and waits for an explicit yes/no before proceeding — no pre-run approval list.
- **D-04:** If the user declines a confirmation, the agent skips only that specific case, marks it in the report as "blocked by user," and continues running the rest of the test cases in the same session.

**API Test Case Source (Phase 1 scope)**
- **D-05:** Phase 1 has no automated discovery yet (that's Phase 3). The user tells the agent what to test via natural language, one or more endpoints per request (e.g., "probá GET /api/clients y POST /api/clients" or "testeá el CRUD de facturas"). No requirement to supply an OpenAPI spec or Postman collection in v1 — natural language is the only input method for Phase 1.
- **D-06:** Authentication against the target API uses a test-user token/API key supplied via environment variable, sent in the `Authorization` header on each request. Never hardcoded in the skill. Session-based auth via browser login doesn't exist until Phase 2 (API-03 in REQUIREMENTS.md) — Phase 1 only supports token-based auth.

**Reporting**
- **D-07:** The report is delivered two ways: a summary shown in the chat, and a full Markdown file with evidence written to a local folder inside the tested project's repo (e.g. `qa-reports/`). — **Reversibility:** costly — the report file location becomes a convention the team will expect; changing it later means updating any tooling/gitignore rules built around it.
- **D-08:** Each test case in the report includes the full request (method, URL, body) and the full response (status, body, relevant headers) — not just a status code and short message. Applies to both pass and fail cases.

### Claude's Discretion
- Exact report filename/timestamp convention inside `qa-reports/` is left to the implementer.
- Whether `qa-reports/` needs a default `.gitignore` entry (to avoid committing test evidence to the tested project's repo) is left to the implementer's judgment — lean toward gitignoring by default since these are ephemeral run artifacts, not team-reviewed docs.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Items explicitly out of scope for Phase 1 (browser auth reuse for API calls, code-aware discovery, OpenAPI/Postman spec ingestion) are already tracked in ROADMAP.md as later-phase requirements (API-03 → Phase 2; DISC-01/02/03 → Phase 3) and REQUIREMENTS.md's "Out of Scope" section — not new deferrals from this discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKG-01 | Agent packaged as an installable Claude Code skill (`~/.claude/skills/`), invocable via slash command | SKILL.md frontmatter schema (Standard Stack, Architecture Patterns §1) confirms directory-name-as-command-name convention and zero-config invocation — no per-project setup needed to satisfy "runs with no prior project-specific setup" |
| SAFE-01 | Agent never executes a destructive action without explicit in-the-moment confirmation | Confirmation Mechanism research (Architecture Patterns §3, Pitfalls §3) — native `AskUserQuestion`/permission-prompt pause plus optional `PreToolUse` hook backstop |
| SAFE-02 | Report distinguishes executed vs. blocked-pending-confirmation actions | Report Structure research (Code Examples, Pitfalls §1/§4) — three-state result schema (`passed`/`failed`/`blocked`) |
| SAFE-03 | Every pass/fail verdict is backed by captured evidence (HTTP request/response) | Evidence-backed reporting pattern (Pitfalls §1) — results.json schema requires evidence field, no verdict without it |
| API-01 | Direct HTTP requests (GET/POST/PUT/DELETE) against target endpoints, no browser needed | Playwright `APIRequestContext` (Standard Stack, Code Examples) |
| API-02 | Validates status codes, response shape/errors | zod `safeParse` pattern for response contract validation (Standard Stack, Code Examples) |
| EXEC-04 | Targets localhost or staging via a base-URL parameter | SKILL.md `arguments`/`$ARGUMENTS` substitution (Architecture Patterns §1) feeding `request.newContext({ baseURL })` |
| REP-01 | Readable report: what was tested, pass/fail, why, evidence per case | Report Structure (Code Examples, Common Pitfalls §1) |
| REP-02 | Reproduction steps attached to each failing case | Report Structure (Code Examples) |
</phase_requirements>

## Summary

This phase has no existing codebase to extend — it is the first artifact of a brand-new Claude Code Agent Skill. The concrete mechanics fall into two well-documented layers and one under-documented layer. **Well-documented:** the `SKILL.md` frontmatter schema is fully specified by Anthropic's official Claude Code docs (verified this session), and Playwright's `APIRequestContext` is a mature, fully-documented HTTP client purpose-built for exactly this "no browser, just requests" use case. **Under-documented:** there is no first-party spec for "an agent skill pauses mid-task to ask for destructive-action confirmation" — this pattern has to be assembled from three primitives that *do* exist and are each independently documented: (1) Claude Code's native `AskUserQuestion` tool and tool-permission-approval flow, both of which already pause an interactive session and wait for the user, requiring no custom harness since this runs inside the normal Claude Code CLI (not the Agent SDK, which is a different, program-embedded product); (2) an optional `PreToolUse` hook (skill-scoped, via the `hooks` frontmatter field) as a deterministic backstop that cannot be bypassed even under `--dangerously-skip-permissions`; and (3) the skill's own prompted instructions telling Claude *when* to invoke that pause (the method-based classification logic from D-01).

The architecture should keep the HTTP call itself and the destructive-action classification as a small, deterministic Node script (invoked via the Bash tool) — not something the LLM free-hands by reading raw `curl` output — while the *judgment call* of "is this POST actually read-only" and the *decision* to proceed after confirmation stay in the orchestrator's own reasoning, per the project's Architecture research (Anti-Pattern 3: "LLM eyeballing raw HTTP output to decide pass/fail"). Evidence capture (full request + response) must be written to `results.json` before any verdict is asserted, directly addressing this project's own Pitfall 1 (hallucinated success).

**Primary recommendation:** Ship a `qa-agent` skill with `SKILL.md` (frontmatter: `name`, `description`, `argument-hint: [base-url] [instruction]`, `arguments: [baseUrl]`) that delegates all HTTP I/O to a bundled `scripts/api-client.mjs` built on Playwright's `request.newContext({ baseURL, extraHTTPHeaders: { Authorization } })`, classifies destructive calls by HTTP method before dispatch, and pauses via Claude's native confirmation flow (backed by a `PreToolUse` hook for hard enforcement) before any DELETE or non-read-only mutating call — writing every request/response pair to `qa-reports/<timestamp>-<summary>.md` plus a same-run `results.json` that the report is generated from, never the other way around.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Skill invocation & parameter parsing (base URL, NL instruction) | Orchestrator (SKILL.md + Claude reasoning) | — | `arguments`/`$ARGUMENTS` substitution is a Claude Code skill primitive; no code needed to parse this |
| HTTP request execution (GET/POST/PUT/DELETE) | Deterministic Script Layer (`scripts/api-client.mjs`, Playwright `APIRequestContext`) | — | Must be deterministic, not LLM-eyeballed `curl` text (project Anti-Pattern 3) |
| Destructive-method classification (DELETE always / POST-PUT-PATCH unless read-only) | Deterministic Script Layer (mechanical method check) | Orchestrator (judgment call on "clearly read-only") | The DELETE-always rule is pure code; "is this POST actually a search/filter" requires LLM judgment per D-01 — split responsibility explicitly so the code layer can't be talked out of flagging a DELETE |
| Confirmation pause & user prompt | Orchestrator (native `AskUserQuestion` / permission prompt) | Deterministic backstop (`PreToolUse` hook) | The hook is the hard technical stop (survives `--dangerously-skip-permissions`); the orchestrator's prompted behavior is what actually shows method/URL/body and asks |
| Response validation (status code, shape) | Deterministic Script Layer (zod `safeParse` in `api-client.mjs`) | — | Must be reproducible/structured, not narrated (project Anti-Pattern 3) |
| Evidence capture (raw request/response) | Deterministic Script Layer (writes to `results.json`) | — | Evidence must be captured at the moment of the call, not reconstructed later by the LLM (project Pitfall 1) |
| Report generation (Markdown, chat summary) | Deterministic Script Layer (`scripts/format-report.mjs` reads `results.json`) | Orchestrator (adds narrative framing in chat) | Formatter script guarantees every verdict quotes its evidence; orchestrator's chat summary is a thin restatement, not a re-derivation |
| Auth token handling | Deterministic Script Layer (`process.env.<VAR>` read inside the script) | — | Token must never enter the LLM's own context/prompt (project Pitfall 4) |
| Report file delivery (`qa-reports/` in target repo) | Filesystem (target project's working directory) | — | Per D-07, written inside the *target* project's repo, not the skill package |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **Claude Code Agent Skills** (`SKILL.md`) | Current Claude Code skill spec (2026) [CITED: code.claude.com/docs/en/skills] | Packaging/invocation mechanism | Only supported way to ship an installable, slash-command-invocable capability inside Claude Code (PKG-01) — confirmed this session against the live docs, not training memory |
| **Node.js** | 22.14.0 confirmed installed locally [VERIFIED: `node --version` this session] | Runtime for all skill scripts | Matches project-level STACK.md; Playwright 1.62.x requires Node 22/24/26 |
| **playwright** (npm) | 1.62.1 [VERIFIED: npm registry, `npm view playwright version`] | `APIRequestContext` — the HTTP client for API-01/API-02 | Purpose-built for exactly this "send GET/POST/PUT/DELETE, assert status/shape, no browser" use case [CITED: playwright.dev/docs/api-testing]; avoids introducing a second HTTP client alongside the browser engine Phase 2 will add |
| **zod** | 4.4.3 [VERIFIED: npm registry, `npm view zod version`] | Response-shape/contract validation (API-02) | `safeParse` gives structured pass/fail without throwing — fits an agent that must keep running after one case fails, rather than crash the script [CITED: zod.dev/api] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **dotenv** | 17.4.2 [VERIFIED: npm registry] | Optionally load a target project's local `.env`/`.env.local` for the auth token when it isn't already exported in the shell that launched Claude Code | Claude Code inherits env vars from its launching shell — if the user's test-user token lives only in the target repo's `.env.local` (common for Next.js projects) rather than a shell export, `api-client.mjs` needs its own loader. Load explicitly by path relative to the target project root the user points at; never assume a `.env` exists. |
| **vitest** | 4.1.10 [VERIFIED: npm registry] | Unit tests for `api-client.mjs`'s destructive-method classifier and `format-report.mjs`'s report formatter | Dev-only; needed to satisfy the Validation Architecture section below, since this phase ships real logic (classification, evidence assembly) that must be regression-tested independent of any live target API |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright `APIRequestContext` | Node global `fetch` | Simpler for one-off calls, but loses `APIRequestContext`'s built-in cookie/header context reuse and the direct code-sharing path with Phase 2's browser `storageState()`; project STACK.md already recommends `APIRequestContext` as the standard for this reason |
| `PreToolUse` hook as confirmation backstop | Rely solely on the skill's prompted instructions to pause | Prompted-only confirmation is exactly what project Pitfall 3 warns against ("hoping the LLM behaves") — a hook is the only mechanism confirmed to survive `--dangerously-skip-permissions` [CITED: code.claude.com/docs/en/hooks] |
| zod for response validation | Manual `if (typeof body.x !== 'string')` checks | zod's `safeParse` centralizes the check and yields a structured error object for the report, instead of ad hoc conditionals scattered through the script |

**Installation:**
```bash
npm init -y
npm install playwright zod dotenv
npm install -D vitest
npx playwright install --with-deps chromium   # only if Phase 2 groundwork is desired; not required for Phase 1's API-only scope
```

**Version verification:** All four core/supporting package versions above were confirmed live via `npm view <pkg> version` in this session (not carried over from project-level STACK.md without re-checking) — see Package Legitimacy Audit below for registry signals.

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|--------------|-------------|---------|-------------|
| zod | npm | 2026-05-04 | 254,388,559 | github.com/colinhacks/zod | OK | Approved |
| playwright | npm | 2026-07-30 | 80,091,572 | github.com/microsoft/playwright | SUS (`too-new`) | Flagged — see note |
| @playwright/test | npm | 2026-07-30 | 52,792,524 | github.com/microsoft/playwright | SUS (`too-new`) | Flagged — see note (not actually installed; `playwright` alone is sufficient for `APIRequestContext`, see Common Pitfalls) |
| dotenv | npm | 2026-04-12 | 166,343,119 | github.com/motdotla/dotenv | OK | Approved |
| vitest | npm | 2026-07-06 | 89,744,366 | github.com/vitest-dev/vitest | OK | Approved |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `playwright`, `@playwright/test` — both flagged by the legitimacy gate purely on a `too-new` publish-date signal (Microsoft ships frequent point releases). Downloads (80M+/wk) and the verified `github.com/microsoft/playwright` source repo are inconsistent with a slopsquat/hallucination pattern. **The planner must still insert a `checkpoint:human-verify` task before `npm install playwright` per protocol**, even though this researcher assesses the flag as a false positive from release cadence, not package identity.

## Architecture Patterns

### System Architecture Diagram

```
[User] --/qa-agent <base-url> "probá GET /api/clients y POST /api/clients"-->
    │
    ▼
[Orchestrator: SKILL.md loaded, Claude reasoning]
    │  parses $ARGUMENTS -> base URL + NL instruction
    │  reads env var name convention from SKILL.md body (e.g. QA_AGENT_TOKEN)
    ▼
[Per test case loop]
    │
    ├─(1) classify: is this call destructive? (DELETE always / POST-PUT-PATCH judgment)
    │       │
    │       ├─ NO  ─────────────────────────────────────────┐
    │       │                                                │
    │       └─ YES ─▶ [Confirmation gate]                    │
    │                  Orchestrator shows method/URL/body     │
    │                  AskUserQuestion / permission prompt    │
    │                  (PreToolUse hook = hard backstop)      │
    │                       │                                 │
    │              ┌────────┴────────┐                        │
    │           declined           confirmed                  │
    │              │                  │                        │
    │              ▼                  ▼                        │
    │      [mark "blocked by         │                        │
    │       user" in results.json]   │                        │
    │              │                  │                        │
    │              │                  ▼◀───────────────────────┘
    │              │        [scripts/api-client.mjs]
    │              │          Playwright APIRequestContext
    │              │          .get/.post/.put/.delete(url, {headers, data})
    │              │          Authorization header from process.env.<TOKEN_VAR>
    │              │              │
    │              │              ▼
    │              │        [Target app: localhost or staging]
    │              │              │
    │              │              ▼
    │              │        response.status(), response.json()
    │              │        zod schema.safeParse(body) -> {success, data|error}
    │              │              │
    │              │              ▼
    │              │        write {request, response, verdict, evidence} to results.json
    │              │              │
    └──────────────┴──────────────▶
                                   │
                                   ▼
                    [scripts/format-report.mjs]
                    reads results.json -> writes
                    qa-reports/<timestamp>-<summary>.md
                    (target project's repo, gitignored by default)
                                   │
                                   ▼
                    [Orchestrator: chat summary + file path surfaced to user]
```

### Recommended Project Structure

```
qa-agent/                              # ~/.claude/skills/qa-agent/
├── SKILL.md                           # frontmatter + orchestration instructions
├── references/
│   ├── destructive-classification.md  # method-based rule + "clearly read-only" judgment examples
│   └── report-template.md             # exact Markdown structure format-report.mjs must produce
├── scripts/
│   ├── api-client.mjs                 # Playwright APIRequestContext wrapper: send + assert + record evidence
│   └── format-report.mjs              # results.json -> qa-reports/<ts>-<summary>.md
└── package.json                       # playwright, zod, dotenv deps + vitest devDep
```

Per-run artifacts, written into the **target** project being tested (never into the skill package):

```
<target-project>/
├── qa-reports/
│   ├── .gitignore                     # "*" — ephemeral run artifacts, per CONTEXT.md discretion note
│   ├── 2026-08-10-1432-client-crud.md # human-readable report (D-07, D-08)
│   └── 2026-08-10-1432-client-crud.results.json  # structured evidence backing the .md report
```

### Pattern 1: SKILL.md parameter passing via `arguments`/`$ARGUMENTS`

**What:** The base URL and the natural-language test instruction are not "special" skill parameters — they are just the trailing text after `/qa-agent`, made available to the skill body via the `$ARGUMENTS` placeholder (whole string) or `$ARGUMENTS[0]`/`$0` etc. for positional access, or a named `arguments:` frontmatter list for `$baseUrl`-style substitution.
**When to use:** Always, for this skill's invocation — `argument-hint: [base-url] [instruction]` in frontmatter drives autocomplete; the body uses `$0` (or `$baseUrl` if declared in `arguments:`) for the URL and the remainder as the NL instruction.
**Example:**
```yaml
# Source: code.claude.com/docs/en/skills (Frontmatter reference, fetched this session)
---
name: qa-agent
description: Run an evidence-backed API test against a local or staging target. Use when asked to test/probar endpoints, run QA, or validate an API.
argument-hint: [base-url] [instruction]
arguments: [baseUrl]
disable-model-invocation: true
---

Target base URL: $baseUrl
Instruction: $ARGUMENTS
```
Invoked as `/qa-agent http://localhost:3000 "probá GET /api/clients y POST /api/clients"` — `$baseUrl` expands to `http://localhost:3000`, `$ARGUMENTS` expands to the full trailing text (including the URL, since `$ARGUMENTS` is the whole string unless explicitly excluded — plan to instruct the skill body to treat `$0`/`$baseUrl` as the URL and `$ARGUMENTS[1:]`-equivalent text as the instruction, since zod-style slicing isn't native to the substitution syntax and must be handled by prompting Claude to parse it that way).

### Pattern 2: Deterministic HTTP + evidence capture, never LLM-narrated

**What:** `api-client.mjs` is a plain Node script (invoked via the Bash tool, e.g. `node scripts/api-client.mjs --method DELETE --url /api/clients/42`) that performs the actual `APIRequestContext` call, checks `response.ok()`/`status()`, runs the zod schema, and prints a single structured JSON object to stdout — which both becomes the tool-call's visible output (for the orchestrator to read) and gets appended to `results.json`.
**When to use:** For every single HTTP call the skill makes — never have the orchestrator read a raw `curl` transcript and reason about pass/fail itself (project Anti-Pattern 3).
**Example:**
```javascript
// Source: playwright.dev/docs/api-testing, playwright.dev/docs/api/class-apirequestcontext (fetched this session)
import { request } from 'playwright';
import { z } from 'zod';

const context = await request.newContext({
  baseURL: process.env.QA_AGENT_BASE_URL,
  extraHTTPHeaders: {
    Authorization: `Bearer ${process.env.QA_AGENT_TOKEN}`,
  },
});

const response = await context.get('/api/clients');
const rawBody = await response.text();
let parsedBody;
try { parsedBody = JSON.parse(rawBody); } catch { parsedBody = rawBody; }

// Response-shape validation is a hint, not an authoritative oracle in Phase 1
// (no OpenAPI spec exists yet — see Common Pitfalls below)
const ShapeHint = z.unknown();
const shapeCheck = ShapeHint.safeParse(parsedBody);

const evidence = {
  request: { method: 'GET', url: '/api/clients', headers: { Authorization: '[REDACTED]' } },
  response: { status: response.status(), ok: response.ok(), body: parsedBody },
  verdict: response.ok() ? 'passed' : 'failed',
};

console.log(JSON.stringify(evidence));
await context.dispose();
```
Note the `Authorization: '[REDACTED]'` in the evidence written to the report — the raw token must never be echoed into `results.json`/the Markdown report, only used in the actual outbound header (see Common Pitfalls).

### Pattern 3: Confirmation gate — native pause + hook backstop

**What:** Two layers, per the Architectural Responsibility Map. Layer 1 (always present): the orchestrator's own prompted behavior — before calling `api-client.mjs` with a destructive method, it states the method/URL/body in chat and calls `AskUserQuestion` (or simply asks and waits for the next user message, both of which are native pause points in an interactive Claude Code session [CITED: code.claude.com/docs/en/agent-sdk/user-input]). Layer 2 (recommended hardening): a `PreToolUse` hook scoped to the skill's `hooks` frontmatter field that inspects the Bash command about to run `api-client.mjs --method DELETE|POST|PUT|PATCH` and returns `permissionDecision: "ask"`, which escalates to Claude Code's standard permission dialog and — per the hooks doc — **cannot be bypassed even under `--dangerously-skip-permissions`** [CITED: code.claude.com/docs/en/hooks].
**When to use:** Layer 1 for every destructive call, always. Layer 2 is the technical enforcement the project's own Pitfalls research (Pitfall 3) explicitly asks for ("verify there's a real technical block/confirmation gate ... not hoping the LLM behaves") — recommended for this phase rather than deferred, since retrofitting a guardrail after the agent has broad access is called out as materially riskier.
**Example:**
```yaml
# Source: code.claude.com/docs/en/hooks (fetched this session) — pattern, not a verbatim
# doc example; skill-scoped hooks confirmed to exist in the frontmatter table above.
---
name: qa-agent
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          if: "Bash(*api-client.mjs*--method*DELETE*)"
          command: "${CLAUDE_SKILL_DIR}/scripts/confirm-destructive.sh"
---
```
`confirm-destructive.sh` (or `.mjs`) reads the pending tool input, and if the method is DELETE (or a non-read-only POST/PUT/PATCH per D-01), emits `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"Destructive API call — requires confirmation"}}`.

### Pattern 4: Report generation from structured data, never from memory

**What:** `format-report.mjs` reads the run's `results.json` (never the conversation transcript) and emits the Markdown report — every PASS/FAIL/BLOCKED line quotes the evidence object next to the verdict, per D-08 and project Pitfall 1's explicit recommendation ("quote the evidence next to each claim").
**When to use:** As the final step of every run, after all cases (including confirmed and blocked ones) have been recorded to `results.json`.
**Example:** see Code Examples section below for the report template.

### Anti-Patterns to Avoid

- **Auto-confirming destructive dialogs to keep the run moving:** Never build a "yes to all" convenience mode for destructive confirmations — project Pitfall 3 and the Technical Debt table both call this out as "never acceptable," and it directly contradicts D-03/D-04.
- **Reading raw HTTP/curl output and reasoning about pass/fail in the orchestrator's own context:** Always route through `api-client.mjs`'s structured JSON output (project Anti-Pattern 3).
- **Treating a zod schema written from a single observed response as an authoritative contract:** With no OpenAPI/Postman spec in Phase 1 scope (D-05), a schema inferred from one example response is a shape *hint*, not ground truth — label it as such in the report rather than implying deep validation (ties to project Pitfall 2, the oracle problem).
- **Writing the auth token into `results.json`, the Markdown report, or the skill's own prompt context:** Redact it in evidence output; only the script process (not the LLM) ever sees the plaintext value (project Pitfall 4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sending HTTP requests with header/context reuse | A custom `http`/`https` wrapper | Playwright `APIRequestContext` | Already handles headers, redirects, response parsing, and (later, Phase 2) `storageState()` interop with the browser context — reinventing this adds surface area for no benefit |
| Runtime response-shape checking | Hand-written `typeof`/`Array.isArray` chains | zod `safeParse` | Centralizes validation, yields a structured error object the report can quote directly, and scales cleanly if Phase 3+ later needs stricter contracts |
| Pausing an interactive Claude Code session for user input | A custom stdin-read loop inside a Bash script | Claude Code's native `AskUserQuestion` tool / permission-approval flow | This pause-and-wait behavior is already a first-class part of the interactive CLI product — building a parallel mechanism inside a Bash script would only work for that one script invocation and wouldn't survive the orchestrator's own reasoning between calls |

**Key insight:** Everything in this phase that looks like "we need custom infrastructure" (an HTTP client, a confirmation UI, a schema validator) already has a first-party or de facto standard tool inside the Claude Code + Node ecosystem. The actual custom work is glue: the destructive-method classification rule, the `results.json` schema, and the report template — all small, deterministic, and testable.

## Common Pitfalls

### Pitfall 1: Token leaks into the LLM's own context via evidence capture
**What goes wrong:** `api-client.mjs` writes the full request object (including the `Authorization` header with the real bearer token) into `results.json`, which then gets read back into the orchestrator's context when it summarizes the run, or gets committed if `qa-reports/.gitignore` is missing.
**Why it happens:** The natural implementation writes "the full request" verbatim per D-08 — but D-08 means method/URL/body, not literally every header value.
**How to avoid:** Redact `Authorization` (and any other credential-bearing header) to `[REDACTED]` in every evidence object before it's written to `results.json` or the Markdown report. The actual header is only ever constructed inside the script process from `process.env`, immediately before the request — never logged, never returned to the orchestrator.
**Warning signs:** Grep `results.json`/`.md` report output for `Bearer ` or the literal env var value during implementation review.

### Pitfall 2: `too-new` false-positive on `playwright` masking a real slopsquat check elsewhere
**What goes wrong:** The package-legitimacy gate flags `playwright` itself as `SUS` purely because Microsoft ships frequent releases — if the planner or a future contributor gets used to seeing `playwright` show up as `SUS` and stops reading the reason field, an actually-malicious similarly-named package (`playwrite`, `play-wright`) could later slip past review under the same "eh, always flagged" assumption.
**Why it happens:** The legitimacy heuristic conflates "recently published version" with "recently created package" — a fast-moving, well-established package trips the same signal as a brand-new one.
**How to avoid:** The `checkpoint:human-verify` task the planner inserts for `playwright` should explicitly confirm the package name (`playwright`, not a typosquat) and the repo URL (`github.com/microsoft/playwright`), not just rubber-stamp past the warning.
**Warning signs:** A "SUS" verdict is not itself evidence of anything — always read the `reasons` array before deciding disposition.

### Pitfall 3: Env var convention undefined across three different target projects (DATAX, dotax, franquix)
**What goes wrong:** D-06 says "a test-user token/API key supplied via environment variable" but doesn't fix the variable's name. If the skill hardcodes one name (e.g. `QA_AGENT_TOKEN`) and a target project's convention differs, or the token needs to be per-project (different test accounts per app), the skill silently sends no `Authorization` header or an empty one, producing misleading 401s that look like "the API test failed" rather than "the agent wasn't configured."
**Why it happens:** PKG-01 requires zero project-specific setup, which is in tension with "the agent needs to know which env var holds the token for *this* project."
**How to avoid:** Pick one fixed, documented convention (e.g. `QA_AGENT_TOKEN` and optionally `QA_AGENT_BASE_URL`) that the skill always reads, and — critically — **fail loudly** at the start of the run if it's unset, rather than proceeding with a missing/empty Authorization header and reporting downstream 401s as generic test failures (this is exactly the "Silent failure when target environment isn't reachable or auth fails" UX pitfall flagged in project PITFALLS.md). Document the convention in the skill's own `SKILL.md` body so it's discoverable per-project without code changes.
**Warning signs:** A test run reports every single case as failed with 401/403 — that should trigger a distinct "auth not configured" message, not 10 generic FAIL rows.

### Pitfall 4: zod schema-from-one-example treated as ground truth
**What goes wrong:** Since Phase 1 has no OpenAPI/Postman ingestion (D-05), any zod schema used to validate a response shape is necessarily inferred by the LLM from a single observed response (or from the user's own description). If the report presents a `safeParse` pass as "contract validated," the team may over-trust it — this is the project's own documented oracle problem (PITFALLS.md Pitfall 2) surfacing inside Phase 1's narrower API-only scope.
**Why it happens:** `safeParse` succeeding looks authoritative even when the schema itself was guessed.
**How to avoid:** In Phase 1, default to *loose* validation (status code + "is it valid JSON" + any specific fields the user explicitly named in their NL instruction) rather than the agent inventing a strict schema unprompted. Label any inferred-shape check in the report as "shape observed" rather than "contract validated."
**Warning signs:** A generated schema rejects a response for a field the user never mentioned caring about.

## Code Examples

### Report template (satisfies D-07, D-08, REP-01, REP-02, SAFE-02, SAFE-03)

```markdown
<!-- Source: synthesized from project ARCHITECTURE.md (results.json contract) +
     Pitfalls research (evidence-quoted-next-to-verdict pattern) + aggregated
     QA report conventions (TestRail/QA Wolf, websearch, MEDIUM-confidence) -->

# QA Report — client-crud — 2026-08-10 14:32

**Target:** http://localhost:3000
**Instruction:** "probá GET /api/clients y POST /api/clients"
**Summary:** 3 passed · 1 failed · 1 blocked (pending confirmation)

## Case 1 — GET /api/clients — PASSED

**Request:**
- Method: `GET`
- URL: `/api/clients`
- Headers: `Authorization: [REDACTED]`

**Response:**
- Status: `200`
- Body: `{"clients": [...], "total": 12}`

**Verdict:** PASSED — status 200, response is valid JSON with expected `clients` array.

---

## Case 3 — DELETE /api/clients/42 — BLOCKED (pending confirmation)

**Request:**
- Method: `DELETE`
- URL: `/api/clients/42`

**Status:** Destructive action detected (DELETE). User declined confirmation — case skipped, no request was sent.

---

## Case 2 — POST /api/clients — FAILED

**Request:**
- Method: `POST`
- URL: `/api/clients`
- Body: `{"name": "", "email": "test@example.com"}`

**Response:**
- Status: `500`
- Body: `{"error": "Internal Server Error"}`

**Verdict:** FAILED — expected a 400 validation error for empty `name`, got a 500.

**Reproduction steps:**
1. `POST http://localhost:3000/api/clients` with header `Authorization: Bearer <test-token>`
2. Body: `{"name": "", "email": "test@example.com"}`
3. Observe response status `500` instead of an expected `400`.
```

### `api-client.mjs` — destructive-method classifier (unit-testable, mechanical layer of D-01)

```javascript
// Source: derived from D-01 (locked decision) — this is the mechanical half only;
// the "clearly read-only" judgment call stays with the orchestrator's prompting.
export function requiresConfirmation(method, { looksReadOnly = false } = {}) {
  const m = method.toUpperCase();
  if (m === 'DELETE') return true;
  if (['POST', 'PUT', 'PATCH'].includes(m)) return !looksReadOnly;
  return false; // GET, HEAD, OPTIONS never require confirmation
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Custom slash-commands via `.claude/commands/*.md` | Agent Skills (`SKILL.md`) with richer frontmatter (`arguments`, `hooks`, `context: fork`, etc.) | Ongoing through 2026 per Claude Code docs | `.claude/commands/` files still work identically but skills are now the recommended, more capable primitive — this phase should use skills, not the legacy commands format |
| Separate Postman/Newman or custom HTTP-testing CLI | Playwright `APIRequestContext` doubling as both the UI and API testing engine | Established practice as of Playwright 1.6x | One toolchain for Phase 1 (API) and Phase 2 (UI) — avoids the "two tools, two credential stores" pitfall flagged in project STACK.md |

**Deprecated/outdated:**
- Hand-rolled `fetch`-based HTTP wrapper scripts for agent tooling: superseded by `APIRequestContext`'s built-in header/redirect/cookie handling and its interop path with Phase 2's browser context.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact env var name (`QA_AGENT_TOKEN` / `QA_AGENT_BASE_URL`) is this researcher's proposed convention, not something confirmed with the user | Common Pitfalls §3, Code Examples | If the user/team has a different existing convention in mind, the skill's hardcoded var name won't match and every run will silently fail auth until corrected — planner should confirm this naming with the user or make it itself-discoverable (e.g., skill prompts for the var name on first run per project) |
| A2 | Skill-scoped `hooks:` frontmatter (`PreToolUse` inside `SKILL.md`) works as described, including the "survives `--dangerously-skip-permissions`" claim | Architecture Patterns §3 | This was WebFetch-summarized from the hooks doc page (LOW confidence, not independently cross-checked against a second source) — if the actual behavior differs (e.g., hook needs to live in project `.claude/settings.json` instead of skill frontmatter, or workspace-trust gating blocks it in practice), the "hard technical stop" claim would not hold and Layer 1 (prompted pause) becomes the only enforcement, which is weaker than D-03's guarantee implies |
| A3 | `$ARGUMENTS` does not automatically split "base URL" from "the rest of the instruction" — the skill body must instruct Claude to parse `$0`/`$baseUrl` vs. the remaining text itself | Architecture Patterns §1 | If assumed incorrect, the skill might mis-parse `/qa-agent http://localhost:3000 probá GET /api/clients` and treat the whole string as the base URL, or vice versa — low risk, easily caught in first manual test, but should be explicitly handled in the SKILL.md instructions rather than assumed to "just work" |
| A4 | Playwright's `SUS`/`too-new` flag on the `playwright` package itself is a heuristic false positive rather than a genuine legitimacy concern | Package Legitimacy Audit | Low risk — 80M+ weekly downloads and the verified `microsoft/playwright` repo strongly support this, but the planner must still gate the install behind `checkpoint:human-verify` per protocol regardless of this researcher's assessment |
| A5 | Loose ("shape observed", not "contract validated") zod validation is the right default for Phase 1 given no OpenAPI/Postman spec exists yet | Common Pitfalls §4 | If the user actually wants strict schema enforcement from day one (contradicting D-05's "no spec required"), loose validation under-delivers on API-02's "validates response shape" requirement — worth confirming with the user during plan review whether "validates shape" means strict or advisory in Phase 1 |

**If this table is empty:** N/A — see entries above; the planner and discuss-phase should treat A1 and A2 as the two items most worth a quick explicit confirmation before implementation, since they affect a locked decision (D-03/D-06) rather than pure implementation detail.

## Open Questions

1. **Exact env var name(s) for the test-user token and (optionally) base URL**
   - What we know: D-06 fixes the *mechanism* (env var → Authorization header), not the *name*.
   - What's unclear: whether the user already has a preferred naming convention across DATAX/dotax/franquix, or whether the skill should prompt for/document a fixed name (`QA_AGENT_TOKEN`) as part of PKG-01's "no prior setup" promise.
   - Recommendation: Planner picks one fixed name, documents it prominently in the skill's own instructions/README, and makes the "env var not set" failure mode loud and specific per Pitfall 3 above.

2. **Whether the `PreToolUse` hook backstop (Pattern 3, Layer 2) ships in Phase 1 or is deferred**
   - What we know: The project's own Pitfalls research explicitly recommends a real technical block, not just prompted behavior, and recommends addressing this in the foundation phase specifically because retrofitting later is riskier.
   - What's unclear: Implementation complexity/reliability of skill-scoped hooks was only WebFetch-summarized this session (A2 above), not independently verified against a second source or hands-on tested.
   - Recommendation: Planner should scope Layer 1 (prompted pause via native `AskUserQuestion`/permission flow) as the Phase 1 baseline (satisfies D-03 literally), and treat Layer 2 (hook backstop) as a stretch/hardening task within the same phase if time allows — not deferred to a later phase, since SAFE-01 is this phase's core requirement.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All skill scripts | ✓ | 22.14.0 [VERIFIED this session] | — |
| npm | Package installation | ✓ | bundled with Node 22 | — |
| playwright (npm package) | API-01/API-02 | ✓ (registry) | 1.62.1 [VERIFIED this session] | — |
| Claude Code CLI | Skill hosting/invocation (PKG-01) | Assumed ✓ (this research session runs inside it) | current | — |
| A running target app (localhost or staging) | Manual per-run, not a phase-time dependency | N/A — supplied by user at invocation time | — | Skill must fail loudly with a clear "target unreachable" message rather than reporting false failures, per project PITFALLS.md integration-gotchas table |

**Missing dependencies with no fallback:** none identified.
**Missing dependencies with fallback:** target-app reachability is inherently per-run, not a setup-time concern — handled via a pre-flight health check the skill/script should perform before running any test case (fail fast, don't report false negatives).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 [VERIFIED: npm registry, `npm view vitest version`] |
| Config file | none yet — Wave 0 |
| Quick run command | `npx vitest run scripts/*.test.mjs` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAFE-01 | `requiresConfirmation()` returns true for DELETE always, and for POST/PUT/PATCH unless `looksReadOnly` | unit | `npx vitest run scripts/api-client.test.mjs -t "requiresConfirmation"` | ❌ Wave 0 |
| SAFE-02 | `results.json` entries carry a `blocked` status distinct from `passed`/`failed` when confirmation is declined | unit | `npx vitest run scripts/api-client.test.mjs -t "blocked status"` | ❌ Wave 0 |
| SAFE-03 | `format-report.mjs` refuses to emit a verdict row with no `evidence` field (throws/skips) | unit | `npx vitest run scripts/format-report.test.mjs -t "requires evidence"` | ❌ Wave 0 |
| API-01 | `api-client.mjs` correctly issues GET/POST/PUT/DELETE against a local mock HTTP server | integration | `npx vitest run scripts/api-client.integration.test.mjs` | ❌ Wave 0 |
| API-02 | zod `safeParse` failure is captured as a structured validation error, not a thrown exception | unit | `npx vitest run scripts/api-client.test.mjs -t "schema validation"` | ❌ Wave 0 |
| EXEC-04 | `api-client.mjs` respects a configurable `baseURL` (localhost vs. arbitrary staging host) | unit | `npx vitest run scripts/api-client.test.mjs -t "baseURL"` | ❌ Wave 0 |
| REP-01, REP-02 | `format-report.mjs` produces Markdown with a summary line and, for failed cases, a numbered reproduction-steps block | unit | `npx vitest run scripts/format-report.test.mjs -t "report structure"` | ❌ Wave 0 |
| PKG-01 | Skill installs and invokes with zero project-specific setup | manual/UAT only | — (requires installing into a fresh unrelated project and running `/qa-agent`) | — |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed-test-file>`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus one manual end-to-end run against a real local target (PKG-01 and the confirmation-pause UX cannot be fully captured by unit tests alone).

### Wave 0 Gaps
- [ ] `package.json` + `vitest` devDependency — none exists yet, this is a from-scratch project
- [ ] `scripts/api-client.test.mjs` — covers SAFE-01, SAFE-02, API-02, EXEC-04
- [ ] `scripts/api-client.integration.test.mjs` — covers API-01 (needs a tiny local mock server, e.g. Node's built-in `http.createServer`, not a new dependency)
- [ ] `scripts/format-report.test.mjs` — covers SAFE-03, REP-01, REP-02
- [ ] `vitest.config.mjs` — minimal config, no framework install beyond the `vitest` devDependency above

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Yes (as a *consumer* of credentials, not an implementer) | Bearer token read from `process.env.<VAR>` only, injected at the script layer, never present in the LLM's own context/prompt or in written evidence (redacted) |
| V3 Session Management | No | Phase 1 is stateless per-call token auth; no session/cookie management exists until Phase 2 (API-03) |
| V4 Access Control | Partially — application-level safety, not classic access control | The destructive-action confirmation gate (D-01–D-04) is this phase's analog: no mutating call proceeds without an explicit, in-the-moment authorization step |
| V5 Input Validation | Yes | zod `safeParse` on response bodies (API-02); base-URL parameter should be treated as untrusted input for SSRF-style reasoning (see Threat Patterns below) |
| V6 Cryptography | No | This phase performs no cryptographic operations itself; TLS is handled by the underlying HTTP client/target server, not custom code |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Credential leakage via LLM context/transcript or committed report files | Information Disclosure | Redact `Authorization` header value in all evidence written to `results.json`/Markdown; keep the real token only inside the script process's `process.env`; gitignore `qa-reports/` by default per CONTEXT.md discretion note |
| SSRF-adjacent misuse — agent sends arbitrary HTTP requests to a user-supplied base URL | Tampering / Elevation of Privilege | Out of scope to fully mitigate in Phase 1 (this is inherently what an API-testing tool must do), but the skill should refuse to run against an obviously-production-looking domain without an explicit override, per project PITFALLS.md Pitfall 3 ("Default target must never be production") — recommend a simple denylist heuristic (e.g., domains containing `prod`, or a documented allowlist of localhost/staging patterns) as a Phase 1 nice-to-have, escalate to explicit confirmation if uncertain rather than silently refusing or silently proceeding |
| Uncontrolled destructive mutation against shared/staging data | Tampering | The entire confirmation-gate mechanism (D-01–D-04, Architecture Pattern 3) is the mitigation; this is the phase's primary security control, not a side concern |
| Report/evidence tampering or fabrication (agent claims success without evidence) | Repudiation | `results.json` is the single source of truth for the report generator; verdicts without an attached evidence object must be rejected by `format-report.mjs` (SAFE-03) |

## Sources

### Primary (HIGH confidence)
- `npm view playwright version` / `npm view zod version` / `npm view dotenv version` / `npm view vitest version` — live registry checks, this session
- `gsd-tools query package-legitimacy check` — live registry signal checks, this session

### Secondary (MEDIUM confidence)
- [Extend Claude with skills — Claude Code Docs](https://code.claude.com/docs/en/skills) — full frontmatter reference table fetched and read directly this session (WebFetch)
- [Claude Code Skills best practices web aggregate](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) and related — progressive disclosure conventions, cross-checked across multiple sources
- [Handle approvals and user input — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/user-input) — `AskUserQuestion`/`canUseTool` mechanics fetched directly this session (note: this doc is written for the Agent SDK; the underlying pause/prompt behavior is consistent with how the interactive Claude Code CLI itself already works, but this specific page describes the SDK's `canUseTool` callback, which is the SDK's exposed hook into that same native behavior, not a separate mechanism the skill itself must implement)
- zod `z.unknown()`/`.safeParse()`/`.passthrough()` patterns — cross-checked across zod.dev/api and multiple guide sites

### Tertiary (LOW confidence)
- [PreToolUse hook mechanics, skill-scoped `hooks` frontmatter, `--dangerously-skip-permissions` interaction — Claude Code Docs](https://code.claude.com/docs/en/hooks) — WebFetch-summarized this session, not independently cross-checked against a second source; see Assumption A2
- [Playwright API testing guide aggregate](https://playwright.dev/docs/api-testing) — WebFetch summary of the official page plus WebSearch aggregate on shared-vs-isolated context usage
- Markdown QA report convention aggregate (TestRail, QA Wolf, VirtuosoQA blog posts via WebSearch) — general industry convention, not a single authoritative spec

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified live against npm registry this session; SKILL.md frontmatter fetched directly from official docs
- Architecture: MEDIUM — component split (deterministic script vs. LLM orchestrator) is directly supported by this project's own ARCHITECTURE.md and PITFALLS.md; the specific confirmation-gate hook mechanics (Pattern 3, Layer 2) are LOW confidence pending a second source
- Pitfalls: MEDIUM — mostly derived from this project's own well-sourced PITFALLS.md, applied to Phase 1's specific scope; the env-var-naming and zod-oracle pitfalls are this researcher's own reasoning, not independently sourced

**Research date:** 2026-08-10
**Valid until:** 2026-09-09 (30 days — Claude Code skill frontmatter and Playwright APIs are both actively evolving; re-verify frontmatter fields and `PreToolUse` hook behavior if planning is delayed past this window)
