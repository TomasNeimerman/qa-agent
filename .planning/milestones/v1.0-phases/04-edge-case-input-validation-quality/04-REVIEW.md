---
phase: 04-edge-case-input-validation-quality
reviewed: 2026-09-18T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - SKILL.md
  - references/discovery-nextjs.md
  - references/test-case-format.md
  - scripts/__fixtures__/sample-test-cases.md
  - scripts/api-client.mjs
  - scripts/api-client.test.mjs
  - scripts/discover-schema.mjs
  - scripts/discover-schema.test.mjs
  - scripts/discovery-surfaces.test.mjs
  - scripts/discovery.e2e.test.mjs
  - scripts/format-report.mjs
  - scripts/format-report.test.mjs
  - scripts/test-case-doc.mjs
  - scripts/test-case-doc.test.mjs
findings:
  critical: 1
  warning: 5
  info: 1
  total: 7
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-09-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the full edge-case/input-validation-quality phase surface: the skill
frontmatter/protocol document, both reference docs, the golden fixture, the
four executable scripts (`api-client.mjs`, `discover-schema.mjs`,
`format-report.mjs`, `test-case-doc.mjs`) and their test suites. The
codebase is unusually well-documented and most of the documented invariants
(evidence-before-verdict, no-fabricated-constraint, confirmation gating,
credential redaction) are genuinely backed by code and tests. This review
found one concrete logic bug that breaks the project's own core "never
invent a boundary" guarantee for a common SQL operator, plus several
smaller correctness/robustness/consistency issues, none of which have test
coverage today.

## Critical Issues

### CR-01: `parseCheckBounds` misreads the SQL `<>` (not-equal) operator as a numeric lower bound

**File:** `scripts/discover-schema.mjs:216-224`
**Issue:** `parseCheckBounds` derives `gt`/`lt` from two independent regexes:
```js
const gt = checkExpr.match(new RegExp(`>(?!=)\\s*(${NUM})`));
const lt = checkExpr.match(new RegExp(`<(?!=)\\s*(${NUM})`));
```
Neither regex is aware that `<` and `>` can appear together as the SQL
not-equal operator `<>`. For a real, common CHECK expression such as
`CHECK (estado <> 5)`:
- `gte`/`lte` don't match (no literal `>=`/`<=` substring).
- `lt` doesn't match (the character right after `<` is `>`, not a digit).
- `gt` **does** match: the `>` inside `<>` satisfies `>(?!=)` (the next
  character is a space, not `=`), then `\s*` consumes the space and `(NUM)`
  captures `5`.

The function therefore returns `{ min: 6, max: null }` for a column that is
merely constrained to "not equal to 5" — a fabricated exclusive-lower-bound
constraint that was never declared. This directly violates the project's
own repeatedly-stated D-09/D-10 invariant ("never invent a boundary
nobody declared") and `references/test-case-format.md`'s "Regla de
límites", since `discoverSchema()` attaches this bogus `bounds` object to
the constraint record, and downstream boundary-case generation
(`min-1/min/max/max+1`) would turn it into four generated test cases
asserting behavior around a threshold that does not exist in the schema.
`<>` is the SQL-92 standard not-equal spelling and is common in Postgres
migrations (the project's own `discover-schema.test.mjs:136-141` already
exercises `CHECK (a <> b)`, just not with a numeric operand, so this gap is
untested).

**Fix:** Reject `<>` explicitly before running the `gt`/`lt` comparison
regexes, e.g.:
```js
export function parseCheckBounds(checkExpr) {
  if (typeof checkExpr !== 'string') return null;
  // Strip <> and != (not-equal) tokens first — neither is a bound.
  const withoutNotEqual = checkExpr.replace(/<>|!=/g, ' ');
  ...
  const gt = withoutNotEqual.match(new RegExp(`>(?!=)\\s*(${NUM})`));
  const lt = withoutNotEqual.match(new RegExp(`<(?!=)\\s*(${NUM})`));
  ...
}
```
and add a regression test: `parseCheckBounds("estado <> 5")` must return
`null`.

## Warnings

### WR-01: `looksLikeProduction`'s IPv6-loopback check is dead code

**File:** `scripts/api-client.mjs:197-214`
**Issue:** The function compares `hostname === '::1'`, but the WHATWG URL
parser Node uses returns IPv6 hostnames wrapped in brackets — e.g.
`new URL('http://[::1]:3000').hostname === '[::1]'`, never `'::1'`. This
branch can therefore never match, so a legitimate IPv6-loopback target
(`http://[::1]:3000`) falls through to the "unrecognised public hostname"
default and is refused as "looks like a production target" (exit 6) even
though it is exactly the kind of local target this check exists to allow.
Not a security hole (it fails toward the safe/refuse direction), but it is
incorrect, untested logic that contradicts the function's own stated intent
("localhost, a private-range IPv4 address, ... treated as non-production").
**Fix:** Compare against the bracketed form, or strip brackets before
comparing:
```js
const bare = hostname.replace(/^\[|\]$/g, '');
if (bare === '::1' || ...) return false;
```

### WR-02: 401/403 verdict hint is appended even when the response was the expected, passing outcome

**File:** `scripts/api-client.mjs:406-411`
**Issue:**
```js
let verdict = composeVerdict({ method: m, url: absoluteUrl, status, checks });
if (status === 401 || status === 403) {
  verdict +=
    ` Note: repeated ${status} responses across cases usually indicate a ` +
    'QA_AGENT_TOKEN problem rather than an application defect.';
}
```
This note is appended purely from the raw HTTP status, with no check for
whether the case actually failed. A negative-auth case that explicitly
expects 401 (e.g. `--expect-status 401` for a "Sin autenticar" case, exactly
the shape SKILL.md's own case-generation examples produce) will pass all its
checks and get a `PASSED` verdict — but that verdict is still polluted with
"...usually indicates a QA_AGENT_TOKEN problem rather than an application
defect," which is actively misleading for a case whose entire point is that
401 *is* the correct behavior. This also contradicts `composeVerdict`'s own
documented contract two lines above it: "Composes a one-line verdict
sentence strictly from the check objects ... never free-authored
narrative." The hint is free-authored narrative tacked on outside that
discipline. The only existing test (`runCase — 401/403 verdict hint
(T-01-18)`) exercises solely the unexpected/failing case, so this gap has no
regression coverage.
**Fix:** Gate the hint on `!allPassed` (or on the specific `status` check
having failed), e.g. `if (!statusPassed && (status === 401 || status === 403))`.

### WR-03: The `--secondary` / `--storage-state` mutual-exclusion invariant is enforced only in `readConfig`, not in `runCase`

**File:** `scripts/api-client.mjs:120-126` (enforced) vs. `scripts/api-client.mjs:308-343` (not enforced)
**Issue:** `readConfig` throws a `ConfigError` when `useSecondary` and
`storageStatePath` are both given, with extensive commentary on why this
matters (D-01: "a storage state is the primary test user's own session, so
combining it with `--secondary` asks the script to be two identities at
once"). `runCase`, the function that actually produces the `credential` and
`mechanism` evidence fields, does not re-check this invariant — it computes
`authMechanism` and `credential` independently and would happily label a
storage-state-driven request `credential: 'secondary'` if called directly
with both `storageStatePath` and `useSecondary: true`. Today the CLI is the
only caller and it always routes through `readConfig` first, so this is not
currently reachable — but it is exactly the kind of defense-in-depth gap the
project calls out elsewhere as worth closing (the `FORBIDDEN_DISPATCH_FLAGS`
check in `test-case-doc.mjs`'s `findCase` is deliberately duplicated for
this same reason: "independent of whether the caller also ran
`validateTestCasesDoc`... first"). Any future direct caller of the exported
`runCase` (a test, a new entry point) can silently produce internally
contradictory evidence.
**Fix:** Either re-check the two-identities contradiction inside `runCase`
itself, or document on `runCase`'s docstring that callers other than the CLI
must replicate `readConfig`'s guard themselves.

### WR-04: Inconsistent `return` after `process.exit()` in `api-client.mjs`'s `main()`

**File:** `scripts/api-client.mjs:615-637`
**Issue:**
```js
let caseObj;
try {
  caseObj = await runCase({ ... });
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(4);
}

appendCase(resultsPath, caseObj, { ... });
```
Every other early-exit branch in this function (`declined`, confirmation
gate, production-target check, `readConfig` failure, `preflight` failure)
follows `process.exit(N)` with an explicit `return;`. This one branch omits
it. In real Node.js, `process.exit()` terminates the process immediately
so `appendCase` is never actually reached today — but the omission breaks
the pattern every sibling branch establishes, and it is a latent
`appendCase(resultsPath, undefined, ...)` (and subsequent
`JSON.stringify(undefined)`/`caseObj.status` crash in downstream tooling)
waiting to happen the moment `process.exit` is intercepted or stubbed (e.g.
by a future test harness, or a supervisor/sandbox that traps exit calls).
**Fix:** Add the same `return;` used by every other branch:
```js
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(4);
  return;
}
```

### WR-05: The citation rule is enforced only at generation time, and its regex is easy to satisfy accidentally

**File:** `scripts/test-case-doc.mjs:107-110, 576-583, 150-191, 311-333`
**Issue:** Two related gaps in the same rule:
1. `CITATION_RE = /[\w./-]+:\d+/` matches *any* word-chars-colon-digits
   substring, not specifically a `path/to/file.ext:123` citation. A
   `Resultado esperado` value that merely happens to contain something like
   `"total:5"` or `"intentos:3"` (no file path at all) satisfies the regex
   and the case is reported as carrying a valid citation, even though
   `references/test-case-format.md`'s citation rule explicitly requires "a
   path fragment followed by a colon and one or more digits" grounding a
   real source location — the exact "invented constraint" problem this
   document format's opening invariant says it refuses to allow.
2. More importantly, the citation check exists **only** inside
   `validateTestCasesDoc` (lines 576-583) — it is never run by
   `parseCaseBlock`/`findCase` (lines 150-191, 311-333), which is what
   `## Running generated cases` actually calls at dispatch time
   (`--file <path> --case <id>`). Since the document is explicitly designed
   to be hand-edited after generation (D-06), a hand-edit that changes a
   case's `Tipo` to `negativo`/`edge` or strips its citation after the
   one-time post-generation `validateTestCasesDoc` run would dispatch
   successfully with no citation check ever re-running — unlike
   `FORBIDDEN_DISPATCH_FLAGS`, which `findCase` deliberately re-checks for
   exactly this "don't trust that validation already ran" reason (see the
   comment at `test-case-doc.mjs:372-378`).
**Fix:** Tighten `CITATION_RE` to require a path-like prefix (e.g. at least
one `/` or a file extension before the colon), and consider having
`findCase` re-run the citation check for `negativo`/`edge` cases the same
way it already re-runs the dispatch-flag scan, so the same "don't trust
prior validation" discipline applies to both rules.

## Info

### IN-01: Report renderer does not escape backticks in dynamically-embedded values

**File:** `scripts/format-report.mjs:48-60`
**Issue:** `renderHeaders`/`renderBody` wrap arbitrary header/body values in
single backticks (`` `${v}` ``) or fenced code blocks. A response body or
header value that itself contains a backtick (or, for a fenced block, a
` ```  ` sequence) will break the surrounding Markdown formatting of the
generated report — not a security issue since this is a local report file,
but it can silently corrupt the rendered evidence for whatever case follows
the offending one.
**Fix:** Escape/neutralize backticks (or use a wider fence such as
` ```` ` when the body itself already contains triple backticks) before
embedding response data.

---

_Reviewed: 2026-09-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
