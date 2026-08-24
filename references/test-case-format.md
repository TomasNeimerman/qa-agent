# Test-case document format

This document is the canonical structure contract for
`qa-reports/<run-id>-test-cases.md` — the artifact `/qa-agent` produces when
asked to discover or generate test cases (DISC-01/DISC-02/DISC-03). Its
non-negotiable invariant: every precondición, paso and resultado esperado
must be traceable to something actually read in the target project's code
during discovery, never to the orchestrator's own expectations about how the
app *should* behave. A case with no observed source is an invented
constraint, and this project already refuses that discipline everywhere else
(project Pitfall 1, `references/report-template.md`'s own opening line).

Unlike `references/report-template.md`, this document's writer is the
orchestrator's own `Write` tool, not a script — `scripts/format-report.mjs`
has no counterpart here. `scripts/test-case-doc.mjs` only reads this format
back, at execution-request time (D-11) and as this contract's own
end-to-end lock (`scripts/discovery.e2e.test.mjs`); it never renders it.

## Section order

A conforming document has exactly these parts, in this order:

1. H1 title
2. Metadata block — five bold-labelled lines
3. One `##` heading per discovered surface (D-05), each followed by an
   `**Origen del surface:**` line
4. Under each surface, one or more `### case-N — <título>` case blocks

## 1. H1 title

```
# Casos de Prueba — 2026-08-20-1530-categorias
```

The H1 always begins with the fixed prefix `# Casos de Prueba — ` followed
by the run id — the same `<YYYY-MM-DD-HHmm>-<slug>` id `SKILL.md`'s
`## Run protocol` already uses for execution reports (D-01).

## 2. Metadata block

Exactly five bold-labelled lines, in this order:

```
**Generado:** 2026-08-20 15:30
**Origen:** Escaneo completo de proyecto — c:/franquix
**Instrucción:** (vacío — escaneo completo, no instrucción puntual)
**Router:** App Router (app/)
**Alcance:** app/**/route.ts, app/**/page.tsx, supabase/migrations/*.sql — excluye node_modules, .next, dist, build, coverage, .git
```

- `**Generado:**` — the timestamp discovery ran.
- `**Origen:**` — whether this was a full-project scan or a one-off
  instruction, plus the absolute target project path.
- `**Instrucción:**` — the developer's verbatim instruction, or an explicit
  empty marker (`(vacío — escaneo completo, no instrucción puntual)`) for a
  full scan. Never paraphrased.
- `**Router:**` — which router layout discovery detected (D-08's result):
  App Router, Pages Router, or a mix. Recorded so a reader knows which tree
  was walked, not just what was found in it.
- `**Alcance:**` — the globs actually scanned and the exclusions applied.
  `Router` and `Alcance` exist to serve this project's transparency
  prohibitions: a reader must be able to tell what was looked at from what
  was found — a surface with nothing reported is not proof nothing exists
  there, only proof it wasn't in scope.

## 3. Surface headings

One `##` heading per discovered surface (D-05), named the way a developer
refers to it — an HTTP method and path for an API route
(`## POST /api/categorias`), a route path and form name for a UI surface
(`## UI /login (Server Action)`). Applies uniformly whether the surface came
from a full-project scan or a scoped instruction — one output convention
regardless of source.

Immediately under each surface heading, one line:

```
**Origen del surface:** app/api/categorias/route.ts:1-41
```

citing the file and line range the surface was read from.

## 4. Case headings

```
### case-1 — Alta de categoría con datos válidos
```

The heading always carries a space, an em dash (`—`) and a space
immediately after the case ID — never a bare ID with no delimiter. This is
load-bearing, not stylistic: `case-1` is a substring of `case-12`, and an
unanchored lookup at execution-request time (D-11) would return the wrong
case or two cases at once (03-RESEARCH.md Pitfall 5). `scripts/test-case-doc.mjs`'s
`CASE_HEADING_PATTERN` is anchored on exactly this delimiter for the same
reason.

Under each case heading, exactly five bold-labelled bullets, in this fixed
order:

```
- **Precondiciones:** Usuario autenticado con rol `admin`
- **Pasos:** POST /api/categorias con body `{ "nombre": "Alquiler", "tipo": "egreso" }`
- **Resultado esperado:** 200, `{ ok: true, categoria: {...} }`
- **Tipo:** positivo
- **Ejecución:** API
```

The first four are D-02's fields (título is the case heading's own title,
so the field list under the bullet is the remaining four plus Tipo); the
fifth, `Ejecución`, is D-03's field, set by discovery so the executor never
re-infers whether a case is an API call or a browser flow.

### Allowed values

- `Tipo` is exactly one of `positivo`, `negativo`, `edge`.
- `Ejecución` is exactly one of `API`, `UI`.

### ID rule (D-04)

Sequential from `case-1`, no gaps, no duplicates, scoped to this one
document — never renumbered across documents, never reused after a case is
struck out by hand (D-06 already allows hand-editing; a struck-out case
keeps its ID rather than shifting every later ID down).

### Citation rule

Any case whose `Tipo` is `negativo` or `edge` must carry a file-and-line
citation inside its `Resultado esperado` (a path fragment followed by a
colon and one or more digits, e.g. `app/api/categorias/route.ts:29`) —
because a failure expectation with no observed source is exactly the
invented constraint this document's opening invariant forbids.

### Labeling rule (negativo vs. edge)

- A failure the code itself announces — an explicit early return with a
  literal message and status code — is `negativo`, and its `Resultado
  esperado` quotes that message verbatim alongside the file-and-line
  citation.
- A failure that exists only at the database layer, or an expected result
  inferred from how the code currently behaves rather than from a message
  it returns, is `edge`. Its `Resultado esperado` must say so explicitly and
  name the migration file and line the constraint came from — this is the
  oracle-problem guard (03-RESEARCH.md Pitfall 4): current behavior is not
  automatically correct behavior, and labeling it `negativo` would overstate
  that authority.

## Worked example

```
## POST /api/categorias

**Origen del surface:** app/api/categorias/route.ts:1-41

### case-1 — Alta de categoría con datos válidos
- **Precondiciones:** Usuario autenticado con rol `admin`
- **Pasos:** POST /api/categorias con body `{ "nombre": "Alquiler", "tipo": "egreso" }`
- **Resultado esperado:** 200, `{ ok: true, categoria: {...} }`
- **Tipo:** positivo
- **Ejecución:** API

### case-2 — Sin autenticar
- **Precondiciones:** Ninguna sesión activa
- **Pasos:** POST /api/categorias sin cookie de sesión, body válido
- **Resultado esperado:** 401, `{ error: "No autenticado" }` (app/api/categorias/route.ts:15, mensaje literal)
- **Tipo:** negativo
- **Ejecución:** API

### case-3 — Día de cierre fuera de rango
- **Resultado esperado:** Fallo esperado — origen: CHECK constraint en supabase/migrations/0002_franquicias_horario.sql:7, comportamiento HTTP no verificado en el código de la ruta.
- **Precondiciones:** Usuario autenticado con rol `admin`
- **Pasos:** POST /api/franquicias/horario con `dia_cierre: 9`
- **Tipo:** edge
- **Ejecución:** API
```

## Closing notes

- This document is meant to be edited by hand before any case is run
  (D-06) — the agent re-reads the file at execution-request time rather
  than treating it as a frozen snapshot of the generation moment.
- Generating this document is a terminal step for the invocation that
  produced it (D-10). The agent never runs a case in the same run it was
  generated in; running cases is a separate, later request (D-11), and
  `scripts/test-case-doc.mjs` is what makes that later lookup
  deterministic.
