# Phase 4: Edge-Case & Input Validation Quality - Pattern Map

**Mapped:** 2026-09-17
**Files analyzed:** 6 (all extensions of existing files — no new files this phase)
**Analogs found:** 6 / 6 (self-analog — every changed file is its own closest analog; extend in place)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/discover-schema.mjs` (`extractPolicies`, `parseCheckBounds`, `parseCheckEnum`) | service (deterministic parser) | transform (SQL text → structured records) | itself — `extractConstraints()` / `discoverSchema()` in the same file | exact (extend existing exported-function set, same module) |
| `scripts/discover-schema.test.mjs` | test | transform | itself — existing `describe('extractConstraints — column forms', ...)` blocks | exact |
| `scripts/api-client.mjs` (`readConfig` `useSecondary` param, `--secondary` CLI flag) | service (HTTP dispatch/config) | request-response | itself — existing `readConfig()` / token resolution | exact |
| `scripts/api-client.test.mjs` | test | request-response | itself — existing ConfigError tests | exact |
| `scripts/test-case-doc.mjs` (`EXECUTION_MODES` extension, pending-state handling) | service (document parser/validator) | transform | itself — `parseCaseBlock`, `scanCaseFields`, `CASE_FIELDS`/`CASE_TYPES` | exact |
| `scripts/test-case-doc.test.mjs` | test | transform | itself — existing case-parsing tests | exact |
| `references/test-case-format.md` | config/docs | — | itself | exact |
| `references/discovery-nextjs.md` (role-guard detection rule) | config/docs | — | itself — existing "Validation detection" section | exact |
| `SKILL.md` (`## Case generation protocol`, `## Running generated cases`) | config/docs | — | itself | exact |

**Note:** This phase adds zero new files. Every change is an in-place extension of a module read in full this session. The "analog" for each is the file itself — follow its own established conventions (doc-comment style, error-class pattern, CLI exit-code table, statement-splitting machinery) rather than importing a pattern from elsewhere in the codebase.

## Pattern Assignments

### `scripts/discover-schema.mjs` — add `extractPolicies()`, `parseCheckBounds()`, `parseCheckEnum()`

**Analog:** same file — `extractConstraints()` (lines 472-508) and `discoverSchema()` (lines 522-598)

**Doc-comment convention** (lines 458-471, apply same style to new exports):
```js
/**
 * Scans `sql` statement by statement and returns a flat array of constraint
 * records (...). The returned array also carries a non-index
 * `withCheckSkipped` property counting every `CHECK (` occurrence
 * recognised and deliberately excluded because it sat inside a
 * `CREATE POLICY` statement (...) — deliberately excluded is a different
 * fact from never seen, and the reader needs to be able to tell them apart.
 */
export function extractConstraints(sql, { file }) { ... }
```
New functions must carry the same "why, not just what" doc-comment discipline — cite the exact ambiguity being resolved (e.g. `CHECK` vs `WITH CHECK`, `>` vs `>=`) the way this file already does.

**Statement-dispatch pattern to extend** (lines 479-504) — `extractPolicies()` should be wired into this same loop, replacing the current "count and skip" branch:
```js
if (/^CREATE\s+POLICY\b/i.test(trimmedText)) {
  const matches = trimmedText.match(/CHECK\s*\(/gi);
  withCheckSkipped += matches ? matches.length : 0;
  continue;
}
```
becomes a call into a new parser that returns a structured record instead of only counting, mirroring how `parseCreateTableStatement`/`parseAlterTableStatement` are dispatched to and pushed into `records`.

**Return-shape extension pattern** (`discoverSchema()`, lines 589-597):
```js
return {
  projectRoot: rootReal,
  migrationsDir: migrationsAbs,
  files,
  skipped,
  enums,
  constraints,
  withCheckSkipped,
};
```
Add `policies` as a new top-level array key here, always present (possibly empty) — same convention as `enums`/`constraints` being accumulated in the per-file loop (lines 573-579) and returned unconditionally.

**Pure-function pattern for `parseCheckBounds`/`parseCheckEnum`:** both should be pure, stateless functions taking a raw `check` string (already returned per-constraint at lines 261-266/328-347) and returning a plain value or `null` — same shape as `stripSqlComments`, `countNewlines`, `extractBalancedParens` elsewhere in this file: no side effects, no file I/O, easily unit-tested in isolation exactly like `stripSqlComments` is tested in `discover-schema.test.mjs`.

---

### `scripts/discover-schema.test.mjs` — add coverage for the three new functions

**Analog:** same file, existing `describe` blocks (lines 40-80)

**Import list to extend** (lines 16-26):
```js
import {
  MAX_MIGRATION_BYTES,
  MigrationsDirError,
  PathEscapeError,
  discoverSchema,
  extractConstraints,
  extractEnumTypes,
  listMigrations,
  resolveWithinRoot,
  stripSqlComments,
} from './discover-schema.mjs';
```
Add `extractPolicies`, `parseCheckBounds`, `parseCheckEnum` here once exported.

**Test structure convention** — one `describe` block per function, inline SQL string fixtures, no mocking (lines 40-80):
```js
describe('extractConstraints — column forms', () => {
  it('a NOT NULL column yields notNull true, unique false', () => {
    const sql = 'CREATE TABLE t (\n  a text NOT NULL\n);\n';
    const records = extractConstraints(sql, { file: 'x.sql' });
    expect(records[0]).toMatchObject({ column: 'a', type: 'text', notNull: true, unique: false });
  });
  ...
});
```
New tests for `parseCheckBounds`/`parseCheckEnum` follow this exact `it('<plain-english behavior>', () => { ... expect(...).toMatchObject/toBe(...) })` style with grounded SQL fixtures (use the real examples cited in RESEARCH.md's Pattern 2/3, e.g. `dia_cierre BETWEEN 0 AND 6`, `cantidad > 0`, `tipo IN ('ingreso', 'egreso')`). `extractPolicies` tests should follow the "CHECK ( that appears only inside a comment" style (lines 57-62) plus a positive-match test per `FOR SELECT/INSERT/UPDATE/DELETE/ALL` shape from RESEARCH.md.

---

### `scripts/api-client.mjs` — add `useSecondary` to `readConfig()` + `--secondary` CLI flag

**Analog:** same file — `readConfig()` (lines 86-129)

**Current token-resolution pattern** (lines 113-126):
```js
const token = process.env.QA_AGENT_TOKEN;
if (!token && !storageStatePath) {
  throw new ConfigError(
    "QA_AGENT_TOKEN is not configured, and no --storage-state path was given — export " +
      "QA_AGENT_TOKEN in the shell that launched Claude Code (or set it in the target " +
      "project's .env.local), or pass --storage-state <path> from a prior UI login (API-03)."
  );
}
return { baseUrl, token, storageStatePath };
```
Extend to a `useSecondary` boolean param that switches which env var is read (RESEARCH.md Pattern 5, already grounded against this exact function):
```js
const token = process.env[useSecondary ? 'QA_AGENT_TOKEN_SECONDARY' : 'QA_AGENT_TOKEN'];
```
Keep the same ConfigError class and the same "name exactly which env var and which flag" message convention — add a `useSecondary`-aware message variant, never a generic one.

**Critical constraint (from Pitfall 4 / D-01):** the token's *value* must never appear in a CLI argument — only a boolean `--secondary` flag is added, resolved inside `readConfig()`'s own `process.env` read, exactly as `QA_AGENT_TOKEN` already is. Do not thread the token string through argv.

**Exit-code table convention** (lines 7-22) — if a new exit code is needed for a missing secondary credential at dispatch time, document it in this same top-of-file table, keeping the "codes 3-8 keep the meanings already assigned" cross-file contract with `discover-schema.mjs`/`test-case-doc.mjs` intact.

---

### `scripts/api-client.test.mjs` — add coverage for `--secondary`/`useSecondary`

**Analog:** same file, existing ConfigError tests (follow the same pattern as `discover-schema.test.mjs`'s per-behavior `it(...)` blocks — read the existing ConfigError test in this file before writing new ones, same non-mocked inline-fixture style).

---

### `scripts/test-case-doc.mjs` — extend `EXECUTION_MODES` / add pending state

**Analog:** same file — `EXECUTION_MODES` (line 48), `parseCaseBlock` (lines 122-159)

**Current enum-validation pattern** (lines 140-145):
```js
const ejecucion = fields['Ejecución'];
if (!EXECUTION_MODES.includes(ejecucion)) {
  throw new TestCaseFormatError(
    `Case ${id} has an invalid Ejecución "${ejecucion}" — must be one of ${EXECUTION_MODES.join(', ')}`
  );
}
```
Per RESEARCH.md's Open Question 1 recommendation (extend `EXECUTION_MODES` to a 3rd literal rather than add a new field), change line 48:
```js
export const EXECUTION_MODES = ['API', 'UI'];
```
to include a third literal (e.g. `'pendiente'`). This single-line change is the crux of **Pitfall 1** — it must land in the same task as:
- `validateTestCasesDoc`'s `counts.byEjecucion` initialization/increment (currently keyed only on `API`/`UI` — Grep this function for the exact object shape before writing the plan step)
- `references/test-case-format.md`'s "Allowed values" section for `Ejecución`
- `SKILL.md`'s `## Running generated cases` step 4 — new branch that refuses to dispatch a `pendiente` case with a clear message, never silently attempting it

**Class/error convention to reuse:** `TestCaseFormatError` (line 34) — do not introduce a new error class for this; the existing throwing/non-throwing split (`scanCaseFields` never throws, `parseCaseBlock` throws, `validateTestCasesDoc` collects instead of throwing — lines 100-159) must be preserved for whatever new validation logic accompanies the pending state.

**FORBIDDEN_DISPATCH_FLAGS pattern** (lines 61-65) — no change needed; confirm (via a new test, not new code) that a pending-marked case's `Pasos`/`Resultado esperado` still passes through this same scan unmodified.

---

### `scripts/test-case-doc.test.mjs` — add coverage for the new `Ejecución` state

**Analog:** same file, mirror `discover-schema.test.mjs`'s per-behavior `it(...)` style. Add: a case with `Ejecución: pendiente` parses successfully; `validateTestCasesDoc`'s `counts.byEjecucion` includes the new key; a document with an out-of-set `Ejecución` value still throws `TestCaseFormatError` (regression test on the existing line 140-145 behavior, now against the widened set).

---

### `references/discovery-nextjs.md` — add role-guard detection rule (D-03/Pattern 4)

**Analog:** same file — "Validation detection" section (lines 33-59) and "The rule that follows from finding nothing" (lines 61-67)

**Structural convention to copy exactly:**
```
## Validation detection

**These applications do not use a schema-validation library.** ...
Treat the imperative early-return shape as the *primary* detection path...

\`\`\`
NextResponse\.json\(\s*\{\s*error:\s*'([^']*)'\s*\}\s*,\s*\{\s*status:\s*(\d{3})\s*\}\s*\)
\`\`\`

**Worked example**, `scripts/__fixtures__/mock-target-repo/app/api/categorias/route.ts`: ...
```
A new `## Permission / role-guard detection` section should follow this same shape: state the primary detection regex (the comparison operator, per RESEARCH.md Pattern 4 — `\.rol\s*[!=]==\s*['"]\w+['"]`), explicitly warn against assuming a single response-wrapper shape (grounded citation: `dotax`'s `err()` helper vs. inline `NextResponse.json`), and close with "the rule that follows from finding nothing" — mirror lines 61-67 verbatim in spirit: absence of a match means "no role-guard was detected by this named pattern," never "no access control exists."

---

## Shared Patterns

### Deterministic-script vs. orchestrator-judgment split
**Source:** established project-wide since Phase 1, reaffirmed in `scripts/discover-schema.mjs`'s own doc-comments and `references/discovery-nextjs.md`'s framing.
**Apply to:** `extractPolicies`/`parseCheckBounds`/`parseCheckEnum` (deterministic — pure SQL-string parsing) vs. role-guard/permission-case detection in route handlers (orchestrator Grep+Read judgment — no schema library exists to parse against). Do not blur this line: RLS parsing belongs in `discover-schema.mjs`, in-code guard detection belongs in `references/discovery-nextjs.md`'s rubric.

### "Never invent, only observe" discipline
**Source:** `references/discovery-nextjs.md` lines 61-67 ("The rule that follows from finding nothing"); CONTEXT.md D-10/D-12.
**Apply to:** `parseCheckBounds`/`parseCheckEnum` returning `null` for an unrecognized `CHECK` shape must produce **no boundary case**, not an invented one — same discipline as the existing regex returning no match meaning "not detected," never "does not exist."

### Credential isolation (never echo/argv a secret)
**Source:** `scripts/api-client.mjs`'s `redactHeaders()` (lines 66-77) and `readConfig()`'s in-process `process.env` read (never a CLI value) — lines 86-129.
**Apply to:** `QA_AGENT_TOKEN_SECONDARY` resolution (D-01) and the generation-time presence check (D-02) — check existence only (e.g. `grep -q '^QA_AGENT_TOKEN_SECONDARY=' <target>/.env.local`, discarding output), never read or print the value.

### Error-class-per-module + numbered CLI exit codes
**Source:** `ConfigError` (`api-client.mjs:43`), `TestCaseFormatError` (`test-case-doc.mjs:34`), the top-of-file exit-code comment tables in both files (lines 7-22 and 17-28 respectively), explicitly cross-referencing each other ("Codes 3-8 keep the meanings scripts/api-client.mjs and scripts/discover-schema.mjs already assigned them").
**Apply to:** any new exit-code or error condition introduced this phase (e.g. missing-secondary-credential at dispatch, pending-case dispatch refusal) must extend these same tables in place, never introduce a parallel numbering scheme.

## No Analog Found

None. Every file this phase touches already exists and was read in full this session; there is no genuinely new file/module to find an external analog for.

## Metadata

**Analog search scope:** `scripts/`, `references/`, `SKILL.md` (all files this phase modifies, per CONTEXT.md/RESEARCH.md)
**Files scanned:** `scripts/discover-schema.mjs`, `scripts/discover-schema.test.mjs`, `scripts/test-case-doc.mjs`, `scripts/api-client.mjs`, `references/discovery-nextjs.md`
**Pattern extraction date:** 2026-09-17
