---
name: qa-agent
description: Run an evidence-backed API test against a local or staging target. Use when asked to test, probar, validar, or run QA against API endpoints (e.g. "probá GET /api/clients", "testeá el CRUD de facturas", "validá el endpoint de login").
argument-hint: [base-url] [instruction]
allowed-tools: Bash, Read, Write, AskUserQuestion
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "node ${CLAUDE_SKILL_DIR}/scripts/confirm-destructive.mjs"
    - matcher: "mcp__playwright__browser_click"
      hooks:
        - type: command
          command: "node ${CLAUDE_SKILL_DIR}/scripts/confirm-destructive-ui.mjs"
    - matcher: "mcp__playwright__browser_fill_form"
      hooks:
        - type: command
          command: "node ${CLAUDE_SKILL_DIR}/scripts/confirm-destructive-ui.mjs"
---

# qa-agent

An evidence-backed API test runner. It dispatches real HTTP requests via a
deterministic script (never by reasoning over raw `curl` output), captures the
full request and response for every case, and writes a Markdown report — with
the auth token redacted everywhere — into the target project's own
`qa-reports/` folder.

## Installation

Copy or symlink this directory to `~/.claude/skills/qa-agent/`, then run
`npm install` inside it **once**. Nothing is installed into, or written to,
the project under test besides the `qa-reports/` run artifacts this skill
produces at run time — there is no project-specific setup step (PKG-01).

## Configuration

- `QA_AGENT_TOKEN` (required for API-only runs) — the test user's bearer
  token, exported in the shell that launched Claude Code, or set in the
  target project's `.env.local`. Sent as `Authorization: Bearer <token>` on
  every request.
- `QA_AGENT_BASE_URL` (optional) — a default base URL, overridden by the
  first argument to `/qa-agent` when one is supplied.
- `QA_AGENT_UI_USER` / `QA_AGENT_UI_PASSWORD` (required together, only when a
  run needs a browser login) — the dedicated test user's login credentials
  for `ui-login.mjs`, loaded from the shell environment or the target
  project's `.env.local` exactly like `QA_AGENT_TOKEN`. These belong to a
  low-privilege, dedicated test account — **never** a real user's own login.
  Never required for an API-only run. If a UI login is requested and either
  variable is unset, empty, or whitespace-only, the run stops with a
  configuration error naming both variable names — it never attempts a login
  with an empty credential.

When `QA_AGENT_TOKEN` is missing, the run stops immediately with a
configuration error message. It never proceeds with a missing or empty
`Authorization` header and never reports the resulting 401s as ordinary test
failures (D-09).

`api-client.mjs`'s exit codes — a configuration error (2), a refused
confirmation (3), an unreachable target (4), or a refused production-looking
host (6) **stops the run**; it is never rendered into the report as if it
were a test failure (D-09). `ui-login.mjs` reuses the same codes for the
meanings they share (2 configuration, 4 unreachable target), so a developer
reads one table, not two:

| Exit code | Meaning |
|-----------|---------|
| 0 | Case recorded — passed, failed, or blocked (`--declined`) are all a successful run of the script |
| 2 | Configuration error — `QA_AGENT_BASE_URL is not configured`, `QA_AGENT_TOKEN is not configured`, or (`ui-login.mjs`) `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` not configured |
| 3 | Confirmation required — a destructive call was dispatched without `--confirmed`, nothing was sent |
| 4 | Target unreachable — either the preflight probe, the dispatch itself, or (`ui-login.mjs`) reaching the login page hit a transport-level failure |
| 5 | Evidence missing — `format-report.mjs` refused to render a passed/failed case with no response evidence |
| 6 | Production-looking target refused — pass `--allow-non-local` to proceed (never a permanent ban, D-02) |
| 7 | Login failed (`ui-login.mjs` only) — the login form was found but the supplied `QA_AGENT_UI_USER` was rejected, or no post-login state change occurred; no storage-state file is written |

## UI authentication and session reuse

When a run needs to act as a logged-in test user in the browser, and reuse
that same session for related API calls, follow this two-step sequence
(EXEC-03, API-03, D-07, D-08):

1. Run the login script through the Bash tool — never drive the login form
   interactively:
   ```
   node <skill-dir>/scripts/ui-login.mjs --base-url <base-url> \
     --storage-state <target-project>/qa-reports/<run-id>-storage-state.json
   ```
   Capture the `storageStatePath` from its single JSON output line
   (`{"status":"logged_in","storageStatePath":...,"postLoginUrl":...,"cookieNames":[...]}`).
2. For every API case in the same run that should act as that logged-in
   user, append `--storage-state <that path>` to the `api-client.mjs`
   invocation. No second login, and no `QA_AGENT_TOKEN` is required for
   those cases (API-03, D-07).

**Credential isolation is a rule the orchestrator must follow, not
background detail.** `QA_AGENT_UI_PASSWORD` is read from the environment
strictly inside `ui-login.mjs`'s own process — it is never passed as an
argument to any tool call, never echoed into chat, and never typed into a
browser through an interactive tool. This is exactly why login is
script-driven instead of orchestrator-issued Playwright MCP tool calls
(D-08): an MCP tool call would require the orchestrator's own reasoning to
construct the password as a literal string argument, putting it in the
conversation transcript. If a login step fails, report the exit code and the
script's own message — never retry by asking the developer to paste the
password into the conversation.

**A storage-state file is a live session credential**, equivalent to a
cookie jar — treat it exactly that way. Reference it only by path, never
print its contents into chat, `results.json`, or the Markdown report, and
leave it inside the already-gitignored `qa-reports/` run directory.

## Run protocol

1. Parse `$ARGUMENTS`: take the first whitespace-delimited token as the base
   URL and the entire remainder as the natural-language test instruction. If
   that first token does not parse as a URL (no `http://`/`https://` scheme),
   ask the user for the base URL via `AskUserQuestion` instead of guessing.
2. From the natural-language instruction, derive one case per endpoint the
   user named (e.g. "probá GET /api/clients y POST /api/clients" -> two
   cases). Phase 1 has no OpenAPI spec, no Postman collection, and does no
   code scanning — natural language is the only input method (D-05).
3. Pick a run id `<YYYY-MM-DD-HHmm>-<slug>` for this run.
4. For each case, invoke the deterministic script via the Bash tool — never
   read raw HTTP/curl output and judge pass/fail by eye, the script's JSON is
   the only verdict source:
   ```
   node <skill-dir>/scripts/api-client.mjs --method <METHOD> --url <path> \
     --base-url <base-url> --title "<METHOD> <path>" \
     --results <target-project>/qa-reports/<run-id>.results.json
   ```
5. After all cases have run (including any blocked ones), render the report:
   ```
   node <skill-dir>/scripts/format-report.mjs \
     --results <target-project>/qa-reports/<run-id>.results.json \
     --out-dir <target-project>/qa-reports \
     --title <run-id>
   ```
6. Post a short summary to chat (pass/fail/blocked counts) plus the absolute
   path to the generated Markdown report — the report is always delivered
   both ways, in chat and as a file (D-07).

Response-shape checks in this phase are labelled **"shape observed"**, not
"contract validated" — no API specification exists yet, so any inferred shape
check is a hint, not ground truth (D-10).

## Case construction

Turning the developer's natural-language instruction into `api-client.mjs`
invocations is the orchestrator's own judgment call — there is no spec to
compile against (D-05):

- **One case per endpoint the developer named.** "probá GET /api/clients y
  POST /api/clients" is two cases, one invocation each — never batch several
  endpoints into a single call.
- **`--expect-status <code>`** only when the developer stated an expectation
  ("debería devolver 201"). When they name nothing, the run falls back to the
  default 2xx check — never invent a specific expected status the developer
  never mentioned.
- **`--expect-fields <a,b,c>`** listing only fields the developer explicitly
  named in their instruction ("que devuelva un array de clients"), comma
  separated, no spaces required. Never add a field to the list because it
  looks like it should be there — an unnamed field is never checked, per
  D-05/D-10's "shape observed, not contract validated" stance.
- **`--allow-non-local`** only after the developer has explicitly confirmed
  they want to target a non-local host — a run refused with exit `6` names
  the host and the flag; re-invoke the identical command with the flag added
  once the developer has said yes. Never add this flag preemptively "just in
  case" a target turns out to be production-looking.
- **`--base-url`** is the same base URL for every case in a run — resolve it
  once per run (from the skill's first argument or `QA_AGENT_BASE_URL`), not
  per case.

## Confirmation protocol

Every destructive call (DELETE always; POST/PUT/PATCH unless clearly
read-only) is gated twice — once by `api-client.mjs`'s own exit-3 refusal,
once by the `PreToolUse` hook above — but the *orchestrator's* job is to
never even reach for `--confirmed` without first pausing. Run this loop for
every case (D-03, D-04):

1. Before invoking the client for a case, decide whether the call is
   destructive using `references/destructive-classification.md`. DELETE is
   always destructive.
2. For a non-destructive POST/PUT/PATCH — a search or filter endpoint — pass
   `--read-only-intent`, and state that judgment in the chat summary so the
   developer can see what was waved through and why.
3. Otherwise invoke the client without `--confirmed` first. It exits 3 and
   returns a preview.
4. Show the developer the preview verbatim — method, full URL, request body —
   and ask via `AskUserQuestion` for a yes or no on that single call. Ask
   about one call at a time; never batch several destructive calls into one
   question and never request approval covering the remainder of the run.
5. On yes, re-invoke the identical command with `--confirmed` appended.
6. On no, invoke with `--declined` and a `--blocked-reason`, then continue
   with the next case in the same session (D-04). A decline never ends the
   run and never permanently bars that action from a later run (D-02).

## UI confirmation protocol

The same confirmation-gate philosophy extends to the browser (D-05, D-06):
before clicking, typing into, or filling any element from a Playwright MCP
`browser_snapshot`, the agent pauses on a destructive-looking one and asks,
exactly as the API gate above pauses on a mutating method. Two independent
layers back this up: the orchestrator's own classification below is the
primary block, and the `PreToolUse` hook registered in frontmatter for
`mcp__playwright__browser_click`/`browser_fill_form` is the hardening layer,
mirroring Phase 1's Bash-command hook exactly (SC1, D-05). **The hook layer's
live-session firing is unverified as of Phase 1's UAT (Test 4)** — a
skill-frontmatter `PreToolUse` hook was not observed firing in that session,
root cause undiagnosed. Do not read the hook's mere presence in frontmatter
as proof of enforcement; the orchestrator-level pause below is the guarantee
this protocol actually rests on.

Run this loop for every interaction against an element from a snapshot:

1. After every `browser_snapshot`, before issuing any click, type or
   form-fill against an element from that snapshot, read the element's role,
   accessible name and aria-label out of the snapshot and classify it using
   `references/ui-destructive-classification.md`.
2. If the element is not destructive, issue the single interaction tool call
   and continue.
3. If it is destructive, or if it has no readable accessible name, stop. Show
   the developer the element's visible text, its aria-label, its snapshot ref
   and the current page URL, and ask via `AskUserQuestion` for a yes or no on
   that one interaction. Ask about one element at a time. Never batch several
   destructive clicks into one question, and never request approval covering
   the remainder of the run — there is no bulk-approval mode in this skill,
   in the browser any more than in the API.
4. On yes, issue that one interaction tool call, then re-snapshot before
   doing anything else.
5. On no, do not issue the tool call. Record the step as blocked with the
   reason and continue with the next case in the same session — a decline
   never ends the run and never permanently bars that action from a later
   run. The concrete recorder invocation for a blocked UI case is documented
   in the `## UI run protocol` section.
6. Never show a value being typed in a confirmation prompt. Show the field's
   label only.
7. Never route around a gate by using a JavaScript-evaluation tool to trigger
   an element directly. If a gated element cannot be interacted with through
   the normal UI surface, report that and stop, rather than reaching for a
   different mechanism.
