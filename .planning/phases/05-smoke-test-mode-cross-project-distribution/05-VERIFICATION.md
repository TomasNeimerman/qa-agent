---
phase: 05-smoke-test-mode-cross-project-distribution
verified: 2026-09-21T16:10:00Z
status: gaps_found
score: 12/14 must-haves verified
behavior_unverified: 2
overrides_applied: 1
overrides:
  - must_have: "A live smoke run is executed against each project's own localhost or staging target and its per-project pass/fail/blocked counts and report path are recorded (PKG-02, D-08, D-09, D-10)"
    reason: "User decision (relayed by the orchestrator): live dispatch happened only against franquix; DATAX-web not re-run; dotax descoped (no fixed environment). Discovery, generation and smoke selection ran on all three."
    accepted_by: "user (relayed by orchestrator; name not recorded in the phase artifacts)"
    accepted_at: "2026-09-21"
gaps:
  - truth: "MUST NOT weaken, skip, batch, or pre-approve the destructive-action confirmation gate for a smoke case (05-01 prohibition, threat T-05-01: the FORBIDDEN_DISPATCH_FLAGS refusal 'still stands between a smoke case and a destructive call')"
    status: failed
    reason: "CR-01 confirmed by reproduction. The --smoke branch of scripts/test-case-doc.mjs runs parseTestCasesDoc + selectSmokeCases only; neither scans FORBIDDEN_DISPATCH_FLAGS. Only findCase (--case) and validateTestCasesDoc do. SKILL.md Smoke-test protocol hands the set to Running generated cases steps 4-6, skipping step 3 (the --case scan), so nothing on the smoke path ever scans the selected cases."
    artifacts:
      - path: "scripts/test-case-doc.mjs"
        issue: "main() --smoke branch (approx. lines 745-760) does not call validateTestCasesDoc / flag scan; plain validate of the same file exits 9, --smoke exits 0 and prints the flags in `pasos`"
      - path: "SKILL.md"
        issue: "## Smoke-test protocol has no validation/scan step before dispatch (step 4 selection -> step 6 handoff)"
      - path: "scripts/test-case-doc.test.mjs"
        issue: "no test asserts that a forbidden flag in a selected case makes --smoke fail"
    missing:
      - "In the --smoke branch run validateTestCasesDoc(markdown) first and exit 9 (empty stdout) if invalid, or scan the selected cases against FORBIDDEN_DISPATCH_FLAGS"
      - "CLI test: a selected positivo case whose Pasos contains --confirmed / --allow-non-local -> exit 9, empty stdout"
      - "Optionally: SKILL.md Smoke-test protocol step stating the scan/validation runs before dispatch"
behavior_unverified_items:
  - truth: "SC1/REP-03 end to end: a natural-language 'corré un smoke test' request is routed by the skill, runs the CLI selection, reports the honest summary (surfaces, skipped, pending, 'subset not health') BEFORE dispatch, and dispatches the set through the unchanged Run protocol"
    test: "In a Claude Code session on a project with an existing qa-reports/*-test-cases.md, say 'corré un smoke test' against a local target"
    expected: "Skill triggers; it invokes test-case-doc.mjs --smoke; chat summary names surfaces/skipped/pendientes and states it is a subset; each destructive case pauses for confirmation; a normal qa-reports report is rendered"
    why_human: "The protocol is prose executed by an LLM orchestrator. The CLI half is tested; the routing, summary and handoff behaviour cannot be proven by grep. The franquix live runs in 05-CROSS-PROJECT-VALIDATION.md used hand-built cases, not the --smoke set (the document says so itself)."
  - truth: "No-document branch: smoke request on a project without a test-cases document runs discovery + generation and stops at the run offer naming the smoke count (never generates a smaller ad-hoc set, never runs in the same turn)"
    test: "Say 'corré un smoke test' in a project with no qa-reports/*-test-cases.md"
    expected: "Discovery/generation run, doc is written, turn ends with an offer naming smoke count and pending count separately; nothing dispatched"
    why_human: "Ordering/terminal-step invariant of an LLM-followed protocol; no test exercises it."
human_verification:
  - test: "PKG-03 / D-12 teammate dry run: a teammate who has not worked in this repo follows SKILL.md ## Installation from scratch (copy folder, npm install inside it, set env vars, invoke /qa-agent against one of their projects)"
    expected: "Skill is invocable and runs an API case with no step the teammate had to guess at"
    why_human: "Only a real person unfamiliar with the repo can produce D-12 evidence. The agent's clean-directory rehearsal proves mechanical sufficiency only (05-03-SUMMARY says so explicitly). Logged open in .planning/WINDOWS.md #1."
  - test: "Smoke-mode end-to-end run (see behavior_unverified_items above)"
    expected: "See above"
    why_human: "LLM-orchestrated protocol"
---

# Phase 05: Smoke-Test Mode & Cross-Project Distribution - Verification Report

**Phase Goal:** The agent supports a fast post-deploy smoke check and is packaged so any teammate can install it and run it unmodified against any of the team's projects.
**Verified:** 2026-09-21
**Status:** gaps_found (one real code gap, CR-01; plus a human-only item that keeps PKG-03 open)
**Re-verification:** No - initial verification

Stance: SUMMARY claims were not trusted. I re-ran every CLI acceptance command, re-ran discovery/validation/smoke against the three real repos, reproduced CR-01 with a modified fixture, and re-read the SKILL.md / mcp-setup.md text.

## Goal Achievement

### Roadmap Success Criteria

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| SC1 | User can invoke a "smoke test" mode that runs only essential flows quickly (REP-03) | VERIFIED (mechanism) / PRESENT_BEHAVIOR_UNVERIFIED (end-to-end invocation) | `selectSmokeCases` + `--smoke` CLI exist and behave exactly as specified (below). `## Smoke-test protocol` exists in SKILL.md (line 658) with trigger, no-doc branch, re-read, CLI selection, honest summary, handoff; description carries smoke phrases. No test or live run has exercised the NL-trigger -> protocol -> dispatch path. |
| SC2 | Skill runs unmodified against DATAX, dotax, franquix with no project-specific config (PKG-02) | VERIFIED (scoped by user decision) | Re-ran on all three: `discover-schema.mjs` exit 0; generated docs `valid:true`; `--smoke` `counts.selected` = 1 on each. Router = App Router on all three. Live dispatch only on franquix (localhost:3000, two reports exist on disk); DATAX-web not re-run, dotax descoped. No skill code keyed on project name (grep: only comments in discover-schema.mjs / ui-destructive.mjs). Recorded as override. Note: "DATAX" is validated via DATAX-web; C:\DATAX (Bejerman/Express) is explicitly recorded as out of the declared stack. |
| SC3 | Teammate installs by copying into skills folder and invokes via slash command, no setup beyond that (PKG-03) | PRESENT_BEHAVIOR_UNVERIFIED (human_needed) | SKILL.md `## Installation` is a numbered 5-step procedure (copy/junction -> `npm install` inside copied folder, Node `>=22` matches `package.json` engines -> env vars -> Playwright MCP browser-only, deferring to mcp-setup.md -> invoke). PKG-01 no-project-setup sentence preserved. Rehearsal in clean dir recorded (agent self-rehearsal). No real teammate has followed it. Wording nuance: ROADMAP says "no setup beyond that" while the doc (per D-13, a deliberate decision) requires `npm install` and env vars; not a defect, but the SC text is stricter than the shipped design. |

### Plan-level must-haves

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | `--smoke` on sample-test-cases.md selects exactly case-1, case-6, case-8, case-13; counts surfaces 4/selected 4/skipped 0/pendientes 0/API 4 UI 0 | VERIFIED | Ran it: exit 0, single JSON line, exact ids and counts |
| 2 | Scoped fixture selects one case with `ejecucion` UI | VERIFIED | Ran it: `case-1`, `ejecucion":"UI"`, byEjecucion UI 1 |
| 3 | Surface without positivo -> not selected, named in `skipped` | VERIFIED | smoke fixture: `skipped` = `DELETE /api/insumos/:id`, motivo text present |
| 4 | Pending first-positivo stays selected, not replaced, counted in `pendientes` | VERIFIED | smoke fixture: case-5 `pendiente:true`, `pendienteMotivo:"falta 2do usuario"`, `counts.pendientes:1`; later runnable case not substituted |
| 5 | No write-back; fixtures unchanged after smoke run | VERIFIED | `git status --short scripts/__fixtures__` empty after runs; selector is pure (13 `selectSmokeCases` references in the test file) |
| 6 | `--smoke --case 3` exit 2 naming both flags; missing file exit 2; new fixture validates | VERIFIED | Ran: exit 2 "--smoke cannot be combined with --case"; exit 2 File not found; smoke fixture `valid:true` |
| 7 | SKILL.md `## Smoke-test protocol` hands off to Running generated cases steps 4-6, NL trigger only, no new flag | VERIFIED (prose present; behavior see SC1) | Read lines 658-719; `argument-hint` untouched; no new allowed-tools |
| 8 | No-document branch reuses discovery/generation, ends at run offer, never a separate smaller set | VERIFIED (prose) / PRESENT_BEHAVIOR_UNVERIFIED | Step 2 present as specified; not exercised |
| 9 | PROHIBITION: smoke must not skip/weaken/pre-approve the confirmation gate | FAILED | See CR-01 below |
| 10 | PROHIBITION: smoke run never reported as health/regression; summary names skipped + pending separately | VERIFIED (prose, judgment-tier, flagged) | Step 5 requires exactly this. Non-authoritative: unverified-prohibition, human review recommended (covered by behavior_unverified item 1). |
| 11 | Discovery -> generation -> smoke selection on DATAX-web, dotax, franquix from one unmodified skill | VERIFIED | Re-ran all nine commands; results match the validation doc (`constraints` 4/569/233 etc. per doc; docs valid; selected 1 each) |
| 12 | Validation doc records per project root, router layout, counts, smoke JSON, skipped, `Skill-code change required: none` | VERIFIED | 05-CROSS-PROJECT-VALIDATION.md read in full; all sections present, honest about scope |
| 13 | `C:\DATAX` recorded explicitly as out of declared stack, DATAX-web named as the validated substitute | VERIFIED | `## Out of declared stack` section present |
| 14 | Live run against each project | PASSED (override) | franquix only; override above. Caveats recorded honestly in the doc: live cases were hand-built, not the `--smoke` set; run 2 left a real test row (`Z-QA-TEST-1`) in franquix's DB; credentials/URL contain no secrets. |
| 15 | Installation: numbered, prerequisites named, no install script/checklist/new env var, PKG-01 preserved | VERIFIED | SKILL.md lines 35-66; `QA_AGENT_*` set = BASE_URL, TOKEN, TOKEN_SECONDARY, UI_PASSWORD, UI_USER (all documented in Configuration; the plan's "four" was stale since Phase 4 added SECONDARY); no install script exists; mcp-setup.md `##` headings unchanged (8) |
| 16 | mcp-setup.md states which runs need it, alternatives framed, Verify your install has pass/fail per check | VERIFIED | Lines 1-2, 40-ish, 112-127 read |
| 17 | Clean-directory rehearsal proves steps mechanically sufficient | VERIFIED (per SUMMARY; not re-executed by me) / explicitly NOT D-12 | I did not re-run `npm install`. SUMMARY records versions matching lockfile and exit codes, and states plainly it is self-review. |

Score: 12 of 14 counted must-haves verified (SC1 mechanism, SC2 scoped, plan truths 1-8 selection/protocol prose, 10-13, 15-16; truth 14 counted via override). Excluded from the score: truth 9 (FAILED), SC3/PKG-03 (human), and the two end-to-end smoke-protocol behaviors (2 behavior-unverified items).

## CR-01 Assessment (reproduced)

Repro: copied `sample-test-cases-smoke.md`, replaced case-5 `Pasos` with `DELETE /api/insumos/1 --confirmed --allow-non-local`.
- `--smoke`: exit 0, JSON prints the string in `pasos`.
- plain validate: exit 9, two "forbidden dispatch flag" errors naming case-5.

Is it a must-have gap? Yes. Plan 05-01 T-05-01 states the FORBIDDEN_DISPATCH_FLAGS refusal "still stands between a smoke case and a destructive call", and the plan's first prohibition forbids skipping/pre-approving the gate for a smoke case. The Smoke-test protocol routes to Running generated cases steps 4-6 and skips step 3, where `findCase` performs the scan. A hand-edited document therefore reaches dispatch with the pre-approval literal unscanned. Step 5 of Running generated cases says the refusal exists precisely for this ("a document that already carried --confirmed would be an approval nobody gave").

Severity bounded by defense in depth, which is why this is one gap rather than a phase collapse:
- `confirm-destructive.mjs` PreToolUse hook escalates destructive api-client calls to a permission dialog even when `--confirmed` is present.
- `api-client.mjs` exit-3 gate and the orchestrator's Confirmation protocol remain.
- Residual hole: `--allow-non-local` (exit-6 production-host gate) on a non-destructive case has no second layer; the hook only covers destructive methods. Also, the no-document path validates the doc at write time, but an existing hand-edited document is never re-validated on the smoke path.

Fix is small (call `validateTestCasesDoc` in the `--smoke` branch; add one CLI test). The warnings WR-01..WR-07 from 05-REVIEW.md are not treated as must-have gaps except as noted below.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| REP-03 | 05-01 | smoke test mode running only essential flows quickly | PARTIAL - selection + protocol exist and are tested; blocked from clean SATISFIED by CR-01 and unverified end-to-end invocation. REQUIREMENTS.md shows Complete; that is premature until CR-01 is fixed. |
| PKG-02 | 05-02 | agnostic across projects (Next.js/Supabase) | SATISFIED (scoped) - discovery/generation/selection on 3 repos; live on franquix only, by user decision (override). REQUIREMENTS.md `[x]` Complete is consistent with the scoped closure but should carry that qualifier. |
| PKG-03 | 05-03 | distributable to team by copying into skills folder | NEEDS HUMAN - docs done and mechanically rehearsed; D-12 teammate dry run not performed. REQUIREMENTS.md correctly still `[ ]` / Pending. |

No orphaned requirements: REQUIREMENTS.md maps exactly REP-03, PKG-02, PKG-03 to Phase 5, all claimed by plans 01, 02, 03 respectively.

## Anti-Patterns / Other Findings

| File | Item | Severity |
|---|---|---|
| scripts/test-case-doc.mjs | CR-01 (above) | BLOCKER (gap) |
| references/mcp-setup.md:26,50,123 | `@playwright/mcp@latest` unpinned; the recorded legitimacy check is for a specific version (WR-07) - directly relevant to PKG-03 distribution safety | WARNING |
| SKILL.md smoke protocol | No rule for which `*-test-cases.md` to use when several exist / how project path and base URL resolve (WR-05) - a real teammate would hit this | WARNING |
| scripts/test-case-doc.mjs | Zero-surface document validates `valid:true` (WR-02); `--case`/`--smoke` arg parsing edge cases (WR-01) | WARNING |
| .planning/ROADMAP.md | Phase 5 plan checkboxes (05-01..03) still `[ ]` and phase listed unchecked | INFO (bookkeeping) |
| franquix DB | Test venta `Z-QA-TEST-1` and heartbeat left behind by live run 2 (recorded in validation doc) | INFO (owner cleanup) |
| npm test | 356/358; the two failures (`ui-login.test.mjs`, `api-client.test.mjs`) got exit 7 where 2 was expected - env-leak of UI credentials, in files this phase did not touch | INFO (pre-existing, not attributed to phase) |

Debt-marker scan (TBD/FIXME/XXX) was not the concern raised here; none of the reviewed findings involve them.

## Gaps Summary

One gap blocks a clean pass: the `--smoke` path skips the forbidden-dispatch-flag scan (CR-01), contradicting the 05-01 prohibition and T-05-01 mitigation. It is reproduced, small to fix, and should be closed with `/gsd-plan-phase --gaps` (or a quick fix + test) before marking REP-03 complete.

Independently of the gap, the phase cannot reach `passed` because two things need a human: the D-12 teammate dry run (keeps PKG-03 Pending, correctly) and one real end-to-end natural-language smoke run through the protocol (the franquix live evidence used hand-built cases rather than the `--smoke` set). PKG-02 is honestly scoped: live dispatch on franquix only; this is stated in the validation document and accepted as an override, not a three-project live pass.

---

_Verified: 2026-09-21_
_Verifier: Claude (gsd-verifier)_
