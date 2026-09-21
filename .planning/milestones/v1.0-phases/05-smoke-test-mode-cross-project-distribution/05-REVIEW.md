---
phase: 05-smoke-test-mode-cross-project-distribution
status: issues_found
depth: standard
files_reviewed: 5
findings:
  critical: 1
  warning: 7
  info: 4
  total: 12
reviewed: 2026-09-21
---

# Phase 05 Code Review (standard depth)

Files: scripts/test-case-doc.mjs, scripts/test-case-doc.test.mjs, scripts/__fixtures__/sample-test-cases-smoke.md, SKILL.md, references/mcp-setup.md.

## Critical

### CR-01: `--smoke` skips the forbidden-dispatch-flag scan
**File:** scripts/test-case-doc.mjs:745-760 (also SKILL.md:707-711)
The `--smoke` branch calls `parseTestCasesDoc` + `selectSmokeCases`, neither of which scans `FORBIDDEN_DISPATCH_FLAGS`; only `findCase` (`--case`) and `validateTestCasesDoc` do. Repro: a positivo case whose `Pasos` is `DELETE /api/insumos/1 --confirmed --allow-non-local` -> `--smoke` exits 0 with that string in `pasos`; plain validate exits 9. SKILL.md hands the smoke set to Run steps 4-6, skipping step 3 (the scan), so a pre-approval flag can reach dispatch.
**Fix:** in the `--smoke` branch run `validateTestCasesDoc(markdown)` first and exit 9 if invalid; add a CLI test (forbidden flag in a selected case -> exit 9, empty stdout).

## Warnings

- **WR-01** (test-case-doc.mjs:680-729): `--case` with no value falls through to full validation, exit 0; `--case --smoke` runs smoke; `--smoke <token>` consumes the next token. Reject boolean `case`/`file`, treat `--smoke` as a pure flag, reject unknown flags.
- **WR-02** (test-case-doc.mjs:508-678): a document with zero surfaces/cases validates `valid: true`; a truncated generation passes. Error on zero surfaces or cases.
- **WR-03** (test-case-doc.mjs:114): `CITATION_RE` accepts any `word:digits` (`status:401`, `10:30`); does not require a real file+line. Require a path-like segment with extension, allow `[ ]` in the class.
- **WR-04** (test-case-doc.mjs:138-152, 596-674): text between a surface's `Origen` line and its first case is never flag-scanned; duplicate field bullets silently overwrite; only first line of a field is captured.
- **WR-05** (SKILL.md:658-719): smoke protocol does not say which `*-test-cases.md` to use when several exist, nor how project path and base URL are resolved.
- **WR-06** (SKILL.md:115-118, 478): `QA_AGENT_TOKEN_SECONDARY` presence check only greps `.env.local`; misses shell-exported vars and `export X=`; an empty `X=` counts as configured.
- **WR-07** (references/mcp-setup.md:26,50,97-103; SKILL.md:10,228-231): `@playwright/mcp@latest` voids the recorded legitimacy check (pin `@0.0.79`); `--caps=storage` unneeded; storage-state handoff to the browser session undefined; no Windows `cmd /c npx` form.

## Info

- **IN-01:** shipped docs reference planning artifacts (D-xx, 03-RESEARCH.md, "Task 1 of this plan", repo-root `.mcp.json`).
- **IN-02:** SKILL.md exit-code table omits test-case-doc.mjs exit 2 cases; exit 9 prints only first error though header says full list.
- **IN-03:** dead/misleading code (`warnings` never populated, shadowed `title`, no-op `replace` in test, weak `toContain(flag.replace(/^--/,''))` assertion).
- **IN-04:** smoke fixture case-5 uses an `admin` second user (contradicts low-privilege secondary model); surfaces 2 and 3 have overlapping origins; empty `Origen del surface` still validates.
