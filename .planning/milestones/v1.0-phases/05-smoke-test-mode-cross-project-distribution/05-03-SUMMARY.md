---
phase: 05-smoke-test-mode-cross-project-distribution
plan: 03
subsystem: testing
tags: [documentation, packaging, distribution, mcp-setup, installation]

# Dependency graph
requires:
  - phase: 05-smoke-test-mode-cross-project-distribution
    provides: "plan 05-01's deterministic --smoke CLI and ## Smoke-test protocol section, unchanged by this plan; the existing SKILL.md ## Installation/## Configuration and references/mcp-setup.md wording this plan tightens"
provides:
  - "A numbered, prerequisite-complete SKILL.md ## Installation procedure (copy -> npm install -> configure -> register MCP -> invoke), naming the Node >=22 prerequisite read from package.json"
  - "A tightened ## Configuration preamble stating which environment variable a given run type actually needs, with no variable added, moved, or removed"
  - "references/mcp-setup.md wording that states up front which kind of run needs the file, frames user-scope vs. project-scope registration as two alternatives, and sharpens ## Verify your install's two checks with pass/fail meaning and Troubleshooting cross-references"
  - "A recorded clean-directory rehearsal proving the rewritten Installation steps are mechanically sufficient (npm install resolves the locked dependency tree; the reader's validation and --smoke selection both exit 0), explicitly distinguished from D-12's still-open teammate dry run"
affects: []

# Actuals (#2632)
actuals:
  tokens: 1513
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Doc-tightening plans stay prose-only: no install script, no post-install checklist, no new environment variable, no vendoring -- the plan's whole output is edited Markdown plus a recorded rehearsal, mirroring D-11/D-13's explicit rejection of new tooling"
    - "A rehearsal that proves mechanical sufficiency (agent follows its own doc in a clean directory) is a strictly weaker claim than a human dry run (D-12), and the two must be reported as separate rows, never merged into one green checkmark"

key-files:
  created: []
  modified:
    - SKILL.md
    - references/mcp-setup.md

key-decisions:
  - "The clean-directory rehearsal copied only the skill's distributable content (SKILL.md, package.json, package-lock.json, scripts/, references/) into the OS temp directory, excluding this dev repo's .git/.planning/.claude/.gsd/.playwright-mcp/qa-reports and, deliberately, .env.local -- the plan's own instruction only named node_modules as excluded; the dev-repo-only directories carry no bearing on whether npm install or the reader scripts work, and .env.local was excluded specifically so no credential-bearing file was ever copied out of its original location"
  - "## Configuration was tightened with a one-paragraph preamble stating which variable a given run type needs, rather than restructuring the existing bullet list or exit-code table -- keeps the plan's 'do not move variables between sections' constraint intact while resolving the ambiguity for a first-time installer"
  - "references/mcp-setup.md's two registration paths were made explicit alternatives via one linking sentence ('pick one, not both') placed before both headings, rather than adding a new heading -- keeps the file's ## heading list unchanged as the acceptance criteria required"

patterns-established: []

requirements-completed: [PKG-03]

coverage:
  - id: D1
    description: "SKILL.md ## Installation is a numbered five-step procedure (copy -> npm install inside the copied folder -> configure -> register MCP for browser runs only -> invoke), names the Node >=22 prerequisite read from package.json engines, defers browser-only MCP registration to references/mcp-setup.md instead of restating it, and preserves the PKG-01 no-project-setup claim verbatim in force; ## Configuration keeps the exit-code-only presence check and the never-read/never-print prohibition, and documents no environment variable beyond the existing five"
    requirement: PKG-03
    verification:
      - kind: manual_procedural
        ref: "grep -c 'npm install' SKILL.md -> 1 (step names 'inside the copied skill folder'); grep -c 'mcp-setup.md' SKILL.md -> 2; node -e \"require('./package.json').engines.node\" -> '>=22', matching the text; grep -c 'PKG-01' SKILL.md -> 2; env-var regex scan over SKILL.md returns exactly the pre-existing five names (QA_AGENT_BASE_URL, QA_AGENT_TOKEN, QA_AGENT_TOKEN_SECONDARY, QA_AGENT_UI_PASSWORD, QA_AGENT_UI_USER), no new name added"
        status: pass
      - kind: integration
        ref: "node scripts/test-case-doc.mjs --file scripts/__fixtures__/sample-test-cases.md --smoke"
        status: pass
    human_judgment: false
  - id: D2
    description: "references/mcp-setup.md states on its opening lines which kind of run needs the file (browser) and which does not (API-only); the two registration scopes read as explicit alternatives with a stated recommendation; ## Verify your install's two checks each state a pass condition and a failure condition cross-referencing the matching ## Troubleshooting entry; ## Package legitimacy and ## Assumption verification are untouched; no new ## heading was added"
    requirement: PKG-03
    verification:
      - kind: manual_procedural
        ref: "git diff -- references/mcp-setup.md: no +##/-## lines (heading set unchanged, 8 headings before and after); diff shows no lines inside ## Package legitimacy or ## Assumption verification"
        status: pass
    human_judgment: false
  - id: D3
    description: "The rewritten Installation procedure was followed verbatim in a fresh throwaway directory: npm install resolved dotenv@17.4.2, playwright@1.62.1, zod@4.4.3, exactly matching package-lock.json's pinned versions, and the reader's plain validation and --smoke selection over the copied sample-test-cases.md fixture both exited 0 -- mechanical proof the documented steps produce a working skill, not merely a folder that exists"
    requirement: PKG-03
    verification:
      - kind: manual_procedural
        ref: "npm install in /tmp/qa-agent-rehearsal-* (exit 0, 'added 73 packages'); per-dependency version comparison against package-lock.json (3/3 match); node scripts/test-case-doc.mjs --file scripts/__fixtures__/sample-test-cases.md (exit 0, valid:true); ... --smoke (exit 0, 4 surfaces selected, 0 skipped)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-12's actual teammate dry run (someone unfamiliar with this repo following SKILL.md ## Installation from scratch, on their own machine, against one of their projects) has not been performed. It is the only thing that closes PKG-03, and the agent's own clean-directory rehearsal (D3) does not substitute for it -- logged to .planning/WINDOWS.md as unrun-verify entry #1"
    requirement: PKG-03
    verification: []
    human_judgment: true
    rationale: "D-12 requires a person who does not already know this repo to follow the doc; a rehearsal run by the agent that wrote the doc is self-review and cannot produce that evidence. This is an explicit human-check in the plan's Task 2 <verify> block, not something the executor can satisfy on its own."

# Metrics
duration: 35min
completed: 2026-09-21
status: complete
---

# Phase 5 Plan 3: Packaging & Distribution Wording Summary

**Rewrote `SKILL.md`'s `## Installation`/`## Configuration` into a numbered, prerequisite-complete procedure and `references/mcp-setup.md`'s opening/registration/verification wording, then proved the steps mechanically sufficient by following them verbatim into a clean throwaway directory.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-21T10:48:00-03:00
- **Completed:** 2026-09-21T10:53:45-03:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `SKILL.md` `## Installation` is now a numbered five-step procedure (copy/symlink -> `npm install` inside the copied folder -> set env vars -> register Playwright MCP for browser runs only -> invoke via slash command), naming the Node `>=22` prerequisite read from `package.json`'s `engines` field and deferring the browser-only MCP registration to `references/mcp-setup.md` instead of restating it. The PKG-01 "nothing installed into the project under test" claim survives verbatim.
- `## Configuration` gained a one-paragraph preamble telling a first-time installer which variable a given run type actually needs (`QA_AGENT_TOKEN` alone for API-only; `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` for browser; `QA_AGENT_TOKEN_SECONDARY` for permission cases), without adding a variable, restructuring the exit-code table, or moving anything between sections.
- `references/mcp-setup.md` now states, in its first two lines, that a browser run needs the file and an API-only run does not; frames the user-scope and project-scope registration paths as explicit alternatives with a stated recommendation; and sharpens `## Verify your install`'s two checks to each state a pass condition, a failure condition, and a cross-reference to the matching `## Troubleshooting` entry. `## Package legitimacy` and `## Assumption verification` were left untouched, and no `##` heading was added.
- The rewritten Installation procedure was followed verbatim in a fresh OS-temp directory (`node_modules` excluded from the copy): `npm install` resolved `dotenv@17.4.2`, `playwright@1.62.1`, `zod@4.4.3` — exactly matching `package-lock.json` — and the reader's plain validation and `--smoke` selection over a copied fixture both exited `0`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Tighten `## Installation` and `## Configuration` into a numbered, prerequisite-complete procedure** - `2b5896e` (docs)
2. **Task 2: Tighten the MCP setup wording and rehearse the documented install in a clean directory** - `aa33311` (docs)

## Files Created/Modified

- `SKILL.md` - `## Installation` rewritten as a numbered five-step procedure; `## Configuration` gained a run-type preamble paragraph
- `references/mcp-setup.md` - opening states which run needs the file; registration paths framed as alternatives; `## Verify your install` sharpened with pass/fail wording and Troubleshooting cross-references

## Decisions Made

- The clean-directory rehearsal copied only the skill's distributable content (`SKILL.md`, `package.json`, `package-lock.json`, `scripts/`, `references/`), excluding this dev repo's `.git`/`.planning`/`.claude`/`.gsd`/`.playwright-mcp`/`qa-reports` and, deliberately, `.env.local`. The plan's own instruction named only `node_modules` as an exclusion; the dev-repo-only directories have no bearing on whether `npm install` or the reader scripts work, and `.env.local` was excluded specifically so no credential-bearing file was ever moved out of its original location — this is a rehearsal safety choice, not evidence of a doc gap a real teammate would hit (a teammate's own copy of the skill folder would not contain this dev repo's GSD tooling in the first place).
- `## Configuration`'s ambiguity was resolved with a short preamble paragraph rather than restructuring the bullet list or exit-code table, keeping the plan's explicit "do not move variables between sections" and "do not restructure the exit-code table beyond 05-01's change" constraints intact.
- `references/mcp-setup.md`'s two registration paths were made explicit alternatives via one linking sentence placed before the existing headings, rather than adding a new heading — keeps the file's `##` heading list exactly as it was, which the acceptance criteria required.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

`npm test` was run after each task per the plan's `<verify>` block. Both runs reproduce the same two pre-existing, unrelated failures already documented in `05-01-SUMMARY.md` (`scripts/api-client.test.mjs` and `scripts/ui-login.test.mjs`, both expecting exit code `2` but observing `4`/`7` for "missing credentials" tests — consistent with an ambient `.env.local`/environment leak into the test shell, not a defect in this plan's changes). Reproduced at both commits (`2b5896e`, `aa33311`): `356/358` tests pass, `2` pre-existing failures in files this plan did not touch. Per the executor's scope-boundary rule (only auto-fix issues directly caused by the current task's changes), these were not touched. This is the same, already-logged issue 05-01 encountered — not a new discovery, and not owned by this plan's file set (`SKILL.md`, `references/mcp-setup.md`).

The rehearsal itself surfaced no doc gap requiring a fix: `npm install`, the plain validation, and the `--smoke` selection all worked exactly as the rewritten `## Installation` describes, with no step the rehearsal had to guess at beyond the dev-repo-exclusion choice noted above under "Decisions Made."

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `SKILL.md` `## Installation`/`## Configuration` and `references/mcp-setup.md` are tightened and mechanically proven sufficient by this plan's clean-directory rehearsal.
- **PKG-03 is NOT fully closed.** This rehearsal proves the written steps are mechanically sufficient (an agent following its own doc produces a working skill) — it is explicitly *not* D-12's teammate dry run (a person unfamiliar with this repo following the doc from scratch, on their own machine, against one of their own projects). That human check is logged as `.planning/WINDOWS.md` unrun-verify entry #1 and is the only thing that actually closes PKG-03. No blockers to running it — it just has not happened yet.
- This plan does not depend on and did not touch plan 05-02's in-progress cross-project validation work (`05-CROSS-PROJECT-VALIDATION.md`, the `QA_AGENT_TOKEN`/dotax/franquix blocker recorded in `STATE.md`'s Blockers/Concerns) — both plans remain independently trackable.

## Self-Check: PASSED

- FOUND: SKILL.md
- FOUND: references/mcp-setup.md
- FOUND commit: 2b5896e
- FOUND commit: aa33311

---
*Phase: 05-smoke-test-mode-cross-project-distribution*
*Completed: 2026-09-21*
