# Playwright MCP Setup

This is the only setup step Phase 2 adds beyond the environment variables
(`QA_AGENT_UI_USER`, `QA_AGENT_UI_PASSWORD`, `QA_AGENT_TOKEN`, `QA_AGENT_BASE_URL`)
already documented in `SKILL.md`. It is a **one-time action per machine or per
project**, not something you repeat per run. Honestly: this is new setup
surface relative to Phase 1, which needed no MCP registration at all — API-only
testing had nothing to register. Browser testing (EXEC-01, EXEC-02) needs a
real Chromium process under the orchestrator's control, and that process is
`@playwright/mcp` (D-01).

The package was verified by a human before it was ever fetched or executed —
see `## Package legitimacy` below.

## Register the server (recommended: user scope)

```bash
claude mcp add playwright --scope user -- npx @playwright/mcp@latest --isolated --caps=storage
```

This registers the server once, under the key `playwright`, and makes it
available in **every** project you open with Claude Code afterwards — which is
what keeps this skill's "runs unmodified against any of the team's projects"
promise intact (DATAX, dotax, franquix, or any future target). RESEARCH's
primary recommendation was project scope (a `.mcp.json` checked into each
target repo); this plan deliberately chose user scope instead, so a developer
registers Playwright MCP once per machine and it just works in whichever
project they later run `/qa-agent` against, rather than re-registering it in
every target repo. That divergence from RESEARCH is recorded here on purpose,
not an accident.

## Alternative: project scope

A team that wants the registration version-controlled inside one specific
repo can commit a `.mcp.json` at that project's root instead:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--isolated", "--caps=storage"]
    }
  }
}
```

This repo's own `.mcp.json` (repo root) is exactly this snippet — it doubles
as this skill's own dev-time registration and as the copy-paste example above.

A project-scoped server from `.mcp.json` requires a **one-time interactive
approval** the first time Claude Code loads that project. A first-run
developer should expect that prompt — the browser tools being temporarily
absent until approved is expected behavior, not a broken install.

## The verified flags

Discovered hands-on this session by running `npx @playwright/mcp@latest --help`
against the resolved version (`@playwright/mcp@0.0.79`, `npm view @playwright/mcp version`),
not inferred from summarized documentation:

- **`--isolated`** — "keep the browser profile in memory, do not save it to
  disk." Each run gets a fresh, non-persistent profile, so a session never
  bleeds between the team's different target projects through a shared
  Chromium user-data directory.
- **`--caps=storage`** — opt-in capability flag (comma-separated list; other
  values are `vision`, `pdf`, `devtools`) that enables the
  `browser_storage_state` / `browser_set_storage_state` / cookie / localStorage
  tools. Not required to *load* a session at startup (see below) — required
  only if the orchestrator needs to call those tools mid-session.
- **`--storage-state <path>`** — "path to the storage state file for isolated
  sessions." This is the flag that loads `scripts/ui-login.mjs`'s output file
  as the server's startup session. It is a **core** flag, not gated behind any
  `--caps` value.
- **Chromium-only (D-02)** — verified by omission, not by an explicit flag.
  `--browser <browser>`'s own `--help` text lists its possible values as
  `chrome, firefox, webkit, msedge` — plain `"chromium"` is **not** one of the
  documented choices. The bundled Chromium engine is what the server launches
  when `--browser` is left out entirely, which is the verified way to satisfy
  D-02: do not pass `--browser` at all.

## How the login script's session reaches the browser

`scripts/ui-login.mjs` writes a fresh, timestamped `storage-state.json` file
per run (`qa-reports/<stamp>-storage-state.json`) — a static path can't be
baked into a user- or project-scoped `.mcp.json` ahead of time. Two ways to
hand that file to the running server, both accepted by the flags above:

1. **At server startup**, pass `--storage-state <path>` pointing at that run's
   file — verified hands-on this session (see `## Assumption verification`).
2. **After the server is already running** (the common case, since the server
   is registered once and reused across runs), call the `browser_set_storage_state`
   tool with the file's path — documented by the vendor as part of the
   `--caps=storage` tool group; not independently exercised this session
   beyond confirming the flag that enables it starts cleanly.

Either way, the MCP server's own storage tooling is a **convenience**, not a
dependency. The path this skill actually depends on is the one plan 02-01
already proved end to end: `ui-login.mjs` produces the session file, and both
the MCP browser session and `api-client.mjs --storage-state` consume it
independently (D-08). A future reader should not treat the MCP server's
storage-export tool as load-bearing.

## Verify your install

1. In a Claude Code session with this skill installed, check the session's MCP
   tool list for entries prefixed `mcp__playwright__` (e.g.
   `mcp__playwright__browser_navigate`, `mcp__playwright__browser_snapshot`).
   This prefix is what `SKILL.md`'s allowed-tools list and plan 02-02's
   `PreToolUse` hook matchers are both written against — a different server
   key would break both silently.
2. Confirm `npx @playwright/mcp@latest --help` exits `0` from the project
   root — proves the approved package resolves and runs on this machine.

## Troubleshooting

- **Browser tools don't appear in the session at all.** Usually means the
  server is registered in a different scope than the session is running
  under (e.g. registered `--scope project` in a repo you didn't open, or
  `--scope user` but the session predates registration — restart Claude
  Code). Check `claude mcp list` for the `playwright` entry and its scope.
- **Missing Chromium binary.** Run `npx playwright install chromium`. This is
  the same one-time download plan 02-01 already required for
  `scripts/ui-login.mjs`'s own `chromium.launch()` calls — one binary serves
  both.
- **Startup session file rejected / login looks stale.** Re-run
  `scripts/ui-login.mjs` — a `storage-state.json` file expires with the
  session it captured, so an old file being rejected (or accepted but
  producing an unauthenticated browser) usually just means the session behind
  it is gone, not that the file's format is wrong.

## Package legitimacy

`@playwright/mcp` triggered a `too-new` (`SUS`) verdict from the automated
publish-recency heuristic during RESEARCH. A human confirmed the package
identity before it was ever executed on this machine (Task 1 of this plan, a
blocking `checkpoint:human-verify`):

- **Name:** `@playwright/mcp` exactly — scoped to `@playwright`, unscoped name
  `mcp`. No near-miss spelling (`playwright-mcp`, `@playwright-mcp/server`,
  `mcp-playwright`, `@microsoft/playwright-mcp`) was substituted.
- **Version:** `0.0.79`
- **Repository:** `github.com/microsoft/playwright-mcp`
- **Weekly downloads:** 6,659,312 — millions, not hundreds or thousands,
  inconsistent with a slopsquat.

## Assumption verification

Tested this session against `@playwright/mcp@0.0.79` (2026-08-12), the version
resolved by `npx @playwright/mcp@latest` at the time of this plan's execution.

**A2 — persistent profile vs. `storageState.json`.** RESEARCH's Assumption A2
claimed Playwright MCP's default "persistent" profile mode stores a Chromium
user-data directory that is *not* the same artifact as a Playwright
`storageState.json`, and that `--isolated` plus a storage-capability flag is
required to get a `request.newContext()`-compatible file. **Observed:
confirmed, with one clarification.** `--isolated` keeps the profile in memory
rather than writing a user-data directory to disk — the persistent-vs-isolated
distinction is real and matches RESEARCH's framing. But loading a *file* at
startup does not itself require `--caps=storage`: `--storage-state <path>` is
a core flag, independent of `--caps`. This session ran `scripts/ui-login.mjs`
against the project's own mock login fixture, confirmed the written file is a
JSON document with exactly `cookies` and `origins` keys (both arrays, never a
directory), and started `@playwright/mcp@0.0.79 --isolated --caps=storage
--storage-state <that file>` — the process stayed running for several seconds
with no stderr output, i.e. it accepted the flag and the path without
rejecting either.

**A4 — the capability flag's exact spelling.** RESEARCH's Assumption A4
guessed the storage-related MCP tools require an explicit `--caps=storage`
flag. **Observed: confirmed exactly as guessed**, though the `--help` text's
own "possible values" list for `--caps` (`vision, pdf, devtools`) is
incomplete — it omits `storage` (and `network`, `config`, `testing`), all of
which the vendor's own README documents as valid `--caps` values gating their
own tool groups. `--caps=storage` was accepted without error when the server
was started with it this session.

**Standing note (D-08).** This skill's session comes from
`scripts/ui-login.mjs` by design, not from driving the login form through
interactive MCP tool calls — the plaintext `QA_AGENT_UI_PASSWORD` never enters
the orchestrator's own context. The MCP server's own storage-export/import
tooling (`browser_storage_state`, `browser_set_storage_state`) is therefore
not on this skill's critical path; it is documented above only because a
developer might reasonably reach for it.
