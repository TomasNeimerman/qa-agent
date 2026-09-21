# Phase 5: Smoke-Test Mode & Cross-Project Distribution - Pattern Map

**Mapped:** 2026-09-21
**Files analyzed:** 3 (no RESEARCH.md this run — analysis is CONTEXT.md + direct codebase read)
**Analogs found:** 3 / 3

This phase adds no new execution engine (D-07: hands off unchanged to the
existing Run protocol). Its only net-new logic is the deterministic
"first `positivo` case per surface" selection rule (D-02/D-04), which reads
`test-case-doc.mjs`'s existing parsed structure, plus prose edits to
`SKILL.md`'s `## Installation`/`## Configuration` sections (D-11) and a new
`## Smoke-test protocol` section that documents the selection + handoff.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `scripts/select-smoke-cases.mjs` (new sibling script — Claude's Discretion option B) OR a `selectSmokeCases()` export added to `scripts/test-case-doc.mjs` (option A) | utility (pure transform over an already-parsed document) | transform (CRUD-adjacent: read-only derivation, no writes) | `scripts/test-case-doc.mjs` (`findCase`/`parseTestCasesDoc`) | exact |
| `SKILL.md` `## Installation` section (edited in place) | config/doc | request-response N/A (static doc) | `SKILL.md` `## Installation` (itself, current text) | exact — self-analog, tighten wording only |
| `SKILL.md` `## Configuration` section (edited in place) | config/doc | N/A | `SKILL.md` `## Configuration` (itself, current text) | exact — self-analog |
| `SKILL.md` new `## Smoke-test protocol` section (new prose, no new script beyond the selector) | doc/orchestration-spec | request-response (NL trigger -> deterministic selection -> existing Run protocol handoff) | `SKILL.md` `## Running generated cases` (existing "read doc, resolve cases, dispatch to existing protocols unchanged" section) | exact — same shape: read live doc, resolve a subset of cases, hand off to `## Run protocol`/`## UI run protocol` unchanged |

No CLI script changes are needed for `api-client.mjs`, `ui-login.mjs`, `ui-case.mjs`, `format-report.mjs`, or `discover-schema.mjs` — D-07/D-08 explicitly reuse them unchanged. They are listed in `## Shared Patterns` below only as the unchanged handoff targets.

## Pattern Assignments

### `scripts/select-smoke-cases.mjs` (new) or `selectSmokeCases()` in `test-case-doc.mjs` (utility, transform)

**Analog:** `scripts/test-case-doc.mjs` — `parseTestCasesDoc` (lines 215-309) and `findCase` (lines 334-403)

**Why this is the analog:** D-02's rule ("for each discovered surface, take the first case of type `positivo` listed under that surface's section") operates directly on the `{ title, metadata, surfaces }` shape `parseTestCasesDoc` already returns, where each surface is `{ heading, origen, cases }` and each case carries `tipo` and `ejecucion`. No new parsing is needed — the selector is a pure filter over this existing structure. D-04 requires re-reading the document fresh every time (never cached), matching how `findCase`/`parseTestCasesDoc` are always invoked against a freshly-read `markdown` string, never a remembered object.

**Imports pattern** (mirror `test-case-doc.mjs` lines 30-32, if a sibling script; or none, if added as an export in the same file):
```javascript
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseTestCasesDoc, TestCaseFormatError } from './test-case-doc.mjs'; // only if sibling script
```

**Core transform pattern** — model the selection function on `parseTestCasesDoc`'s per-surface loop (lines 231-306), reducing each surface's `cases` array to its first `positivo`:
```javascript
// Pure, deterministic, no I/O of its own — takes the already-parsed
// { surfaces: [{ heading, origen, cases }] } shape parseTestCasesDoc
// produces and returns one case per surface (D-02), or none for a surface
// with no positivo case (never fabricate one — "shape observed" discipline,
// Phase 1 D-10 / this phase's code_context "Established Patterns").
export function selectSmokeCases(parsedDoc) {
  const smokeSet = [];
  for (const surface of parsedDoc.surfaces) {
    const firstPositivo = surface.cases.find((c) => c.tipo === 'positivo');
    if (firstPositivo) {
      smokeSet.push({ surface: surface.heading, ...firstPositivo });
    }
  }
  return smokeSet;
}
```

**Error handling pattern** — follow `test-case-doc.mjs`'s convention of throwing `TestCaseFormatError` only for structural document problems, never for "this surface has no positivo case" (that is a valid, expected outcome per D-02, not an error):
```javascript
// No throw here — an empty smokeSet (no surface had a positivo case) is a
// reportable fact for the orchestrator's chat summary, not a script failure.
// Reuse TestCaseFormatError only if the input doc itself fails
// parseTestCasesDoc/validateTestCasesDoc upstream (that failure already
// exists and is unchanged by this phase).
```

**CLI wrapper pattern** (if implemented as a sibling script rather than a library export) — mirror `test-case-doc.mjs`'s `main()`/`parseArgs()`/`isMainModule()` block (lines 602-680) exactly, including the realpath-based `isMainModule` check (needed because of the documented symlink/junction install method) and exit-code discipline consistent with the project's existing table in `SKILL.md` `## Configuration` (reuse codes 2/9, introduce no new code per D-07's "no new execution mechanism" framing — treat "document not found"/"malformed" as code 2/9 exactly as `test-case-doc.mjs` does today).

---

### `SKILL.md` `## Installation` / `## Configuration` (doc, D-11/D-13)

**Analog:** the sections themselves, current text (`SKILL.md` lines 35-46 Installation, 47-147 Configuration)

**Pattern to follow:** D-11 is explicit — no new install script, no new checklist, just tightened wording of the existing two sections. Style precedent for "tightened, concrete, numbered where sequential" prose is `## UI authentication and session reuse` (lines 113-147), which turns a previously-loose two-step sequence into a numbered, unambiguous procedure with concrete command blocks. Apply that same tightening style to `## Installation`: make the `npm install` step and the Playwright MCP registration step explicitly sequential/numbered, and cross-reference `references/mcp-setup.md` the same way line 42-45 already does. Do not add new env vars or new commands — D-13 explicitly rejects vendoring/pre-bundling.

**Excerpt to preserve verbatim in intent** (lines 37-40):
```markdown
Copy or symlink this directory to `~/.claude/skills/qa-agent/`, then run
`npm install` inside it **once**. Nothing is installed into, or written to,
the project under test besides the `qa-reports/` run artifacts this skill
produces at run time — there is no project-specific setup step (PKG-01).
```

---

### `SKILL.md` new `## Smoke-test protocol` section (doc/orchestration-spec, request-response)

**Analog:** `## Running generated cases` (SKILL.md lines 543-627)

**Why this is the analog:** Both sections describe "read a live document fresh, resolve a subset of its cases by a deterministic rule, then hand off unchanged to `## Run protocol`/`## UI run protocol`." `## Running generated cases` is the closest existing template for exactly this shape — re-read-from-disk discipline (D-04's mirror is `## Running generated cases` step 2, "Re-read that document from disk at that moment... never act on a remembered version"), resolve via a deterministic reader/script rather than eyeballing text (mirrors step 3's "resolve each named case by invoking the reader's CLI... never grep the document and read the matched heading by eye"), then dispatch through the unchanged `API`/`UI` branches (step 4) with the same confirmation gates (step 5) and the same report renderer (step 6).

**Structure to copy** (paraphrasing `## Running generated cases` steps 1-6, substituting D-02's automatic selection for the developer's named case IDs):
```markdown
## Smoke-test protocol

1. Triggered by natural-language instruction (D-06) — no new CLI flag.
2. If `qa-reports/*-test-cases.md` does not exist for the target project,
   run `## Discovery protocol` and `## Case generation protocol` first
   (D-03) — one discovery path, not two.
3. Re-read the resulting test-cases document from disk at this moment
   (D-04, mirrors `## Running generated cases` step 2).
4. Apply the deterministic selection rule (D-02) — one case per surface,
   the first `positivo` case listed under that surface's section — via
   `scripts/select-smoke-cases.mjs` (or `test-case-doc.mjs`'s
   `selectSmokeCases` export), never by eye (mirrors `## Running generated
   cases` step 3's "never grep the document... by eye").
5. Dispatch the selected set through `## Running generated cases` steps
   4-6 unchanged (D-07) — same `API`/`UI` branches, same confirmation
   gates, same `format-report.mjs` rendering, same report location.
```

**Error handling pattern:** identical to `## Running generated cases` step 4's "Pending first" handling — a surface whose only `positivo` case is pending (D-02/D-04 of Phase 3) is reported by name and skipped, never silently dropped and never substituted with a different case.

---

## Shared Patterns

### Deterministic-script vs. orchestrator-judgment split
**Source:** `scripts/test-case-doc.mjs` (parsing/lookup) vs. `SKILL.md` `## Case generation protocol` (orchestrator judgment)
**Apply to:** `select-smoke-cases.mjs` / `selectSmokeCases()` — selection is a pure deterministic function (script tier), exactly as `discover-schema.mjs` stays deterministic per the phase's own `code_context`. The orchestrator's only judgment is deciding *whether* to trigger a smoke run (NL parsing) and whether discovery needs to run first (D-03) — never re-deriving the selection rule by eye.

### Re-read-live-document discipline
**Source:** `SKILL.md` `## Running generated cases` step 2 (lines 553-557); `scripts/test-case-doc.mjs` module doc comment (lines 6-11)
**Apply to:** the smoke-test protocol's step 3/4 — never cache a previous selection result across turns; always re-parse from disk (D-04).

### Unchanged handoff to existing executors
**Source:** `SKILL.md` `## Run protocol`, `## UI run protocol`, `## Confirmation protocol`, `## UI confirmation protocol`, `scripts/api-client.mjs`, `scripts/ui-login.mjs`, `scripts/ui-case.mjs`, `scripts/format-report.mjs`
**Apply to:** every dispatched smoke case, exactly as `## Running generated cases` step 4-6 already specify — no smoke-specific report section, no smoke-specific confirmation bypass (D-07).

### CLI script conventions (only if `select-smoke-cases.mjs` is a sibling script)
**Source:** `scripts/test-case-doc.mjs` lines 602-680 (`parseArgs`, `main`, `isMainModule`)
**Apply to:** argument parsing (`--file <path>`), single-line JSON stdout on success, non-zero exit + stderr message on failure, realpath-based `isMainModule` check for the symlink-install compatibility.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| — | — | — | None — this phase's only net-new code (the selection function) has a strong analog in `test-case-doc.mjs`, and its two doc changes are self-analogs (tightening existing prose) |

## Metadata

**Analog search scope:** `scripts/*.mjs`, `SKILL.md` (whole file read in full — 732 lines, single Read call, no re-reads needed)
**Files scanned:** `scripts/test-case-doc.mjs` (read in full), `SKILL.md` (read in full); `scripts/discover-schema.mjs`, `scripts/api-client.mjs`, `scripts/ui-login.mjs`, `scripts/ui-case.mjs`, `scripts/format-report.mjs` referenced via SKILL.md's own documented invocations (not independently re-read — their unchanged CLI contracts are already fully specified in SKILL.md's `## Run protocol`/`## UI run protocol`/`## Configuration` sections quoted above)
**Pattern extraction date:** 2026-09-21
