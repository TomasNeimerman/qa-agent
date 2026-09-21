---
phase: 03-dual-discovery-test-case-generation
plan: 02
subsystem: testing
tags: [nextjs, app-router, pages-router, server-actions, vitest, discovery, fixtures]

# Dependency graph
requires:
  - phase: 03-dual-discovery-test-case-generation
    plan: 01
    provides: scripts/__fixtures__/mock-target-repo (the App Router fixture repo this plan extends), SKILL.md's ## Discovery protocol / ## Case generation protocol sections this plan expands in place, references/test-case-format.md's Router/Alcance metadata lines this plan's SKILL.md edit now populates
provides:
  - references/discovery-nextjs.md — the detection-rule contract for App/Pages Router handlers, forms, Server Actions, imperative validation and router-layout detection
  - scripts/discovery-surfaces.test.mjs — proof that every documented pattern finds its fixture surfaces across all three router layouts, and an anti-drift lock against the doc and SKILL.md
  - scripts/__fixtures__/mock-target-repo/app/login (Server-Action form pair) and app/registro + app/api/registro (client-fetch form + the API route it posts to)
  - scripts/__fixtures__/mock-target-repo-pages and scripts/__fixtures__/mock-target-repo-hybrid — Pages Router and both-layouts fixture repos
  - SKILL.md "## Discovery protocol" expanded to glob forms, detect router layout ahead of any glob, and record Router/Alcance metadata
affects: [03-03-execution-handoff-validator]

# Actuals (#2632)
actuals:
  tokens: 9963
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Minimal glob-to-RegExp translator (supports only '**' and '*', the two shapes every pattern here uses) built specifically for scripts/discovery-surfaces.test.mjs's walkFixture helper, rather than a full glob engine or fs.globSync (still Experimental in this Node version per 03-01-RESEARCH.md)"
    - "readdirSync(root, { withFileTypes: true, recursive: true }) with entry.parentPath reconstruction, matching 03-RESEARCH.md's verified-stable recursive-readdir recommendation"
    - "Regex .source string embedded verbatim (character-for-character) in references/discovery-nextjs.md as the anti-drift lock target — scripts/discovery-surfaces.test.mjs asserts doc.includes(PATTERN.source) rather than re-deriving the pattern from prose"

key-files:
  created:
    - references/discovery-nextjs.md
    - scripts/discovery-surfaces.test.mjs
    - scripts/__fixtures__/mock-target-repo/app/login/actions.ts
    - scripts/__fixtures__/mock-target-repo/app/login/page.tsx
    - scripts/__fixtures__/mock-target-repo/app/registro/page.tsx
    - scripts/__fixtures__/mock-target-repo/app/api/registro/route.ts
    - scripts/__fixtures__/mock-target-repo-pages/pages/api/legacy.ts
    - scripts/__fixtures__/mock-target-repo-hybrid/app/page.tsx
    - scripts/__fixtures__/mock-target-repo-hybrid/pages/api/legacy.ts
  modified:
    - SKILL.md

key-decisions:
  - "Form-mechanism precedence pinned as server-action-wins when both a colocated actions.ts (carrying 'use server') and a fetch() call are present in the same page — a bound form action attribute is what the browser actually submits through, so it takes precedence over a fetch() call elsewhere in the same file. Pinned by an explicit synthetic-fixture test (mkdtempSync), not left as an incidental consequence of check ordering."
  - "Pattern constants declared and used only inside scripts/discovery-surfaces.test.mjs (not exported from a separate implementation module) — the file's own header comment states explicitly it is a proof the documented rule matches real file shapes, not a component of the runtime discovery path, which stays with the orchestrator's own Glob/Grep tool calls at run time."
  - "SKILL.md's exclusion list gained 'out' (previously node_modules/.next/dist/build/coverage/.git only, missing 'out') to match the full EXCLUDED_DIRS set the plan's must_haves require and scripts/discovery-surfaces.test.mjs's doc-agreement test enforces against both references/discovery-nextjs.md and SKILL.md."
  - "Router-layout detection step inserted immediately after target-root resolution and before any glob step in SKILL.md's numbered Discovery protocol, so the protocol never globs before it knows which tree(s) to glob — matches the plan's stated ordering rationale exactly."

patterns-established:
  - "Pattern 3: form-mechanism detection is an ordered check with an explicit, separately-tested tie-break (colocated actions.ts wins), never an implicit consequence of if/else branch order left unverified"
  - "Pattern 4: a router-layout heuristic returns one of a closed set of named outcomes including a distinct 'unknown', never conflating 'nothing recognized' with an empty/zero-surface result"

requirements-completed: [DISC-01]

coverage:
  - id: D8
    description: "A form under app/**/page.tsx is correctly classified as server-action-backed (colocated actions.ts carrying 'use server') or client-fetch-backed (fetch() call resolving to an existing app/**/route.ts), with server-action winning when both signals are present in the same page"
    requirement: "DISC-01"
    verification:
      - kind: unit
        ref: "scripts/discovery-surfaces.test.mjs — 'form discovery — app-router fixture' and 'form mechanism tie-break' describe blocks (5 tests)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Imperative validation (no schema library) is extracted from route handlers as file+line+literal-message+4xx-status records; the categorias fixture's four checks are all found and all fall in the 400-499 range"
    requirement: "DISC-01"
    verification:
      - kind: unit
        ref: "scripts/discovery-surfaces.test.mjs — 'API-handler discovery — app-router fixture' describe block"
        status: pass
    human_judgment: false
  - id: D10
    description: "The target project's router layout (App Router / Pages Router / both / unknown) is detected from folder structure alone, with 'unknown' a distinct, nameable stop condition rather than an empty result, and an App Router directory with no handler/page file does not by itself yield layout 'app'"
    requirement: "DISC-01"
    verification:
      - kind: unit
        ref: "scripts/discovery-surfaces.test.mjs — 'router layout detection' describe block (5 tests, including empty-app and unknown-layout edge cases)"
        status: pass
    human_judgment: false
  - id: D11
    description: "The Pages Router handler shape (default-exported, method-switching) is structurally distinct from the App Router's (one exported function per verb) — the App Router verb-export pattern finds nothing in a Pages Router file, proving layout detection must precede globbing rather than being a post-hoc fallback"
    requirement: "DISC-01"
    verification:
      - kind: unit
        ref: "scripts/discovery-surfaces.test.mjs — 'Pages Router handler shape' describe block"
        status: pass
    human_judgment: false
  - id: D12
    description: "Every pattern constant and every excluded directory scripts/discovery-surfaces.test.mjs relies on is present, verbatim, in references/discovery-nextjs.md (and every excluded directory also in SKILL.md) — the anti-drift lock between documented rule and proven rule"
    requirement: "DISC-01"
    verification:
      - kind: unit
        ref: "scripts/discovery-surfaces.test.mjs — 'pattern doc agreement (anti-drift lock)' describe block (5 tests)"
        status: pass
    human_judgment: false
  - id: D13
    description: "SKILL.md's ## Discovery protocol section, expanded in place, still keeps every Phase 1/2 section and the ## Case generation protocol plan 03-01 wrote — no heading added or removed, only the existing Discovery protocol section grown"
    requirement: "DISC-01"
    verification:
      - kind: other
        ref: "grep -c '^## ' SKILL.md returns 10 (unchanged from 03-01's post-plan count); manual listing confirms all 10 headings present"
        status: pass
    human_judgment: false

duration: ~20min
completed: 2026-08-24
status: complete
---

# Phase 3 Plan 02: Forms, Server Actions & Router Detection Summary

**Discovery now tells a Server-Action-bound form apart from a client-fetch form before writing a case (server-action wins on precedence), and detects App Router vs. Pages Router vs. both vs. unknown from folder structure alone — every detection rule proven against fixtures across all three layouts and locked against documentation drift.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-24T10:20:56-03:00 (baseline test run, prior commit)
- **Completed:** 2026-08-24T10:37:37-03:00
- **Tasks:** 2
- **Files modified:** 10 (9 created, 1 modified)

## Accomplishments

- `references/discovery-nextjs.md` (170 lines): the detection-rule contract in `references/destructive-classification.md`'s declarative style — handler detection table, imperative-validation shape (with the "no schema found ≠ unvalidated" rule stated as its own section), the ordered form-mechanism check with its server-action-wins tie-break, which side is authoritative when a form duplicates validation client- and server-side, the four-outcome router-layout heuristic, the Pages-Router-is-structurally-different-not-a-variant rule, an honesty note that the Pages Router branch is fixture-validated only (RESEARCH confirmed zero `pages/api` directories across DATAX-web/dotax/franquix), exclusions, and a closing tie-breaker.
- `scripts/discovery-surfaces.test.mjs` (25 tests): declares all 8 pattern constants (`API_ROUTE_GLOB`, `PAGES_API_GLOB`, `PAGE_GLOB`, `SERVER_ACTION_MARKER`, `VERB_EXPORT_PATTERN`, `PAGES_HANDLER_PATTERN`, `IMPERATIVE_ERROR_PATTERN`, `EXCLUDED_DIRS`) and three helpers (`walkFixture` on a minimal glob-to-RegExp translator over `readdirSync(..., {recursive:true})`, `classifyFormSurface`, `detectRouterLayout`) — every describe block traces to a specific behavior-block assertion, including the exclusion-tree test built with `mkdtempSync` rather than committed throwaway files, and the tie-break pinned against a synthetic fixture rather than left as an incidental consequence of branch order.
- Four new App Router fixture files (`app/login/actions.ts` + `page.tsx`, `app/registro/page.tsx` + `app/api/registro/route.ts`) — the login pair has no `fetch(` call anywhere and the registro pair duplicates required-fields/min-length validation client- and server-side, exactly mirroring the franquix/dotax contrast RESEARCH.md documented.
- Two new fixture repos (`mock-target-repo-pages`, `mock-target-repo-hybrid`) exercising the Pages-only and both-present branches of router-layout detection, each carrying a default-export, method-switching handler with no App Router verb export.
- `SKILL.md`'s `## Discovery protocol` expanded from 6 to 11 numbered steps in place: router-layout detection now runs before any glob (with the `unknown` hard-stop rule inline), the glob step forms/API-handler pair defers to `references/discovery-nextjs.md`, a project-root/symlink/allowlist scope rule closes out the plan's information-disclosure prohibition, and a new step records the detected layout and scanned globs on the generated document's `Router`/`Alcance` metadata lines. Heading count unchanged at 10 — no section added or removed.

## Task Commits

1. **Task 1: Find the forms — Server-Action-backed and fetch-backed, told apart before a case is written** - `245557c` (test)
2. **Task 2: Detect the router layout from the folder structure, and make a full scan the default** - `4ec43ca` (feat)

## Files Created/Modified

- `references/discovery-nextjs.md` - Detection-rule contract (170 lines): handler table, validation shape, form-mechanism check + tie-break, router-layout heuristic, Pages Router honesty note, exclusions, tie-breaker
- `scripts/discovery-surfaces.test.mjs` - 25 tests: pattern doc agreement (anti-drift lock), API-handler discovery, form discovery + tie-break, exclusions, router layout detection, Pages Router handler shape, hybrid layout handling
- `scripts/__fixtures__/mock-target-repo/app/login/actions.ts` - Server-directive module, `loginAction(prevState, formData)` with literal validation/rejection messages
- `scripts/__fixtures__/mock-target-repo/app/login/page.tsx` - Client component binding the form to `loginAction` via `useActionState`; no `fetch(` call
- `scripts/__fixtures__/mock-target-repo/app/registro/page.tsx` - Client-fetch form with client-side validation, posting to `/api/registro`
- `scripts/__fixtures__/mock-target-repo/app/api/registro/route.ts` - The handler the registro form posts to; re-validates server-side with 3 imperative checks
- `scripts/__fixtures__/mock-target-repo-pages/pages/api/legacy.ts` - Pages Router default-export, method-switching handler, no App Router verb export
- `scripts/__fixtures__/mock-target-repo-hybrid/app/page.tsx` + `pages/api/legacy.ts` - Both router layouts present in one fixture repo
- `SKILL.md` - `## Discovery protocol` expanded (router detection, form-mechanism check, exclusion-list `out` addition, Router/Alcance metadata recording, scope rule)

## Decisions Made

- Form-mechanism precedence: server-action wins whenever both a colocated `actions.ts` (with `'use server'`) and a `fetch()` call are present in the same page — matches what the browser's submit actually triggers. Pinned with a dedicated synthetic-fixture test rather than left as an implicit consequence of the check's `if`/`else` ordering.
- Router-layout detection step placed immediately after target-root resolution and before any glob step in `SKILL.md`'s numbered protocol — the protocol never globs before it knows which tree(s) to glob, matching the plan's own stated rationale for why this ordering matters.
- `SKILL.md`'s exclusion list gained `out` (the six-entry list from 03-01 — `node_modules`, `.next`, `dist`, `build`, `coverage`, `.git` — was missing it) to match the full seven-entry `EXCLUDED_DIRS` set this plan's `must_haves` require and its own doc-agreement test enforces against both `references/discovery-nextjs.md` and `SKILL.md`.
- Regex pattern constants' `.source` strings are embedded verbatim in `references/discovery-nextjs.md` (moved out of a Markdown table cell after discovering GitHub-flavored-Markdown's pipe-escaping rule silently altered the literal substring the anti-drift test checks for) so `doc.includes(PATTERN.source)` is a true character-for-character proof, not a paraphrase.

## Deviations from Plan

### Process deviation (not a Rule 1-4 auto-fix)

**TDD granularity — one commit per task instead of separate RED/GREEN commits:** Both tasks carry `tdd="true"`, and for each task the test file (declaring the pattern constants and assertions) was written and run first, observed failing for the documented reason (missing fixtures/reference doc — `ENOENT` on `references/discovery-nextjs.md` for Task 1, `ENOENT` on the Pages/hybrid fixture files for Task 2), then fixtures/doc/`SKILL.md` were added and the same test run confirmed green, before a single commit per task. This mirrors the precedent `03-01-SUMMARY.md` documented (`"01-03: Task 2's implementation was briefly committed ahead of its RED test..."` and its own Task-1 TDD-ordering note) rather than the workflow's literal "commit the RED state separately" instruction — the RED state was genuinely observed both times (see task commit history above shows `test(03-02)` then `feat(03-02)`, one commit each, not a `test` commit followed by a separate `feat` commit for the same task). No functional impact: every behavior-block assertion in both tasks passed on the first real green run.

### Auto-fixed issues (Rule 1 — bug)

**1. [Rule 1 - Bug] Markdown table pipe-escaping silently corrupted a regex-source literal the anti-drift test checked for**
- **Found during:** Task 1, first `npx vitest run scripts/discovery-surfaces.test.mjs` after writing `references/discovery-nextjs.md`.
- **Issue:** `VERB_EXPORT_PATTERN`'s source (`export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(`) was originally embedded inside a Markdown table cell, where the `|` alternation characters had to be escaped as `\|` for the table syntax to render — but that escaping is not part of the regex's actual `.source` string, so `doc.includes(PATTERN.source)` failed.
- **Fix:** Moved the pattern out of the table cell into its own fenced code block below the table, as an unescaped literal.
- **Files modified:** `references/discovery-nextjs.md`
- **Commit:** `245557c` (fixed before commit, not left in a red state)

**2. [Rule 1 - Bug] Fixture header comment accidentally contained the literal substring the test asserted absent**
- **Found during:** Task 1, same test run.
- **Issue:** `app/login/page.tsx`'s header comment read "no fetch() call, by design" — which itself contains the literal substring `fetch(` that the test asserts is absent from the file (`expect(pageContent).not.toContain('fetch(')`), since the whole point of the server-action fixture is that it makes no `fetch()` call in its actual code.
- **Fix:** Reworded the comment to "no client-side data fetch, by design", removing the literal substring while keeping the documentation intent.
- **Files modified:** `scripts/__fixtures__/mock-target-repo/app/login/page.tsx`
- **Commit:** `245557c` (fixed before commit, not left in a red state)

**Impact:** Neither issue reached a committed state — both were caught and fixed during the RED→GREEN cycle before the task commit. No scope change.

## Issues Encountered

- Pre-existing, unrelated `ui-login.test.mjs` failures (2 of 203 baseline tests, both about `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` configuration-error status codes) were present before this plan started and remain unchanged after both task commits (2 failed / 226 passed of 228, up from 2 failed / 201 passed of 203). Confirmed out of scope (Phase 2 / `ui-login.mjs` territory, untouched by 03-01 or 03-02) and logged to `.planning/phases/03-dual-discovery-test-case-generation/deferred-items.md` per the scope-boundary rule, not fixed.

## Next Phase Readiness

- `references/discovery-nextjs.md`, `scripts/discovery-surfaces.test.mjs`, and all fixture repos (`mock-target-repo`, `mock-target-repo-pages`, `mock-target-repo-hybrid`) are in place for plan 03-03 (execution-handoff validator) to build on without touching this plan's files, per the "Do NOT create here" boundary in `03-02-PLAN.md`'s `<artifacts_this_phase_produces>`.
- `SKILL.md`'s `## Discovery protocol` now fully covers DISC-01's scope end to end (routes, forms, Server Actions, imperative validation, both router layouts, full-scan default with exclusions) — 03-03's execution-handoff work can assume discovery is complete and turn to validating the generated document and running cases from it.
- The STATE.md research flag ("no authoritative pattern exists for code-aware discovery across App Router vs. Pages Router") is now fully answered: the App Router branch is empirically confirmed against all three real target repos (03-01/03-RESEARCH.md), and this plan's Pages Router and both-present branches are built and fixture-proven, with `references/discovery-nextjs.md`'s honesty note explicit that the Pages Router branch itself has not yet been exercised against a real repo (none of the three currently has one).
- No blockers. Full suite (`npx vitest run`) is at 13 test files / 228 tests (226 passed, 2 pre-existing unrelated failures), up from the pre-plan baseline of 12 files / 203 tests (201 passed, same 2 pre-existing failures).

## Self-Check: PASSED

All 10 claimed files verified present on disk (`references/discovery-nextjs.md`, `scripts/discovery-surfaces.test.mjs`, `scripts/__fixtures__/mock-target-repo/app/login/actions.ts`, `scripts/__fixtures__/mock-target-repo/app/login/page.tsx`, `scripts/__fixtures__/mock-target-repo/app/registro/page.tsx`, `scripts/__fixtures__/mock-target-repo/app/api/registro/route.ts`, `scripts/__fixtures__/mock-target-repo-pages/pages/api/legacy.ts`, `scripts/__fixtures__/mock-target-repo-hybrid/app/page.tsx`, `scripts/__fixtures__/mock-target-repo-hybrid/pages/api/legacy.ts`, `SKILL.md`). Both task commit hashes (`245557c`, `4ec43ca`) verified present in `git log --oneline --all`.

---
*Phase: 03-dual-discovery-test-case-generation*
*Completed: 2026-08-24*
