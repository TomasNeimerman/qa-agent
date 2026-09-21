# Roadmap: QA Agent

## Overview

QA Agent ships as a Claude Code skill that eliminates manual regression/form testing across Tomás's projects (DATAX, dotax, franquix). It's built as five vertical MVP slices, each independently demoable end-to-end (invoke → act → report), layering capability on top of a safety-first foundation: (1) an installable skill with guardrails and a direct API-testing loop, (2) a real browser execution engine driven by natural language, (3) dual discovery (code-aware + natural-language) that generates documented test cases, (4) systematic edge-case and form-validation quality on top of that discovery, and (5) a fast smoke-test mode plus final cross-project packaging polish. By the end of Phase 1 there is already a usable, if narrow, QA agent; each subsequent phase strictly adds capability to that same loop.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation, Guardrails & API Testing** - Installable skill with safety guardrails and a complete direct-HTTP API test loop (explore → test → report) (completed 2026-08-11)
- [x] **Phase 2: Browser Execution Engine** - Natural-language-directed browser automation with test-account auth and UI↔API session reuse (completed 2026-08-20)
- [x] **Phase 3: Dual Discovery & Test-Case Generation** - Code-aware and natural-language discovery that produces documented, executable test cases (completed 2026-08-24)
- [x] **Phase 4: Edge-Case & Input Validation Quality** - Systematic boundary, negative, and permission edge-case coverage grounded in discovered constraints (completed 2026-09-18)
- [ ] **Phase 5: Smoke-Test Mode & Cross-Project Distribution** - Fast post-deploy smoke checks and unmodified portability across the team's projects

## Phase Details

### Phase 1: Foundation, Guardrails & API Testing

**Goal**: A developer can invoke the QA agent as an installed Claude Code skill and get a reliable, evidence-backed API test run against a local or staging target, with destructive actions safely gated behind confirmation.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: PKG-01, SAFE-01, SAFE-02, SAFE-03, API-01, API-02, EXEC-04, REP-01, REP-02
**Success Criteria** (what must be TRUE):

  1. User can invoke the skill via a slash command in Claude Code and it runs against a target project with no prior project-specific setup (PKG-01).
  2. User can point the agent at localhost or a staging URL (passed as a base-URL parameter) and it runs HTTP requests (GET/POST/PUT/DELETE) against that target, validating status codes and response shape/errors (API-01, API-02, EXEC-04).
  3. When the agent is about to perform a destructive action (delete, payment, role/permission change, real email) via the API, it stops and requires explicit confirmation before proceeding, and the resulting report clearly distinguishes actions that were executed from actions that were blocked pending confirmation (SAFE-01, SAFE-02).
  4. After a run, the user receives a readable report showing what was tested and what passed/failed, with every verdict backed by captured evidence (HTTP request/response) and reproduction steps attached to each failing case (SAFE-03, REP-01, REP-02).

**Plans**: 4/4 plans executed

Plans:

- [x] 01-01-PLAN.md — Tracer: installable `/qa-agent` skill sends one real GET and writes an evidence-backed report
- [x] 01-02-PLAN.md — Destructive-action confirmation gate (script refusal + PreToolUse hook backstop)
- [x] 01-03-PLAN.md — Three-state evidence-quoted report with reproduction steps and chat summary
- [x] 01-04-PLAN.md — Full GET/POST/PUT/DELETE dispatch, shape observation, preflight and target safety

### Phase 2: Browser Execution Engine

**Goal**: The agent can autonomously drive a real browser to execute application flows described in natural language, authenticate as a test user, and reuse that session for related API checks.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: EXEC-01, EXEC-02, EXEC-03, API-03
**Success Criteria** (what must be TRUE):

  1. User can give a natural-language instruction (e.g. "probá el alta de cliente") and the agent translates it into concrete browser actions (click/fill/submit) executed end-to-end against the target app (EXEC-01, EXEC-02).
  2. The agent logs into the target app, on either localhost or staging, using test credentials supplied via environment variables and never hardcoded in the skill (EXEC-03).
  3. Once authenticated in the browser, the agent reuses that same session to make related API calls within the same run, without a separate login step (API-03).

**Plans**: 4/4 plans executed

Plans:

- [x] 02-01-PLAN.md — Tracer: script-driven browser login exports a storageState the API client reuses (EXEC-03, API-03)
- [x] 02-02-PLAN.md — UI destructive-action gate: element-text classifier, MCP-tool PreToolUse backstop and rubric (D-05, D-06)
- [x] 02-03-PLAN.md — Playwright MCP registration with a package-legitimacy gate and hands-on storage-capability verification
- [x] 02-04-PLAN.md — Natural-language flow execution and evidence-backed browser cases in the existing report (EXEC-01, EXEC-02)

### Phase 3: Dual Discovery & Test-Case Generation

**Goal**: The agent can determine what to test either by reading the target project's code or from a plain natural-language instruction, and turn that into documented test cases ready for the executors from Phase 1 and Phase 2 to run.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: DISC-01, DISC-02, DISC-03
**Success Criteria** (what must be TRUE):

  1. User can point the agent at a project and it scans routes, input fields, validation schemas, and database constraints to infer testable surfaces, without being told what to test (DISC-01).
  2. From what it discovers in code, the agent produces documented test cases (title, preconditions, steps, expected result, type: positive/negative/edge) that the API and browser executors can run directly (DISC-02).
  3. User can instead give a one-off natural-language instruction and get documented test cases generated for just that flow, without the agent scanning the whole codebase (DISC-03).

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Tracer: fixture project → deterministic Supabase constraint extraction → one conforming test-cases.md, plus the document format contract (DISC-01, DISC-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Route/form/Server-Action discovery rules and automatic App Router vs Pages Router detection (DISC-01, D-07, D-08)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — Scoped natural-language generation, anchored case lookup, and the run-by-case-ID handoff to the Phase 1/2 executors (DISC-02, DISC-03)

### Phase 4: Edge-Case & Input Validation Quality

**Goal**: Test cases the agent generates systematically cover input-validation boundaries and negative/permission edge scenarios, grounded in the constraints discovered in Phase 3, not just the happy path.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: DISC-04, DISC-05
**Success Criteria** (what must be TRUE):

  1. For any discovered set of input fields, the agent generates test cases covering required-field omission, invalid formats, and boundary values (min/max length, numeric limits) (DISC-04).
  2. The agent generates and executes negative/edge cases beyond input validation — out-of-range data, wrong data types, and permission/auth edge cases (e.g. attempting an action outside the test user's role) — as part of the same run (DISC-05).

**Plans**: 6/6 plans executed

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Tracer: one discovered CHECK bound becomes exactly four boundary cases in a validating document, plus the subcategory-titling convention (DISC-04, D-08, D-09, D-10)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — `parseCheckEnum` value sets and `extractPolicies`: CREATE POLICY becomes structured records instead of a discarded count (DISC-04, DISC-05, D-03, D-11)
- [x] 04-03-PLAN.md — Role-guard and required-field/format detection rubric, proven against inline and helper-wrapped guard shapes (DISC-04, DISC-05, D-03, D-11)
- [x] 04-04-PLAN.md — The pending `Ejecución` state in the case-document contract, for a permission case with no secondary credential (DISC-05, D-02, D-04)
- [x] 04-05-PLAN.md — `QA_AGENT_TOKEN_SECONDARY` and the `--secondary` dispatch contract, with per-case credential evidence (DISC-05, D-01, D-05)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-06-PLAN.md — Permission-case generation and dispatch wiring: policy/role-guard cases, pending refusal, secondary-run role delta, type/range rules (DISC-04, DISC-05, D-02, D-03, D-04, D-05, D-07, D-12, D-13, D-14)

### Phase 5: Smoke-Test Mode & Cross-Project Distribution

**Goal**: The agent supports a fast post-deploy smoke check and is packaged so any teammate can install it and run it unmodified against any of the team's projects.
**Mode:** mvp
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4
**Requirements**: REP-03, PKG-02, PKG-03
**Success Criteria** (what must be TRUE):

  1. User can invoke a "smoke test" mode that runs only the essential flows quickly, instead of a full regression pass (REP-03).
  2. The skill runs unmodified against any of the team's existing projects (DATAX, dotax, franquix) without project-specific configuration (PKG-02).
  3. A teammate can install the skill by copying it into their own skills folder and immediately invoke it via slash command, with no setup beyond that (PKG-03).

**Plans**: 3 plans

Plans:
**Wave 1**

- [ ] 05-01-PLAN.md — Tracer: a validated test-cases document becomes a deterministic one-positivo-per-surface smoke set, dispatched through the unchanged Run protocol (REP-03, D-01–D-07)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 05-02-PLAN.md — Cross-project validation: discovery, generation, selection and a live smoke run against DATAX-web, dotax and franquix (PKG-02, D-08, D-09, D-10)
- [ ] 05-03-PLAN.md — Tightened installation and MCP-setup docs, proven by a clean-directory rehearsal (PKG-03, D-11, D-12, D-13)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|-----------------|--------|-----------|
| 1. Foundation, Guardrails & API Testing | 4/4 | Complete    | 2026-08-11 |
| 2. Browser Execution Engine | 4/4 | Complete    | 2026-08-20 |
| 3. Dual Discovery & Test-Case Generation | 3/3 | Complete    | 2026-08-24 |
| 4. Edge-Case & Input Validation Quality | 6/6 | Complete    | 2026-09-18 |
| 5. Smoke-Test Mode & Cross-Project Distribution | 0/3 | Not started | - |

---
*Roadmap created: 2026-08-10*
