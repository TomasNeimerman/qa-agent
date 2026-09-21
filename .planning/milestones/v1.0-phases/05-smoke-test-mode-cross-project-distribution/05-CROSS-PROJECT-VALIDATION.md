# Cross-Project Validation — PKG-02

**Run id:** `2026-09-21-1500-cross-project-uat`
**Executed:** 2026-09-21
**Scope:** Discovery → generation → smoke-selection run against the three real
target repos from this one unmodified installed skill (Task 1). Task 2 (the
live dispatch run) closed on **franquix evidence only** by user decision:
DATAX-web was not re-run this phase and dotax was descoped (no fixed
environment). See `## Task 2 — scope decision` and `## Verdict`. The
DATAX-side shared demo base (`SBDAMODE`) was not used by any run in this
phase.

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

**Not re-run this phase.** No new live run was performed against this
project. The only live report in `C:/DATAX-web/qa-reports/` is the older
`2026-08-11-1540-2026-08-11-1540-ext-capabilities.md` (from before this
phase), which is not evidence for this phase's smoke path and is not
counted as such. This project's `QA_AGENT_TOKEN`/`QA_AGENT_BASE_URL`
precondition is met; the run was simply not carried out here (user
decision, see `## Task 2 — scope decision`).

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

**Descoped, not failed.** No live run was performed and nothing was
touched in dotax's Supabase or Vercel. The user's stated reason is that
dotax has no fixed environment to target (D-09 requires a project's own
local/staging target, and there is none to point at). Separately, at the
time of the precondition check `C:\dotax` had no `.env.local` (nor `.env`),
so `QA_AGENT_TOKEN` was not configured either. This is a scope decision
about the environment, not a finding about the skill or the application.

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

Performed by the user's side against franquix's own local dev server
(the only project with a live run this phase). Evidence is the two report
files below, which this document quotes and does not re-run; `.env.local`
was not opened.

- **Resolved base URL:** `http://localhost:3000` (host and port only; the
  project's own local dev server, not staging or production).
- **Reports (absolute paths, both exist on disk):**
  - `C:/franquix/qa-reports/2026-09-21-1232-2026-09-21-1500-api-v1.md` (run 1)
  - `C:/franquix/qa-reports/2026-09-21-1238-2026-09-21-1245-api-v1-fixed.md` (run 2)

**Run 1 — 0 passed, 3 failed, 0 blocked, 0 pending.** `GET
/api/v1/franquicias`, `POST /api/v1/ventas` and `POST /api/v1/heartbeat`
each returned `401 {"error":"API key inválida o revocada"}`. Classification:
**packaging/credential-type error, not an application defect.** franquix's
`/api/v1/*` handlers validate the project's own API keys, not the Supabase
JWT that had been supplied as `QA_AGENT_TOKEN`; the app correctly rejected
the wrong credential type. The report's own note ("repeated 401 responses
... usually indicate a QA_AGENT_TOKEN problem") points the same way. It did
not indicate a skill-code change.

**Run 2 (with a franquix API key) — 3 passed, 2 failed, 0 blocked, 0
pending.** Passed: `GET /api/v1/franquicias` 200; `POST /api/v1/ventas`
201 (once sent with a body); `POST /api/v1/heartbeat` 200 (once sent with a
body). Failed: the first `POST /api/v1/ventas` and `POST
/api/v1/heartbeat`, both dispatched with an **empty body**, which the app
answered `400 {"error":"Body JSON inválido"}`. Classification: **case
construction artifact, not an application defect and not a PKG-02
failure** — that 400 is exactly the message the handler documents at
`app/api/v1/heartbeat/route.ts:26`, and the same endpoints returned 201/200
as soon as a body was sent.

**Relation to the smoke set above.** The live cases were not dispatched
verbatim from the `--smoke` JSON quoted in this section (that set is one
case, `POST /api/v1/heartbeat` case-1). The heartbeat request in run 2's
Case 5 (200, `franquicia` resolved, `sistema` defaulted to `api`) is the
live counterpart of that case; the `GET /franquicias` and `POST /ventas`
checks are additional hand-built cases outside the generated document.

**Side effect (recorded as such, not cleaned up):** run 2's `POST
/api/v1/ventas` wrote a real row into the FranquiX Supabase database — a
venta `Z-QA-TEST-1`, id `e52a32e3-9867-4f2a-8357-2e27702f1e15`, against the
franquicia named `QA Sucursal 04899900` (`codigo_externo` `QA04899900`) —
and the heartbeat call recorded a health signal for the same franquicia.
Neither was removed. That database is the project's own local/dev target as
reported by the user; whoever owns it should delete the test venta if they
do not want it kept. No credential value appears in this document or in the
quoted reports (the reports redact the `Authorization` header).

**Verdict for this project (D-10):** the discovery → generation →
smoke-selection → live-dispatch path ran on franquix with no project
configuration beyond the documented `QA_AGENT_BASE_URL`/token environment
variables and no skill-code change. The two failure groups above were a
wrong credential type (run 1) and empty-body case construction (run 2);
neither is an application bug and neither is a PKG-02 failure. No case in
either run failed because franquix has a real defect.

---

## Task 2 — scope decision

**User decision (relayed by the orchestrator), which closes Task 2 on
franquix evidence only:**

| Project | Live smoke run this phase | Status |
|---|---|---|
| `C:\franquix` | Yes — `http://localhost:3000`, two runs, reports quoted above | Done |
| `C:\DATAX-web` | No new run; only the older 2026-08-11 report exists | Not re-run this phase |
| `C:\dotax` | No — the user says it has no fixed environment | Descoped, not failed |

This document therefore does **not** claim that all three projects ran
live. One of three did. The other two are stated as what they are: one not
re-run, one descoped.

### How Task 2 originally stopped (kept for the record)

The executor first stopped at Task 2's own `<precondition>` — "Each target
repo defines `QA_AGENT_TOKEN` in its own `.env.local`, verified with the
exit-code-only presence test." Checked read-only, output discarded, for all
three projects before any Task 2 work began (this is the state at that
moment; franquix's live runs happened afterwards, on the user's side):

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

Neither reason was a case failing because a target application has a real
bug (D-10). They are environment/tool-access facts, and they are why the
live evidence below comes from the user's own runs rather than from this
executor.

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

**Live-dispatch half (Task 2), by D-10's criterion — franquix only.** On
`C:\franquix`, the live run against its own local dev server needed no
project-specific configuration and no skill-code change. Run 1's three
401s were a wrong credential type (Supabase JWT supplied where franquix's
own API key is required) and run 2's two 400s were empty-body case
construction; neither is an application bug, and neither is a PKG-02
failure. Run 2's remaining three cases passed (200, 201, 200). On that
evidence PKG-02 holds for franquix.

**What is not confirmed.** PKG-02 is *not* confirmed live for
`C:\DATAX-web` (not re-run this phase) or for `C:\dotax` (descoped: no
fixed environment). For those two the evidence is limited to the
discovery/generation/selection half above. The user chose to close Task 2
on the franquix evidence; this document records that as a scoped closure,
not as a three-project live pass.

**Open items for the owner of the franquix dev database:** the test venta
`Z-QA-TEST-1` (id `e52a32e3-9867-4f2a-8357-2e27702f1e15`) and the heartbeat
signal for `QA Sucursal 04899900` were written by run 2 and not cleaned up.

**Process note:** run 1 used a credential of the wrong type and run 2 sent
two POSTs without a body; both are avoidable by the protocol's own guidance
(read the target's auth scheme before dispatch; construct the body from the
case's `Pasos`). They are worth remembering when running `/qa-agent` against
an API that has its own key scheme.
