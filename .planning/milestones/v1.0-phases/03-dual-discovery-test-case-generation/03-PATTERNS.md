# Phase 3: Dual Discovery & Test-Case Generation - Pattern Map

**Mapped:** 2026-08-20
**Files analyzed:** 8 (new)
**Analogs found:** 6 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `scripts/discover-schema.mjs` | utility (deterministic extractor) | transform (file → JSON) | `scripts/api-client.mjs` | role-match |
| `scripts/discover-schema.test.mjs` | test | transform | `scripts/api-client.test.mjs` | exact |
| `scripts/__fixtures__/mock-target-repo/` | fixture (data, not code) | file-I/O | `scripts/__fixtures__/mock-server.mjs` (fixture dir convention) | role-match |
| `references/discovery-nextjs.md` | reference/config (procedure doc) | — | `references/destructive-classification.md` | exact |
| `references/test-case-format.md` | reference/config (structure contract) | — | `references/report-template.md` | exact |
| `qa-reports/<run-id>-test-cases.md` (generated output, not source) | — (generated artifact) | file-I/O (Write) | `qa-reports/<run-id>.md` (produced by `format-report.mjs`) | role-match |
| `SKILL.md` additions (`## Discovery protocol`, `## Case generation protocol`) | orchestrator procedure (doc, not code) | request-response (instruction → artifact) | `SKILL.md` `## Run protocol` / `## Case construction` | exact |
| No new renderer script (D-01 chose Markdown-only, Write-tool authored) | — | — | n/a — explicitly no `format-report.mjs`-equivalent needed | no analog needed |

## Pattern Assignments

### `scripts/discover-schema.mjs` (utility, transform)

**Analog:** `scripts/api-client.mjs` (`C:/qa-agent/scripts/api-client.mjs`)

Even though `api-client.mjs` dispatches HTTP rather than parsing SQL, it is the strongest analog for the *deterministic-script* shape this project uses everywhere: named exports for pure functions, a `parseArgs`-style CLI entry only in `main()`, explicit typed errors, and an `isMainModule()` guard so the file is both an importable library (for tests) and a CLI (for the orchestrator's Bash tool calls). `discover-schema.mjs` should copy this shape exactly, not the HTTP specifics.

**Imports pattern** (api-client.mjs lines 33-39):
```javascript
import { basename, dirname, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { request } from 'playwright';
import { z } from 'zod';
import { previewOf, requiresConfirmation } from './destructive.mjs';
```
For `discover-schema.mjs`, this becomes purely `node:fs` (`readdirSync`, `readFileSync`) + `node:path` (`join`, `resolve`) — no `dotenv`/`playwright`/`zod` needed, per RESEARCH.md's "no new dependency" stack decision. Keep the header-comment convention (lines 1-31) documenting exit/behavior invariants once, at the top of the file.

**Typed error class pattern** (api-client.mjs line 43):
```javascript
export class ConfigError extends Error {}
```
Copy this convention for a `discover-schema.mjs`-specific error (e.g. `class MigrationsDirNotFoundError extends Error {}`), matching `format-report.mjs`'s own `EvidenceMissingError extends Error {}` (format-report.mjs line 21) — every deterministic script in this codebase signals a specific failure mode via a small custom Error subclass, never a generic `throw new Error(...)`.

**Explicit dispatch-map pattern, applies to constraint-type classification** (api-client.mjs lines 45-56):
```javascript
export const DISPATCH = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
  HEAD: 'head',
};
```
The comment above this map ("A typo or an unrecognised method... must never become a dynamic property lookup... it must throw before any network activity instead") is the exact discipline `discover-schema.mjs` needs for the `CHECK (` vs `WITH CHECK (` disambiguation (RESEARCH.md Pattern 3/Pitfall 2): classify via an explicit, named rule set, never a loose regex whose match implicitly decides behavior.

**Named pure-function + doc-comment pattern** (api-client.mjs lines 79-85, `redactHeaders`/`readConfig`):
```javascript
/**
 * Returns a shallow copy of `headers` with the values of any credential-bearing
 * header ... replaced by the literal string "[REDACTED]".
 */
export function redactHeaders(headers) { ... }
```
Every exported function in this codebase carries a doc-comment stating its contract and *why* (not just what). `discover-schema.mjs`'s `listMigrations()` and `extractConstraints()` (already sketched in RESEARCH.md Code Examples) should follow this same doc-comment-first convention.

**CLI arg parsing + main() + isMainModule() guard pattern** (format-report.mjs lines 393-471, structurally identical in api-client.mjs):
```javascript
function parseArgs(argv) { /* --key value / --flag boolean */ }
async function main() {
  const args = parseArgs(process.argv.slice(2));
  // ... read input, transform, write output, print one JSON/text line to stdout, process.exit(code)
}
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}
const isMain = isMainModule();
if (isMain) {
  main().catch((err) => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(1);
  });
}
```
Copy this verbatim shape for `discover-schema.mjs`'s CLI entry (e.g. `node scripts/discover-schema.mjs --migrations-dir <path>` printing one JSON line to stdout). The `isMainModule()` comment explains *why* (symlink/junction install method) — keep that comment too.

---

### `scripts/discover-schema.test.mjs` (test, transform)

**Analog:** `scripts/api-client.test.mjs`

**Imports + fixture pattern** (api-client.test.mjs lines 1-30):
```javascript
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DISPATCH, appendCase, buildShapeSchema, looksLikeProduction, preflight, readConfig, redactHeaders, runCase } from './api-client.mjs';
import { startMockServer } from './__fixtures__/mock-server.mjs';
```
For `discover-schema.test.mjs`: import `listMigrations`/`extractConstraints` from `./discover-schema.mjs` directly for unit tests (no child-process spawn needed since this script has no network/side-effect surface to isolate — simpler than api-client's sibling-process pattern). Use `mkdtempSync(join(tmpdir(), ...))` to write a small fixture `.sql` file per test case, mirroring how api-client.test.mjs uses `tmpDir` for `--results` files. RESEARCH.md's Wave 0 Gaps explicitly call for a fixture containing both a real `CHECK (` and a `WITH CHECK (` in the same file to assert the disambiguation — this is the critical test case, not just a smoke test.

---

### `references/discovery-nextjs.md` (reference doc)

**Analog:** `references/destructive-classification.md`

Read this file for the established style: rule table + "when to check" callouts + explicit worked examples with file:line citations, referenced on-demand from SKILL.md rather than inlined. `discovery-nextjs.md` should document, in this same declarative-rule-table style: (a) App Router (`app/**/route.ts`) vs Pages Router (`pages/api/**/*.ts`) fallback detection (D-08), (b) the imperative-validation pattern-match (`if (!<field>` + `NextResponse.json({ error:` + 4xx status) since Zod is absent per RESEARCH.md Pitfall 1, (c) Server Action (`actions.ts` + `'use server'`) vs client-fetch form detection (RESEARCH.md Pattern 2/Pitfall 3).

---

### `references/test-case-format.md` (reference doc, structure contract)

**Analog:** `references/report-template.md`

**Section-order-contract pattern** (report-template.md lines 1-25):
```markdown
This document is the canonical structure contract `scripts/format-report.mjs`
must emit. ... every line in a rendered report must be traceable to a field
in the run's `results.json`, never to the conversation transcript...

## Section order

A rendered QA report has exactly these sections, in this order:
1. H1 title — ...
2. Metadata block — ...
3. `## Blocked pending confirmation` — only present when...
4. `## Case N — ...` — one section per case...
```
`test-case-format.md` should adopt the identical framing but note the contract's writer is the **orchestrator's own Write tool**, not a script — "every case's precondiciones/pasos/resultado esperado must be traceable to a specific file read during discovery, never invented" (D-12/Pitfall 1's discipline, mirroring report-template.md's opening sentence almost verbatim). Sections to specify: H1 + metadata block (Generado/Origen/Instrucción, per RESEARCH.md's Code Examples skeleton), one `##` heading per discovered surface (D-05), one `### case-N — <título>` per case with the 5 D-02 fields + `Ejecución` (D-03), and the `case-N` heading-delimiter rule from RESEARCH.md Pitfall 5 (`### case-3 — <título>`, never bare `case-3` with no delimiter, to avoid `case-3`/`case-30` substring collisions at D-11 lookup time).

---

### `SKILL.md` additions — Discovery protocol / Case generation protocol (orchestrator procedure)

**Analog:** `SKILL.md` `## Run protocol` (lines 123-155) and `## Case construction` (lines 242-267)

**Numbered, concrete step-list pattern** (Run protocol lines 125-151):
```
1. Parse $ARGUMENTS: take the first whitespace-delimited token as the base
   URL and the entire remainder as the natural-language test instruction...
2. From the natural-language instruction, derive one case per endpoint...
3. Pick a run id <YYYY-MM-DD-HHmm>-<slug> for this run.
4. For each case, invoke the deterministic script via the Bash tool...
5. After all cases have run..., render the report: ...
6. Post a short summary to chat...
```
The new `## Discovery protocol` section should follow this exact numbered-imperative-step style: (1) decide DISC-01 full-scan vs DISC-03 scoped instruction, (2) detect App Router/Pages Router + Server-Action-vs-fetch per file discovered, (3) run `discover-schema.mjs` for migrations, (4) hand results to a `## Case generation protocol` section styled after `## Case construction` (lines 242-267) — "one case per X the developer/code named," never inventing scope, with explicit bullet rules for how a discovered fact maps to a case field (mirrors `--expect-status`/`--expect-fields` bullets' "only when explicitly named" discipline, applied to precondiciones/resultado esperado grounding instead of CLI flags).

**Run-id + terminal-step pattern** (Run protocol step 3 + D-10):
Reuse the identical `<YYYY-MM-DD-HHmm>-<slug>` run-id convention (already shared with `reportFileName()` in format-report.mjs lines 39-46) for `<run-id>-test-cases.md`, and end the new protocol the same way Run protocol step 6 ends a run: a short chat summary plus the absolute file path — no automatic execution afterward (D-10).

---

## Shared Patterns

### Deterministic-script CLI shape (imports/error-class/parseArgs/main/isMainModule)
**Source:** `scripts/api-client.mjs` (lines 1-56, 393-471), `scripts/format-report.mjs` (lines 393-471)
**Apply to:** `scripts/discover-schema.mjs`
```javascript
export class SomeSpecificError extends Error {}
// ... named exported pure functions with doc-comments ...
function parseArgs(argv) { /* ... */ }
async function main() { /* read → transform → write → stdout summary → process.exit */ }
function isMainModule() { /* realpathSync comparison, see api-client.mjs comment for why */ }
if (isMainModule()) { main().catch((err) => { process.stderr.write(...); process.exit(1); }); }
```

### Reference-doc "canonical structure contract" framing
**Source:** `references/report-template.md` (lines 1-11), `references/destructive-classification.md`
**Apply to:** `references/discovery-nextjs.md`, `references/test-case-format.md`
Opening paragraph states what the document is a contract *for* and the non-negotiable invariant ("every line traceable to a field," "never the conversation transcript/never invented") before any procedural detail — both new reference docs should open the same way, adapted to discovery/test-case grounding instead of report rendering.

### Orchestrator-procedure numbered steps in SKILL.md
**Source:** `SKILL.md` `## Run protocol`, `## UI run protocol`, `## Case construction`, `## Confirmation protocol`
**Apply to:** New `## Discovery protocol` and `## Case generation protocol` sections
Every existing protocol section in SKILL.md is a flat numbered list of concrete, unambiguous actions (never "explore the codebase" — always "Glob X, Grep Y, Read Z, then do W"), each referencing a `references/*.md` file for the judgment-call detail rather than inlining it. New sections should match this granularity exactly so two different sessions produce the same discovery sequence (RESEARCH.md's own stated goal).

### `qa-reports/` output convention (gitignored, run-id-named)
**Source:** `scripts/format-report.mjs` lines 431-445 (creates `.gitignore` with `*\n` on first write, writes `<run-id>.md` + copies `.results.json` alongside)
**Apply to:** test-cases.md generation step
Since D-01 chose Markdown-only (no results.json-equivalent), the new step only needs the `.gitignore`-if-absent + write-to-`qa-reports/` half of this pattern (via the orchestrator's Write tool directly, not a script) — reuse the existing `.gitignore` if `format-report.mjs` already created one in that target project's `qa-reports/`, don't create a second one.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `scripts/__fixtures__/mock-target-repo/` (route.ts/actions.ts/page.tsx/migration .sql fixtures) | fixture data | file-I/O | No existing fixture in `scripts/__fixtures__/` mimics a *target project's* source tree (existing fixtures — `mock-server.mjs`, `mock-login-app.mjs`, `mock-server-process.mjs` — are runtime HTTP/UI mocks, not static source-file fixtures). Build fresh per RESEARCH.md's Recommended Project Structure; keep each fixture file minimal (a couple `route.ts` with one imperative check each, one `actions.ts`+`page.tsx` pair, 2-3 `.sql` migrations including one with both `CHECK (` and `WITH CHECK (`). |
| `qa-reports/<run-id>-test-cases.md` itself (the generated artifact) | generated document | file-I/O (Write) | Not a source file to pattern-match against code — it's Write-tool output. Its *shape* is fully specified by `references/test-case-format.md` (see above) and RESEARCH.md's Code Examples skeleton; no script renders it (unlike `qa-reports/<run-id>.md`, which `format-report.mjs` renders) since D-01 chose no JSON intermediate. |

## Metadata

**Analog search scope:** `C:/qa-agent/scripts/`, `C:/qa-agent/references/`, `C:/qa-agent/SKILL.md`
**Files scanned:** `SKILL.md`, `scripts/api-client.mjs`, `scripts/api-client.test.mjs`, `scripts/format-report.mjs`, `references/report-template.md`, `scripts/__fixtures__/` listing
**Pattern extraction date:** 2026-08-20
