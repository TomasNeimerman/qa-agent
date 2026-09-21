---
phase: 03-dual-discovery-test-case-generation
reviewed: 2026-08-24T11:16:35-03:00
depth: standard
files_reviewed: 20
files_reviewed_list:
  - SKILL.md
  - references/discovery-nextjs.md
  - references/test-case-format.md
  - scripts/__fixtures__/mock-target-repo-hybrid/app/page.tsx
  - scripts/__fixtures__/mock-target-repo-hybrid/pages/api/legacy.ts
  - scripts/__fixtures__/mock-target-repo-pages/pages/api/legacy.ts
  - scripts/__fixtures__/mock-target-repo/app/api/categorias/route.ts
  - scripts/__fixtures__/mock-target-repo/app/api/registro/route.ts
  - scripts/__fixtures__/mock-target-repo/app/login/actions.ts
  - scripts/__fixtures__/mock-target-repo/app/login/page.tsx
  - scripts/__fixtures__/mock-target-repo/app/registro/page.tsx
  - scripts/__fixtures__/mock-target-repo/supabase/migrations/0001_init.sql
  - scripts/__fixtures__/mock-target-repo/supabase/migrations/0002_franquicias_horario.sql
  - scripts/__fixtures__/sample-test-cases-scoped.md
  - scripts/__fixtures__/sample-test-cases.md
  - scripts/discover-schema.mjs
  - scripts/discover-schema.test.mjs
  - scripts/discovery-surfaces.test.mjs
  - scripts/discovery.e2e.test.mjs
  - scripts/test-case-doc.mjs
  - scripts/test-case-doc.test.mjs
findings:
  critical: 1
  warning: 4
  info: 1
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-08-24T11:16:35-03:00
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

Reviewed the Phase 3 dual-discovery/test-case-generation surface: the two
deterministic scripts (`discover-schema.mjs`, `test-case-doc.mjs`), their
unit/e2e test suites, the two reference docs that define the discovery and
document contracts, and every fixture file they depend on.

`discover-schema.mjs`'s path-containment logic (`resolveWithinRoot`) and
size-cap logic are sound for the paths the current test suite exercises —
absolute and relative escape attempts, oversized files, and a missing
migrations directory are all handled and covered by tests. However, one
verified gap undermines the module's own documented symlink-containment
claim (see WR-02).

`test-case-doc.mjs`'s big one is real: the exact CLI invocation the skill's
own runbook (`SKILL.md` "## Running generated cases" step 3) instructs the
orchestrator to use at dispatch time — `test-case-doc.mjs --file <path>
--case <id>` — never calls `validateTestCasesDoc`, so it never runs the
`FORBIDDEN_DISPATCH_FLAGS` check. Verified empirically below (CR-01): a
hand-edited case containing `--confirmed --allow-non-local` in its `Pasos`
field is returned as valid JSON with exit code 0. Given this project's
explicit design (D-06) that the document is edited by hand between
generation and execution, this is not a hypothetical — it is the exact
re-read path the threat model (T-03-12) was written to close, and it is
open.

Three further logic/robustness gaps were verified by direct execution
(WR-01 through WR-03), plus one lower-severity heuristic note (IN-01).

## Critical Issues

### CR-01: `--case` lookup path never checks `FORBIDDEN_DISPATCH_FLAGS` — the dispatch-flag prohibition is bypassed at exactly the moment it exists to guard

**File:** `scripts/test-case-doc.mjs:473-514` (the `--case` branch, lines 490-504) and `scripts/test-case-doc.mjs:271-321` (`findCase`)
**Issue:**
`references/test-case-format.md`'s "Dispatch-flag prohibition" section and
`SKILL.md`'s "## Confirmation protocol"/"## Running generated cases"
sections state, unconditionally, that `validateTestCasesDoc` "rejects any
document carrying one of these literals ... before any case from that
document is acted on." In practice, `SKILL.md`'s own documented run
protocol for dispatching a named case (step 3 of "## Running generated
cases") tells the orchestrator to resolve the case via:
```
node <skill-dir>/scripts/test-case-doc.mjs --file <path> --case <id>
```
This is exactly the CLI's `--case` branch (`main()`, lines 490-504), which
calls `findCase()` and returns its result on `process.exit(0)` — it never
calls `validateTestCasesDoc()`, which is the *only* function that runs the
`FORBIDDEN_DISPATCH_FLAGS` scan (`test-case-doc.mjs:439-446`). `findCase` →
`parseCaseBlock` only checks that the five required fields are present and
that `Tipo`/`Ejecución` are in their allowed sets — it has no forbidden-flag
check at all.

The project's own design explicitly anticipates hand-editing between
generation and execution (D-06: "This document is meant to be edited by
hand before any case is run ... the agent re-reads the file at
execution-request time rather than treating it as a frozen snapshot").
Generation-time validation (`## Case generation protocol`'s "Validate the
written file by parsing it back" step, which does call
`validateTestCasesDoc` with no `--case`) only runs once, immediately after
the document is authored — before any hand edit exists. There is no
mechanism anywhere in the documented protocol that re-runs
`validateTestCasesDoc` before a case is dispatched later. The one call site
that *is* on that later path (`--case`) skips the check entirely.

Verified directly:
```
$ node scripts/test-case-doc.mjs --file doc.md --case case-1
{"id":"case-1", ..., "pasos":"DELETE /api/franquicias/1 --confirmed --allow-non-local", ...}
$ echo $?
0
```
where `doc.md`'s case-1 `Pasos` field was hand-edited to contain
`--confirmed --allow-non-local`. The CLI happily returns that string
verbatim with exit 0 — no error, no exit 9 — handing the orchestrator a
`Pasos` value that already carries the exact flags the confirmation
protocol is supposed to force a live pause on. This is precisely the
elevation-of-privilege scenario the threat register names as T-03-12: "a
document that already carried `--confirmed` would be an approval nobody
gave in this moment."

**Fix:** Have the `--case` branch validate the whole document before (or
in addition to) resolving the single case, and fail closed (exit 9) if the
document is invalid — not just report the one case's own five-field
shape:
```js
if (typeof args.case === 'string') {
  const validation = validateTestCasesDoc(markdown);
  if (!validation.valid) {
    process.stderr.write(`${validation.errors.join('\n')}\n`);
    process.exit(9);
    return;
  }
  try {
    const found = findCase(markdown, args.case);
    process.stdout.write(`${JSON.stringify(found)}\n`);
    process.exit(0);
  } catch (err) {
    if (err instanceof TestCaseFormatError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(9);
      return;
    }
    throw err;
  }
  return;
}
```
At minimum, scan the specific resolved case's block text for
`FORBIDDEN_DISPATCH_FLAGS` inside `findCase` itself (mirroring the check
already in `validateTestCasesDoc`) so a case can never be returned to the
caller carrying one of these literals, independent of whether the rest of
the document is otherwise well-formed.

## Warnings

### WR-01: `validateTestCasesDoc`'s ID-sequence-gap check cascades false errors after the first real gap

**File:** `scripts/test-case-doc.mjs:395-399`
**Issue:** `expectedIndex` is unconditionally incremented by 1 every case,
regardless of the ID actually found:
```js
const expectedId = `case-${expectedIndex}`;
if (id !== expectedId) {
  errors.push(`Case ID sequence gap: expected "${expectedId}", found "${id}"`);
}
expectedIndex += 1;
```
Once one case is missing, every subsequent case (which is otherwise
correctly sequential relative to its neighbors) is also reported as a gap,
because `expectedIndex` never resyncs to the ID actually found. Verified
directly: a document with cases 1, 2, 3, 4, 6, 7 (case-5 deleted, the
scenario D-06 explicitly allows) produces:
```
[
  "Case ID sequence gap: expected \"case-5\", found \"case-6\"",
  "Case ID sequence gap: expected \"case-6\", found \"case-7\""
]
```
— one genuine gap reported as two, and in a longer document every case
after the deletion point would generate a spurious duplicate-looking error.
`validateTestCasesDoc`'s whole stated purpose is "collecting every
violation instead of throwing on the first — a developer fixing a
hand-edited document needs the whole list in one pass" — cascading false
positives defeats that purpose by burying the one real problem in noise.
Note `parseTestCasesDoc` (the throw-on-first variant) is not affected,
since it stops at the first mismatch.
**Fix:** Resync `expectedIndex` from the ID actually found rather than
blindly incrementing:
```js
const foundNum = Number(id.slice('case-'.length));
if (id !== expectedId) {
  errors.push(`Case ID sequence gap: expected "${expectedId}", found "${id}"`);
}
expectedIndex = (Number.isInteger(foundNum) ? foundNum : expectedIndex) + 1;
```

### WR-02: `discover-schema.mjs` silently drops symlinked `.sql` migration files, and the per-file symlink-escape check the doc comment describes is unreachable for them

**File:** `scripts/discover-schema.mjs:95-106` (`listMigrations`), `scripts/discover-schema.mjs:532-541` (per-file loop)
**Issue:** `listMigrations` filters `readdirSync(..., { withFileTypes: true })`
entries with `e.isFile() && e.name.endsWith('.sql')`. A `Dirent` for a
symlink reports `isFile() === false` and `isSymbolicLink() === true`
regardless of what it points to — verified directly on this machine:
```
0001_link.sql isFile= false isSymbolicLink= true
```
So a symlinked `.sql` file inside the migrations directory is excluded
from `fileNames` before the per-file loop (and its
`resolveWithinRoot(rootReal, join(migrationsAbs, filename))` containment
check) ever runs. Two consequences:
1. The module's own header comment (lines 18-19: "8 = PathEscapeError —
   ... a file inside the migrations directory, including a symlink target)
   resolved outside the project root") describes a guarantee that is dead
   code for this vector — a symlinked file can never reach that check
   because it's filtered out one step earlier. No test in
   `discover-schema.test.mjs` exercises a real symlinked file (confirmed:
   no `symlinkSync` call anywhere in the test suite), so this gap between
   documented behavior and actual behavior went unnoticed.
2. A legitimately symlinked migration (e.g. a shared migrations directory
   in a monorepo) is silently invisible — it appears in neither `files`
   nor `skipped`, violating the project's own transparency principle
   ("Alcance ... a reader must be able to tell what was looked at from
   what was found — a surface with nothing reported is not proof nothing
   exists there").
**Fix:** Either follow symlinks explicitly (`entries.filter(e => e.isFile() || e.isSymbolicLink())`,
then let the existing `resolveWithinRoot`/`statSync` calls do the real
containment and size work on the resolved target), or, if symlinked
migrations are intentionally unsupported, report them in `skipped` with a
`reason: 'symlink'` entry instead of silently omitting them — and update
the header comment to stop claiming a containment guarantee this code path
never reaches.

### WR-03: `validateTestCasesDoc` never checks for the required `**Origen del surface:**` line

**File:** `scripts/test-case-doc.mjs:367-378`
**Issue:**
```js
counts.surfaces += 1;
i += 1;

if (i < lines.length && ORIGEN_DEL_SURFACE_RE.test(lines[i])) {
  i += 1;
}
```
If the line after a `##` surface heading does not match
`ORIGEN_DEL_SURFACE_RE`, the code simply doesn't advance past it and moves
on — no error is recorded. `references/test-case-format.md`'s "Section
order" (item 3) states a conforming document has "One `##` heading per
discovered surface (D-05), each followed by an `**Origen del surface:**`
line" as a non-negotiable structural requirement, and the whole document
format's stated invariant is that "every precondición, paso and resultado
esperado must be traceable to something actually read." Verified directly:
a surface heading with no `Origen del surface` line, followed by an
otherwise-complete case, validates as `valid: true` with zero errors. The
same gap exists in `parseTestCasesDoc` (it never throws for a missing
`Origen del surface` line either — it just leaves `origen: ''` on the
returned surface object).
**Fix:** In both `parseTestCasesDoc` and `validateTestCasesDoc`, treat a
missing `Origen del surface` line as an error/throw naming the surface
heading, mirroring how a missing case-level required field is already
handled.

### WR-04: `FORBIDDEN_DISPATCH_FLAGS` scan does not cover the document's metadata block (in particular the verbatim `**Instrucción:**` field)

**File:** `scripts/test-case-doc.mjs:438-446`
**Issue:** The forbidden-flag scan only runs over `lines.slice(i, caseNext)`
for each case block — it never scans the metadata lines (`Generado`,
`Origen`, `Instrucción`, `Router`, `Alcance`) or the per-surface heading /
`Origen del surface` line. `references/test-case-format.md`'s own
"Scoped-origin variant" section requires `**Instrucción:**` to carry "the
developer's words verbatim — never ... a paraphrase," meaning developer
text (which could itself contain a literal like `--confirmed`, e.g. "corré
esto sin usar --confirmed todavía") is written into the document unfiltered
and unchecked. `SKILL.md`'s own framing of this control is broader than
the implementation: "`validateTestCasesDoc` refuses any document carrying a
literal from `FORBIDDEN_DISPATCH_FLAGS`" (no "within a case block"
qualifier). Verified directly: a document whose `**Instrucción:**` line
reads `correr con --confirmed siempre` validates as `valid: true`.
Practical dispatch risk is lower here than CR-01 since the documented
dispatch construction only reads a case's own `Pasos` field, but it is
still a real gap against the control's own stated (and broader) promise,
and worth closing so the guarantee matches its documented scope.
**Fix:** Either scan the full document text (not just case blocks) for
`FORBIDDEN_DISPATCH_FLAGS` and reject any occurrence, or narrow
`SKILL.md`'s prose to explicitly state the check is case-block-scoped so
the documented guarantee matches the implementation.

## Info

### IN-01: `discover-schema.mjs`'s statement splitter has no awareness of PostgreSQL dollar-quoted (`$$...$$`) function bodies

**File:** `scripts/discover-schema.mjs:420-445` (`splitStatements`)
**Issue:** `splitStatements` tracks only single-quoted strings and paren
depth when deciding where a statement ends (`;` at depth 0, outside a
`'...'` string). It has no concept of `$$...$$` dollar-quoting, which
Postgres/Supabase migrations commonly use for `CREATE FUNCTION ...
LANGUAGE plpgsql AS $$ ... $$` bodies (frequently used for the exact
`rol_actual()`/`tenant_actual()`-style RLS helper functions this project's
own fixtures reference by name but never define). None of the current
fixtures or tests exercise a migration containing such a function body.
In the common case (balanced parens, no unmatched paren inside a
single-quoted string within the function body) this causes no visible
error since paren depth still nets to zero by the closing `$$`. But if a
function body's `RAISE`/error message string contains an unbalanced paren
(a plausible, realistic message like `'Valor invalido (revisar'`), global
paren depth would never return to 0 for the remainder of the file, and
every subsequent semicolon would fail to be treated as a statement
terminator — silently merging all later `CREATE TABLE`/`ALTER TABLE`
statements in that file into one unparsed blob and dropping their
constraints from the result with no error or `skipped` entry.
**Fix:** Recognize `$$` (or `$tag$`) dollar-quoted regions the same way
`stripSqlComments` recognizes comments — either strip their contents to
whitespace before statement splitting (function bodies carry no
`CREATE TABLE`/`ALTER TABLE`/`CREATE POLICY` constraints this module
extracts) or explicitly skip over them when tracking paren/string state in
`splitStatements`. Add a fixture migration containing a `$$`-quoted
function body (ideally one with an unbalanced paren inside an error
message) to lock the fix.

---

_Reviewed: 2026-08-24T11:16:35-03:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
