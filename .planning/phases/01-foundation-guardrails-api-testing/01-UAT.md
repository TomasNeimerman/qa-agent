---
status: partial
phase: 01-foundation-guardrails-api-testing
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md
started: 2026-08-11T15:00:00Z
updated: 2026-08-11T15:45:00Z
---

## Current Test

[testing paused — 2 items outstanding, deferred to Phase 2+ live session]

## Tests

### 1. Install skill via symlink/junction with zero project-specific setup
expected: Copy/link the skill directory into `~/.claude/skills/qa-agent`, invoke via `/qa-agent`, no per-project config needed beyond the target's own `.env.local`
result: issue
reported: "Installed via Windows junction (`mklink /J`). Invoking the script through the junction silently no-op'd — exit 0, zero output, no file written. Root cause: `isMain` module-entrypoint check compared `import.meta.url` to `pathToFileURL(process.argv[1])` without resolving symlinks, so it mismatched under the very install method the README documents."
severity: major
fixed: true
fix_commit: a51ab32
fix_summary: "isMain now resolves both sides via realpathSync before comparing (api-client.mjs, format-report.mjs). Re-verified after fix: skill invokes correctly through the junction, full suite still 81/81 green."

### 2. Real GET request against a live local target, evidence captured, report generated
expected: `/qa-agent <base-url> "probá GET ..."` dispatches a real HTTP GET via Playwright, captures full request/response as evidence, writes both a chat summary and a Markdown report in `<target>/qa-reports/`, with the auth token redacted everywhere
result: pass
reported: "Ran GET /api/ext/capabilities against DATAX-web on localhost:3000 (real Next.js dev server). Got a 200, full evidence captured (status, headers, body), report rendered to qa-reports/*.md with Authorization shown as [REDACTED] in both the .json and .md artifacts. Confirmed via direct file read."

### 3. Destructive action (DELETE/POST/PUT) triggers live confirmation pause
expected: Attempting a destructive call against a real target pauses execution, shows method/URL/body, and waits for explicit yes/no before dispatching
result: skipped
reason: "No destructive endpoint was exercised against a live target this session — DATAX-web's available API routes weren't probed for a safe-to-call mutating one. Confirmation-gate logic (requiresConfirmation, exit-3 refusal, --declined path, evidence-on-block) is covered by 23/23 passing tests in scripts/destructive.test.mjs and scripts/api-client.test.mjs (plan 01-02). Deferred rather than blocking — low risk given unit coverage, but should be exercised live before this becomes a habit the team trusts against real destructive endpoints."

### 4. PreToolUse hook backstop fires inside a real Claude Code session
expected: A destructive `api-client.mjs` Bash invocation is intercepted by the skill's `PreToolUse` hook and escalated to Claude Code's own permission dialog, independent of the orchestrator's own prompted pause
result: skipped
reason: "Not observed live this session — the hook mechanics are unit-tested (scripts/confirm-destructive.test.mjs) but the hook's actual registration/firing inside an installed Claude Code session was flagged as Assumption A2 in 01-RESEARCH.md (single-source, not independently verified) and has not yet been confirmed empirically."

## Summary

total: 4
passed: 1
issues: 1 (found and fixed live)
pending: 0
skipped: 2
blocked: 0

## Gaps

(none open — the one issue found (Test 1) was diagnosed and fixed in this same session, commit a51ab32, and re-verified passing)
