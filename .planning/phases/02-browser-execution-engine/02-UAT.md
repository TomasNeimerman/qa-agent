---
status: testing
phase: 02-browser-execution-engine
source: [02-VERIFICATION.md]
started: 2026-08-12T20:30:00-03:00
updated: 2026-08-12T20:30:00-03:00
---

## Current Test

number: 1
name: Live natural-language browser run against a real target app
expected: |
  The agent logs in once (ui-login.mjs), walks the flow via browser_navigate/browser_snapshot/
  browser_click/browser_fill_form targeting elements by role/accessible name, pauses via
  AskUserQuestion on any destructive-looking control, records every step through ui-case.mjs,
  and produces one qa-reports/*.md report containing both the browser cases and any API cases
  from the same run — with exactly one storage-state file for the whole run (confirming a
  single login, per API-03).
awaiting: user response

## Tests

### 1. Live natural-language browser run against a real target app
expected: |
  Install the skill in a live Claude Code session with Playwright MCP registered (per
  references/mcp-setup.md). Point it at a real running local or staging app with a login
  form and a form flow (e.g. DATAX/dotax/franquix's own "alta de cliente" equivalent). Give
  the instruction as a base URL plus a Spanish sentence, e.g. "probá el alta de cliente".
  Expect the agent to log in once, drive the browser end to end, pause before destructive
  clicks, and produce one combined report with exactly one storage-state file for the run.
result: [pending]

### 2. Live PreToolUse hook firing for a destructive UI click
expected: |
  In the same or a separate live session, drive the agent toward a button labelled with a
  D-06 keyword (e.g. "Eliminar") and observe both (a) whether the orchestrator's own
  AskUserQuestion pause fires (the primary layer) and (b) whether confirm-destructive-ui.mjs's
  PreToolUse hook independently escalates the same browser_click call to a separate Claude
  Code permission dialog (the secondary/hardening layer). Carried forward from Phase 1 UAT
  Test 4 and 02-REVIEW.md's WR-1 — hook firing has never been observed working live.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
