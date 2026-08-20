# Phase 3: Dual Discovery & Test-Case Generation - Research

**Researched:** 2026-08-20
**Domain:** Static code discovery of Next.js App Router routes/forms/Server Actions and Supabase SQL migration constraints, translated into a human-reviewable Markdown test-case document (no execution in this phase)
**Confidence:** MEDIUM — the discovery *targets* (route.ts conventions, migration SQL shape) are HIGH confidence because they were read directly from all three real target repos this session, not assumed from training data. The *generation format* design is this researcher's own synthesis grounded in D-01–D-12 and Phase 1/2's established conventions, since no test-case-document format precedent exists yet in this project.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Test-Case Document Format**
- **D-01:** Generated cases are written to a new Markdown file, `qa-reports/<run-id>-test-cases.md` — same directory and naming convention as the existing execution reports, not a separate output location.
- **D-02:** Each case has exactly the 5 fields REQUIREMENTS.md's DISC-02 names: título, precondiciones, pasos, resultado esperado, tipo (positivo/negativo/edge). No extra fields invented beyond what's needed for D-03/D-05 below.
- **D-03:** Each case also carries an explicit `ejecución: API | UI` field, set by the discovery step itself (it already knows whether a case came from an API route or a page/form) — the executor should not have to re-infer this at run time.
- **D-04:** Cases are identified by short sequential IDs (`case-1`, `case-2`, ...) scoped to that one test-cases.md file — simple enough for the user to reference later ("corré case-3").
- **D-05:** Cases are grouped by discovered surface — one Markdown section per route/form/endpoint (e.g. `## POST /api/clientes`), with that surface's positive/negative/edge cases listed underneath. Applies uniformly whether the case came from full-project discovery (DISC-01) or a one-off instruction (DISC-03) — one output convention regardless of source.
- **D-06:** test-cases.md is a reviewable, editable document — the user can strike out or add cases by hand before asking the agent to run any of them. The agent re-reads the file at execution-request time rather than treating it as a frozen snapshot of the generation moment.

**Code Discovery Scope (DISC-01)**
- **D-07:** Full-project scan is the default when the user points the agent at a project with no further qualifier — scans routes/API routes, forms, and validation schemas across the whole repo (excluding `node_modules`, build output). A narrower scan (one folder/flow) is reached via a natural-language instruction (DISC-03/D-11), not a separate discovery mode.
- **D-08:** The agent detects Next.js App Router (`app/`) vs Pages Router (`pages/api/`) automatically from the target repo's folder structure and adjusts where it looks for routes/schemas accordingly — no user-supplied flag for this. **Reversibility:** costly — the detection heuristic becomes the thing every later discovery script depends on; changing it after Phase 3 ships means re-touching every route-finding code path. Carries forward the STATE.md research flag: validate this detection against at least two of the three target repos (DATAX, dotax, franquix) before considering the phase done, since App Router vs Pages Router usage is known to vary between them.
- **D-09:** Beyond the routes/forms themselves, discovery also reads Zod/validation schemas colocated with route handlers AND Supabase SQL migration files (`supabase/migrations/`) for `NOT NULL`/`UNIQUE`/`CHECK`/type constraints — both app-level and DB-level validation inform how a case gets labeled negative/edge, not just the route shape.

**Generation → Execution Handoff**
- **D-10:** Generating test-cases.md is a terminal step for that invocation — the agent does not execute any case automatically in the same run. Running cases is a separate, later request.
- **D-11:** To run generated cases, the user references the test-cases.md file and the specific case ID(s) (e.g. "corré los casos 1, 3 y 5 de qa-reports/<run-id>-test-cases.md"). The agent reads those specific cases and hands them to the existing Phase 1/2 Run protocol unchanged — Phase 3 does not introduce a new execution path.

**Natural-Language-Only Generation (DISC-03)**
- **D-12:** For a one-off instruction with no full-project scan requested, the agent still reads the specific file/route/form the instruction names to ground preconditions and validation in what it actually observed — same "shape observed, not invented" discipline as Phase 1's D-10. It does not scan the rest of the project, and it does not fabricate constraints it didn't see in code.

### Claude's Discretion
- Exact Markdown table/heading styling within a case section (D-02's 5 fields + D-03's `ejecución` field) — implementer discretion, constrained by D-02 (fields), D-04 (IDs), D-05 (grouping). See Code Examples below for a concrete proposal.
- Whether discovery is implemented as orchestrator-driven Glob/Grep/Read tool calls, a deterministic Node helper script, or a mix — a real tension between CONTEXT.md's "Established Patterns" framing and the project's own CLAUDE.md/STACK.md guidance. Raised as Open Question 1 for the planner; **resolved** in `03-01-PLAN.md`'s objective (orchestrator tools for routes/forms, script only for SQL constraints and document read-back) — see `## Open Questions (RESOLVED)` §1 below.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. Systematic boundary/negative/permission edge-case coverage (DISC-04, DISC-05) was correctly not raised here — that's Phase 4's explicit job, building on top of the constraints Phase 3 discovers (D-09).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-01 | Agent explores target project code (routes, forms, validation schemas, DB constraints) to infer what to test | Architecture Patterns §1–3 (route/form/action discovery via Glob+Grep+Read; migration-constraint extraction script); Runtime Findings (all three target repos are App Router only, none use Zod, franquix uses Server Actions for some forms) |
| DISC-02 | Agent generates documented test cases (título, precondiciones, pasos, resultado esperado, tipo: positivo/negativo/edge) from what it discovered | Code Examples (test-cases.md skeleton); Common Pitfalls §2/§7 (oracle problem, coverage theater) — case labeling discipline |
| DISC-03 | Agent generates documented test cases from a one-off natural-language instruction, without scanning the whole codebase | Architecture Patterns §4 (scoped discovery for D-12); Don't Hand-Roll (reuse Phase 1's NL→case-construction judgment, don't build a new NLU layer) |
</phase_requirements>

## Summary

This phase has no new runtime dependency to install — no MCP server, no npm package. Its real difficulty is **getting the discovery targets right against the actual target repos**, because two of D-09's stated assumptions do not hold empirically. This session read all three target repos (DATAX-web, dotax, franquix) directly:

1. **All three repos are App Router only.** `find -name route.ts` returned matches in all three (34–60+ files each); an exhaustive search for `pages/api` directories found none [VERIFIED: read via Bash `find` across c:/dotax, c:/DATAX-web, c:/franquix this session]. D-08's Pages Router fallback is still worth building defensively (a fourth, not-yet-seen target project could use it), but the "validate against at least two of three target repos" flag in STATE.md should be closed as: **App Router detection confirmed uniform across all three — the actual variation risk is elsewhere** (see next point).
2. **None of the three repos use Zod.** `grep -r "from ['\"]zod['\"]" app/api lib` returned zero matches in DATAX-web, dotax, and franquix [VERIFIED: Grep tool run against all three repos' `app/api` and `lib` directories this session]. Validation in these apps is hand-written imperative checks inside `route.ts` (`if (!nombre) return NextResponse.json({error: 'Falta el nombre'}, {status: 400})`) [VERIFIED: c:/franquix/app/api/categorias/route.ts:36-40, quoted in Code Examples]. D-09's "Zod schemas colocated with route handlers" premise needs correcting: discovery must extract **imperative validation checks** (regex/pattern match on `if (!x` / `return NextResponse.json({error:` / `status: 4xx` near a field name), not Zod schema shapes. `zod` *is* a dependency of this skill itself (already installed, used for the skill's own response-shape contract checks per Phase 1) — that is unrelated to what the target repos use for their own validation, and this distinction should not be conflated.
3. **A third form-submission surface exists that D-09 doesn't name: React Server Actions.** franquix's auth-adjacent forms (`login`, `registro`, `recuperar`, `clave-nueva`, `suscribite`) submit via `<form action={formAction}>` bound to a `'use server'` function in a colocated `actions.ts` file, not a client-side `fetch()` call to a `route.ts` handler [VERIFIED: c:/franquix/app/login/page.tsx:1-14,40 and c:/franquix/app/login/actions.ts:1-16, both quoted in Runtime Findings below]. dotax and DATAX-web, by contrast, use plain client components with `onSubmit` handlers calling `fetch()` against `app/api/**/route.ts` [VERIFIED: c:/dotax/app/registro/page.tsx:1,49-57, quoted below]. **This is the actual cross-repo variation the phase needs to detect** (Server Actions vs. client-fetch forms), not App Router vs. Pages Router as D-08 emphasized — the discovery step for "forms" must check for a colocated `actions.ts` alongside `page.tsx` before assuming the form posts to a JSON API endpoint.
4. **Supabase migration `CHECK` greps are ambiguous without care.** A naive `grep CHECK` over `supabase/migrations/*.sql` returns both real column/table `CHECK (...)` constraints (e.g. `dia_cierre smallint CHECK (dia_cierre BETWEEN 0 AND 6)`) and RLS policy `WITH CHECK (...)` clauses, which describe row-level access rules, not data-shape constraints [VERIFIED: c:/franquix/supabase/migrations/0005_franquicias_tipo_horario.sql:5 vs. c:/franquix/supabase/migrations/0001_init.sql:198,210,216, both matched by the same `grep CHECK` this session]. A discovery script that doesn't distinguish `WITH CHECK` (policy) from a bare `CHECK (` immediately after a column/table definition (constraint) will conflate the two and generate nonsensical "edge case" cases from access-control text.

**Primary recommendation:** Do discovery in two tiers, split by how error-prone freehand parsing is for each: (a) for routes, forms, and Server Actions, use the orchestrator's own Glob (`app/**/route.ts`, `app/**/actions.ts`, `app/**/page.tsx`) + Grep (`export async function (GET|POST|PUT|PATCH|DELETE)`, `<form`, `'use server'`) + Read tool calls directly — this matches the project's own CLAUDE.md/STACK.md guidance ("no dedicated library is needed here... resist the urge to add a test generation library dependency") and the actual file shapes are simple and consistent enough (single exported async function per HTTP verb, one `route.ts` per endpoint) that a custom parser adds maintenance cost without adding reliability; (b) for Supabase migration constraint extraction, build one small deterministic Node script (`scripts/discover-schema.mjs`, no new npm dependency — `node:fs`'s stable `readdirSync(..., {recursive: true})` is sufficient, avoid the still-Experimental `fs.globSync`) because this is exactly the class of mechanical, easy-to-misparse-by-eye task the project's own Anti-Pattern 3 ("LLM eyeballing raw output to decide pass/fail") warns against generalizing — the `WITH CHECK` vs. `CHECK (` ambiguity above is empirical proof a freehand grep-and-reason pass over dozens of migration files will get this wrong at least once per repo, and getting it wrong produces test cases that assert against RLS policy text instead of data constraints.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Route/form/Server-Action discovery (file finding) | Orchestrator (Glob/Grep/Read) | — | File-shape is simple and stable (one exported function per verb); a custom script would duplicate what Glob/Grep already do well, contradicting project CLAUDE.md's explicit "no dedicated library" guidance |
| Migration constraint extraction (SQL parsing) | Deterministic script (`scripts/discover-schema.mjs`) | Orchestrator (reasoning over the script's JSON output) | Mechanical, syntax-sensitive text extraction (constraint vs. RLS policy, multi-line `ALTER TABLE ... ADD COLUMN ... CHECK`) is exactly the class of task Phase 1's own Anti-Pattern 3 says should never be freehand-eyeballed |
| Test-case labeling (positivo/negativo/edge) and grouping | Orchestrator (reasoning) | — | Judgment call over discovered facts, not mechanical extraction — matches CONTEXT.md's "deciding how to label a case... stays with the orchestrator's reasoning" |
| test-cases.md authoring | Orchestrator (Write tool) | — | D-01 chose Markdown-only, no JSON intermediate; no renderer script needed unlike Phase 1/2's `results.json` → `format-report.mjs` split |
| Case-ID lookup at execution-request time (D-11) | Orchestrator (Read + text search) | — | A one-off small-file read; building a dedicated parser script is unjustified overhead for a human-editable document meant to be read directly |

## Standard Stack

### Core
No new core dependency. This phase extends the existing skill's own toolchain (`node:fs`, `node:path`, the Read/Glob/Grep/Write tools already available to the orchestrator) — it does not add a package to `package.json`.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs` (built-in) | Node 22.14.0 [VERIFIED: `node --version` run this session] | Recursive directory walk for `scripts/discover-schema.mjs` (`readdirSync(dir, {recursive: true, withFileTypes: true})`) | Zero new dependency; `recursive` option on `readdirSync` is stable (unlike `fs.globSync`, confirmed [CITED: nodejs.org/api/fs.html] to still carry Stability 1 — Experimental as of the current Node.js docs) |

### Supporting
None. No new npm package is required for this phase.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `node:fs` recursive directory walk | `fs.globSync` (built into Node 22, confirmed present via `node -e "typeof require('node:fs').globSync"` → `function` this session [VERIFIED]) | `fs.globSync` is more concise for pattern matching (`app/**/route.ts`) but is Experimental per Node's own docs [CITED: nodejs.org/api/fs.html] — for a script that must run unmodified for years against arbitrary target repos, a stable recursive-readdir walk with a manual filename filter (`.endsWith('route.ts')`) is a safer bet than depending on an API that could change shape in a later Node release |
| A custom route/form-scanning script | Orchestrator Glob+Grep+Read (recommended) | Building a script duplicates Glob/Grep's native pattern-matching for no reliability gain, and directly contradicts the project's own CLAUDE.md stack guidance to treat exploration as "a prompting/workflow-design problem, not a tooling problem" |

**Installation:** None required — no `npm install` for this phase.

## Package Legitimacy Audit

Not applicable — this phase installs no external packages. All work is built on `node:fs`/`node:path` (already available via the Node 22 runtime already required by `package.json`'s `engines` field) and the orchestrator's existing Read/Glob/Grep/Write tool access.

## Architecture Patterns

### System Architecture Diagram

```
User invokes /qa-agent with either:
  (a) a project path + "no qualifier" instruction  → DISC-01 full-project scan
  (b) a project path + a specific instruction        → DISC-03 scoped/NL-only generation
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│ DISCOVERY (orchestrator-driven, split by extraction difficulty)   │
│                                                                     │
│  Glob app/**/route.ts, app/**/actions.ts, app/**/page.tsx          │
│  (fallback: pages/api/**/*.ts if app/ absent — D-08)                │
│         │                                                           │
│         ├─ Grep each route.ts for exported HTTP verb functions      │
│         │   and nearby imperative validation ("if (!x) return       │
│         │   ...400...")                     ─────────────┐         │
│         │                                                  │         │
│         ├─ Grep each page.tsx for <form>, and check for a   │        │
│         │   colocated actions.ts ('use server') vs. an       │        │
│         │   onSubmit → fetch() pattern         ────────────┤        │
│         │                                                    │        │
│         └─ node scripts/discover-schema.mjs                  │        │
│             supabase/migrations/*.sql                          │        │
│             → JSON: { table, column, notNull, unique,           │        │
│                        check, type, enumValues, fk }[]            │        │
│                                                                    ▼        │
│                                              [ discovered surfaces: routes, │
│                                                forms/actions, DB constraints]│
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ TEST-CASE GENERATION (orchestrator reasoning, no subagent needed)  │
│  - one section per discovered surface (D-05)                       │
│  - label each case positivo/negativo/edge from what was actually    │
│    observed (route validation + migration constraints)               │
│  - set ejecución: API | UI per surface kind (D-03)                    │
│  - assign case-N IDs scoped to this file (D-04)                        │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
   Write qa-reports/<run-id>-test-cases.md (D-01) — terminal step (D-10)
         │
         ▼ (separate, later invocation, D-11)
   User: "corré case-3 de qa-reports/<run-id>-test-cases.md"
         │
         ▼
   Orchestrator reads that case's fields from the file, hands off
   unchanged to Phase 1 `## Run protocol` (ejecución: API) or
   Phase 2 `## UI run protocol` (ejecución: UI)
```

### Recommended Project Structure
```
scripts/
├── discover-schema.mjs        # NEW — deterministic Supabase migration constraint extractor
├── discover-schema.test.mjs   # NEW — vitest unit tests against a small fixture migration dir
references/
├── discovery-nextjs.md        # NEW — App Router route/form/Server-Action detection conventions
│                                 (route.ts vs actions.ts vs Pages Router fallback), referenced
│                                 on demand by SKILL.md, not loaded into every context window
└── test-case-format.md        # NEW — the D-01–D-05 test-cases.md structure contract, mirroring
                                  references/report-template.md's role for format-report.mjs
scripts/__fixtures__/
└── mock-target-repo/          # NEW — a small synthetic Next.js+Supabase repo fixture (a few
                                  route.ts, one actions.ts, one page.tsx with a plain form, a
                                  couple of migration .sql files) for discover-schema.mjs's tests
                                  and for a future discovery smoke-test, since no fixture target
                                  project exists in this repo yet [VERIFIED: `ls scripts/__fixtures__`
                                  this session shows only mock-server.mjs/mock-login-app.mjs/
                                  mock-server-process.mjs — no target-repo-shaped fixture]
```

### Pattern 1: Route/form discovery via Glob+Grep+Read (no custom script)

**What:** The orchestrator globs `app/**/route.ts` for API surfaces and `app/**/page.tsx` for UI surfaces, then Reads each match to extract the exported HTTP verb functions (route.ts) or `<form>` usage + a colocated `actions.ts` check (page.tsx).
**When to use:** Always, for DISC-01's route/form scanning — this is the CLAUDE.md/STACK.md-recommended default ("Claude's own reasoning over the repo using its existing Read/Grep/Glob tools").
**Example (Next.js official convention, HTTP methods and export shape):**
```typescript
// Source: https://nextjs.org/docs/app/getting-started/route-handlers (Route Handlers)
// [CITED: nextjs.org/docs/app/getting-started/route-handlers — confirmed via WebSearch this
// session: "Route Handlers are defined in a route.js|ts file... methods exported as async
// functions"; supported verbs GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS]
export async function GET() {
  return Response.json({ message: 'Hello World' })
}
```
**Observed in target repos (imperative validation, no Zod):**
```typescript
// Source: c:/franquix/app/api/categorias/route.ts:24-40 [VERIFIED, read this session]
export async function POST(req: Request) {
  const perfil = await perfilDeSesion()
  if (!perfil) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  if (perfil.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo el administrador puede crear categorías' }, { status: 403 })
  }
  const cuerpo = (await req.json().catch(() => null)) as {
    nombre?: string
    tipo?: 'ingreso' | 'egreso'
    seccion?: 'bruto' | 'neto' | 'distribucion'
  } | null
  const nombre = cuerpo?.nombre?.trim()
  if (!nombre) return NextResponse.json({ error: 'Falta el nombre' }, { status: 400 })
  if (cuerpo?.tipo !== 'ingreso' && cuerpo?.tipo !== 'egreso') {
    return NextResponse.json({ error: 'Tipo inválido (ingreso o egreso)' }, { status: 400 })
  }
  // ...
```
This single file grounds *four* test cases directly from what was read: a 401 (unauthenticated), a 403 (wrong role), a 400 (missing `nombre`), a 400 (invalid `tipo`) — plus the happy path. None of these required inventing a constraint; every expected status/message is quoted verbatim from the file, which is exactly the discipline D-12/Pitfall 1 require.

### Pattern 2: Server Action vs. client-fetch form detection

**What:** Before assuming a `<form>` posts JSON to a `route.ts` handler, check the same directory for a colocated `actions.ts` with a `'use server'` directive. If present, the form's real validation lives there, invoked via `useActionState`/`formAction`, not via a `fetch()` call the discovery step could otherwise find by grepping for `fetch(`.
**When to use:** Every time a `<form>` is discovered under `app/**/page.tsx`, before deciding what "ejecución: UI" actually exercises server-side.
**Example — Server Action form (franquix):**
```typescript
// Source: c:/franquix/app/login/actions.ts:1-16 [VERIFIED, read this session]
'use server'
export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  if (!email || !password) return { error: 'Email y contraseña son obligatorios.' }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'Email o contraseña incorrectos.' }
  // ...
```
```tsx
// Source: c:/franquix/app/login/page.tsx:1,3,13-14,40 [VERIFIED, read this session]
'use client'
import { useActionState, useState } from 'react'
// ...
const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, undefined)
// ...
<form action={formAction} onSubmit={onSubmit} className="mt-6 grid gap-4">
```
**Example — client-fetch form (dotax, contrast case):**
```tsx
// Source: c:/dotax/app/registro/page.tsx:1,49,54-57 [VERIFIED, read this session]
"use client";
// ...
async function registrar(e: React.FormEvent) {
  e.preventDefault();
  // ...
  if (!organizacion.trim() || !nombre.trim() || !email.trim() || !password) {
    throw new Error("Completá organización, nombre, email y contraseña.");
  }
  if (password.length < 6) throw new Error("La contraseña necesita al menos 6 caracteres.");
  // ... then calls fetch('/api/registro', ...) further down, which server-validates again
  // in c:/dotax/app/api/registro/route.ts:28-42 [VERIFIED, read this session]
```
Note the dotax example duplicates its validation client-side (for immediate feedback) and server-side (`app/api/registro/route.ts`, `password.length < 6` re-checked at line 37) — both must be read; the client-side check alone would miss the server's actual authority (a negative case against the API directly bypasses client JS entirely, so only the server-side check is a real guarantee).
**Trade-off:** Reading two files per form (client component + either `actions.ts` or the API route it calls) roughly doubles Read-tool calls versus assuming one file is authoritative — acceptable given Pitfall 6's token-blowup concern is about *unscoped whole-repo* exploration, not about reading the 1-2 files directly relevant to one already-discovered form.

### Pattern 3: Migration constraint extraction, `CHECK` vs `WITH CHECK` disambiguation

**What:** `discover-schema.mjs` walks `supabase/migrations/*.sql` in filename order (they're numbered, e.g. `0001_init.sql`) and extracts column/table-level constraints, distinguishing them from RLS policy text.
**When to use:** Always for DISC-01's DB-constraint reading (D-09); for DISC-03 (D-12), only when the instruction names a specific table/flow whose migration file discovery already resolved.
**The disambiguation rule, grounded in what was actually observed this session:**
- A `CHECK (...)` immediately following a column definition or inside a bare `ALTER TABLE ... ADD COLUMN ... CHECK (...)` / `ADD CONSTRAINT ... CHECK (...)` is a **data constraint** — e.g. `dia_cierre smallint CHECK (dia_cierre BETWEEN 0 AND 6)` [VERIFIED: c:/franquix/supabase/migrations/0005_franquicias_tipo_horario.sql:5].
- `WITH CHECK (...)` appearing inside a `CREATE POLICY ... FOR INSERT/UPDATE ...` block is an **RLS access-control rule**, not a data-shape constraint — e.g. `WITH CHECK (rol_actual() = 'admin' AND tenant_id = tenant_actual())` [VERIFIED: c:/franquix/supabase/migrations/0001_init.sql:198]. A naive `grep CHECK` over these files returns both with no distinction, and both franquix and dotax migration sets mix the two freely across the same files.
- Practical extraction rule: only treat a `CHECK (` match as a data constraint when it is **not** preceded by the literal token `WITH ` on the same match, and is either inside a `CREATE TABLE (...)` block or an `ALTER TABLE ... ADD COLUMN/CONSTRAINT` statement — never inside a `CREATE POLICY` block.
**Example schema (representative of all three repos' style — `NOT NULL`, `ENUM`, `REFERENCES ... ON DELETE`, `numeric(p,s)`):**
```sql
-- Source: c:/franquix/supabase/migrations/0001_init.sql:7,21-25,39-48 [VERIFIED, read this session]
CREATE TYPE rol_usuario AS ENUM ('admin', 'franquiciado');

CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuarios (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  franquicia_id   uuid REFERENCES franquicias(id) ON DELETE SET NULL,
  email           text NOT NULL,
  nombre          text NOT NULL,
  rol             rol_usuario NOT NULL,
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now()
);
```
This example alone grounds: a NOT NULL negative case (`nombre` missing on `tenants`), an enum-domain edge case (`rol` outside `('admin','franquiciado')`), and an FK-integrity negative case (`tenant_id` referencing a nonexistent tenant) — all traceable to specific migration lines, satisfying Pitfall 7's "ground edge-case generation in the actual code" guidance.

### Pattern 4: Scoped discovery for DISC-03 (D-12)

**What:** When the user names a specific flow/route/form in natural language ("probá el alta de categorías"), the orchestrator resolves that instruction to specific files (Grep for the route path fragment or flow keyword across `app/api` and `app/`) instead of running the full Glob+Grep sweep from Pattern 1. Same read-then-ground discipline as Pattern 1/2, just scoped.
**When to use:** DISC-03, whenever the invocation names a specific thing rather than "scan the whole project."
**Trade-off:** Faster and cheaper (Pitfall 6), but depends on the user's vocabulary matching something greppable in the codebase — if the grep finds nothing, ask the user for the specific route/file rather than silently falling back to a full scan (falling back silently would violate D-12's "does not scan the rest of the project").

### Anti-Patterns to Avoid
- **Grepping `CHECK` without distinguishing `WITH CHECK`:** produces test cases that assert against RLS policy predicates as if they were data validation rules — nonsensical and misleading (see Pattern 3).
- **Assuming every `<form>` posts to a `route.ts` API endpoint:** franquix's auth flows prove this is false; missing the colocated `actions.ts` means generating a case whose `ejecución: API` invocation has no matching endpoint to call (see Pattern 2).
- **Treating "no Zod schema found" as "no validation exists":** all three repos validate imperatively inline in the route handler; a discovery pass that only pattern-matches for `z.object(` will find nothing and under-report every negative case these apps actually have (see Summary point 2).
- **Full-repo Glob with no exclusion of `node_modules`/build output:** D-07 already excludes this explicitly; a discovery Glob without `node_modules` excluded on a real target repo (each of the three has a populated `node_modules/`) would return thousands of irrelevant matches and blow the token budget Pitfall 6 warns about.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Finding `route.ts`/`page.tsx`/`actions.ts` files across a repo | A custom recursive file-walker with its own pattern-matching DSL | The orchestrator's existing Glob tool | Glob already does recursive pattern matching reliably; a custom walker duplicates it for no benefit and is explicitly against the project's own CLAUDE.md guidance |
| Extracting exported HTTP-verb functions from a route.ts | A TypeScript AST parser (e.g. `@typescript/compiler` walk) | Grep for `export async function (GET|POST|PUT|PATCH|DELETE|HEAD)` plus a Read of the matched file for context | Every observed route.ts in all three repos exports one function per verb at the top level with no nesting or re-export indirection — a full AST parser is disproportionate machinery for a pattern this consistent |
| NL instruction → test-case judgment (DISC-03) | A new NLU/intent-classification layer | Reuse the same orchestrator-reasoning judgment Phase 1's `## Case construction` already documents for turning an instruction into cases | Phase 1 already solved "one case per thing the developer named, don't invent scope" — Phase 3's DISC-03 is the identical judgment call applied to case *generation* instead of case *dispatch*; building a parallel mechanism duplicates working logic |

**Key insight:** Every "don't hand-roll" here is really the same principle — the target repos' actual code shape (App Router only, one function per verb, no Zod, imperative checks) is simple enough that Glob+Grep+Read cover the mechanical part reliably; the only place a dedicated script earns its cost is SQL constraint extraction, where the `WITH CHECK` ambiguity proves freehand parsing genuinely fails.

## Common Pitfalls

### Pitfall 1: D-09's "Zod schemas colocated with route handlers" assumption doesn't hold

**What goes wrong:** A discovery step built to pattern-match `z.object(`/`.parse(`/`.safeParse(` against target route.ts files will find nothing in DATAX, dotax, or franquix and silently under-report validation, making the "negative" case set thin or absent entirely for apps that actually validate extensively (just not with Zod).
**Why it happens:** D-09 was written from a plausible Next.js convention (Zod is extremely common in the ecosystem generally) without having read these three specific repos yet.
**How to avoid:** Pattern-match for the imperative shape these repos actually use: `if (!<field>` / `if (<field>` combined with `return NextResponse.json({ error:` and a `status:` in the 4xx range within a few lines. Treat "Zod schema found" as a bonus enrichment, not the primary detection path.
**Warning signs:** A generated test-cases.md with zero or near-zero "negativo" cases for a route file that visibly has several `if (!x) return ... 400` blocks when Read directly.

### Pitfall 2: Conflating RLS `WITH CHECK` with data `CHECK` constraints

**What goes wrong:** A generated "edge case" cites a business-access rule (e.g. "solo admin puede...") as if it were a numeric/format boundary, confusing the executor and the human reviewer reading test-cases.md.
**Why it happens:** Both use the literal substring `CHECK (`; a plain grep can't tell them apart without also checking the enclosing statement (`CREATE POLICY` vs. `CREATE TABLE`/`ALTER TABLE`).
**How to avoid:** See Architecture Pattern 3's disambiguation rule; verify empirically per repo before trusting it, since RLS policy density varies (franquix's `0001_init.sql` has 8+ policy blocks in one file).
**Warning signs:** A case whose "resultado esperado" mentions a role/tenant condition but is labeled as originating from a column CHECK constraint.

### Pitfall 3: Assuming one form-submission mechanism project-wide

**What goes wrong:** Discovery hardcodes "form → fetch → route.ts" and silently misses or mis-labels franquix's Server-Action-backed forms (5 of them: login, registro, recuperar, clave-nueva, suscribite), generating a case with `ejecución: API` pointing at a route.ts that doesn't exist for that flow.
**Why it happens:** Two of the three repos (dotax, DATAX-web) exclusively use client-fetch forms, making Server Actions look like a franquix-only edge case easy to overlook if only one repo is used to validate the discovery logic during planning/implementation.
**How to avoid:** Always check for a colocated `actions.ts` with `'use server'` before assuming a form's target is an API route (Pattern 2). Test the discovery logic against at least franquix specifically for this reason, not just dotax/DATAX-web.
**Warning signs:** A generated UI case whose steps describe filling a form correctly, but whose `ejecución: API`-equivalent verification step references a `route.ts` path that Grep can't actually find.

### Pitfall 4: The oracle problem, applied to constraint-derived cases (project Pitfall 2, extended)

**What goes wrong:** Every "expected result" derived purely from what the code currently does (e.g. "returns 500 on duplicate name" because that's what an unhandled DB unique-constraint violation happens to produce today) gets asserted as correct behavior, even when it's actually a bug (a duplicate-name insert should probably 409, not 500).
**Why it happens:** Discovery has no independent business-requirements oracle — it can only observe current behavior, exactly as project PITFALLS.md's Pitfall 2 already documents generally.
**How to avoid:** For any case whose expected result was inferred from code behavior rather than an explicit validation message the code itself returns (e.g., `categorias/route.ts`'s explicit `'Ya existe una categoría con ese nombre'` 409 response vs. a table with only a bare DB `UNIQUE` constraint and no app-level duplicate check, which would 500 on violation), label the case's tipo as `edge` rather than `negativo` and note in `resultado esperado` that the expectation is "inferred from current behavior, not a stated requirement" — carrying forward project PITFALLS.md's explicit flagging recommendation.
**Warning signs:** A `negativo` case whose "resultado esperado" reads like an implementation detail ("responde 500") rather than a business rule ("el email debe ser único").

### Pitfall 5: `case-N` ID collisions on substring match

**What goes wrong:** At execution-request time (D-11), the orchestrator greps test-cases.md for `case-3` to locate that case's fields, but `case-3` is also a substring of `case-30`, `case-31`, etc. — a naive substring search returns the wrong (or multiple) matches once a file has 10+ cases.
**Why it happens:** D-04 only specifies the ID format (`case-1`, `case-2`, ...), not the lookup mechanism.
**How to avoid:** Anchor each case heading unambiguously, e.g. `### case-3 — <título>` (a trailing ` — ` or `:` immediately after the number, never bare `case-3` with no delimiter) and search with a pattern that requires a non-digit character immediately after the number (`case-3[^0-9]` or a line-start anchor on the heading level).
**Warning signs:** Running "case-3" returns the fields for case-30 instead, or returns two case blocks.

## Code Examples

### Proposed test-cases.md skeleton (D-01–D-05)
```markdown
<!-- Source: this researcher's synthesis of D-01–D-05; no prior precedent exists in this
     project — modeled on references/report-template.md's section-order-contract approach -->
# Casos de Prueba — 2026-08-20-1530-categorias

**Generado:** 2026-08-20 15:30
**Origen:** Escaneo completo de proyecto | `c:/franquix`
**Instrucción:** (vacío — escaneo completo, no instrucción puntual)

## POST /api/categorias

### case-1 — Alta de categoría con datos válidos
- **Precondiciones:** Usuario autenticado con rol `admin` (`perfilDeSesion()` exige perfil no nulo — app/api/categorias/route.ts:25; chequeo de rol en línea 27-29)
- **Pasos:** POST /api/categorias con body `{ "nombre": "Alquiler", "tipo": "egreso" }`
- **Resultado esperado:** 200, `{ ok: true, categoria: {...} }`
- **Tipo:** positivo
- **Ejecución:** API

### case-2 — Sin autenticar
- **Precondiciones:** Ninguna sesión activa
- **Pasos:** POST /api/categorias sin cookie de sesión, body válido
- **Resultado esperado:** 401, `{ error: "No autenticado" }` (app/api/categorias/route.ts:26, mensaje literal)
- **Tipo:** negativo
- **Ejecución:** API

### case-3 — Falta el campo nombre
- **Precondiciones:** Usuario autenticado con rol `admin`
- **Pasos:** POST /api/categorias con body `{ "tipo": "egreso" }`
- **Resultado esperado:** 400, `{ error: "Falta el nombre" }` (app/api/categorias/route.ts:37, mensaje literal)
- **Tipo:** negativo
- **Ejecución:** API

## UI /login (franquix, Server Action)

### case-4 — Login con credenciales válidas
- **Precondiciones:** Usuario de prueba existente (QA_AGENT_UI_USER/PASSWORD)
- **Pasos:** Navegar a /login, completar email y contraseña, enviar
- **Resultado esperado:** Redirección a `/` (actions.ts:22, `redirect('/')` tras login exitoso)
- **Tipo:** positivo
- **Ejecución:** UI

### case-5 — Campos vacíos
- **Precondiciones:** Ninguna
- **Pasos:** Navegar a /login, dejar email y contraseña vacíos, enviar
- **Resultado esperado:** Mensaje "Email y contraseña son obligatorios." (actions.ts:14, string literal), sin redirección
- **Tipo:** negativo
- **Ejecución:** UI
```

### Proposed `discover-schema.mjs` shape (deterministic, no new dependency)
```javascript
// scripts/discover-schema.mjs — proposed shape for planning, not yet implemented.
// Deterministic tier: reads supabase/migrations/*.sql, returns structured JSON.
// Mirrors format-report.mjs's own header-comment convention (state the invariant once, here).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// [VERIFIED this session: readdirSync's `recursive` option is stable in Node 22.14.0 —
// ran `fs.readdirSync(dir, {withFileTypes:true, recursive:false})` successfully against
// c:/franquix/supabase/migrations, 30 entries returned]
export function listMigrations(migrationsDir) {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort(); // filenames are zero-padded-numbered (0001_init.sql, ...) — lexicographic sort is chronological
}

// Distinguishes a real column/table CHECK from an RLS "WITH CHECK" policy predicate —
// see RESEARCH.md Architecture Pattern 3 for the empirical justification.
export function extractConstraints(sql) {
  // ... regex/line-scan implementation: match CREATE TABLE blocks for NOT NULL / column
  // types / inline CHECK / REFERENCES; match standalone ALTER TABLE ... ADD CONSTRAINT/
  // COLUMN ... CHECK; explicitly SKIP any CHECK preceded by "WITH " on the same statement
  // or inside a CREATE POLICY block.
}
```

## State of the Art

Not heavily applicable — this phase's "state of the art" question is really "what does this specific codebase actually do," answered empirically in Runtime Findings/Summary above rather than via industry trend research. No deprecated/legacy pattern applies here beyond the general Next.js App Router vs. Pages Router distinction already covered in D-08.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | The "no dedicated library needed, use Glob/Grep/Read directly" guidance in CLAUDE.md/STACK.md should win over CONTEXT.md's "discovery scripts (file/route/schema scanning) are the deterministic layer" framing for the *route/form* portion specifically (this researcher's synthesis, not a locked decision) | Architectural Responsibility Map, Standard Stack, Summary | If the planner instead builds a full route/form-scanning script per CONTEXT.md's literal wording, the extra maintenance cost is real but not catastrophic — the split proposed here (script only for SQL) is a recommendation, not something empirically falsifiable the way the Zod/App-Router findings are. **Ratified as an explicit decision** in `03-01-PLAN.md`'s objective (see Open Question 1's `**RESOLVED:**` note), so the planner accepted this assumption knowingly rather than by default |
| A2 | franquix's five Server-Action forms (login/registro/recuperar/clave-nueva/suscribite) represent the only Server-Action usage in that repo, and dotax/DATAX-web have none at all | Summary point 3, Pattern 2 | Based on `grep -rl "'use server'"` returning 7 files in franquix (5 actions.ts + 2 more) and 0 in dotax/DATAX-web this session [VERIFIED] — low risk of being wrong since it's a direct grep result, but a future addition to any of the three repos could add more without this research being re-run |
| A3 | The proposed test-cases.md skeleton (heading levels, field-list styling) is a reasonable default | Code Examples | Low risk — D-02/D-04/D-05 constrain the substance (fields, IDs, grouping) but not the exact Markdown styling, which is explicitly implementer discretion per CONTEXT.md |

**If this table is empty:** N/A — see entries above.

## Open Questions (RESOLVED)

Both questions below were raised for the planner to settle explicitly. Both were settled during Phase 3 planning; the `**RESOLVED:**` note under each records where. The original question text is left intact as the paper trail for *why* the decision was needed.

1. **Should route/form discovery be a deterministic script or orchestrator Glob/Grep/Read?**
   - What we know: CONTEXT.md's "Established Patterns" section frames "discovery scripts (file/route/schema scanning)" as a single deterministic-layer category. The project's own `.claude/CLAUDE.md` (sourced from `research/STACK.md`, written earlier in the project) says explicitly: "No dedicated library is needed here — this is Claude's own reasoning over the repo using its existing Read/Grep/Glob tools... resist the urge to add a 'test generation library' dependency."
   - What's unclear: Whether CONTEXT.md's phrasing was meant to literally include route/form scanning as a script, or was describing the split at the *conceptual* level (mechanical extraction vs. judgment) without specifically deciding route/form discovery needs its own script the way Phase 1/2 needed `api-client.mjs`/`ui-case.mjs`.
   - Recommendation: This research recommends splitting by actual parsing difficulty (Glob/Grep/Read for routes/forms, one small script only for SQL migration constraints — see Summary's "Primary recommendation"), since the route/form file shapes observed this session are simple and stable while SQL constraint extraction demonstrably is not (the `WITH CHECK` ambiguity). The planner should make this an explicit, stated decision in the phase plan rather than leaving it implicit, since it affects whether `references/discovery-nextjs.md` documents a *procedure for the orchestrator* or a *script's CLI contract*.
   - **RESOLVED:** Recommendation accepted, with one addition. **`03-01-PLAN.md` `<objective>`, the "Purpose:" paragraph** states the decision explicitly ("This plan ratifies RESEARCH's recommendation with one addition"): deterministic tier = SQL migration constraint extraction (`scripts/discover-schema.mjs`) *plus* reading the generated document back (`scripts/test-case-doc.mjs`, added because the alternative at execution-request time is the orchestrator eyeballing a grep result — the `case-1` vs. `case-12` collision of Pitfall 5); orchestrator judgment = finding route/form files via Glob/Grep/Read, labeling a case positivo/negativo/edge, and authoring the document with the Write tool. **`03-01-PLAN.md` Task 1 action step (f)** implements the split in `SKILL.md`'s new `## Discovery protocol`: steps 3-4 glob and Read route handlers with the orchestrator's own tools, step 5 shells out to `discover-schema.mjs` for migration SQL. This also settles the question's stated consequence: **`03-02-PLAN.md` Task 1 (`references/discovery-nextjs.md`)** documents *a procedure for the orchestrator* — a "detection rubric the orchestrator applies while running `SKILL.md`'s `## Discovery protocol`" — not a script CLI contract; its companion `scripts/discovery-surfaces.test.mjs` is explicitly "a proof that the documented patterns work, not a component of the runtime discovery path." Assumption A1 is therefore ratified as a decision, not left as an open recommendation. `03-01-PLAN.md` `<success_criteria>` carries the same statement as a phase gate.

2. **Where does the DB constraint discovery result get grounded when a route has no visible imperative check but the DB has a NOT NULL/CHECK?**
   - What we know: Some fields are validated only at the DB layer (e.g., a `CHECK (dia_cierre BETWEEN 0 AND 6)` with no matching app-level range check found in the route handler that writes it).
   - What's unclear: Whether such a case should still be generated as an API-level negative case (submit `dia_cierre: 9`, expect *some* failure) even though the actual observed behavor might be a raw 500 from an unhandled Postgres constraint violation rather than a clean 400 — this bleeds into Pitfall 4 (oracle problem)'s edge/negative-label distinction and needs a plan-level convention.
   - Recommendation: Label these `edge` (not `negativo`) per Pitfall 4's guidance, with the resultado esperado noting the check's DB origin explicitly (e.g. "Fallo esperado — origen: CHECK constraint en supabase/migrations/0005_franquicias_tipo_horario.sql:5, comportamiento HTTP no verificado en el código de la ruta").
   - **RESOLVED:** Recommendation accepted verbatim and promoted from a suggestion to a written contract. **`03-01-PLAN.md` Task 1 action step (c)** — the `references/test-case-format.md` specification — carries the labeling rule as a required section of that contract: "a failure the code itself announces (an explicit early return with a literal message and status) is `negativo` and quotes that message verbatim. A failure that exists only at the database layer, or an expected result inferred from how the code currently behaves rather than from a message it returns, is `edge`, and its `Resultado esperado` must say so and name the migration file and line the constraint came from." The same action step's citation rule makes the file-and-line reference mandatory for every `negativo` and `edge` case. Enforcement is not documentation-only: **`03-03-PLAN.md`** carries it as a `must_haves` prohibition (a result inferred from current behavior must be labeled `edge` and say so), its validator rejects any `negativo`/`edge` case whose `Resultado esperado` lacks a file-and-line citation, and threat `T-03-15` registers the un-labeled-inference case as a Repudiation risk with this rule as its mitigation. `03-01-PLAN.md` `<success_criteria>` records that "RESEARCH.md Open Question 2's labeling convention is written into the format contract."

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Target repo: DATAX-web (`c:/DATAX-web`) | DISC-01 validation (STATE.md flag) | ✓ | Next.js 16.2.7, App Router only, no `pages/api`, 8 migrations | — |
| Target repo: dotax (`c:/dotax`) | DISC-01 validation | ✓ | Next.js 16.2.7, App Router only, no `pages/api`, 63 migrations | — |
| Target repo: franquix (`c:/franquix`) | DISC-01 validation, Server-Action detection (Pattern 2/Pitfall 3) | ✓ | Next.js ^16.2.11, App Router only, no `pages/api`, 30 migrations, 5 Server-Action forms | — |
| Node.js `fs.globSync` | Considered for discovery script | ✓ but Experimental | Node 22.14.0 [VERIFIED this session] | Use `readdirSync(..., {recursive: true})` instead (stable) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** `fs.globSync` — experimental, has a stable fallback (recursive `readdirSync`), documented above.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 [from package.json devDependencies, read this session] |
| Config file | none — `npm test` runs `vitest run` with no `vitest.config.*` present [VERIFIED: `ls C:/qa-agent/vitest.config.*` returned no matches this session] |
| Quick run command | `npx vitest run scripts/discover-schema.test.mjs` |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| DISC-01 | `discover-schema.mjs` extracts NOT NULL/UNIQUE/CHECK/type/enum constraints from a fixture migration file, correctly skipping `WITH CHECK` RLS text | unit | `npx vitest run scripts/discover-schema.test.mjs` | ❌ Wave 0 |
| DISC-01 | Route/form discovery via Glob+Grep is an orchestrator procedure, not a script — no automated unit test possible; verify via manual UAT against at least franquix (Server Actions) and one of dotax/DATAX-web (client-fetch) per Pitfall 3 | manual-only | N/A — justification: this is orchestrator-level reasoning over live tool calls, not testable code | ❌ Wave 0 (UAT script/checklist) |
| DISC-02 | Generated test-cases.md matches the D-01–D-05 structure (5 fields + ejecución, case-N IDs, grouped by surface) for at least one real discovered surface | manual-only (UAT) | N/A — output is a human-reviewed document, not an assertable unit | ❌ Wave 0 (UAT script/checklist) |
| DISC-03 | A one-off NL instruction naming a specific route produces cases grounded only in that route's file(s), with no full-repo scan triggered | manual-only (UAT), optionally instrumented by counting Read/Grep tool calls in a captured session | N/A | ❌ Wave 0 (UAT script/checklist) |

### Sampling Rate
- **Per task commit:** `npx vitest run scripts/discover-schema.test.mjs`
- **Per wave merge:** `npm test` (full suite, including Phase 1/2's existing scripts — `discover-schema.mjs` must not regress them)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus the manual UAT checklist above (this phase is unusually manual-UAT-heavy since its two most important behaviors — route/form discovery quality and generated document quality — are not unit-testable by design)

### Wave 0 Gaps
- [ ] `scripts/discover-schema.test.mjs` — new, covers DISC-01's migration-constraint extraction, including a fixture with both a real `CHECK (` and a `WITH CHECK (` in the same file to assert the disambiguation (Pattern 3/Pitfall 2)
- [ ] `scripts/__fixtures__/mock-target-repo/` — new fixture directory (a few `route.ts`, one `actions.ts` + `page.tsx` pair, 2-3 `.sql` migration files) so `discover-schema.mjs`'s tests don't depend on the real DATAX/dotax/franquix repos being present on disk at test time
- [ ] A manual UAT checklist item explicitly running discovery against real franquix (Server Actions) — carries forward the STATE.md flag, now re-scoped: confirm App Router detection (already empirically closed by this research) is less important than confirming Server-Action-vs-client-fetch detection actually works against franquix specifically

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V1 Architecture | Partial | Discovery is strictly read-only against the target repo's source tree (ARCHITECTURE.md: "Target repo source (read-only)... never write into the target repo except the isolated run-scratch directory") — `discover-schema.mjs` must never write into the target repo, only read `supabase/migrations/*.sql` and return JSON to stdout/caller |
| V5 Input Validation | Yes | The target project path and any user-supplied filters (DISC-03's instruction text) are inputs to `discover-schema.mjs`'s directory-walk — must not allow a path outside the intended target repo root to be read (basic path-containment check: resolve the migrations dir path and confirm it's still under the supplied project root before reading) |
| V12 File and Resources | Yes | Reading arbitrary `.sql` files from a target repo — cap total bytes read / file count if a target repo has an unusually large migrations directory, to avoid an accidental resource/token blowup (Pitfall 6) |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Path traversal via a malicious/malformed project path argument (e.g. `../../etc`) causing the discovery script to read files outside the intended target repo | Information Disclosure | Resolve the supplied project root to an absolute path and verify every file the script reads is a descendant of it before opening; refuse otherwise, don't silently clamp |
| A crafted SQL migration file with pathological content (extremely long lines, deeply nested comments) causing the extraction regex to hang or the script to consume excessive memory | Denial of Service | Cap per-file read size for `discover-schema.mjs` (these repos' actual migration files are all well under 10KB [observed this session across the files read]); treat any wildly oversized file as a signal to skip-and-report rather than parse |

## Sources

### Primary (HIGH confidence — read directly this session)
- `c:/dotax`, `c:/DATAX-web`, `c:/franquix` — full `app/`, `app/api/`, `supabase/migrations/` directory listings and representative file reads (route.ts, page.tsx, actions.ts, migration .sql) across all three target repos
- `C:/qa-agent/SKILL.md`, `scripts/api-client.mjs`, `scripts/format-report.mjs`, `references/report-template.md`, `references/destructive-classification.md` — existing conventions this phase must plug into
- `C:/qa-agent/.planning/phases/03-dual-discovery-test-case-generation/03-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/research/{ARCHITECTURE,STACK,PITFALLS}.md`, `.claude/CLAUDE.md` — project decisions and prior research

### Secondary (MEDIUM confidence)
- [Route Handlers — Next.js official docs](https://nextjs.org/docs/app/getting-started/route-handlers) — confirmed via WebSearch this session: route.ts convention, exported async function per HTTP verb, supported methods list
- [File-system conventions: route.js — Next.js official docs](https://nextjs.org/docs/app/api-reference/file-conventions/route) — route.js/ts nesting rule (cannot coexist with page.js at the same segment)
- [File system — Node.js v26 documentation](https://nodejs.org/api/fs.html) — `fs.globSync` Stability 1 (Experimental) status

### Tertiary (LOW confidence)
- None used — all claims above trace to either a direct file read this session or an official-docs WebSearch result.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, built-in Node APIs only, version/stability confirmed live this session
- Architecture: MEDIUM-HIGH — discovery *targets* are HIGH confidence (read directly from all three real repos); the *generation format* design (test-cases.md skeleton, script/no-script split) is this researcher's synthesis and is flagged as an Open Question for the planner to explicitly ratify
- Pitfalls: HIGH for the four repo-specific pitfalls (Zod absence, WITH CHECK ambiguity, Server Actions, ID collision) — each is grounded in a direct read/grep this session, not inferred

**Research date:** 2026-08-20
**Valid until:** 30 days, or immediately if any of DATAX-web/dotax/franquix's `app/api`, form, or `supabase/migrations` structure changes materially — this research is unusually coupled to the current state of three live, actively-developed repos
