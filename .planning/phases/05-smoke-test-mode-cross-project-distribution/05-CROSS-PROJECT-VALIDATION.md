# Cross-Project Validation — PKG-02

**Run id:** `2026-09-21-1500-cross-project-uat`
**Executed:** 2026-09-21
**Scope:** Discovery → generation → smoke-selection run against the three real
target repos from this one unmodified installed skill (Task 1). Task 2 (the
live dispatch run) is recorded separately below — it did not complete for
all three projects; see `## Verdict`.

Every count and JSON blob quoted below is the literal output of
`discover-schema.mjs` or `test-case-doc.mjs`, copied from the Bash tool's
result — never retyped from memory (T-05-10).

---

## C:\DATAX-web

**Resolved absolute root:** `C:/DATAX-web`

**Detected router layout:** App Router (`app/`). `app/` exists and contains
39 `route.ts` handlers under `app/api/**` plus page directories under
`app/compras`, `app/configuracion`, `app/precios`, `app/stock`; no
`pages/api` directory is present. Matches
`references/discovery-nextjs.md`'s `app` outcome exactly.

**`discover-schema.mjs --project-root C:/DATAX-web` — exit 0:**
```json
{"files":11,"skipped":[],"enums":1,"constraints":4,"policies":30,"policyWithCheckCount":16}
```
`policies` is non-empty (30 records) — RLS policy matching did find records
for this parser in this repo.

**Skill-code change required:** none.

**Scoped generation.** A full scan of 39 API handlers plus every page in
this repo is out of proportion for a validation pass — scoped per the
plan's own scope-discipline clause to one bounded, named surface:
`app/api/ext/capabilities/route.ts`, a public (no-auth) endpoint that
documents the external API's own surface. Resolved via a one-off
instruction, not a project-wide glob — recorded in the generated document's
`Alcance` line as that single file.

**Generated document:**
`C:/DATAX-web/qa-reports/2026-09-21-1500-cross-project-uat-test-cases.md`

`test-case-doc.mjs --file <path>` — exit 0:
```json
{"valid":true,"errors":[],"warnings":[],"counts":{"surfaces":1,"cases":1,"byTipo":{"positivo":1,"negativo":0,"edge":0},"byEjecucion":{"API":1,"UI":0},"pendientes":0}}
```

`test-case-doc.mjs --file <path> --smoke` — exit 0:
```json
{"selected":[{"id":"case-1","index":1,"titulo":"Alcance de API externa sin autenticación","precondiciones":"Ninguna — el propio handler documenta que este endpoint no requiere autenticación, por ser documentación de alcance y no exponer datos de negocio (app/api/ext/capabilities/route.ts:5-6).","pasos":"GET /api/ext/capabilities","resultadoEsperado":"200, `{ ok: true, salida: [...], entrada: [...] }`","tipo":"positivo","ejecucion":"API","pendiente":false,"pendienteMotivo":null,"line":13,"surface":"GET /api/ext/capabilities"}],"skipped":[],"counts":{"surfaces":1,"selected":1,"skipped":0,"pendientes":0,"byEjecucion":{"API":1,"UI":0}}}
```

**Skipped surfaces:** none — the document's only surface contributed a
`positivo` case.

**`counts.pendientes`:** 0.

### Live run

See `## Task 2 — precondition check` below — not performed for this
project for the reason recorded there (a documented tool-access limit of
this execution context, not a project-specific configuration gap: this
project's own `QA_AGENT_TOKEN`/`QA_AGENT_BASE_URL` precondition is met).

---

## C:\dotax

**Resolved absolute root:** `C:/dotax`

**Detected router layout:** App Router (`app/`). `app/` exists and contains
39 `route.ts` handlers under `app/api/**`; no `pages/api` directory is
present. Matches `references/discovery-nextjs.md`'s `app` outcome exactly.

**`discover-schema.mjs --project-root C:/dotax` — exit 0:**
```json
{"files":140,"skipped":[],"enums":17,"constraints":569,"policies":126,"policyWithCheckCount":82}
```
`policies` is non-empty (126 records).

**Skill-code change required:** none.

**Scoped generation.** 140 migration files and 39 API handlers is well
outside a validation pass's proportionate scope — scoped to one bounded,
named surface: `app/api/v1/ping/route.ts` (plus its two direct
dependencies, `lib/api/auth.ts` and `lib/api/respuesta.ts`, read for the
auth-failure messages), the API's own connectivity/identity-check endpoint.
Resolved via a one-off instruction, recorded in the generated document's
`Alcance` line as those three files, not a glob.

**Generated document:**
`C:/dotax/qa-reports/2026-09-21-1500-cross-project-uat-test-cases.md`

`test-case-doc.mjs --file <path>` — exit 0:
```json
{"valid":true,"errors":[],"warnings":[],"counts":{"surfaces":1,"cases":3,"byTipo":{"positivo":1,"negativo":2,"edge":0},"byEjecucion":{"API":3,"UI":0},"pendientes":0}}
```

`test-case-doc.mjs --file <path> --smoke` — exit 0:
```json
{"selected":[{"id":"case-1","index":1,"titulo":"Ping autenticado con API key válida","precondiciones":"API key activa (`Authorization: Bearer dtx_live_...`) asociada a un tenant existente.","pasos":"GET /api/v1/ping con header `Authorization: Bearer <api key>`","resultadoEsperado":"200, `{ ok: true, datos: { version: \"v1\", organizacion: ..., plan: ..., estadoSuscripcion: ..., clave: ... } }`","tipo":"positivo","ejecucion":"API","pendiente":false,"pendienteMotivo":null,"line":13,"surface":"GET /api/v1/ping"}],"skipped":[],"counts":{"surfaces":1,"selected":1,"skipped":0,"pendientes":0,"byEjecucion":{"API":1,"UI":0}}}
```

**Skipped surfaces:** none — the document's only surface contributed a
`positivo` case (its two `negativo` auth-failure cases were correctly not
selected by the smoke rule).

**`counts.pendientes`:** 0.

### Live run

Not performed. See `## Task 2 — precondition check` below: `C:\dotax` has
no `.env.local` file at all (confirmed by a read-only existence check —
neither `.env.local` nor `.env` exists in the project root), so
`QA_AGENT_TOKEN` is not configured anywhere this run could read it from.
Task 2's own `<precondition>` is unmet for this project.

---

## C:\franquix

**Resolved absolute root:** `C:/franquix`

**Detected router layout:** App Router (`app/`). `app/` exists and contains
28 `route.ts` handlers under `app/api/**`; no `pages/api` directory is
present. Matches `references/discovery-nextjs.md`'s `app` outcome exactly.

**`discover-schema.mjs --project-root C:/franquix` — exit 0:**
```json
{"files":38,"skipped":[],"enums":8,"constraints":233,"policies":29,"policyWithCheckCount":14}
```
`policies` is non-empty (29 records).

**Skill-code change required:** none.

**Scoped generation.** 38 migration files and 28 API handlers is well
outside a validation pass's proportionate scope — scoped to one bounded,
named surface: `app/api/v1/heartbeat/route.ts`, the agent's own
post-deploy health-signal endpoint (its own header comment names it as
exactly the "is the agent alive" check this smoke mode exists to run).
Resolved via a one-off instruction, recorded in the generated document's
`Alcance` line as that single file, not a glob.

**Generated document:**
`C:/franquix/qa-reports/2026-09-21-1500-cross-project-uat-test-cases.md`

`test-case-doc.mjs --file <path>` — exit 0:
```json
{"valid":true,"errors":[],"warnings":[],"counts":{"surfaces":1,"cases":3,"byTipo":{"positivo":1,"negativo":2,"edge":0},"byEjecucion":{"API":3,"UI":0},"pendientes":0}}
```

`test-case-doc.mjs --file <path> --smoke` — exit 0:
```json
{"selected":[{"id":"case-1","index":1,"titulo":"Latido válido de una sucursal activa","precondiciones":"API key activa asociada al tenant; la sucursal (`franquicia_codigo`) existe y está activa.","pasos":"POST /api/v1/heartbeat con header `Authorization: Bearer <api key>` y body `{ \"franquicia_codigo\": \"<codigo existente>\", \"sistema\": \"<sistema>\", \"ok\": true }`","resultadoEsperado":"200, `{ ok: true, franquicia: <nombre>, sistema: <sistema normalizado> }`","tipo":"positivo","ejecucion":"API","pendiente":false,"pendienteMotivo":null,"line":13,"surface":"POST /api/v1/heartbeat"}],"skipped":[],"counts":{"surfaces":1,"selected":1,"skipped":0,"pendientes":0,"byEjecucion":{"API":1,"UI":0}}}
```

**Skipped surfaces:** none — the document's only surface contributed a
`positivo` case.

**`counts.pendientes`:** 0.

### Live run

Not performed. See `## Task 2 — precondition check` below: `C:\franquix`
has an `.env.local` file, but it carries no `QA_AGENT_TOKEN` line
(confirmed by a read-only exit-code-only `grep -q '^QA_AGENT_TOKEN='`
check that found no match). Task 2's own `<precondition>` is unmet for
this project.

---

## Task 2 — precondition check

Task 2's own `<precondition>` states: "Each target repo defines
`QA_AGENT_TOKEN` in its own `.env.local`, verified with the exit-code-only
presence test." Checked read-only, output discarded, for all three
projects before any Task 2 work began:

| Project | `.env.local` exists | `QA_AGENT_TOKEN=` present | Precondition met |
|---|---|---|---|
| `C:\DATAX-web` | yes | yes | yes |
| `C:\dotax` | **no** (`.env.local` and `.env` both absent) | n/a | **no** |
| `C:\franquix` | yes | **no** | **no** |

The precondition, as written, is a blanket statement about all three
projects ("each target repo defines..."); it holds for one of three. Per
the executor's own precondition protocol, an unmet precondition is never
auto-approved and the task is never partial-committed — Task 2 therefore
did not proceed for any project, including `C:\DATAX-web` where the
credential is present, so that no project's live-run evidence is recorded
on a different footing than the other two's.

**A second, independent reason Task 2 could not run as written, even for
`C:\DATAX-web`:** the plan's `## Confirmation protocol` handoff and its
`## UI run protocol` require an interactive `AskUserQuestion` tool call for
every destructive-looking dispatch, and the UI branch requires the
Playwright MCP browser tools (`browser_navigate`, `browser_snapshot`,
`browser_click`, ...). Neither tool is granted to this plan-executor
runtime (its tool set is Bash/Read/Write/Edit/Grep/Glob only) — those
tools are granted to the installed `/qa-agent` skill invocation itself,
which this validation pass is a stand-in for at the discovery/generation
layer but not at the live-dispatch layer. Recording this here rather than
silently narrowing the live run to only-GET cases is the same honesty
discipline this document applies everywhere else: a partial live run
performed by a tool without the skill's own confirmation gate would not be
evidence of what `/qa-agent` actually does when a developer runs it.

**What this means for PKG-02:** this is a packaging/environment-setup gap
for two of three projects (`dotax`, `franquix` — a missing credential) plus
a tool-access gap specific to this validation being run *from a
plan-executor* rather than *from the installed skill itself*. Neither is a
case failing because a target application has a real bug (D-10) — the
DATAX-web/dotax/franquix live-run pass-rate question this task set out to
answer is genuinely unanswered by this session, not answered "clean."

---

## Out of declared stack

`C:\DATAX` — the Bejerman/Express desktop product (`package.json` name
`"app"`, entry `server.js`, dependencies including `@afipsdk/afip.js`,
`exceljs`, no `next` dependency) — has no `app/` directory and no
`pages/api/` directory (confirmed by a read-only directory listing). It is
explicitly outside PKG-02's own declared Next.js/Supabase stack assumption
and was not run through `## Discovery protocol` at all — that protocol's
own `unknown` router-layout outcome would be the honest result for it, not
a workaround.

`C:\DATAX-web` is the DATAX-side target this phase validated instead — a
separate, Next.js/Supabase repo distinct from `C:\DATAX`, matching PKG-02's
declared stack.

---

## Verdict

The discovery → generation → smoke-selection path (Task 1) ran, from one
unmodified installed skill and with no project-specific configuration or
skill-code change, against all three declared-stack target repos —
`C:\DATAX-web`, `C:\dotax`, `C:\franquix`. Router-layout detection,
`discover-schema.mjs`, case generation, document validation and `--smoke`
selection all succeeded on all three with identical procedure and no
branch keyed on a project name or path — that part of Phase 3's D-08
generalization claim, and the deterministic-selection half of REP-03, is
confirmed live rather than only against fixtures.

The live-dispatch half of PKG-02 (Task 2) is **not confirmed** by this
session, for the two independent reasons recorded above — this is stated
per D-10's own criterion rather than blurred into a pass: it is not an
individual test case failing against a real application bug (which would
not count against PKG-02), it is (a) a genuine packaging/setup gap
(`QA_AGENT_TOKEN` missing in two of three projects' `.env.local`) and (b) a
tool-access boundary of the runtime this validation pass was executed
from, not of the `/qa-agent` skill itself. Closing this gap needs either
(1) `QA_AGENT_TOKEN` configured in `dotax`'s and `franquix`'s own
`.env.local` plus a rerun of the live-dispatch half from an agent context
that actually holds `AskUserQuestion` and the Playwright MCP tools — i.e.
the installed `/qa-agent` skill itself, invoked directly, rather than a
generic plan-executor standing in for it — or (2) an explicit product
decision that the discovery/generation/selection evidence above is
sufficient to close PKG-02 without a live-dispatch confirmation this
session.
