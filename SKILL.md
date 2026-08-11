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

- `QA_AGENT_TOKEN` (required) — the test user's bearer token, exported in the
  shell that launched Claude Code, or set in the target project's
  `.env.local`. Sent as `Authorization: Bearer <token>` on every request.
- `QA_AGENT_BASE_URL` (optional) — a default base URL, overridden by the
  first argument to `/qa-agent` when one is supplied.

When `QA_AGENT_TOKEN` is missing, the run stops immediately with a
configuration error message. It never proceeds with a missing or empty
`Authorization` header and never reports the resulting 401s as ordinary test
failures (D-09).

`api-client.mjs`'s exit codes — a configuration error (2), a refused
confirmation (3), an unreachable target (4), or a refused production-looking
host (6) **stops the run**; it is never rendered into the report as if it
were a test failure (D-09):

| Exit code | Meaning |
|-----------|---------|
| 0 | Case recorded — passed, failed, or blocked (`--declined`) are all a successful run of the script |
| 2 | Configuration error — `QA_AGENT_BASE_URL is not configured` or `QA_AGENT_TOKEN is not configured` |
| 3 | Confirmation required — a destructive call was dispatched without `--confirmed`, nothing was sent |
| 4 | Target unreachable — either the preflight probe or the dispatch itself hit a transport-level failure |
| 5 | Evidence missing — `format-report.mjs` refused to render a passed/failed case with no response evidence |
| 6 | Production-looking target refused — pass `--allow-non-local` to proceed (never a permanent ban, D-02) |

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
