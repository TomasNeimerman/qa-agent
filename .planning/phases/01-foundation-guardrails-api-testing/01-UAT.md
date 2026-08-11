---
status: complete
phase: 01-foundation-guardrails-api-testing
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-04-SUMMARY.md
started: 2026-08-11T15:00:00Z
updated: 2026-08-11T15:55:00Z
---

## Current Test

[testing complete]

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
result: pass
reported: "Dispatched DELETE against the mock server (not DATAX-web — no safe-to-mutate endpoint was available there without risking real dev data). Unconfirmed call correctly refused: exit 3, zero HTTP traffic, preview shown (method/URL/body). Orchestrator relayed the preview to the developer via AskUserQuestion per SKILL.md's Confirmation protocol; developer approved; re-invoked with --confirmed and the DELETE dispatched for real (204, evidence captured, token redacted). Script-level gate (Layer 1, D-01–D-04) fully verified live."

### 4. PreToolUse hook backstop fires inside a real Claude Code session
expected: A destructive `api-client.mjs` Bash invocation is intercepted by the skill's `PreToolUse` hook and escalated to Claude Code's own permission dialog, independent of the orchestrator's own prompted pause
result: issue
reported: "No additional Claude Code permission dialog was observed when the confirmed DELETE command ran via the Bash tool in this session — only the orchestrator-driven AskUserQuestion pause (Test 3) occurred. The skill's SKILL.md correctly declares `hooks: PreToolUse: - matcher: Bash ... command: confirm-destructive.mjs`, but nothing indicates Claude Code actually registered/fired it for this Bash call. This matches 01-RESEARCH.md's Assumption A2 (single-source, unverified claim about skill-scoped hooks) — now empirically unconfirmed rather than just unverified. Not a regression from the plan's own design: Layer 1 (Test 3, the script-level gate) is the actual hard guarantee per D-01–D-04 and is fully working; Layer 2 (this hook) was always documented as additional hardening, not the sole enforcement mechanism. Root cause not diagnosed — possibilities include: skill-frontmatter hooks not supported by the installed Claude Code version, hooks needing registration via project/user settings.json rather than SKILL.md frontmatter, or hooks only activating for Bash calls Claude itself initiates while \"inside\" a skill invocation rather than a manually-run one. Worth a follow-up investigation, not a Phase 1 blocker."
severity: minor

## Summary

total: 4
passed: 2
issues: 2 (both found and diagnosed to the extent possible; Test 1 fixed, Test 4 root-caused as an unresolved Claude Code capability question, not a code defect in this skill)
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "PreToolUse hook fires as an independent enforcement layer for destructive Bash calls, per SKILL.md hooks frontmatter"
  status: unconfirmed
  reason: "No permission dialog observed for a confirmed destructive api-client.mjs call in this session; script-level gate (Layer 1) is unaffected and fully verified"
  severity: minor
  test: 4
  root_cause: "Unknown — either a Claude Code runtime limitation on skill-frontmatter hooks, a missing settings.json registration step, or a hook-activation scope this manual test didn't trigger. Not diagnosed via /gsd-debug this session."
  artifacts: []
  missing: ["Confirm whether Claude Code needs skill hooks mirrored into .claude/settings.json to activate", "Re-test by having Claude itself (not a human-directed manual command) invoke the destructive call inside a live /qa-agent run"]
  debug_session: ""
