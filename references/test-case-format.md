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

### Scoped-origin variant (DISC-03)

When the document came from a one-off natural-language instruction rather
than a full-project scan (D-12), the same five lines carry the scoped
story instead of the full-scan one:

```
**Generado:** 2026-08-24 11:05
**Origen:** Instrucción puntual — c:/dotax
**Instrucción:** probá el login de usuarios
**Router:** App Router (app/)
**Alcance:** app/login/actions.ts, app/login/page.tsx — resuelto desde la
  instrucción, no un glob del proyecto
```

- `**Origen:**` names "Instrucción puntual" (not "Escaneo completo de
  proyecto") plus the same absolute target project path — a reader must be
  able to tell a scoped pass from a full scan at a glance, not by
  inference from the other four lines.
- `**Instrucción:**` carries the developer's words verbatim — never the
  empty marker a full scan uses, and never a paraphrase of what was asked.
- `**Alcance:**` lists the specific files the scoped branch actually read,
  one per file, never a glob pattern. A glob on this line in a scoped
  document is itself a defect: it means the pass silently widened past the
  one flow the developer named (D-12, T-03-16), and a reader must be able
  to see exactly how narrow the pass was from this line alone.

Every other section of the document — surface headings, `Origen del
surface`, and every case block — is byte-identical in structure to a
full-scan document (D-05: one output convention regardless of source).
Only these five metadata lines differ.

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
- `Ejecución` is `API` or `UI`, optionally followed by a `(pendiente —
  <motivo>)` qualifier — e.g. `API (pendiente — falta 2do usuario)`. The
  qualifier never widens the layer itself: `scripts/test-case-doc.mjs`
  strips it off and validates what remains against the same two-value set
  it always has (`EXECUTION_MODES`). See the next section for what the
  qualifier means and when it is used.

### Regla de ejecución pendiente (D-02/D-04)

A permission case is generated whether or not a secondary test credential
(`QA_AGENT_TOKEN_SECONDARY`) is configured for the current run — it is
never omitted from the document just because it cannot be run right now
(D-02). Its absence would be exactly the silent-skip failure mode this
document's opening invariant already forbids: a case nobody generated is a
case nobody knows was needed.

When no secondary credential is configured, a case that requires one is
marked pending in the document by appending a qualifier to its `Ejecución`
value — the layer stays whatever it already was, `API` or `UI` (D-04: the
field still records which layer the case belongs to, since the discovered
check that produced the case determines how it is later run):

```
- **Ejecución:** API (pendiente — falta 2do usuario)
```

The pending marker is a fact about this run's configuration, never a claim
about the application under test — it does not mean the permission check
itself is broken or untested-for, only that this run has no second
identity to exercise it with.

A pending case becomes runnable in either of two ways: hand-editing the
qualifier away once the credential is available (D-06 already permits
hand-editing a generated document before any case runs), or regenerating
the document after configuring `QA_AGENT_TOKEN_SECONDARY`.

A pending case is never dispatched. `SKILL.md`'s `## Running generated
cases` refuses a case marked pending by name — the same document that
carries the qualifier is what a developer reads to know why — rather than
attempting to run it and discovering the missing credential at request
time.

The qualifier's reason text (`falta 2do usuario`, or whatever the pending
cause is) is written for the developer reading the document, and is never
a credential value — this document's existing rule that a literal
credential read out of the target project is never reproduced (see the
metadata block's transparency rules above) applies to this text unchanged.

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

### Subcategoría de caso (D-08)

A case produced by the systematic input-validation pass (DISC-04) names its
subcategory in the case title, in human-readable Spanish, so a reader can
scan the document without opening every case. No sixth bullet is added to
the five-field schema above to carry it — the subcategory lives in the
title text alone.

This convention covers three DISC-04 subcategories:

- **campo requerido faltante** — the case omits a field the discovery pass
  found to be required. Worked title: `### case-4 — Falta el campo nombre
  (campo requerido faltante)`.
- **formato inválido** — the case sends a value that violates a discovered
  format constraint (a Zod `.email()`/`.regex(...)`, or an SQL `CHECK` with
  a pattern). Worked title: `### case-6 — Email con formato inválido
  (formato inválido)`.
- **valor límite** — the case sends a value at or just past a discovered
  numeric/length boundary. The four `dia_cierre` titles in
  `scripts/__fixtures__/sample-test-cases.md` (`dia_cierre limite inferior
  menos 1`, `dia_cierre limite inferior exacto`, `dia_cierre limite
  superior exacto`, `dia_cierre limite superior mas 1`) are the canonical
  example of this form.

The exact phrasing — word order, whether the subcategory is parenthesised
or inline, accents — is the generator's own judgment, constrained only by
naming the subcategory and the field the case exercises.

### Regla de límites (D-09/D-10)

- A field whose discovered constraint resolves **two bounds** (both `min`
  and `max` non-null) gets exactly **four** boundary cases, in `min-1`,
  `min`, `max`, `max+1` order.
- A field whose discovered constraint resolves **one bound** (only `min` or
  only `max` non-null) gets **only that side's pair** — never an invented
  opposite bound.
- A field with **no discovered constraint** gets **no** boundary case at
  all. A required field with no numeric/length constraint still gets its
  required-field-omission case (per the campo requerido faltante
  subcategory above) — the absence of a boundary is not the absence of the
  required-field check.

Every boundary case carries the file-and-line citation of the constraint it
came from, under the citation rule above — a boundary value with no cited
source is the invented constraint this document's opening invariant already
forbids.

### Dispatch-flag prohibition

A case document is written at generation time and read back later, at
execution-request time (D-06, D-11) — so a case's `Pasos` or `Resultado
esperado` must never contain a literal `scripts/api-client.mjs` dispatch
flag (`--confirmed`, `--read-only-intent`, `--allow-non-local`). A flag
sitting in the document would be an approval nobody actually gave in the
moment the case is run, silently routing a destructive call around
`## Confirmation protocol`'s pause — exactly the elevation-of-privilege
threat `03-03-PLAN.md`'s threat register names as `T-03-12`.
`scripts/test-case-doc.mjs`'s `validateTestCasesDoc` enforces this rule, exported as
`FORBIDDEN_DISPATCH_FLAGS`, and rejects any document containing one of
these literals — by name, and naming which case it was found in — with
exit code 9, before any case from that document is acted on.

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

### case-4 — Usuario sin permiso no puede ver categorías de otro usuario
- **Precondiciones:** Dos usuarios (`admin`, `otro`) con categorías propias
- **Pasos:** GET /api/categorias autenticado como `otro`, esperando no ver las categorías de `admin`
- **Resultado esperado:** 200, la lista de categorías no incluye ninguna perteneciente a `admin` (app/api/categorias/route.ts:22, filtro por owner)
- **Tipo:** negativo
- **Ejecución:** API (pendiente — falta 2do usuario)
```

Case-4 above is the D-02/D-04 pending shape: a permission case generated
without `QA_AGENT_TOKEN_SECONDARY` configured, still recording its `API`
layer and its pending reason, exactly as the previous section describes.

## Closing notes

- This document is meant to be edited by hand before any case is run
  (D-06) — the agent re-reads the file at execution-request time rather
  than treating it as a frozen snapshot of the generation moment.
- Generating this document is a terminal step for the invocation that
  produced it (D-10). The agent never runs a case in the same run it was
  generated in; running cases is a separate, later request (D-11), and
  `scripts/test-case-doc.mjs` is what makes that later lookup
  deterministic.
