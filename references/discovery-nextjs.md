# Next.js discovery detection rules

This is the detection rubric the orchestrator applies while running
`SKILL.md`'s `## Discovery protocol` (DISC-01). It decides only *what
surfaces exist and what shape they are* — an API handler, a page, a
Server-Action-backed form, a client-fetch-backed form, and which router
layout the target project uses. It never decides what a case should
assert (that is `## Case generation protocol`'s job, deferring to
`references/test-case-format.md`), and it never decides whether an action
is safe to run, which stays with `references/destructive-classification.md`
and `references/ui-destructive-classification.md`.

`scripts/discovery-surfaces.test.mjs` proves every pattern named below
still finds what it claims to find, against fixture repos under
`scripts/__fixtures__/`. That test file is a proof the documented rule
matches real Next.js file shapes — it is not part of the runtime discovery
path, which stays with the orchestrator's own Glob and Grep tool calls.

## Handler detection table

| Shape | Glob | What to grep once matched | What a match means |
|---|---|---|---|
| App Router API handler | `app/**/route.ts` | verb-export pattern (below) | One exported async function per HTTP method, at the top level. Every handler observed across the three target repos (DATAX-web, dotax, franquix) follows this shape exactly — no nesting, no re-export indirection — which is why a TypeScript AST parser is disproportionate machinery here; a Grep plus a Read of the matched file is enough. |
| App Router page | `app/**/page.tsx` | `<form[\s>]` | A page that renders a `<form>` element is a UI surface to classify with the form-mechanism check below. A page with no `<form>` is not a form surface for this discovery pass. |
| Colocated Server-Action module | `actions.ts` in the same directory as a matched `page.tsx` | the literal string `'use server'` | The form's real validation lives in this module, invoked through `useActionState`/`formAction`, not through a fetch call. |

The verb-export pattern, matched once per exported HTTP-verb function:

```
export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(
```

## Validation detection

**These applications do not use a schema-validation library.** A discovery
pass built to pattern-match `z.object(`/`.parse(`/`.safeParse(` against a
target `route.ts` finds nothing in DATAX-web, dotax, or franquix and
silently under-reports every negative case the app actually has. Treat the
imperative early-return shape as the *primary* detection path, not a
fallback:

```
NextResponse\.json\(\s*\{\s*error:\s*'([^']*)'\s*\}\s*,\s*\{\s*status:\s*(\d{3})\s*\}\s*\)
```

A returned JSON error response carrying a status in the 400-499 range,
near a field name, is a validation check regardless of whether any schema
import is present anywhere in the file.

**Worked example**, `scripts/__fixtures__/mock-target-repo/app/api/categorias/route.ts`:
four distinct checks in one handler — `No autenticado` (401), `Solo el
administrador puede crear categorias` (403), `Falta el nombre` (400), and
`Tipo invalido (ingreso o egreso)` (400) — ground five cases (the four
negatives plus the happy path), every expected status and message quoted
verbatim from the file, none invented.

A schema-library match, when one *is* found in some other target project,
is a bonus enrichment layered on top of this rule — never the primary
detection path a discovery pass depends on.

## The rule that follows from finding nothing

If a handler yields no match for the imperative-error pattern above,
record that **no validation was detected by these named patterns** — never
that the endpoint is unvalidated. The second phrasing is a claim about the
application; discovery has no standing to make it. It is only entitled to
report the limits of what it looked for.

## Form mechanism detection

Before assuming a form posts JSON to an `app/**/route.ts` handler, run
this ordered check:

1. Look in the same directory as the matched `page.tsx` for a colocated
   `actions.ts`. If it exists and contains the literal string
   `'use server'`, the form's real validation lives there, invoked through
   `useActionState`/`formAction` — the surface is **server-action-backed**.
2. If no such module is present, and the page calls `fetch(` against a
   path beginning with `/api/`, the surface is **client-fetch-backed** and
   resolves to the `route.ts` handler at that path.
3. **If both signals are present, server-action wins.** A bound form
   `action` attribute is what the browser actually submits through; a
   `fetch(` call elsewhere in the same page is not what fires when the
   form's submit button is pressed.

## Worked examples, both mechanisms

- **Server-action.** `scripts/__fixtures__/mock-target-repo/app/login/page.tsx`
  binds its form's `action` to `loginAction`, imported from the colocated
  `scripts/__fixtures__/mock-target-repo/app/login/actions.ts`, whose first
  line is `'use server'`. The page contains **no** `fetch(` call anywhere —
  the whole point of this fixture pair is a form that submits without one.
- **Client-fetch.** `scripts/__fixtures__/mock-target-repo/app/registro/page.tsx`
  has no colocated `actions.ts`. Its `onSubmit` handler validates
  client-side (required fields, a minimum password length) and then calls
  `fetch('/api/registro', ...)`, which resolves to
  `scripts/__fixtures__/mock-target-repo/app/api/registro/route.ts` — a
  handler `API_ROUTE_GLOB` (`app/**/route.ts`) actually matches. A form
  whose declared API target does not exist on disk is exactly the failure
  mode this resolution check exists to catch.

## Which side is authoritative

For a client-fetch form whose page and route both validate — the registro
fixture pair duplicates a required-fields check and a minimum-length
password check on both sides — the **server-side check is the real
guarantee**. A negative case dispatched against the API directly bypasses
client-side JavaScript entirely. Record both signals if both are read, but
derive an API-level negative case only from the server-side check, never
from a client-side-only validation the API itself does not enforce.

## Exclusions

A scan never walks these directory names, in the target project or any of
its subdirectories: `node_modules`, `.next`, `dist`, `build`, `out`,
`coverage`, `.git`. Each of the three real target repos has a populated
dependency directory; a scan that walks it returns thousands of irrelevant
matches and burns the token budget the scan exists to conserve.

## Tie-breaker

When a surface's shape is genuinely ambiguous — the form-mechanism
signals conflict in a way step 3 above doesn't resolve, or a file's role
can't be told from its path alone — read the file rather than guessing
from the path. If it is still ambiguous after reading it, say so in the
generated document rather than picking a mechanism and presenting it as
certain.
