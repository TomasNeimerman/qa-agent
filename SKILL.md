---
name: qa-agent
description: Run an evidence-backed API/UI test, or discover a target project's own code to generate documented test cases. Use when asked to test, probar, validar, or run QA against API endpoints or UI flows (e.g. "probá GET /api/clients", "testeá el CRUD de facturas", "validá el endpoint de login"), or to discover/generate test cases from a project's code (e.g. "generá casos de prueba", "explorá el proyecto", "qué se puede testear en este repo").
argument-hint: [base-url|project-path] [instruction]
# allowed-tools deliberately excludes any JavaScript-evaluation tool (e.g.
# browser_evaluate) — an arbitrary-script capability would let a stuck flow
# be "unblocked" by executing code in the page, routing around both the
# destructive-action gate and the rule that this skill only operates
# through the app's normal UI/API surface (T-02-22).
allowed-tools: Bash, Read, Write, Glob, Grep, AskUserQuestion, mcp__playwright__browser_navigate, mcp__playwright__browser_navigate_back, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_fill_form, mcp__playwright__browser_type, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_wait_for, mcp__playwright__browser_close
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

A browser run additionally needs the Playwright MCP server registered once
— see `references/mcp-setup.md` for the verified one-time setup procedure
(the exact flags and the two registration paths, user-scope or
project-scope). An API-only run needs none of this.

## Configuration

- `QA_AGENT_TOKEN` (required for API-only runs) — the test user's bearer
  token, exported in the shell that launched Claude Code, or set in the
  target project's `.env.local`. Sent as `Authorization: Bearer <token>` on
  every request.
- `QA_AGENT_TOKEN_SECONDARY` (optional) — a second, lower-privilege test
  user's bearer token, for executing the permission and role cases DISC-05
  generates (D-01). It belongs to a dedicated low-privilege test account —
  **never** a real user's own login, and never an elevated one, exactly like
  `QA_AGENT_UI_USER` below. It is selected by `api-client.mjs --secondary`;
  the flag itself carries no value. A run with `--secondary` and this
  variable unset stops with a configuration error — it never falls back to
  `QA_AGENT_TOKEN`, because running a permission case as the wrong identity
  and reporting it as if it came from the right one would defeat the point
  of the check.
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

**Checking whether `QA_AGENT_TOKEN_SECONDARY` is configured is a rule the
orchestrator must follow, not background detail** — framed the same way
`## UI authentication and session reuse` frames credential isolation below.
Deciding whether a permission case is runnable (`## Case generation
protocol`) requires knowing only whether this variable is configured, never
its value. The check is an exit-code-only test whose output is discarded,
e.g.:
```
grep -q '^QA_AGENT_TOKEN_SECONDARY=' <target-project>/.env.local
```
Reading the env file with the `Read` tool, or running any command that
prints the variable, is forbidden — either one puts the secret in the
conversation transcript.

`api-client.mjs`'s exit codes — a configuration error (2), a refused
confirmation (3), an unreachable target (4), or a refused production-looking
host (6) **stops the run**; it is never rendered into the report as if it
were a test failure (D-09). `ui-login.mjs` reuses the same codes for the
meanings they share (2 configuration, 4 unreachable target), so a developer
reads one table, not two:

| Exit code | Meaning |
|-----------|---------|
| 0 | Case recorded — passed, failed, or blocked (`--declined`) are all a successful run of the script |
| 2 | Configuration error — `QA_AGENT_BASE_URL is not configured`, `QA_AGENT_TOKEN is not configured`, `QA_AGENT_TOKEN_SECONDARY is not configured` (only when `--secondary` is given), `--secondary` combined with `--storage-state`, or (`ui-login.mjs`) `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` not configured |
| 3 | Confirmation required — a destructive call was dispatched without `--confirmed`, nothing was sent |
| 4 | Target unreachable — either the preflight probe, the dispatch itself, or (`ui-login.mjs`) reaching the login page hit a transport-level failure |
| 5 | Evidence missing — `format-report.mjs` refused to render a passed/failed case with no response evidence |
| 6 | Production-looking target refused — pass `--allow-non-local` to proceed (never a permanent ban, D-02) |
| 7 | Login failed (`ui-login.mjs` only) — the login form was found but the supplied `QA_AGENT_UI_USER` was rejected, or no post-login state change occurred; no storage-state file is written |
| 8 | Refused — a resolved path (`--project-root`/`--migrations-dir`, or a file inside the migrations directory) fell outside the target project root (`discover-schema.mjs` only) |
| 9 | Malformed test-case document — `qa-reports/<run-id>-test-cases.md` failed to parse or validate back after being written, or a case named when running generated cases (see the section below `## Case generation protocol`) could not be resolved (`scripts/test-case-doc.mjs --file <path> [--case <id>]`; stderr names every offending case ID) |

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

## UI run protocol

This is the loop the orchestrator runs for a browser instruction (EXEC-01,
EXEC-02, D-01–D-03, D-07). It is written to be concrete enough that two
different sessions produce the same sequence:

1. **Decide whether the instruction is a browser instruction.** A flow
   described in terms of screens, forms or user actions — the alta de
   cliente example, filling a form, walking a checkout — is a browser
   instruction. An instruction naming HTTP methods and endpoint paths stays
   on the API path in `## Run protocol` above. When both appear in one
   instruction, run the browser flow first and then the API checks, so the
   API checks inherit the session.
2. **Resolve the base URL and pick one run id**, exactly as `## Run
   protocol` steps 1 and 3 already specify. Browser cases and API cases from
   the same instruction share one run id, one results file and one report.
3. **Authenticate once**, per `## UI authentication and session reuse`: run
   `scripts/ui-login.mjs` and keep the storage-state path it prints. Hand
   that same path to the browser session as the startup session file
   described in `references/mcp-setup.md`, and to every `api-client.mjs`
   invocation later in the run as `--storage-state`. One login serves the
   whole run.
4. **Derive one case per user-visible outcome the developer asked about**,
   not one per click — the same judgment `## Case construction` describes
   for endpoints, applied to flows. The alta de cliente example is one case
   whose steps are navigating to the form, filling it and submitting it.
   Never invent a flow the developer did not ask for.
5. **For each case, run this step loop:**
   - `browser_navigate` to the starting URL.
   - `browser_snapshot` to read the page.
   - Map the instruction onto elements by their role and accessible name
     from that snapshot, never by a CSS selector and never by guessing a ref
     that is not in the snapshot in hand.
   - Classify the target element against
     `references/ui-destructive-classification.md` and apply `## UI
     confirmation protocol` when it is gated.
   - Issue exactly one interaction tool call (`browser_click`,
     `browser_fill_form`, or `browser_type`).
   - `browser_snapshot` again before doing anything else, because refs from
     the previous snapshot are invalidated by any navigation or
     DOM-mutating action, and reusing one produces a confusing
     element-not-found failure that looks like an application bug but is
     not.
6. **Record every step's outcome.** Write the fresh snapshot's text to
   `<target-project>/qa-reports/<run-id>-<case-id>-<step>.snapshot.txt` with
   the `Write` tool, then invoke:
   ```
   node <skill-dir>/scripts/ui-case.mjs \
     --results <target-project>/qa-reports/<run-id>.results.json \
     --title "<case title>" --status <passed|failed|blocked> \
     --action <navigate|click|fill|submit|assert> \
     --element "<accessible name>" --url <page-url> \
     --snapshot-file <that snapshot file path>
   ```
   Never write a pass or fail into the report by asserting it in chat — the
   recorder is the only thing that produces a UI verdict, exactly as
   `api-client.mjs` is the only thing that produces an API one. Capture
   `browser_take_screenshot` and pass its path via `--screenshot` as well
   for a failed case, where a picture is worth having next to the tree.
7. **Retry a failed step exactly once** — re-snapshot and repeat that single
   step — before recording the case as failed. Then say so honestly in the
   verdict: a UI failure seen on one run is labelled **unconfirmed**, not
   reproducible, because a single browser run cannot distinguish an
   application defect from a timing artefact. Do not add a second or third
   retry, and never loop a step until it passes — that converts a real
   failure into a silent pass.
8. **Prefer `browser_wait_for`** with a text or state condition over any
   fixed sleep when a step needs the page to settle.
9. **After the flow, run any API cases** the instruction called for through
   `api-client.mjs` with `--storage-state` set to the run's session file,
   following `## Case construction` and `## Confirmation protocol`
   unchanged. No second login.
10. **Render the report** with `scripts/format-report.mjs`, exactly as `##
    Run protocol` step 5 already specifies, and post the same two-way
    summary. Browser cases need no separate report and no separate command.
11. **Close the browser** at the end of the run (`browser_close`).

Never, in a browser run:
- Reuse a ref across an action.
- Fall back to a CSS selector when the accessible name is hard to match — a
  per-project selector is exactly the setup this skill exists to avoid.
- Use a JavaScript-evaluation tool to unblock a stuck flow.
- Approve a batch of destructive clicks in one question.
- Record a UI verdict without a captured snapshot.

## Discovery protocol

This is the loop the orchestrator runs when asked to discover what to test
from a target project's own code (DISC-01) — written to be concrete enough
that two different sessions produce the same sequence. Discovery reads
only the target's source tree and writes nothing into it — the only
artifact it produces is the test-cases document itself, per `## Case
generation protocol` below.

1. **Decide whether this invocation is a full-project scan or a one-off
   scoped instruction**, and say which in chat before starting (D-07/D-12).
   No qualifier beyond a project path means full-project scan of the whole
   repository under the detected router-layout roots (step 4 below) — a
   narrower scan is reached by naming a flow in the instruction, never by a
   separate mode or a flag.
2. **If this is a one-off scoped instruction, follow this branch instead of
   steps 3–12 below** (D-12) — it is self-contained and ends at its own
   hand-off, so a reader follows one branch or the other rather than
   reading the full-scan procedure below and mentally subtracting from it:
   - Resolve the target project root to an absolute path and pick one run
     id, exactly as step 3 below does for a full scan.
   - Detect the router layout, exactly as step 4 below does — the grep
     below still needs to know whether it is looking under `app/` or
     `pages/api/` before it can resolve anything.
   - Resolve the instruction to specific files by grepping its nouns — a
     path fragment, an entity name, a form or page name — against the
     router roots just detected. Do not glob the repository.
   - If nothing resolves, stop and ask the developer which route, folder
     or file to look at. Do not fall back to a full scan: the developer
     asked for one flow, and quietly scanning the whole project spends
     their budget on something they did not request and produces a
     document whose scope does not match its instruction line.
   - If more than one surface resolves, list what was found and ask
     which. Do not pick.
   - Read only the resolved files, plus the two things a surface
     genuinely needs to be understood: for a client-fetch form, the API
     handler it posts to; for a colocated Server Action, the action
     module. Reading two files for one form is the correct cost, and it
     is a different thing from an unscoped repository sweep.
   - Read migration constraints only for the tables the resolved surface
     actually writes to, invoking `discover-schema.mjs` exactly as step 9
     below does — never by eye.
   - Ground every precondición, paso and resultado esperado in what those
     files literally say. Never fabricate a constraint that was not read,
     and never carry an assumption across from a different project or a
     different flow. This is Phase 1's shape-observed discipline applied
     to generation instead of dispatch.
   - Record what was looked at, exactly as step 11 below does for a full
     scan, except `Alcance` here lists the individual files actually
     read, never a glob — the scoped-origin metadata variant
     `references/test-case-format.md` documents.
   - Hand the result to `## Case generation protocol` below unchanged.
     The document format is identical whether the source was a full scan
     or one instruction (D-05) — only the origin, instruction and scope
     metadata lines differ.
3. **For a full-project scan, resolve the target project root to an
   absolute path and pick one run id**, in the same `YYYY-MM-DD-HHmm-<slug>`
   form `## Run protocol` step 3 already uses.
4. **Detect the router layout** from the target's folder structure before
   globbing anything (D-08): an `app` directory with at least one handler
   or page file means App Router; its absence with a `pages/api` directory
   present means Pages Router; both present means both trees are scanned;
   neither present is `unknown` — a hard stop, not an empty result. On
   `unknown`, report exactly what was looked for (`app/` and `pages/api/`)
   and where (the resolved project root), and ask the developer to name
   the route or folder to scan — never emit an empty test-cases document
   for a layout that was simply unrecognised. Full heuristic detail:
   `references/discovery-nextjs.md`.
5. **Glob the target's API handlers and pages under the detected roots** —
   `app/**/route.ts` and `app/**/page.tsx` for App Router,
   `pages/api/**/*.ts` for Pages Router, both when the layout is `both` —
   always excluding `node_modules`, `.next`, `dist`, `build`, `out`,
   `coverage` and `.git` (D-07). Detection detail for every glob — the
   exact patterns, the imperative-validation shape, the Pages Router
   handler shape, and the form-mechanism check below — is documented in
   `references/discovery-nextjs.md`; read that file rather than
   re-deriving the rule from scratch, the same way `## Confirmation
   protocol` step 1 defers to `references/destructive-classification.md`.
6. **Read each matched handler** and record, for every exported HTTP verb
   function (App Router) or every branch of the method switch (Pages
   Router), each early-return validation check with its file, line,
   literal message and status code. These apps validate imperatively, not
   with a schema library — finding no schema import is not evidence that a
   route is unvalidated; read the handler body itself before concluding
   that.
7. **For each matched page, apply the form-mechanism check** from
   `references/discovery-nextjs.md` before deciding anything about that
   surface: look in the same directory for a colocated `actions.ts`
   carrying the server directive first — if present the surface is
   server-action-backed; if absent and the page calls `fetch()` against an
   API path, the surface is client-fetch-backed and resolves to that
   handler.
8. **Invoke `node <skill-dir>/scripts/discover-schema.mjs --project-root
   <target>`** through the Bash tool and read its JSON. Never read
   migration SQL by eye to decide what a constraint says — a policy
   predicate (`WITH CHECK`) and a data constraint (`CHECK`) share the same
   substring, and this script is the only tier permitted to make that call
   (03-RESEARCH.md Pattern 3).
9. **Name each discovered surface** using the convention `## Case
   generation protocol` below groups by: an HTTP method and path for an
   API surface (e.g. `POST /api/categorias`), and a route path plus
   mechanism for a UI surface (e.g. `UI /login (Server Action)`).
10. **Stay inside the resolved project root for the whole scan.** Never
    follow a symlink that points outside it, and never open a file outside
    `references/discovery-nextjs.md`'s documented allowlist even when it
    looks relevant (T-03-07, T-03-09).
11. **Record what was looked at.** The detected router layout goes on the
    generated document's `Router` metadata line; the globs actually
    scanned and the exclusions applied go on its `Alcance` line, per
    `references/test-case-format.md`. A reader must be able to tell what
    was looked at from what was found.
12. **Hand everything recorded** — the route handlers' imperative checks,
    the classified form surfaces, and `discover-schema.mjs`'s JSON — to
    `## Case generation protocol` below.

## Case generation protocol

Turning what `## Discovery protocol` found into
`qa-reports/<run-id>-test-cases.md` is the orchestrator's own judgment call,
styled after `## Case construction`'s bullet rules below. This protocol
defers the document's structure to `references/test-case-format.md` rather
than restating it — read that file for the exact section order, field list
and labeling rule before writing anything.

- **One `##` section per discovered surface** — never one section per file,
  never one giant undifferentiated list.
- **One case per outcome actually observed**, never one per line of code
  and never a flow nobody asked for. Four imperative checks plus a happy
  path in one route handler is five cases, not more and not fewer.
- **`Ejecución` is `API` for a route-handler surface and `UI` for a
  page/form surface**, decided here so the executor never re-infers it at
  run time (D-03).
- **`Tipo` follows `references/test-case-format.md`'s negativo-versus-edge
  rule**: a failure the code itself announces is `negativo`; a failure that
  exists only at the database layer, or an expectation inferred from
  current behavior rather than a stated message, is `edge` and must say so.
  Concretely: a handler that explicitly returns a duplicate-name conflict
  with its own message (`{ error: "Ya existe una categoría con ese
  nombre" }`, 409) grounds a `negativo` case quoting that message verbatim.
  A table with only a database-level `UNIQUE` constraint and no matching
  handler check grounds an `edge` case whose `Resultado esperado` says the
  HTTP behaviour was not verified in the route's code and names the
  migration file and line the constraint came from — an expected result
  inferred from how the code currently behaves is never asserted as a
  requirement.
- **Permission cases are generated from two independent inputs, and
  neither one's result is evidence about the other.** Both passes always
  run over what `## Discovery protocol` handed off: the top-level
  `policies` array from `discover-schema.mjs`'s JSON (each record's
  `policyName`, `table`, `command`, `role`, `using`, `withCheck` and
  `source`), and the in-code role guards found by
  `references/discovery-nextjs.md`'s `## Permission / role-guard
  detection` rubric. At least one permission case is generated per policy
  record and per detected role guard — a policy that guards three
  commands is three cases, not one, and two handlers guarding the same
  role are two cases, matching this section's existing one-case-per-
  observed-outcome discipline rather than one case per table.
- **Every permission case names which pass found it and cites its
  source** — the whole mitigation for reading silence as coverage. A
  policy case cites the migration file and line from the record's
  `source`, quoting the `withCheck` or `using` expression verbatim. A
  role-guard case cites the handler file and line and quotes the literal
  message and status read from it, exactly as `## Permission / role-guard
  detection`'s worked examples do. An empty `policies` array is recorded,
  in the document's scope line and in the chat summary, as
  "no RLS policy matched this parser" — never as a statement that the
  project has no permission boundaries, and never as a reason to skip
  the in-code pass.
  Where no role guard matched either, use the rubric's own finding-nothing
  wording ("no role guard was detected by these named patterns") rather
  than inventing a new phrasing here.
- **`Ejecución` for a permission case is the layer the discovered check
  lives in** — the third case of the `Ejecución` bullet above (D-04): a
  route-handler role guard is `API`, a page or form guard is `UI`, and an
  RLS policy is the `API` surface that writes the table the policy is on,
  named as that surface rather than as the table. Decided here, so the
  executor never re-infers it.
- **Whether a permission case is written runnable or pending depends only
  on whether `QA_AGENT_TOKEN_SECONDARY` is configured** (D-01, D-02) — the
  case itself is always generated, whether or not a second credential
  exists. Check with the exit-code-only presence check `## Configuration`
  documents (`grep -q '^QA_AGENT_TOKEN_SECONDARY=' <target-project>/.env.local`),
  whose output is discarded; reading the env file or printing the
  variable is forbidden here for the same reason it is forbidden there.
  Configured means the layer value above, written plainly. Not configured
  means the pending shape `references/test-case-format.md`'s `### Regla
  de ejecución pendiente` publishes — `<Layer> (pendiente — <motivo>)` —
  written exactly as committed; that shape already carries the layer as
  its own prefix, so D-04's record of which layer the check lives in
  survives the pending state without any change to the case title.
- **The secondary user's role is never asked of the developer up front**
  (D-05). A case's `Resultado esperado` is written as the role boundary
  the discovered check states — the guard's own message when the code
  announces one, the policy's predicate when only the database does — and
  the actual role delta is inferred later, at run time, from the observed
  difference between the two runs `## Running generated cases` performs.
  Generation records the boundary that was found; it never asserts a
  permission model nobody wrote down.
- **A field whose constraint record from `discover-schema.mjs` carries a
  non-null `bounds` gets exactly four boundary cases, in `min-1`, `min`,
  `max`, `max+1` order** (D-09). When only one side of `bounds` resolved,
  generate only that side's pair — never invent the missing side. When
  `bounds` is `null`, generate no boundary case for that field at all
  (D-10). The four values always come from the script's `bounds` JSON,
  never from reading the migration file by eye.
- **A numeric column whose declared SQL type implies a rejection
  generates the odd values that type implies** — zero, a negative value,
  and a decimal in an integer column — even when no `CHECK` resolved any
  bound (D-12). This reads a fact the column's own declared type states,
  which is a different thing from the never-invent-a-threshold rule two
  bullets above (D-10): D-10 forbids inventing a *threshold* nobody
  declared, while this rule reads a fact the column's own declared type
  states. The case cites the column type it was inferred from, never a
  constraint expression, and its title says the value is type-implied —
  e.g. `(valor implicado por el tipo)` — so a reader can tell it apart
  from a case grounded in a `CHECK`. A column whose type implies nothing
  generates none of these cases.
- **No case generated by any rule in this protocol carries an attack
  payload** — no SQL-injection string, no script tag, no traversal
  sequence (D-13). Out-of-range and wrong-type cases are strictly
  data-contract violations: a string where a number is expected, a
  malformed JSON body, an array where an object is expected, a missing
  required field's type counterpart. Injection testing is security
  testing rather than QA-functional testing, and belongs to the
  `security-audit` skill instead — this is a scope boundary the developer
  chose, stated as one rather than left as an omission.
- **A wrong-type or out-of-range case's `Resultado esperado` is the
  generic `debe rechazar la request`, never a specific HTTP status the
  code was never read to confirm** (D-14). The real code — 400, 422, 500,
  or an unvalidated pass-through — is captured as evidence at run time,
  and a project that does not follow REST status conventions to the
  letter must not be handed a false failure verdict for it. A case whose
  status *was* read from the handler's own code is the existing
  `negativo` path and keeps quoting that status verbatim — this rule
  governs the inferred case, not the observed one.
- **The chat summary and the document's scope line describe what this pass
  observed, never that a surface is fully covered.** Systematic boundary
  and permission coverage is a later phase's job (DISC-04/DISC-05); this
  phase records what one discovery pass found, and claiming that pass is
  complete would make a partial scan read like a guarantee. This governs
  the systematic input-validation pass too: the chat summary reports the
  total case count the pass produced, broken down so the developer sees how
  many cases came from boundary expansion versus the rest of the pass, and
  that count is disclosed before the developer is asked to do anything with
  the document — a systematic pass that silently multiplies a surface's
  case count hands the developer an unreadable document and an unaffordable
  run they never agreed to.
- **A literal credential, token or connection string read out of the
  target project is never reproduced** in the document — the shape of a
  constraint is written down, its secret values never are.
- **Write the file with the `Write` tool** to
  `<target-project>/qa-reports/<run-id>-test-cases.md`, creating
  `qa-reports/.gitignore` containing a single `*` line only if one is not
  already there — exactly as `format-report.mjs` does for execution
  reports.
- **Validate the written file by parsing it back** before telling the
  developer anything — invoke
  `node <skill-dir>/scripts/test-case-doc.mjs --file <path>` through the
  Bash tool and confirm it exits 0 with `valid: true`. A non-zero exit
  means the document was written malformed; fix it and re-validate before
  reporting success — never tell the developer a document is ready on the
  strength of eyeballing it.
- **Close with the terminal-step rule (D-10):** post a chat summary
  carrying the surface count, the case count broken down by `Tipo`, and the
  absolute path of the written file — then stop. Running a case is a
  separate, later request (D-11); this invocation never runs one in the
  same turn it generated them.

## Running generated cases

This is D-11's handoff — the developer names a generated document and one
or more case IDs, and those cases dispatch through the existing Phase 1/2
executors unchanged. Phase 3 introduces no new execution path; this
section's whole job is to reach `## Case construction`/`## Confirmation
protocol` (API) or `## UI run protocol`/`## UI confirmation protocol` (UI)
exactly as they already stand.

1. **The developer names a document path and one or more case IDs** (e.g.
   "corré los casos 1, 3 y 5 de qa-reports/2026-08-24-1105-categorias-test-cases.md").
2. **Re-read that document from disk at that moment.** It is meant to be
   edited by hand, so cases may have been struck out, added or rewritten
   since it was written (D-06). Never act on a remembered version from
   earlier in the conversation, and never assume the IDs still mean what
   they meant at generation time.
3. **Resolve each named case by invoking the reader's CLI** — `node
   <skill-dir>/scripts/test-case-doc.mjs --file <path> --case <id>` —
   through the Bash tool, and read its JSON. Never grep the document and
   read the matched heading by eye: a short ID is a substring of a longer
   one (`case-1` inside `case-12`), and this is the same reason an HTTP
   verdict comes from `api-client.mjs`'s JSON rather than from reading raw
   output. An exit code other than 0 means the case could not be resolved
   — report the CLI's own message and stop for that case rather than
   guessing at what was meant.
4. **Dispatch by the case's `Ejecución` field.** For `API`, construct the
   `api-client.mjs` invocation exactly as `## Case construction` already
   specifies, using the case's `Pasos` as the developer's instruction. For
   `UI`, follow `## UI run protocol` from step 2 onward, using the case's
   `Pasos` to derive the step loop. Neither protocol changes for a case
   that arrived this way instead of from a fresh natural-language
   instruction.
5. **Every case still passes through `## Confirmation protocol` or `## UI
   confirmation protocol` at dispatch.** A case document is a description,
   never an approval: a case whose steps describe a destructive action
   stops and asks exactly as it would have without a document. This is why
   `validateTestCasesDoc` refuses any document carrying a literal from
   `FORBIDDEN_DISPATCH_FLAGS` (exit 9) — a document that already carried
   `--confirmed` would be an approval nobody gave in this moment.
6. **Render the report with `scripts/format-report.mjs`**, exactly as
   `## Run protocol` step 5 already specifies. Cases run this way produce
   an ordinary run report; results are never written back into the case
   document — the document and the report are two separate artifacts, and
   running a case never mutates the document it came from.

Closing note, in the other direction from D-10: generating a document
never runs a case in the same invocation, and running cases the way this
section describes never regenerates the document. Each is a terminal step
for its own invocation.

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
- **`--secondary`** is added only for a case whose own steps describe acting
  as the second, lower-privilege user; it is never combined with
  `--storage-state`, which the script refuses because the two name different
  identities; and it is never added speculatively to see what happens, for
  the same reason `--allow-non-local` is never added preemptively. The
  resulting case's evidence records which credential ran it, so a reader of
  the report can tell the two runs of a role-boundary pair apart.

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
