# Phase 3: Dual Discovery & Test-Case Generation - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The agent can determine what to test either by reading the target project's code (DISC-01) or from a plain natural-language instruction (DISC-03), and turn that into documented test cases (DISC-02) ready for the Phase 1 (API) and Phase 2 (browser) executors to run. This phase is generation only — it produces a reviewable artifact, it does not execute cases itself. Systematic edge-case/boundary coverage (DISC-04, DISC-05) is Phase 4's job, not this one; Phase 3 may label a case "negative" or "edge" based on what it observed, but does not attempt exhaustive coverage of every boundary.

</domain>

<decisions>
## Implementation Decisions

### Test-Case Document Format
- **D-01:** Generated cases are written to a new Markdown file, `qa-reports/<run-id>-test-cases.md` — same directory and naming convention as the existing execution reports, not a separate output location.
- **D-02:** Each case has exactly the 5 fields REQUIREMENTS.md's DISC-02 names: título, precondiciones, pasos, resultado esperado, tipo (positivo/negativo/edge). No extra fields invented beyond what's needed for D-03/D-05 below.
- **D-03:** Each case also carries an explicit `ejecución: API | UI` field, set by the discovery step itself (it already knows whether a case came from an API route or a page/form) — the executor should not have to re-infer this at run time.
- **D-04:** Cases are identified by short sequential IDs (`case-1`, `case-2`, ...) scoped to that one test-cases.md file — simple enough for the user to reference later ("corré case-3").
- **D-05:** Cases are grouped by discovered surface — one Markdown section per route/form/endpoint (e.g. `## POST /api/clientes`), with that surface's positive/negative/edge cases listed underneath. Applies uniformly whether the case came from full-project discovery (DISC-01) or a one-off instruction (DISC-03) — one output convention regardless of source.
- **D-06:** test-cases.md is a reviewable, editable document — the user can strike out or add cases by hand before asking the agent to run any of them. The agent re-reads the file at execution-request time rather than treating it as a frozen snapshot of the generation moment.

### Code Discovery Scope (DISC-01)
- **D-07:** Full-project scan is the default when the user points the agent at a project with no further qualifier — scans routes/API routes, forms, and validation schemas across the whole repo (excluding `node_modules`, build output). A narrower scan (one folder/flow) is reached via a natural-language instruction (DISC-03/D-11), not a separate discovery mode.
- **D-08:** The agent detects Next.js App Router (`app/`) vs Pages Router (`pages/api/`) automatically from the target repo's folder structure and adjusts where it looks for routes/schemas accordingly — no user-supplied flag for this. **Reversibility:** costly — the detection heuristic becomes the thing every later discovery script depends on; changing it after Phase 3 ships means re-touching every route-finding code path. Carries forward the STATE.md research flag: validate this detection against at least two of the three target repos (DATAX, dotax, franquix) before considering the phase done, since App Router vs Pages Router usage is known to vary between them.
- **D-09:** Beyond the routes/forms themselves, discovery also reads Zod/validation schemas colocated with route handlers AND Supabase SQL migration files (`supabase/migrations/`) for `NOT NULL`/`UNIQUE`/`CHECK`/type constraints — both app-level and DB-level validation inform how a case gets labeled negative/edge, not just the route shape.

### Generation → Execution Handoff
- **D-10:** Generating test-cases.md is a terminal step for that invocation — the agent does not execute any case automatically in the same run. Running cases is a separate, later request.
- **D-11:** To run generated cases, the user references the test-cases.md file and the specific case ID(s) (e.g. "corré los casos 1, 3 y 5 de qa-reports/<run-id>-test-cases.md"). The agent reads those specific cases and hands them to the existing Phase 1/2 Run protocol unchanged — Phase 3 does not introduce a new execution path.

### Natural-Language-Only Generation (DISC-03)
- **D-12:** For a one-off instruction with no full-project scan requested, the agent still reads the specific file/route/form the instruction names to ground preconditions and validation in what it actually observed — same "shape observed, not invented" discipline as Phase 1's D-10. It does not scan the rest of the project, and it does not fabricate constraints it didn't see in code.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (Phase 1, still applicable)
- `.planning/research/ARCHITECTURE.md` — build-order guidance; Phase 3 sits after both executors exist so generated cases have somewhere to run
- `.planning/research/PITFALLS.md` — Pitfall 1 (evidence-backed reporting / no hallucinated success) extends here: a generated case's precondition/steps must trace to something actually read in code, not invented

### Phase 1 & 2 (prior phases, direct dependencies)
- `.planning/phases/01-foundation-guardrails-api-testing/01-CONTEXT.md` — D-05 (NL is Phase 1's only case-source), D-10 ("shape observed, not contract validated" discipline this phase's D-12 extends)
- `.planning/phases/01-foundation-guardrails-api-testing/SKILL.md` `## Run protocol` and `## Case construction` — the existing execution path D-11's handoff must plug into unchanged
- `.planning/phases/02-browser-execution-engine/02-CONTEXT.md` — D-06 (UI destructive-element classification), D-07 (session reuse) — a generated UI case must still pass through this phase's confirmation gate when it's later executed
- `.planning/phases/02-browser-execution-engine/SKILL.md` `## UI run protocol` — the browser-side execution path D-11's handoff must plug into unchanged

### Project-level
- `.planning/STATE.md` — Blockers/Concerns: "No authoritative pattern exists for code-aware discovery scripts across Next.js App Router vs. Pages Router — validate against at least two of the three target repos (DATAX, dotax, franquix) before considering Phase 3 done" — directly informs D-08 and should shape this phase's UAT plan
- `.planning/PROJECT.md` — Core Value, Constraints (agnostic across DATAX/dotax/franquix, Next.js/Supabase stacks)
- `.planning/REQUIREMENTS.md` — DISC-01, DISC-02, DISC-03 (this phase's mapped requirements)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/api-client.mjs`, `scripts/format-report.mjs`: Phase 1's `results.json` → Markdown rendering pattern is the template for how test-cases.md should relate to a future case-source structure, even though D-01 chose Markdown-only for the case document itself (no separate JSON intermediate was requested).
- `SKILL.md` `## Run protocol` / `## UI run protocol`: the two execution paths D-11 must hand generated cases into without modification.
- `references/destructive-classification.md`, `references/ui-destructive-classification.md`: existing classifiers a generated case still passes through at execution time — Phase 3 doesn't need to duplicate destructive-action judgment, only label a case's execution type (D-03).

### Established Patterns
- `qa-reports/<run-id>.md` naming convention (Phase 1 D-07) — D-01 extends this same convention to `<run-id>-test-cases.md`.
- Deterministic-script vs. orchestrator-judgment split (Phase 1 Architectural Responsibility Map, reused in Phase 2) — discovery scripts (file/route/schema scanning) are the deterministic layer; deciding how to label a case (positive/negative/edge, which surface it belongs to) stays with the orchestrator's reasoning over what the scripts found.

### Integration Points
- `qa-reports/` output directory (already gitignored) — test-cases.md lands here alongside existing run reports.
- Env var / `.env.local` loading (`readConfig()`) — discovery itself needs no new env vars; it operates on the target project's source tree directly, not its running server.

</code_context>

<specifics>
## Specific Ideas

No specific example test-case document was sketched beyond the decisions above — exact Markdown table/heading styling is left to implementer discretion, constrained by D-02 (fields), D-04 (IDs), D-05 (grouping).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Systematic boundary/negative/permission edge-case coverage (DISC-04, DISC-05) was correctly not raised here — that's Phase 4's explicit job, building on top of the constraints Phase 3 discovers (D-09).

</deferred>

---

*Phase: 3-Dual Discovery & Test-Case Generation*
*Context gathered: 2026-08-20*
