---
phase: 02-browser-execution-engine
plan: 03
subsystem: mcp-setup
tags: [playwright-mcp, mcp-json, storage-state, package-legitimacy]

# Dependency graph
requires:
  - phase: 02-browser-execution-engine
    provides: "02-01's scripts/ui-login.mjs and its storageState output shape — this plan proves that file is acceptable to the Playwright MCP server at startup"
provides:
  - ".mcp.json: Playwright MCP server registration under the key `playwright` (--isolated --caps=storage, no --browser flag), the copy-paste snippet for project-scope installs"
  - "references/mcp-setup.md: the verified one-time setup procedure, the real flag surface read off npx @playwright/mcp@latest --help, and a dated A2/A4 outcome record"
affects: [02-04-ui-case-runner]

# Actuals (#2632)
actuals:
  tokens: 2500
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added:
    - "@playwright/mcp@0.0.79 (npm, not a project dependency — invoked via npx per the vendor's own installation pattern)"
  patterns:
    - "Hands-on flag discovery over inferred documentation: this plan's whole purpose was running the installed package's own --help and README rather than trusting RESEARCH's WebFetch-summarized guesses, and it found one flag was right (--caps=storage), one was right with a caveat (--storage-state doesn't need --caps at all), and one didn't exist as guessed (there is no explicit --browser chromium value — Chromium-only is the CLI's own default when --browser is omitted)"

key-files:
  created:
    - .mcp.json
    - references/mcp-setup.md
  modified: []

key-decisions:
  - "Registered under user scope (claude mcp add playwright --scope user) as the primary recommended path, diverging from RESEARCH's project-scope recommendation, because a user-scoped server is available in every target project (DATAX/dotax/franquix) without per-repo re-registration — the divergence and its rationale are recorded in mcp-setup.md, not left implicit"
  - "D-02's Chromium-only requirement is satisfied by omitting --browser entirely, not by an explicit flag value — npx @playwright/mcp@latest --help's own possible-values list for --browser is chrome/firefox/webkit/msedge, with no plain 'chromium' entry; the bundled Chromium is the documented default when --browser is left unset"
  - "--caps=storage is documented as required only for the browser_storage_state/browser_set_storage_state/cookie/localStorage MCP tools, not for loading a session file at startup — --storage-state <path> is a core flag independent of --caps, discovered by reading the full --help output rather than assuming the two were coupled"

patterns-established:
  - "Pattern: verify a fast-moving sub-1.0 dependency's real flag surface against its own --help/README before writing config that encodes guessed flag names, and write down any correction with the exact evidence, not just the corrected value"

requirements-completed: [EXEC-01, EXEC-02]

coverage:
  - id: D1
    description: "Package legitimacy: the exact scoped name @playwright/mcp and its Microsoft source repository were confirmed by a human before the package was ever fetched or executed"
    verification:
      - kind: other
        ref: "Task 1 (checkpoint:human-verify, gate=blocking-human) resolved via the orchestrator's pre-dispatch AskUserQuestion checkpoint, evidence: npm view @playwright/mcp name version repository.url -> @playwright/mcp 0.0.79 git+https://github.com/microsoft/playwright-mcp.git; 6,659,312 weekly downloads; developer selected \"Approved\""
        status: pass
    human_judgment: true
    rationale: "A blocking-human package-legitimacy checkpoint per protocol — resolved by the human developer, not by this executor, before any @playwright/mcp code ran on this machine."
  - id: D2
    description: ".mcp.json registers exactly one server under the key `playwright`, launched via npx, with args referencing @playwright/mcp, and parses as valid JSON"
    requirement: EXEC-01
    verification:
      - kind: other
        ref: "node one-liner (mcp-json-ok) — this plan's own <verify> block, run against the committed file"
        status: pass
    human_judgment: false
  - id: D3
    description: "npx @playwright/mcp@latest --help exits 0, proving the human-approved package resolves and runs on this machine, and every flag written into .mcp.json (--isolated, --caps=storage) appears verbatim in that output"
    requirement: EXEC-01
    verification:
      - kind: other
        ref: "npx @playwright/mcp@latest --help (exit 0); flags cross-checked against both the CLI --help text and the installed package's own README.md Configuration table"
        status: pass
    human_judgment: false
  - id: D4
    description: "The storage-state file scripts/ui-login.mjs produces is a JSON document with cookies and origins keys (arrays, not a directory), and @playwright/mcp accepts its path via --storage-state at server startup without erroring"
    requirement: EXEC-02
    verification:
      - kind: e2e
        ref: "Scratchpad verification run this session: started scripts/__fixtures__/mock-login-app.mjs, ran scripts/ui-login.mjs against it with QA_AGENT_UI_USER=qa-test-user / QA_AGENT_UI_PASSWORD=CorrectHorseBatteryStaple! (the fixture's own defaults), confirmed the written file's keys are exactly cookies,origins (both arrays), then started @playwright/mcp@0.0.79 --isolated --caps=storage --storage-state <that file> and observed it stay running 4s with zero stderr/stdout output"
        status: pass
    human_judgment: false
  - id: D5
    description: "references/mcp-setup.md is at least 40 lines and records the tested version, the verified flags, the user-scope-over-project-scope decision and rationale, and a dated outcome for RESEARCH Assumptions A2 and A4"
    requirement: EXEC-01
    verification:
      - kind: other
        ref: "node one-liners: mcp-setup-ok (required substrings present), setup-length-ok (185 lines, well over the 40-line floor)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Full suite (npx vitest run) is still green — this plan ships no code, only config and documentation"
    verification:
      - kind: unit
        ref: "npx vitest run — 127/127 tests passing across 9 files, unchanged from plan 02-02's baseline"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-08-12
status: complete
---

# Phase 2 Plan 3: Playwright MCP Setup Summary

**Registered `@playwright/mcp` in `.mcp.json` (`--isolated --caps=storage`, Chromium-only by omission) with flags read off the installed version's own `--help`/README rather than RESEARCH's inference, and wrote `references/mcp-setup.md` recording a dated, hands-on outcome for both unverified research assumptions.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-12T22:45:00Z
- **Completed:** 2026-08-12T23:03:32Z
- **Tasks:** 2 (Task 1 resolved via orchestrator pre-dispatch checkpoint; Task 2 executed by this agent)
- **Files modified:** 2 (both created)

## Task 1: Package legitimacy gate — already resolved

Task 1 (`type="checkpoint:human-verify"`, `gate="blocking-human"`) was resolved
**before this agent was dispatched**, in the orchestrator's own session, via an
`AskUserQuestion` checkpoint. This executor did not re-run or re-ask this
check — per this run's explicit instructions, doing so would have been
redundant and contrary to the checkpoint-already-resolved protocol.

Evidence shown to the developer at approval time:

- `npm view @playwright/mcp name version repository.url` → `name: @playwright/mcp`,
  `version: 0.0.79`, `repository: git+https://github.com/microsoft/playwright-mcp.git`
- Weekly downloads (npm downloads API, last-week window): **6,659,312**
- The developer reviewed this against the plan's six-point checklist (exact
  scoped name, no near-miss spelling, Microsoft-org repository, download
  volume in the millions) and selected **"Approved."**

This satisfies the plan's `must_haves` truth: "The exact package name
`@playwright/mcp` and its Microsoft source repository were confirmed by a
human before the package was ever executed."

## Task 2: Register Playwright MCP and verify flags hands-on

### Accomplishments

- **Discovered the real flag surface** by running `npx @playwright/mcp@latest --help`
  and reading the installed package's own `README.md` (both fetched fresh —
  version resolved to `0.0.79`, matching RESEARCH's own verified version), not
  by trusting RESEARCH's WebFetch-summarized inference.
- **`.mcp.json`** registers one server under the key `playwright`:
  `npx @playwright/mcp@latest --isolated --caps=storage`, with no `--browser`
  flag. That server key matters beyond this file — plan 02-02's `PreToolUse`
  hook matchers and plan 02-04's allowed-tools list are both built from the
  `mcp__playwright__` prefix, and it was **not** changed from `playwright`.
- **`references/mcp-setup.md`** (185 lines): register-then-verify setup
  procedure, user-scope-primary / project-scope-alternative registration
  commands, the verified flag list with one-line explanations, a "verify your
  install" checklist, a troubleshooting section for the three most likely
  first-run failures, and a dated `## Assumption verification` section.
- **Hands-on verification of A2 and A4** (see Deviations below for the exact
  corrections found).

### Task Commits

Each task was committed atomically:

1. **Task 2: Register Playwright MCP and verify flags hands-on** - `7f30d9a` (feat)

_No plan-metadata commit — per this run's instructions, STATE.md/ROADMAP.md
updates are owned by the orchestrator, not this executor._

## Files Created

- `.mcp.json` — Playwright MCP server registration (`playwright` key,
  `--isolated --caps=storage`, no `--browser` flag)
- `references/mcp-setup.md` — the verified one-time setup procedure, flag
  list, and the A2/A4 assumption-verification record

## Decisions Made

- **User scope over project scope.** Registered as
  `claude mcp add playwright --scope user -- npx @playwright/mcp@latest --isolated --caps=storage`
  as the primary recommended path, diverging deliberately from RESEARCH's
  project-scope recommendation — a user-scoped server needs no re-registration
  per target project. Project scope is documented as the alternative for teams
  that want the registration version-controlled inside one specific repo.
- **Chromium-only by omission, not by an explicit flag.** `--browser`'s own
  documented possible values (`chrome, firefox, webkit, msedge`) do not
  include a plain `"chromium"` value. D-02's single-Chromium-context
  requirement is satisfied by leaving `--browser` unset entirely — the
  documented default — rather than by passing a flag value that isn't in the
  tool's own accepted list.
- **`--caps=storage` is not required to load a session at startup.** Read
  the full `--help` output and the vendor README's tools reference rather
  than assuming `--storage-state` was gated behind `--caps`; it is a core
  flag. `--caps=storage` is only what unlocks the mid-session
  `browser_storage_state`/`browser_set_storage_state`/cookie/localStorage
  tools, which this plan documents as a convenience layered on top, not what
  makes the startup path work.

## Deviations from Plan

### Auto-fixed / Corrected Findings (Rule 2 — recording a discovered correction, not a bug)

**1. RESEARCH Assumption A4 — confirmed, with an undocumented `--help` gap noted**
- **Found during:** Task 2, step (a) — reading `npx @playwright/mcp@latest --help`
- **What RESEARCH guessed:** the storage-related tools require an explicit
  `--caps=storage` (or similarly spelled) capability flag.
- **What was observed:** confirmed exactly — `--caps=storage` is the correct
  spelling, and the server accepted it without error. One gap worth recording:
  the `--help` text's own "possible values" list for `--caps` only shows
  `vision, pdf, devtools` — it omits `storage` (and `network`, `config`,
  `testing`), all of which the same package's own `README.md` documents as
  valid values gating their own tool groups. The `--help` text is
  incomplete relative to the vendor's own generated docs; this session cross-
  checked both rather than trusting either alone.
- **Files affected:** `references/mcp-setup.md` (`## Assumption verification`,
  A4 entry) documents this gap explicitly so a future reader checking only
  `--help` isn't misled into thinking `storage` is unsupported.
- **Commit:** `7f30d9a`

**2. RESEARCH Assumption A2 — confirmed, with one mechanic clarified**
- **Found during:** Task 2, step (c) — hands-on spike (mock login app →
  `ui-login.mjs` → real `@playwright/mcp` process)
- **What RESEARCH guessed:** the default "persistent" profile mode is a
  Chromium user-data directory, not a `storageState.json`, and `--isolated`
  plus a storage-capability flag is required to get a
  `request.newContext()`-compatible file.
- **What was observed:** confirmed on the persistent-vs-isolated distinction.
  Clarified on the mechanism: loading a *file* at startup uses the core
  `--storage-state <path>` flag, which does **not** itself require
  `--caps=storage` — that capability flag only gates the mid-session
  import/export *tools*, not the startup-time file load. The storage-state
  file produced by `scripts/ui-login.mjs` was confirmed to be a JSON document
  with exactly `cookies` and `origins` keys (both arrays), and
  `@playwright/mcp@0.0.79 --isolated --caps=storage --storage-state <that file>`
  started and stayed running for 4 seconds with zero stderr/stdout output —
  i.e. no rejection of the flag or the path.
- **Files affected:** `references/mcp-setup.md` (`## Assumption verification`,
  A2 entry)
- **Commit:** `7f30d9a`

**3. A flag the plan expected did not exist as written — Chromium-only pinning**
- **Found during:** Task 2, step (a)
- **What the plan expected:** "the flag that pins the browser to Chromium,
  since D-02 limits this project to a single Chromium context."
- **What was observed:** no CLI value pins to plain Chromium. `--browser`'s
  documented values are `chrome, firefox, webkit, msedge` (Chrome-family
  *channels*, plus the two other engines) — `"chromium"` is not among them.
  The bundled Chromium is the default when `--browser` is omitted, confirmed
  against both the `--help` text and the package's config-file schema
  (`browserName?: 'chromium' | 'firefox' | 'webkit'` in the programmatic
  config, which is a different surface than the CLI flag). `.mcp.json`
  therefore omits `--browser` entirely rather than passing an unsupported
  value.
- **Files affected:** `.mcp.json` (no `--browser` flag present),
  `references/mcp-setup.md` (`## The verified flags`, "Chromium-only" entry)
- **Commit:** `7f30d9a`

---

**Total deviations:** 3 findings, all resolved by writing down the correction
rather than silently working around it (per this plan's own stated purpose).
No architectural change (Rule 4) was triggered — all three are corrections to
flag-level detail, not to the D-01/D-02 decisions themselves.

## Issues Encountered

None beyond the findings documented above.

## User Setup Required

The Playwright MCP server itself still needs to be registered by each
developer on their own machine — `.mcp.json` in this repo covers the
project-scope path automatically once this repo is opened in Claude Code
(with the standard one-time interactive approval prompt), or a developer can
run the user-scope `claude mcp add` command from `references/mcp-setup.md`
directly. Neither was run as part of this plan's execution — registering the
server interactively is out of scope for a non-interactive script and is
correctly left to the developer, per `references/mcp-setup.md`'s own
instructions.

## Next Phase Readiness

- `.mcp.json` and `references/mcp-setup.md` are both ready for plan 02-04 (the
  UI case runner), which is the first plan that will actually drive
  `mcp__playwright__*` tool calls and link to `references/mcp-setup.md` from
  `SKILL.md`'s Installation section.
- `SKILL.md` was **not** touched by this plan, per its explicit scope
  boundary (plan 02-02 modified it in the same wave; plan 02-04 will add the
  pointer to `references/mcp-setup.md`).
- No blockers identified for plan 02-04.
- Deferred to end-of-phase UAT (`workflow.human_verify_mode: end-of-phase`):
  in a live Claude Code session with the skill installed, confirm the
  `mcp__playwright__*` tools appear in the session's tool list and that
  `browser_navigate` followed by `browser_snapshot` returns a real
  accessibility tree — this plan verified the server process starts cleanly
  and accepts the registered flags, but did not drive a full MCP client
  handshake end to end (that requires a live Claude Code session, not a
  scriptable spike).

---
*Phase: 02-browser-execution-engine*
*Completed: 2026-08-12*

## Self-Check: PASSED

Both created files confirmed present on disk (`.mcp.json`, `references/mcp-setup.md`);
task commit hash `7f30d9a` confirmed present in `git log`; both plan `<verify>`
node one-liners (`mcp-json-ok`, `mcp-setup-ok`, `setup-length-ok`) re-run
against the committed files and passing; `npx @playwright/mcp@latest --help`
exits 0; `npx vitest run` 127/127 passing.
