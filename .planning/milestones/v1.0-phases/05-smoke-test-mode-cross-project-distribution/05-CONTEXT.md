# Phase 5: Smoke-Test Mode & Cross-Project Distribution - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning

<domain>
## Phase Boundary

The agent supports a fast post-deploy smoke check that runs only the essential flows instead of a full regression pass (REP-03), and is verified + documented well enough that any teammate can copy it into their own skills folder and run it unmodified against any of the team's projects — DATAX, dotax, franquix (PKG-02, PKG-03). This phase does not add new discovery, execution, or reporting mechanisms beyond what Phases 1–4 already built — it reuses the existing Run protocol, discovery pipeline, and report format, and adds a selection layer on top plus a distribution validation pass. It does not touch CI/CD triggering (out of scope per PROJECT.md) or introduce new execution engines.

</domain>

<decisions>
## Implementation Decisions

### What Counts as "Smoke" (REP-03)
- **D-01:** Smoke-set selection is fully automatic — the agent infers which cases are "essential," the user never marks cases by hand and never has to name flows on request.
- **D-02:** The rule is deterministic: for each discovered surface (route/form/endpoint), the smoke set takes the first case of type `positivo` listed under that surface's section in `test-cases.md` — one per surface, reusing Phase 3's D-05 surface grouping.
- **D-03:** If no `test-cases.md` exists yet for the target project when a smoke test is requested, the agent runs the full discovery/generation pipeline first (Phase 3, unchanged), then applies the D-02 selection rule on the result. It never generates a separate, smaller ad-hoc case set — one discovery path, not two.
- **D-04:** Nothing is written back into `test-cases.md` to mark a case as "smoke." The selection is recalculated by re-reading the document every time a smoke test is requested — consistent with Phase 3 D-06 (the document is live, re-read at execution-request time, not a frozen snapshot). If the user edits/reorders the document, a later smoke run may select a different case.
- **D-05:** The smoke set is not restricted to one execution layer — it includes both `ejecución: API` and `ejecución: UI` cases per Phase 3's D-03/D-04 field, whichever the first-positive-per-surface happens to be. A smoke test on a project with both layers is meant to check end-to-end health, not just the fastest layer.

### Invocation & Execution
- **D-06:** Triggered by natural-language instruction ("corré un smoke test", "hacé un chequeo rápido post-deploy") — no new CLI flag, consistent with the skill's existing NL-first invocation style (EXEC-02) and `argument-hint: [base-url|project-path] [instruction]`.
- **D-07:** Once the smoke set is selected, it's handed to the existing Run protocol (Phase 1/2) completely unchanged — same confirmation gate for destructive cases, same report format/location as a regular run. No separate "smoke report" section or distinguishing report header was requested.

### Cross-Project Validation (PKG-02)
- **D-08:** Validated by actually running the new smoke test against DATAX, dotax, and franquix as part of this phase's UAT — not just a code read-through. This is the only way to confirm Phase 3 D-08's App Router/Pages Router auto-detection and the discovery pipeline generalize in practice, not just in theory.
- **D-09:** Each of the three UAT runs targets that project's localhost or staging environment — never a client's production database. DATAX specifically has a shared demo base (`SBDAMODE`) for this kind of testing; client databases are read-only per that repo's own rules (`c:\DATAX\CLAUDE.md` §5–6). dotax/franquix use their own equivalent local/staging setup.
- **D-10:** Pass criterion for PKG-02 is that the smoke test runs against all three projects without any project-specific configuration or skill-code changes beyond the already-documented env vars — i.e., discovery correctly detects each project's stack/routes and the Run protocol executes without configuration errors. Individual test cases failing (a real bug in the target app) does NOT count as a phase failure — that's the smoke test doing its job, not the packaging failing.

### Packaging & Distribution (PKG-03)
- **D-11:** No new install tooling. The existing installation instructions (copy/symlink to `~/.claude/skills/qa-agent/`, `npm install` once, register Playwright MCP per `references/mcp-setup.md`) stay as-is. This phase reviews and tightens the wording of those existing docs — it does not add an install script or a post-install checklist.
- **D-12:** The installation doc is validated by having an actual teammate follow it from scratch as part of this phase's UAT — not a self-review. Any step they get stuck on is a doc gap to fix, found through a real dry run rather than re-reading the README critically alone.
- **D-13:** `node_modules`/`package-lock.json` handling is unchanged — a teammate still runs `npm install` manually after copying the skill folder. Vendoring or pre-bundling dependencies was explicitly considered and rejected for this phase — not worth the added copy weight for one saved command.

### Claude's Discretion
- Exact wording/formatting of the tightened installation instructions (D-11) — constrained by "no new tooling," not a fixed template.
- Whether the "first positive case per surface" selection (D-02) is implemented as a small pure function inside `test-case-doc.mjs` or a new sibling script — an implementation call for planning, not discussed here.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Prior phases (direct dependencies)
- `.planning/phases/03-dual-discovery-test-case-generation/03-CONTEXT.md` — D-01 (`test-cases.md` naming/location), D-02 (5-field case schema), D-03/D-04 (`ejecución: API | UI` field, reused by D-05 here), D-05 (surface grouping, reused by D-02 here), D-06 (document is live/re-read, reused by D-04 here), D-10/D-11 (terminal generation step / Run protocol handoff, reused unchanged by D-07)
- `.planning/phases/03-dual-discovery-test-case-generation/03-CONTEXT.md` — D-08 (App Router vs Pages Router auto-detection) — the exact mechanism D-08/D-09 here validate against DATAX/dotax/franquix
- `.planning/phases/04-edge-case-input-validation-quality/04-CONTEXT.md` — D-08 (human-readable subcategory titling in cases) — informs how a "positivo" case is identified by type when applying D-02's selection rule
- `.planning/phases/01-foundation-guardrails-api-testing/SKILL.md` `## Run protocol`, `.planning/phases/02-browser-execution-engine/SKILL.md` `## UI run protocol` — the execution paths the smoke set hands into unchanged (D-07)
- `SKILL.md` `## Installation` and `## Configuration` sections — the existing install/config docs D-11/D-13 review and tighten rather than replace
- `references/mcp-setup.md` — existing Playwright MCP one-time registration steps, referenced by the installation doc D-12 validates

### External project rules (validation targets)
- `c:\DATAX\CLAUDE.md` §5 ("La instalación y la base demo son ÚNICAS" — `SBDAMODE` shared demo base) and §6 ("Bases de clientes: solo lectura") — governs what D-09 means by "never against a client's production database" when the DATAX UAT run happens

### Project-level
- `.planning/PROJECT.md` — Core Value, Constraints (agnostic across DATAX/dotax/franquix, Next.js/Supabase stacks); "Out of Scope" (no CI/CD-triggered execution — smoke test stays manual/on-demand, same as every other mode)
- `.planning/REQUIREMENTS.md` — REP-03, PKG-02, PKG-03 (this phase's mapped requirements)
- `.planning/STATE.md` — no open blockers specific to Phase 5 at time of writing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/test-case-doc.mjs`: existing test-case document reader/writer (Phase 3/4) — D-02's "first positive case per surface" selection reads this document's existing structure; no new document format needed.
- `scripts/discover-schema.mjs`: existing discovery pipeline (Phase 3/4), including the App Router/Pages Router auto-detection (Phase 3 D-08) that D-08/D-09 validate against the three target repos.
- `scripts/api-client.mjs`, `scripts/ui-login.mjs`, `scripts/ui-case.mjs`: existing Run protocol execution paths (Phase 1/2) that D-07 hands the smoke set into unchanged.
- `scripts/format-report.mjs`: existing report renderer, reused as-is per D-07 (no separate smoke report format).
- `SKILL.md` `## Installation` / `## Configuration`: existing install documentation D-11 tightens rather than replaces.

### Established Patterns
- Deterministic-script vs. orchestrator-judgment split (Phase 1, reused every phase since): case selection (D-02) is a deterministic rule over an already-generated document — likely fits the script tier rather than orchestrator judgment, similar to how `discover-schema.mjs` stays deterministic.
- `qa-reports/<run-id>-test-cases.md` naming and per-surface grouping (Phase 3 D-01/D-05) — unchanged; smoke selection reads this same document, doesn't create a new one.
- "Shape observed, not invented" discipline (Phase 1 D-10, reused every phase since) — D-03's "run discovery first if nothing exists" follows this: no fabricated minimal case set, always grounded in what discovery actually found.

### Integration Points
- `qa-reports/` output directory — no new output location; smoke runs produce the same report format Phase 1/2 already write.
- `.env.local` / `readConfig()` env-var loading — no new env vars introduced by this phase.

</code_context>

<specifics>
## Specific Ideas

No specific example smoke-test transcript was sketched beyond the decisions above. The two most concrete, explicitly-locked shapes from this discussion: the "first positivo case per surface, recalculated every time, no persisted marker" selection rule (D-02/D-04), and the "actually run against DATAX/dotax/franquix as UAT, targeting each project's local/staging/demo environment, never client production data" validation approach (D-08/D-09).

</specifics>

<deferred>
## Deferred Ideas

- **Install script or post-install verification checklist (PKG-03)** — explicitly considered and rejected for this phase (D-11); current docs are judged sufficient once tightened and validated by a real dry run (D-12).
- **Vendoring/pre-bundling `node_modules` for distribution** — explicitly considered and rejected (D-13); manual `npm install` stays the mechanism.
- **A `--smoke` CLI flag or explicit slash-command argument for triggering smoke mode** — considered as an alternative to natural-language invocation and rejected in favor of D-06 (NL-first, no new flag).

### Reviewed Todos (not folded)
None — `todo.match-phase` returned zero matches for Phase 5.

</deferred>

---

*Phase: 5-Smoke-Test Mode & Cross-Project Distribution*
*Context gathered: 2026-09-18*
