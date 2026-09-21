# Phase 2: Browser Execution Engine - Research

**Researched:** 2026-08-12
**Domain:** Playwright MCP (Microsoft's official browser-control MCP server) integration into a Claude Code skill; Playwright `storageState` interop between an MCP-driven browser session and a standalone `APIRequestContext`; accessibility-tree-based autonomous login-form detection; UI destructive-action classification
**Confidence:** MEDIUM (Playwright MCP tool names and CLI flags cross-checked across two independent official-doc fetches this session; storageState/APIRequestContext interop confirmed via official `playwright.dev` docs; Claude Code MCP configuration scoping confirmed via a direct, full fetch of `code.claude.com/docs/en/mcp`; the credential-exposure architecture finding below is this researcher's own reasoning from confirmed MCP tool-call mechanics, not a single authoritative source — flagged accordingly)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Browser Tooling**
- **D-01:** Use Playwright MCP (Microsoft's official MCP server, accessibility-tree snapshots rather than screenshots) as the browser-control mechanism, per Phase 1 research's recommendation. — **Reversibility:** costly — switching away later means re-deriving element-interaction patterns across every UI task.
- **D-02:** A single Chromium context/browser for all UI testing in v1. Cross-browser (Firefox/WebKit) is out of scope, consistent with Phase 1 research and REQUIREMENTS.md's "Out of Scope" section.

**Login / Authentication**
- **D-03:** The agent navigates autonomously to the login page and identifies username/password fields via accessibility role/label (not hardcoded CSS selectors) — same "no per-project setup" philosophy as Phase 1's zero-config API testing.
- **D-04:** New environment variables `QA_AGENT_UI_USER` / `QA_AGENT_UI_PASSWORD` hold the test user's login credentials for browser-based auth — distinct from Phase 1's `QA_AGENT_TOKEN` (a bearer token is a different credential shape than a login form's username/password). Same "never hardcoded, fail loudly if unset" discipline as D-06/D-09 from Phase 1's CONTEXT.md.

**Destructive Actions in the UI**
- **D-05:** The same confirmation-gate philosophy from Phase 1 (SAFE-01–SAFE-04) extends to the browser: before clicking an element that looks destructive, the agent pauses and asks for explicit confirmation, exactly like the API's DELETE/mutating-method gate. No absolute blacklist — same "everything gated by in-the-moment confirmation" stance as Phase 1 D-02.
- **D-06:** Destructive UI elements are detected by their visible text / aria-label (keywords like "eliminar", "borrar", "cancelar", "confirmar pago", "dar de baja") — the UI-equivalent of Phase 1's HTTP-method-based classification, since there's no HTTP verb to inspect for a button click.

**UI→API Session Reuse**
- **D-07:** After a successful browser login, export Playwright's `storageState` (cookies/localStorage) and reuse it when constructing the `APIRequestContext` for any API-01/API-02 calls made later in the same run — avoids a second, separate login for API checks that happen after a UI flow. This directly satisfies API-03 from REQUIREMENTS.md.

### Claude's Discretion
- Exact Playwright MCP tool-call sequencing (which of `browser_navigate` / `browser_snapshot` / `browser_fill_form` / `browser_click` / `browser_type` to use, and in what order) is implementer discretion.
- Exact `storageState` file naming/location within a run's artifact directory is implementer discretion.
- The exact UI destructive-keyword list beyond the five examples given in D-06 is implementer discretion — same "no absolute list, tie-break toward asking" philosophy as Phase 1's `destructive-classification.md`.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Code-aware discovery of what flows/forms exist (Phase 3) and systematic edge-case generation for forms (Phase 4) were correctly not raised here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXEC-01 | Agent navigates a web app autonomously (single Chromium context via Playwright) and executes click/fill/submit actions | Standard Stack (Playwright MCP tool inventory), Architecture Patterns §1–2 (accessibility-snapshot-driven interaction loop) |
| EXEC-02 | Agent receives natural-language instructions and translates them into concrete navigation steps | Architecture Patterns §1 (orchestrator-owned NL→action translation, no dedicated library — mirrors Phase 1's D-05 case-construction pattern) |
| EXEC-03 | Agent authenticates using test credentials from environment variables, never hardcoded | Architecture Patterns §3 (login-form detection heuristic), Common Pitfalls §1 (the credential-exposure-to-LLM-context finding — this phase's most important, non-obvious risk) |
| API-03 | Agent reuses the UI-authenticated session for related API calls in the same run | Architecture Patterns §4 (`storageState` export/reuse mechanics), Code Examples (extending `api-client.mjs`'s `readConfig`/`runCase`) |
</phase_requirements>

## Summary

This phase adds one new external dependency (`@playwright/mcp`, the official Microsoft MCP server) and extends three existing Phase 1 modules (`api-client.mjs`, `destructive.mjs`/`confirm-destructive.mjs`, `SKILL.md`) rather than building new infrastructure from scratch. The mechanics are well-documented at the tool level — Playwright MCP's tool names (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_fill_form`, `browser_storage_state`, etc.) and CLI flags (`--isolated`, `--storage-state`, `--caps`) are confirmed via two independent official-doc fetches this session, and Playwright's own `storageState()`/`request.newContext({storageState})` interop between a `BrowserContext` and a standalone `APIRequestContext` is a first-party, documented feature (not something this project has to invent).

Two design questions are **not** resolved by tool documentation and require explicit choices during planning:

1. **Persistent vs. isolated MCP browser profile.** Playwright MCP's *default* "persistent" mode stores login state in a Chromium user-data directory keyed by workspace — this is **not** the same artifact as a Playwright `storageState.json` file, and is not directly loadable by `request.newContext({storageState})`. To produce the JSON file Phase 1's `api-client.mjs` needs for API-03, the skill must run the MCP server with `--isolated` (fresh session, no cross-run profile bleed across DATAX/dotax/franquix) and explicitly call the `browser_storage_state` tool (which requires the server's storage capability to be enabled) to dump cookies+localStorage to a path after login.
2. **Where the login step's credential value is constructed.** Every Playwright MCP interaction tool (`browser_type`, `browser_fill_form`) takes the value to type as a literal string argument in the tool call the *orchestrator* (Claude) issues — meaning the plaintext `QA_AGENT_UI_PASSWORD` value would pass through the model's own context/reasoning and appear in the tool-call transcript if the orchestrator drives the login form directly via MCP tools. This is architecturally different from — and weaker than — Phase 1's guarantee that the API token "never enters the LLM's own context" (`process.env` read only inside `api-client.mjs`). This is flagged as this phase's most important, non-obvious pitfall; see Common Pitfalls §1 and the recommended mitigation (a small deterministic login script, analogous to `api-client.mjs`, that performs the login with Playwright's own `page.getByRole()` locators and never routes the password through the LLM).

**Primary recommendation:** Register `@playwright/mcp` in the project's `.mcp.json` (project scope, `--isolated` mode, storage capability enabled) rather than embedding it in `SKILL.md` frontmatter (Agent Skills have no `mcpServers` field — only Claude Code *plugins* can bundle an MCP server). Perform the login step with a new deterministic script (`scripts/ui-login.mjs`, using Playwright's core library directly, not MCP tool calls) that reads `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` from `process.env`, locates the login form via `page.getByRole('textbox', {name: /.../})` heuristics, submits, and writes `storageState` to a run-scoped JSON path — keeping the plaintext credential inside the script process exactly like Phase 1's bearer token. The orchestrator then loads that `storageState` into the Playwright MCP session (via `--storage-state` at server start, or `browser_set_storage_state` if the server is already running) and drives the rest of the flow (the actual "probá el alta de cliente" steps) through ordinary MCP tool calls, extending `api-client.mjs`'s `readConfig`/`runCase` to accept an optional `--storage-state <path>` flag for API-03. Destructive UI clicks are gated by a new `scripts/ui-destructive.mjs` (mechanical keyword-match sibling to Phase 1's `destructive.mjs`) plus a `PreToolUse` hook matcher on `mcp__playwright__browser_click` (and `browser_fill_form`), mirroring Phase 1's two-layer confirmation-gate pattern exactly.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Browser session lifecycle (launch, navigate, close) | External Integration (Playwright MCP server process) | Orchestrator (issues navigate/close tool calls) | The MCP server owns the actual Chromium process; the orchestrator only issues tool calls against it — no code in this skill manages a browser process directly except the login script (see below) |
| Login credential handling (`QA_AGENT_UI_USER`/`PASSWORD`) | Deterministic Script Layer (`scripts/ui-login.mjs`, new) | — | Per Common Pitfalls §1: an MCP tool call routes its string arguments through the orchestrator's own context, so the credential must be read and used exclusively inside a script process (`process.env`), exactly like Phase 1's `QA_AGENT_TOKEN`, never as an MCP tool-call argument the LLM constructs |
| Login-form field identification (username vs. password) | Deterministic Script Layer (`ui-login.mjs`'s own `page.getByRole()` heuristics) | Orchestrator (for in-flow forms encountered *after* login, e.g. a "confirm password" reauth prompt mid-flow) | The login step itself is scripted (see above); any later, unplanned auth-adjacent form the agent meets mid-flow falls back to orchestrator judgment over an MCP `browser_snapshot`, same as any other form field |
| Flow navigation & form interaction (the actual "probá el alta de cliente" steps) | Orchestrator (Playwright MCP tool calls: `browser_navigate`, `browser_snapshot`, `browser_click`, `browser_fill_form`) | — | This is the core EXEC-01/EXEC-02 capability — NL→action translation is inherently an LLM reasoning task, not scriptable, per project ARCHITECTURE.md's Anti-Pattern 2 |
| Destructive-element classification (mechanical keyword check) | Deterministic Script Layer (`scripts/ui-destructive.mjs`, new) | Orchestrator (judgment call on ambiguous element text) | Mirrors Phase 1's `destructive.mjs` split exactly: a keyword hit is mechanical, "is this ambiguous label actually destructive" is judgment |
| Confirmation pause & user prompt (UI clicks) | Orchestrator (native `AskUserQuestion`) | Deterministic backstop (`PreToolUse` hook matching `mcp__playwright__browser_click`) | Same two-layer pattern as Phase 1 Pattern 3, retargeted at the MCP tool-name matcher syntax instead of a Bash command regex |
| `storageState` export (cookies/localStorage after login) | Deterministic Script Layer (`ui-login.mjs` writes the file) or MCP `browser_storage_state` tool (if login is driven interactively instead) | — | Whichever layer performs the login also owns exporting the resulting session state — see Architecture Patterns §4 for the two viable sequencing options |
| `storageState` reuse for API-03 calls | Deterministic Script Layer (extended `api-client.mjs`, `request.newContext({storageState, ...})`) | — | Consistent with Phase 1's Architectural Responsibility Map row for HTTP execution — must stay deterministic, not LLM-narrated |
| Evidence capture for UI steps (snapshot/screenshot on failure) | External Integration (Playwright MCP's own `browser_snapshot`/`browser_take_screenshot` output) | Orchestrator (decides *when* to capture, quotes it in the case record) | MCP tool output is already structured (accessibility tree text or an image); the orchestrator's job is only to attach it to the right case, not to re-derive it |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **@playwright/mcp** (Microsoft, official) | 0.0.79 [VERIFIED: `npm view @playwright/mcp version`, this session] | Browser-control MCP server — exposes `browser_navigate`/`browser_click`/`browser_snapshot`/etc. as MCP tools the orchestrator calls directly | Locked by D-01. First-party Microsoft package; 6.66M downloads/week [VERIFIED: `npm view` + npmjs.org download API, this session]; confirmed source repo `github.com/microsoft/playwright-mcp` |
| **playwright** (npm, already a project dependency from Phase 1) | 1.62.1 [VERIFIED: already installed, `package.json`] | Provides the Node-side `chromium`/`request` APIs used by the new `scripts/ui-login.mjs` (core-library login, not MCP) and the existing `api-client.mjs`'s `APIRequestContext` | Already in the project; no new dependency needed for the deterministic-login-script recommendation — `playwright` (not `@playwright/test`) already exposes `chromium.launch()`/`page.getByRole()` |

### Supporting

No new supporting libraries are needed. `zod` and `dotenv` (Phase 1 dependencies) are reused as-is — `dotenv` for loading `QA_AGENT_UI_USER`/`PASSWORD` from `.env.local`/`.env` exactly like Phase 1's token loading in `readConfig()`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright MCP driving the login form directly (orchestrator-issued `browser_type`/`browser_fill_form`) | A deterministic `scripts/ui-login.mjs` using Playwright's core `chromium.launch()` + `page.getByRole()` | The scripted approach keeps the plaintext credential out of the LLM's context (Common Pitfalls §1) at the cost of one extra script to maintain and a slightly less literal reading of D-01 ("Playwright MCP as the browser-control mechanism") for this one bounded sub-step — flagged in Assumptions Log for confirmation |
| `--isolated` MCP session + explicit `browser_storage_state` export | Default "persistent" MCP profile mode | Persistent mode's `--user-data-dir` is a full Chromium profile directory, not a `storageState.json` — it cannot be fed into `request.newContext({storageState})` for API-03, and it would also silently carry logged-in state between unrelated target-project runs (DATAX vs. dotax vs. franquix share one workspace-keyed profile by default), which is undesirable for a portable, per-project skill |
| `PreToolUse` hook matcher on `mcp__playwright__browser_click` | Relying only on the orchestrator's prompted classification | Same rationale as Phase 1 Pattern 3 — a hook is the only mechanism documented to survive `--dangerously-skip-permissions`; the prompted check alone is "hoping the LLM behaves" (project PITFALLS.md, "Looks Done But Isn't" checklist) |

**Installation:**
```bash
# Register the Playwright MCP server (project scope, checked into git via .mcp.json)
claude mcp add playwright --scope project -- npx @playwright/mcp@latest --isolated --caps=storage

# Download the Chromium binary Playwright MCP will drive (not yet present on this
# machine — verified this session, see Environment Availability)
npx playwright install chromium
```
`playwright` itself is already a `package.json` dependency from Phase 1 — no `npm install` needed for the core library used by `scripts/ui-login.mjs`.

**Version verification:** `@playwright/mcp` version confirmed live via `npm view @playwright/mcp version` this session (0.0.79). `playwright` (1.62.1) was already verified in Phase 1's research and is unchanged in this project's `package.json`.

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|--------------|-------------|---------|-------------|
| @playwright/mcp | npm | 2026-08-06 (this version) | 6,659,312 [VERIFIED: npmjs.org download API, this session] | github.com/microsoft/playwright-mcp | SUS (`too-new`) | Flagged — see note |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `@playwright/mcp` — flagged purely on the legitimacy gate's `too-new` publish-date heuristic (Microsoft ships frequent point releases, same false-positive pattern Phase 1's own audit documented for `playwright`/`@playwright/test`). 6.66M downloads/week and the verified `github.com/microsoft/playwright-mcp` source repo are inconsistent with a slopsquat/hallucination pattern. **The planner must still insert a `checkpoint:human-verify` task before `claude mcp add playwright`** per protocol, confirming the exact package name (`@playwright/mcp`, not a typosquat like `playwright-mcp` or `@playwright-mcp/server`) and the repo URL, not just rubber-stamp past the warning — same discipline as Phase 1's Pitfall 2.

## Architecture Patterns

### System Architecture Diagram

```
[User] --/qa-agent <base-url> "probá el alta de cliente"-->
    │
    ▼
[Orchestrator: SKILL.md loaded, Claude reasoning]
    │  parses instruction -> flow description + base URL
    │  reads QA_AGENT_UI_USER / QA_AGENT_UI_PASSWORD are configured (fail loudly if not)
    ▼
[Step 1: Deterministic login]                                    Credential never
    │  scripts/ui-login.mjs (Bash tool, own Playwright process)   leaves this script
    │    - launches a headless Chromium via `playwright`           process (mirrors
    │    - page.goto(baseUrl + "/login" or discovered login route) Phase 1's
    │    - locates fields via page.getByRole('textbox', {name})    QA_AGENT_TOKEN
    │    - reads QA_AGENT_UI_USER/PASSWORD from process.env         discipline)
    │    - submits, waits for a post-login navigation/state change
    │    - context.storageState({ path: <run-dir>/storage-state.json })
    │    - closes its own browser
    ▼
[Step 2: MCP session picks up the authenticated session]
    │  Playwright MCP server (already registered in .mcp.json,
    │  --isolated --caps=storage) is started/reused with
    │  --storage-state=<run-dir>/storage-state.json OR the
    │  orchestrator calls browser_set_storage_state with that path
    ▼
[Step 3: Per test-case loop — the actual UI flow]
    │
    ├─(1) browser_navigate -> target flow's starting URL
    ├─(2) browser_snapshot -> accessibility tree (structured text, refs e1..eN)
    ├─(3) orchestrator maps NL instruction to concrete actions using the
    │      snapshot's role/name pairs (EXEC-02) — never CSS selectors
    ├─(4) before each browser_click/browser_fill_form call:
    │       classify element text/aria-label via
    │       references/ui-destructive-classification.md (D-06)
    │       │
    │       ├─ NOT destructive ──────────────────────────────┐
    │       │                                                 │
    │       └─ destructive ─▶ [Confirmation gate]              │
    │                  Orchestrator shows element text/label    │
    │                  AskUserQuestion                          │
    │                  (PreToolUse hook on                      │
    │                   mcp__playwright__browser_click/         │
    │                   browser_fill_form = hard backstop)      │
    │                       │                                   │
    │              ┌────────┴────────┐                          │
    │           declined           confirmed                    │
    │              │                  │                          │
    │              ▼                  ▼◀─────────────────────────┘
    │      [mark "blocked by     browser_click / browser_fill_form
    │       user" in results]         │
    │              │                  ▼
    │              │           browser_snapshot (re-snapshot — refs
    │              │           are invalidated by the action)
    │              │                  │
    │              │                  ▼
    │              │           orchestrator judges outcome from the
    │              │           fresh snapshot; on failure, attaches
    │              │           browser_take_screenshot as evidence
    └──────────────┴──────────────────┴─▶
                                        │
                                        ▼
[Step 4: API-03 — reuse the same session for related API calls]
    │  node scripts/api-client.mjs --method POST --url /api/clients \
    │    --storage-state <run-dir>/storage-state.json \
    │    --base-url <base-url> ...
    │  request.newContext({ baseURL, storageState: <path>, ... })
    │  -> cookies from the UI login are sent automatically; no second
    │     login, no QA_AGENT_TOKEN required for this call
    ▼
[Reporting — unchanged from Phase 1: format-report.mjs reads results.json]
```

### Recommended Project Structure

```
qa-agent/
├── SKILL.md                           # extended: UI run protocol, .mcp.json setup instructions,
│                                       # QA_AGENT_UI_USER/PASSWORD docs, allowed-tools += mcp__playwright__*
├── .mcp.json                          # NEW — project-scoped Playwright MCP registration
├── references/
│   ├── destructive-classification.md  # existing (Phase 1, HTTP-method based)
│   ├── ui-destructive-classification.md  # NEW — element-text/aria-label based (D-06)
│   └── report-template.md             # existing, unchanged
├── scripts/
│   ├── api-client.mjs                 # EXTENDED — new --storage-state flag, readConfig() accepts
│   │                                   # either QA_AGENT_TOKEN or a storageState path (or both)
│   ├── destructive.mjs                # existing, unchanged
│   ├── ui-destructive.mjs             # NEW — sibling classifier, keyword-match on element text/aria-label
│   ├── ui-login.mjs                   # NEW — deterministic login script (see Common Pitfalls §1)
│   ├── confirm-destructive.mjs        # EXTENDED — also matches mcp__playwright__browser_click /
│   │                                   # browser_fill_form, delegates to ui-destructive.mjs
│   └── format-report.mjs              # existing, unchanged (UI cases use the same results.json schema)
└── package.json                       # unchanged — playwright/zod/dotenv already present
```

Per-run artifacts (target project's own `qa-reports/`, same convention as Phase 1):
```
<target-project>/qa-reports/
├── <run-id>.results.json
├── <run-id>-storage-state.json        # NEW — gitignored (qa-reports/.gitignore already "*")
└── <run-id>.md
```

### Pattern 1: MCP server registration — project-scoped `.mcp.json`, not skill frontmatter

**What:** A plain Claude Code Agent Skill (`SKILL.md`) has no `mcpServers` frontmatter field — only Claude Code *plugins* can bundle an MCP server (via `.mcp.json` at the plugin root, or inline in `plugin.json`) [CITED: code.claude.com/docs/en/mcp, "Plugin-provided MCP servers", fetched directly this session]. `qa-agent` is distributed as a plain skill (per Phase 1's D-07/PKG-01), not a plugin, so the Playwright MCP server must be registered separately: either the user runs `claude mcp add playwright ... --scope project` (writes `.mcp.json` at the *target* project's root, shared via version control), or the skill ships a ready-made `.mcp.json` snippet in its own docs for the user to copy into the target project.
**When to use:** Document this as an explicit one-time setup step in `SKILL.md`'s "Installation" section, alongside the existing `QA_AGENT_TOKEN`/`QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` documentation — this is new, unavoidable setup surface area that slightly weakens PKG-02's "zero-config" claim for Phase 2 specifically (API-only Phase 1 needed no MCP registration at all).
**Example:**
```json
// .mcp.json — project scope, checked into the TARGET project's repo
// Source: code.claude.com/docs/en/mcp (fetched directly this session) — schema
// confirmed; --isolated/--caps flags confirmed via playwright.dev/mcp docs
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--isolated", "--caps=storage"]
    }
  }
}
```
Project-scoped servers from `.mcp.json` require one-time interactive approval the first time Claude Code loads the project [CITED: code.claude.com/docs/en/mcp, "Project server approvals and workspace trust"] — worth calling out explicitly in `SKILL.md` so a first-run user isn't confused when Playwright MCP's tools aren't immediately available.

### Pattern 2: Accessibility-snapshot-driven interaction loop (EXEC-01, EXEC-02)

**What:** `browser_snapshot` returns a hierarchical text tree where every interactive element has a role, an accessible name, and a stable-within-that-snapshot `ref` (e.g. `ref=e5`) [CITED: playwright.dev/mcp/snapshots, cross-checked against the raw GitHub README this session]. The orchestrator reads this tree, maps the natural-language instruction onto specific elements by role+name (never CSS selectors, per D-03), and issues `browser_click`/`browser_type`/`browser_fill_form` calls against the current refs. **Refs are invalidated by any navigation or DOM-mutating action** — the orchestrator must call `browser_snapshot` again after every click/submit before acting on a "new" ref, not reuse refs from before the action.
**When to use:** Every UI interaction step, always — this is the core mechanism satisfying EXEC-01/EXEC-02 and Playwright MCP's whole reason for existing over screenshot-based agents (project STACK.md, Pattern 2).
**Example:**
```
// Source: playwright.dev/mcp (tool names/shape cross-checked against the raw
// GitHub README this session, MEDIUM confidence)
browser_navigate { url: "http://localhost:3000/clients/new" }
browser_snapshot
// -> textbox "Nombre" [ref=e3], textbox "Email" [ref=e5], button "Guardar" [ref=e9]
browser_fill_form { fields: [
  { ref: "e3", value: "Cliente de Prueba QA" },
  { ref: "e5", value: "qa-test-cliente@example.com" }
] }
browser_click { element: "Guardar button", ref: "e9" }
browser_snapshot  // re-snapshot — e3/e5/e9 are no longer valid after this click
```

### Pattern 3: Login step — deterministic script, not orchestrator-driven MCP calls (EXEC-03)

**What:** Per Common Pitfalls §1, the recommended pattern performs login with a **new** `scripts/ui-login.mjs` that uses Playwright's *core* library directly (`chromium.launch()`, not the MCP server), reads `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` from `process.env` exactly like `api-client.mjs` reads `QA_AGENT_TOKEN`, locates fields with the same accessibility-role heuristic D-03 requires, submits, and exports `storageState`. The plaintext credential never becomes an argument in an orchestrator-issued tool call and never appears in the conversation transcript.
**When to use:** Always, as the very first step of any run that needs UI authentication — before any MCP `browser_*` tool call.
**Example:**
```javascript
// Source: playwright.dev/docs/api/class-page (getByRole is a well-established
// core Playwright locator API, not MCP-specific) — pattern synthesized for this
// project; not a verbatim doc example
import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(new URL('/login', baseUrl).toString());

// Same accessibility-role heuristic D-03 requires the *interactive* agent to
// use — here applied by a script instead of an MCP tool call:
const userField = page.getByRole('textbox', { name: /user|email|usuario|correo/i }).first();
const passField = page.locator('input[type="password"]').first();
await userField.fill(process.env.QA_AGENT_UI_USER);
await passField.fill(process.env.QA_AGENT_UI_PASSWORD);
await page.getByRole('button', { name: /log ?in|iniciar|entrar|ingresar/i }).click();
await page.waitForLoadState('networkidle');

await context.storageState({ path: storageStatePath });
await browser.close();
```
**Fallback if this recommendation is not adopted:** If the planner instead drives login interactively via MCP `browser_type`/`browser_fill_form` (a more literal reading of D-01), explicitly document in `SKILL.md` that `QA_AGENT_UI_PASSWORD` will pass through the model's own context for that one step, and confirm this tradeoff with the user during plan review — do not let this exposure be an undocumented side effect.

### Pattern 4: `storageState` reuse for API-03

**What:** Playwright's `storageState` (cookies + localStorage) is a first-party, interchangeable artifact between a `BrowserContext` and a standalone `APIRequestContext` [CITED: playwright.dev/docs/api-testing, fetched directly this session]. `context.storageState({ path })` writes the file; `request.newContext({ storageState: path })` creates a new, independent context pre-authenticated from it.
**When to use:** Whenever a case tagged `type=api` in the same run follows a UI login — extend `api-client.mjs`'s `runCase`/`readConfig` to accept an optional `--storage-state <path>` CLI flag. When present, pass it through to `request.newContext({ baseURL, storageState: path, extraHTTPHeaders: ... })`. `QA_AGENT_TOKEN` and `storageState` are not mutually exclusive — a target app could require both a bearer header *and* a session cookie; `readConfig()` should require **at least one** authentication mechanism (token or storageState path) to be present, not always both, since Phase 2 runs may have no `QA_AGENT_TOKEN` configured at all.
**Example:**
```javascript
// Source: playwright.dev/docs/api-testing (fetched directly this session,
// code adapted to this project's existing api-client.mjs shape)
const context = await request.newContext({
  baseURL,
  storageState: storageStatePath ?? undefined,          // NEW for Phase 2
  extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
});
```

### Pattern 5: UI destructive-element classification — mechanical keyword layer + orchestrator judgment

**What:** `scripts/ui-destructive.mjs` mirrors `destructive.mjs`'s shape exactly: exports `requiresConfirmationForElement(text, { ariaLabel } = {})` that lowercases and checks the element's visible text/aria-label against a keyword set (`eliminar`, `borrar`, `cancelar`, `confirmar pago`, `dar de baja`, plus discretion-extended entries like `eliminar cuenta`, `dar de baja`, `enviar email`/`enviar notificación` per the project's own PITFALLS.md "financial mutation/real email" destructive categories). An unrecognized/ambiguous label is gated (never waved through), matching Phase 1's `destructive.mjs` tie-breaker exactly.
**When to use:** Before every `browser_click`/`browser_fill_form` call whose target element's snapshot-reported name/aria-label is available to check.
**Example:**
```javascript
// Source: derived from D-06 (locked decision) + Phase 1's destructive.mjs shape
export const UI_DESTRUCTIVE_KEYWORDS = [
  'eliminar', 'borrar', 'cancelar', 'confirmar pago', 'dar de baja',
  'suspender', 'anular', 'rechazar', 'enviar email', 'enviar notificaci',
];

export function requiresConfirmationForElement(text, { ariaLabel } = {}) {
  const haystack = `${text ?? ''} ${ariaLabel ?? ''}`.toLowerCase();
  return UI_DESTRUCTIVE_KEYWORDS.some((kw) => haystack.includes(kw));
}
```

### Pattern 6: `PreToolUse` hook backstop, retargeted at MCP tool names

**What:** Phase 1's `confirm-destructive.mjs` parses a Bash command string. For UI actions there is no Bash command — the tool call is `mcp__playwright__browser_click` (server name `playwright`, as registered in `.mcp.json`) [CITED: code.claude.com/docs/en/hooks, fetched directly this session — confirms the `mcp__<server>__<tool>` naming and that a bare matcher like `mcp__playwright__browser_click` needs `.*` to also cover `browser_fill_form`, or two explicit matcher entries]. The hook payload's `tool_input` for an MCP tool call is the actual MCP call arguments (e.g. `{ element: "Eliminar cliente button", ref: "e12" }`), not a command string — `decideForCommand`'s regex-on-a-string approach from Phase 1 doesn't directly apply; the extended hook reads `tool_input.element` (and `tool_input.fields[].value`/label context for `browser_fill_form`) and calls `requiresConfirmationForElement`.
**When to use:** As the hardening backstop layer, exactly parallel to Phase 1 Pattern 3 — the orchestrator's own prompted pre-check (Pattern 5 above) is the primary block.
**Example:**
```json
// SKILL.md frontmatter addition — Source: code.claude.com/docs/en/hooks
// (matcher syntax fetched directly this session)
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node ${CLAUDE_SKILL_DIR}/scripts/confirm-destructive.mjs" }] },
      { "matcher": "mcp__playwright__browser_click", "hooks": [{ "type": "command", "command": "node ${CLAUDE_SKILL_DIR}/scripts/confirm-destructive-ui.mjs" }] },
      { "matcher": "mcp__playwright__browser_fill_form", "hooks": [{ "type": "command", "command": "node ${CLAUDE_SKILL_DIR}/scripts/confirm-destructive-ui.mjs" }] }
    ]
  }
}
```
Also add `mcp__playwright__*` tool names to `SKILL.md`'s `allowed-tools` list — the existing frontmatter only lists `Bash, Read, Write, AskUserQuestion`.

### Anti-Patterns to Avoid

- **Driving the login form's `browser_type`/`browser_fill_form` calls directly from the orchestrator without reading Common Pitfalls §1 first:** silently exposes `QA_AGENT_UI_PASSWORD` to the LLM's own context/transcript — this is the single most important thing to get right in this phase.
- **Reusing refs from a `browser_snapshot` taken before a click/navigation:** refs are invalidated by any DOM-mutating action; a stale ref produces a confusing "element not found" failure that looks like an app bug but is a script-flow bug.
- **Treating the default "persistent" MCP profile mode as equivalent to a Playwright `storageState.json`:** it is a Chromium user-data directory, not a JSON file `request.newContext({storageState})` can consume — see Common Pitfalls §2.
- **Hardcoding an English-only destructive-keyword list:** the target apps (DATAX/dotax/franquix) are Spanish-language; an English-only list (`delete`, `cancel`) will silently wave through Spanish-labeled destructive buttons.
- **Auto-confirming a single UI flow's confirmation prompt "for the whole run" to save time:** identical anti-pattern to Phase 1 — never build a bulk-approval mode (project Pitfalls research, Technical Debt table, "Never").

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser automation / DOM interaction | A custom CDP client or raw Puppeteer wrapper | `@playwright/mcp` (D-01) | First-party Microsoft MCP server, already the de facto standard; reinventing accessibility-tree parsing has no benefit |
| Sharing an authenticated session between a browser and HTTP requests | A custom cookie-jar/header-copying shim | Playwright's own `storageState()`/`request.newContext({storageState})` interop (Pattern 4) | Already handles cookie *and* localStorage portability, is exactly what Phase 1's STACK.md flagged this dependency choice for |
| Detecting login-form fields | A per-project CSS-selector config file | `page.getByRole()` / accessibility-tree role+name matching (D-03) | The entire point of the accessibility-snapshot approach is zero per-project configuration — a selector config file would violate PKG-02 |
| UI destructive-action detection | An exhaustive hardcoded blacklist of button IDs per target app | Keyword-on-visible-text/aria-label classifier (D-06), tie-broken toward asking | No per-project setup, consistent with Phase 1's "no allowlist/denylist needed" (D-01 there) |

**Key insight:** As in Phase 1, everything that looks like "we need custom infrastructure" already has a first-party tool. The genuinely custom work in this phase is glue plus one deliberate architecture decision: keeping the UI credential inside a script process the same way Phase 1 kept the API token there, rather than letting the interactive MCP-tool-call pattern silently change that guarantee.

## Common Pitfalls

### Pitfall 1: UI credential exposure to the LLM's own context via interactive MCP tool calls
**What goes wrong:** Every Playwright MCP interaction tool (`browser_type`, `browser_fill_form`) requires the value to type as a literal string argument that the *calling model* constructs. If the orchestrator drives the login form directly (the most literal reading of "the agent navigates autonomously... and identifies fields," D-03), the plaintext `QA_AGENT_UI_PASSWORD` value passes through Claude's own context and appears in the tool-call transcript — a materially weaker guarantee than Phase 1's "the LLM's own context should never need to see the plaintext token" (project PITFALLS.md, Pitfall 4).
**Why it happens:** D-03/D-04 lock the *mechanism* (env var, accessibility-role detection) but not *which layer* performs the actual field-filling — the natural, most literal implementation routes it through the same interactive orchestrator loop used for the rest of the flow, since that's how every other Playwright MCP interaction in this phase works.
**How to avoid:** Perform the login step with a dedicated deterministic script (`scripts/ui-login.mjs`, Pattern 3) using Playwright's core library, reading the credential from `process.env` inside the script process only, and exporting `storageState` for the MCP session to pick up. If the team decides interactive MCP-driven login is acceptable for a low-privilege dedicated test account (per D-04, never a real user's credentials), document that tradeoff explicitly in `SKILL.md` rather than leaving it an implicit side effect.
**Warning signs:** Grep a run's Claude Code transcript/tool-call log for the literal `QA_AGENT_UI_PASSWORD` value during implementation review, the same way Phase 1's own review process checked for `Bearer ` token leaks.

### Pitfall 2: Persistent MCP profile mode is not a Playwright `storageState.json`
**What goes wrong:** Playwright MCP's default "persistent" mode stores session state in a Chromium `--user-data-dir` (a full browser profile directory), not a portable JSON `storageState` file. A plan that assumes `browser_storage_state`/`--storage-state` "just works" out of the box, without first switching to `--isolated` mode and enabling the storage capability, will either fail to produce a consumable file or silently rely on the wrong artifact.
**Why it happens:** The MCP server's two profile modes ("persistent" vs. "isolated") are a Playwright-MCP-specific concept layered on top of Playwright's own `storageState` concept — they're easy to conflate because both are described as "session persistence" in the docs.
**How to avoid:** Register the server with `--isolated --caps=storage` (Pattern 1) and explicitly call `browser_storage_state`/`browser_set_storage_state` (or feed a file via `--storage-state` at startup) rather than relying on the default persistent profile.
**Warning signs:** A `request.newContext({storageState: <path>})` call in `api-client.mjs` throws a JSON-parse error, or the path points at a directory rather than a file.

### Pitfall 3: Browser automation flakiness (project PITFALLS.md Pitfall 5, now directly applicable)
**What goes wrong:** `browser_snapshot` refs are only valid for the snapshot they came from; reusing a stale ref after a navigation/click produces a confusing failure. Toasts, modals, and optimistic-UI redirects (common in Next.js/Supabase apps) can also cause the same NL instruction to take a different action path on different runs.
**Why it happens:** The MCP server perceives the page fresh at each `browser_snapshot` call and re-decides the next action from that snapshot — there's no deterministic selector script being replayed.
**How to avoid:** Always re-snapshot after any action that could mutate the DOM before issuing the next click/fill; prefer `browser_wait_for` with a text/state condition over a fixed sleep; allow one automatic retry (re-snapshot + retry the single failed step) before marking a UI case FAILED, and label single-run UI failures as "unconfirmed" rather than "reproducible" in the report, per the project's own Pitfall 5 guidance.
**Warning signs:** The same flow run twice in a row (no app changes) produces a different pass/fail result.

### Pitfall 4: Two credential shapes now coexist, and `readConfig()`'s "fail loudly if unset" logic must not conflate them
**What goes wrong:** Phase 1's `readConfig()` throws `ConfigError` if `QA_AGENT_TOKEN` is missing — that check must NOT unconditionally fire for a Phase 2 UI-driven run that has no `QA_AGENT_TOKEN` at all but *does* have a valid `storageState` path from a prior login step. Conversely, `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` must fail loudly (their own distinct error) when a UI flow is requested but they're unset — never silently attempt login with an empty credential.
**Why it happens:** The natural extension is to bolt a second `if (!x) throw` onto the same function without reconsidering which checks are mutually exclusive vs. always-required.
**How to avoid:** `readConfig()` (or a new UI-specific config resolver) should require: `QA_AGENT_UI_USER` + `QA_AGENT_UI_PASSWORD` together whenever a UI login is being performed (both-or-fail, per D-04's "fail loudly" discipline); and for `api-client.mjs`, at least one of `QA_AGENT_TOKEN` or `--storage-state <path>` present, not both mandatory.
**Warning signs:** A Phase 2 API-03 call fails with Phase 1's old "`QA_AGENT_TOKEN` is not configured" message even though a valid `storageState` file was passed — that error message is now misleading if left unchanged.

## Code Examples

### Extending `api-client.mjs`'s `readConfig` for storageState (API-03)

```javascript
// Source: pattern extension of the existing readConfig() in
// C:/qa-agent/scripts/api-client.mjs (read this session) — the new
// storageStatePath parameter is additive, not a replacement of the
// existing QA_AGENT_TOKEN path.
export function readConfig({ baseUrlArg, projectRoot, storageStatePath } = {}) {
  // ...existing .env.local/.env loading unchanged...
  const baseUrl = baseUrlArg ?? process.env.QA_AGENT_BASE_URL;
  if (!baseUrl) { throw new ConfigError('QA_AGENT_BASE_URL is not configured...'); }

  const token = process.env.QA_AGENT_TOKEN;
  if (!token && !storageStatePath) {
    throw new ConfigError(
      'No auth mechanism configured — set QA_AGENT_TOKEN or pass --storage-state ' +
      '<path> from a prior UI login (API-03)'
    );
  }

  return { baseUrl, token, storageStatePath };
}
```

### `scripts/ui-destructive.mjs` (unit-testable mechanical layer of D-06)

```javascript
// Source: derived from D-06 (locked decision) — mirrors Phase 1's
// destructive.mjs shape (destructive.mjs was read in full this session).
export const UI_DESTRUCTIVE_KEYWORDS = [
  'eliminar', 'borrar', 'cancelar', 'confirmar pago', 'dar de baja',
  'suspender', 'anular', 'rechazar', 'enviar email', 'enviar notificaci',
];

export function requiresConfirmationForElement(text, { ariaLabel } = {}) {
  const haystack = `${text ?? ''} ${ariaLabel ?? ''}`.toLowerCase();
  return UI_DESTRUCTIVE_KEYWORDS.some((kw) => haystack.includes(kw));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Screenshot + vision-model interpretation for browser agents | Accessibility-tree snapshot (`browser_snapshot`) as the default perception mode | Established since Playwright MCP's initial release; still current as of this session | Cheaper in tokens, far less flaky than pixel-based agents — already the basis for D-01 |
| One shared, long-lived browser profile per machine | Per-workspace persistent profile (default) or `--isolated` fresh-session mode | Current `@playwright/mcp` (0.0.79) behavior, confirmed this session | Matters directly for this phase's `--isolated` recommendation (Pitfall 2) |

**Deprecated/outdated:** none identified specific to this phase beyond what Phase 1's research already covered (Selenium, screenshot-only perception).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The recommended login-via-deterministic-script pattern (Pattern 3) is a legitimate implementation of D-03 rather than a deviation from D-01's "Playwright MCP as the browser-control mechanism" | Architecture Patterns §3, Common Pitfalls §1 | This is this researcher's own reasoning about credential-exposure risk, not a claim from an authoritative source — if the user actually wants a strictly MCP-only implementation (accepting the plaintext-in-transcript tradeoff for a low-privilege dedicated test account), the planner should confirm this explicitly rather than silently adopting the script-based recommendation |
| A2 | Playwright MCP's "persistent" profile mode stores a Chromium user-data directory that is NOT the same artifact as a `storageState.json`, and `--isolated` + `browser_storage_state`/`--storage-state` is required to get a `request.newContext()`-compatible file | Architecture Patterns §1/§4, Common Pitfalls §2 | Synthesized from a WebFetch-summarized (LLM-condensed) reading of `playwright.dev/mcp/configuration/user-profile` and `playwright.dev/mcp/tools/storage`, not a raw-text read of those pages (the raw GitHub README fetch corroborates the *tool names* but not this specific file-format distinction) — if wrong, the planner should hands-on verify early (start the MCP server, log in via `browser_type`, call `browser_storage_state`, and inspect the resulting file's shape) before committing to the two-step login sequencing in Pattern 3/4 |
| A3 | `mcp__playwright__browser_click`/`browser_fill_form` is the correct hook-matcher tool name for a server registered under the key `playwright` in `.mcp.json` | Architecture Patterns §6 | Confirmed pattern (`mcp__<server>__<tool>`) via a direct, full fetch of `code.claude.com/docs/en/hooks` this session — LOW residual risk, but the exact server key must match whatever name is actually chosen in `.mcp.json` (this research assumes the key `"playwright"`) |
| A4 | The `browser_storage_state`/`browser_set_storage_state`/cookie/localStorage MCP tools require an explicit `--caps=storage` (or similar) capability flag rather than being available by default | Standard Stack, Pattern 1 | Sourced from a WebFetch summary of `playwright.dev/mcp/tools/storage` ("These tools require the storage capability enabled via configuration") — if the exact flag name differs from `--caps=storage`, the `.mcp.json` snippet in Pattern 1 needs a one-line correction; low risk, easily caught by running `claude mcp add` and checking `/mcp` tool list during Wave 0 |

**If this table is empty:** N/A — see entries above. A1 and A2 are the two items most worth confirming hands-on before implementation, since A1 affects a security-relevant architecture choice and A2 affects whether the core API-03 mechanism (storageState export) works at all as sequenced.

## Open Questions

1. **Should login be orchestrator-driven (MCP tool calls) or script-driven (Pattern 3)?**
   - What we know: D-03/D-04 lock the mechanism (env vars, accessibility-role detection) but not which layer performs it; MCP tool-call arguments are visible to the orchestrator's own context by construction.
   - What's unclear: Whether the team considers this an acceptable risk for a dedicated, low-privilege test account (D-04 already forbids using a real user's credentials), or whether the stronger guarantee (script-only, matching Phase 1's token discipline) is worth the extra script.
   - Recommendation: Default to the script-based approach (Pattern 3) as the primary recommendation above; surface this explicitly during `/gsd-plan-phase` or a follow-up `/gsd-discuss-phase` pass if the user wants to reconsider.

2. **Exact shape of the `browser_storage_state`/`--caps` mechanism (A2, A4 above)**
   - What we know: The tool names and CLI flags exist and are named consistently across two independent official-doc fetches.
   - What's unclear: The precise capability-flag syntax and whether `--isolated` mode is strictly required for `--storage-state` to produce a *reusable* file (vs. just an initial-load convenience), since this session's fetches were WebFetch-summarized rather than raw-text reads of every page.
   - Recommendation: Wave 0 of the plan should include a manual spike — register the MCP server, perform one login against a real target, call the storage-export tool, and confirm the resulting file is consumable by `request.newContext({storageState})` — before writing the full `ui-login.mjs`/`api-client.mjs` integration.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All skill scripts | ✓ | 22.14.0 [VERIFIED this session] | — |
| `playwright` (npm package) | `ui-login.mjs` core-library login, existing `api-client.mjs` | ✓ (already installed) | 1.62.1 [VERIFIED: `package.json`, this session] | — |
| `@playwright/mcp` (npm package) | EXEC-01/EXEC-02 browser-control MCP server | ✓ (registry) | 0.0.79 [VERIFIED: `npm view`, this session] | — |
| Chromium browser binary | Both the MCP server and `ui-login.mjs`'s `chromium.launch()` | ✗ — not yet downloaded on this machine [VERIFIED: no `ms-playwright` cache directory found, this session] | — | Run `npx playwright install chromium` as a Wave 0 setup step; `@playwright/mcp` may also auto-download its own browser on first use, but this should not be left implicit |
| Claude Code CLI (MCP support, `.mcp.json`) | Registering/using Playwright MCP | Assumed ✓ (this research session runs inside it) | current | — |
| A running target app with a real login form | Manual per-run | N/A — supplied by user at invocation time | — | Same "fail loudly on unreachable target" discipline as Phase 1's `preflight()` should extend to a login-page-not-found case |

**Missing dependencies with no fallback:** Chromium browser binary — must be installed as an explicit Wave 0 step (`npx playwright install chromium`); this was not needed in Phase 1 (API-only) and is a genuinely new setup requirement for this phase.
**Missing dependencies with fallback:** none beyond the above.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (already configured, Phase 1) |
| Config file | none — zero-config default glob, consistent with Phase 1 |
| Quick run command | `npx vitest run scripts/ui-destructive.test.mjs` (new file) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EXEC-03, D-06 | `requiresConfirmationForElement()` matches Spanish destructive keywords case-insensitively on text OR aria-label, and returns `false` for a clearly benign label like "Guardar" | unit | `npx vitest run scripts/ui-destructive.test.mjs -t "requiresConfirmationForElement"` | ❌ Wave 0 |
| API-03 | `readConfig()` accepts a `storageStatePath` in place of `QA_AGENT_TOKEN`, and throws when *neither* is present | unit | `npx vitest run scripts/api-client.test.mjs -t "storage state auth"` | ❌ Wave 0 — extends the existing `api-client.test.mjs` (read this session) |
| API-03 | `runCase()`/`request.newContext()` is called with `storageState: <path>` when provided | integration | `npx vitest run scripts/api-client.integration.test.mjs -t "storageState"` | ❌ Wave 0 — extends the existing mock-server-backed integration test (`scripts/__fixtures__/mock-server-process.mjs`, read this session) |
| EXEC-03 | `ui-login.mjs`'s credential resolver fails loudly (throws a specific error) when `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` are unset, mirroring Phase 1's `ConfigError` discipline | unit | `npx vitest run scripts/ui-login.test.mjs -t "missing credentials"` | ❌ Wave 0 |
| EXEC-01, EXEC-02, D-05 | The `PreToolUse` hook decision function for `mcp__playwright__browser_click` returns an `ask` decision for a destructive element and `undefined` for a benign one | unit | `npx vitest run scripts/confirm-destructive-ui.test.mjs` | ❌ Wave 0 |
| EXEC-01, EXEC-02 | Full UI flow against a real target, storageState export, and API-03 reuse | manual/UAT only | — (requires a real target app with a login form; cannot be scripted against a mock, since the MCP server drives a real browser) | — |

### Sampling Rate
- **Per task commit:** `npx vitest run <changed-test-file>`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus one manual end-to-end run against a real local target covering login → a UI flow with at least one destructive-looking button → an API-03 call reusing the session — this is the only way to validate the two Open Questions above and cannot be fully captured by unit tests, consistent with how Phase 1 treated its own PKG-01 manual check.

### Wave 0 Gaps
- [ ] `scripts/ui-destructive.test.mjs` — covers D-06/EXEC-03 classification
- [ ] `scripts/ui-login.mjs` + `scripts/ui-login.test.mjs` — covers EXEC-03 credential resolution (mirrors `readConfig`'s `ConfigError` pattern)
- [ ] `scripts/confirm-destructive-ui.mjs` + test — covers the MCP-tool-name hook backstop (Pattern 6)
- [ ] `api-client.test.mjs`/`api-client.integration.test.mjs` extensions — covers API-03's `storageState` path
- [ ] `.mcp.json` at project root — new file, not yet present [VERIFIED: no `.mcp.json` found in repo root, this session]
- [ ] Manual spike (Open Question 2): confirm `--isolated --caps=storage` actually produces a `request.newContext()`-consumable file before writing the full integration

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | Yes — as a consumer of two credential types now | `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` read via `process.env` only inside `ui-login.mjs` (Pattern 3); never as an MCP tool-call argument the orchestrator constructs (Common Pitfalls §1) |
| V3 Session Management | Yes — new to this phase | `storageState` (cookies/localStorage) is written to a run-scoped, gitignored file (`qa-reports/.gitignore` already `*`, per Phase 1 D-07's discretion note) and must be treated as a bearer credential equivalent — never logged/echoed into `results.json` or the Markdown report, same redaction discipline as Phase 1's `Authorization` header |
| V4 Access Control | Partially — same UI-destructive confirmation-gate analog as Phase 1's API gate | D-05/D-06's element-text classification + two-layer confirmation (Pattern 5/6) |
| V5 Input Validation | Not newly applicable — no new user-controlled input parsing beyond Phase 1's base-URL/instruction handling | — |
| V6 Cryptography | No | Unchanged from Phase 1 — TLS handled by the browser/target server, not custom code |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| UI credential (`QA_AGENT_UI_PASSWORD`) leakage via LLM context/transcript during interactive MCP-driven login | Information Disclosure | Pattern 3's script-based login recommendation; if not adopted, explicit documented risk acceptance (Common Pitfalls §1, Open Question 1) |
| `storageState` file (an equivalent of a live session cookie) committed to the target repo or left readable after a run | Information Disclosure / Elevation of Privilege | Write it only inside the already-gitignored `qa-reports/` run directory; never print its contents to chat/report, only its path |
| Destructive UI action executed via a label the keyword classifier doesn't recognize (e.g., an icon-only button with no text) | Tampering | The classifier's "unrecognized/ambiguous → gated" tie-breaker (Pattern 5) — an icon button with no accessible name should fail closed, not open |
| MCP server compromise / prompt injection via page content reflected into `browser_snapshot`/`browser_evaluate` output | Tampering / Information Disclosure | Out of scope to fully mitigate in this phase (inherent to any LLM-driven browser agent reading live page content) — the existing "never operate outside the app's normal UI/API surface" discipline (project PITFALLS.md Pitfall 3) already bounds the blast radius: the agent should not be granted `browser_evaluate`-driven arbitrary JS execution as a workaround tool for "unblocking" a stuck flow |

## Sources

### Primary (HIGH confidence)
- `npm view @playwright/mcp version` / `npm view @playwright/mcp repository.url` — live registry checks, this session
- `curl https://api.npmjs.org/downloads/point/last-week/@playwright/mcp` — live download-count check, this session
- `gsd-tools query package-legitimacy check --ecosystem npm @playwright/mcp` — live registry signal check, this session
- Direct `Read` of this project's own `scripts/api-client.mjs`, `scripts/destructive.mjs`, `scripts/confirm-destructive.mjs`, `scripts/format-report.mjs`, `SKILL.md`, `package.json`, `scripts/tracer.e2e.test.mjs` — this session

### Secondary (MEDIUM confidence — cross-checked across ≥2 independent official-doc fetches this session)
- [Playwright MCP tool reference — playwright.dev/mcp](https://playwright.dev/mcp) and the raw `github.com/microsoft/playwright-mcp` README — tool-name list agrees across both fetches
- [Storage & Authentication — playwright.dev/mcp/tools/storage](https://playwright.dev/mcp/tools/storage) and [Profile & State — playwright.dev/mcp/configuration/user-profile](https://playwright.dev/mcp/configuration/user-profile) — persistent-vs-isolated and `--storage-state` mechanics agree across both fetches, though not independently hands-on verified (see Assumptions A2, A4)
- [API testing — playwright.dev/docs/api-testing](https://playwright.dev/docs/api-testing) — `storageState()`/`request.newContext({storageState})` interop, fetched directly this session
- [Connect Claude Code to tools via MCP — code.claude.com/docs/en/mcp](https://code.claude.com/docs/en/mcp) — full page fetched and read directly this session; `.mcp.json` scoping, plugin-vs-skill MCP bundling, environment-variable expansion all confirmed from primary text, not a summary
- [Hooks — code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks) — `mcp__<server>__<tool>` matcher naming confirmed via a direct fetch this session

### Tertiary (LOW confidence — single WebSearch aggregate, not independently cross-checked)
- WebSearch: "@playwright/mcp install .mcp.json Claude Code configuration" — general installation-flow framing, corroborated by the direct `code.claude.com/docs/en/mcp` fetch above
- WebSearch: "Playwright accessibility snapshot login form detect username password field role textbox" — the specific username/password-field regex heuristic in Pattern 3/Code Examples is this researcher's own synthesis from general accessibility-tree documentation, not a single authoritative "how to detect a login form" source
- WebSearch: "Playwright MCP browser_snapshot ref stale element flaky timing" and "MCP browser automation agent password credential exposed to LLM context" — general industry framing for Common Pitfalls §1 and §3; the specific architectural conclusion (script-based login) is this researcher's own reasoning applied to this project's existing Phase 1 patterns, not a cited external recommendation

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — `@playwright/mcp` version/downloads/repo verified live against npm registry; tool-name inventory cross-checked across two independent official-doc fetches; the exact `--caps`/isolated-mode mechanics (A2, A4) are WebFetch-summarized, not raw-text-verified or hands-on tested
- Architecture: MEDIUM-LOW — the `.mcp.json`/hooks/MCP-tool-naming mechanics are HIGH-confidence (full-text official docs read directly this session); the credential-exposure finding and script-based login recommendation (Pattern 3, the most consequential architectural call in this research) is this researcher's own reasoning from confirmed MCP tool-call mechanics, explicitly flagged in the Assumptions Log for planner/user confirmation rather than presented as settled fact
- Pitfalls: MEDIUM — Pitfalls 1 and 2 are specific, non-obvious findings for this exact phase (not carried over from project-level PITFALLS.md); Pitfall 3 is a direct application of the project's own already-researched Pitfall 5

**Research date:** 2026-08-12
**Valid until:** 2026-09-11 (30 days — `@playwright/mcp` is a fast-moving, sub-1.0 package; re-verify tool names, CLI flags, and especially the `--caps`/storage-capability mechanics if planning is delayed past this window, since Assumptions A2/A4 were not hands-on verified this session)
