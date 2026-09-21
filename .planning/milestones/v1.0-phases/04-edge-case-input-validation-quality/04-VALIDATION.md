---
phase: 04
slug: edge-case-input-validation-quality
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-17
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.10 |
| **Config file** | none detected — `package.json`'s `"test": "vitest run"` / `"test:e2e": "vitest run scripts/tracer.e2e.test.mjs"` scripts run directly against `scripts/*.test.mjs` |
| **Quick run command** | `npm test -- scripts/discover-schema.test.mjs` (or the relevant changed test file) |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run the specific changed test file's quick-run command
- **After every plan wave:** Run `npm test` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | DISC-04 | T-04-03 | `parseCheckBounds()` returns `{min,max}` for `BETWEEN`/`>=`/`<=`/`>`/`<` shapes, `null` for unrecognized expressions | unit | `npm test -- scripts/discover-schema.test.mjs` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | DISC-04 | T-04-09 | Generated test-cases.md contains exactly 4 boundary cases (min-1/min/max/max+1) for a two-sided bounded field, fewer for one-sided, none for unbounded | integration | `npm test -- scripts/discovery.e2e.test.mjs` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | DISC-04 | T-04-03 | `parseCheckEnum()` extracts `IN ('a','b',...)` value lists; `allowedValues` present on every constraint record | unit | `npm test -- scripts/discover-schema.test.mjs` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | DISC-05 | T-04-01, T-04-10 | `extractPolicies()` returns correctly-typed records for `FOR SELECT/INSERT/UPDATE/DELETE/ALL`, with/without `TO`, with/without `WITH CHECK`; an RLS-free project yields an empty `policies` array | unit + integration | `npm test -- scripts/discover-schema.test.mjs scripts/discovery.e2e.test.mjs` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | DISC-05 | T-04-11 | `ROLE_GUARD_PATTERN` matches a helper-wrapped guard the existing imperative-error pattern misses; zero matches asserted for a guard-free handler | unit | `npm test -- scripts/discovery-surfaces.test.mjs` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 2 | DISC-05 | T-04-04, T-04-05 | `test-case-doc.mjs` accepts and counts the pending `Ejecución` state; an out-of-set value still throws; a pending case is still scanned for forbidden dispatch flags | unit | `npm test -- scripts/test-case-doc.test.mjs` | ❌ W0 | ⬜ pending |
| 04-05-01 | 05 | 2 | DISC-05 | T-04-06, T-04-19 | `readConfig({ useSecondary: true })` resolves `QA_AGENT_TOKEN_SECONDARY`, throws a named `ConfigError` when absent, and refuses `--secondary` with `--storage-state`; the confirmation gate still precedes the credential read | unit | `npm test -- scripts/api-client.test.mjs` | ❌ W0 | ⬜ pending |
| 04-05-02 | 05 | 2 | DISC-05 | T-04-02, T-04-07 | Secondary credential is redacted by the existing `redactHeaders()` path with no new redaction code, and `evidence.request.auth.credential` names which credential ran each case | unit | `npm test -- scripts/api-client.test.mjs scripts/format-report.test.mjs` | ❌ W0 | ⬜ pending |
| 04-06-01 | 06 | 3 | DISC-05 | T-04-16, T-04-17 | `## Case generation protocol` states the permission-case rules, the presence-only credential check and the honest empty-policies reporting — locked by `PERMISSION_GENERATION_MARKERS` | unit (doc agreement) | `npm test -- scripts/discovery-surfaces.test.mjs` | ❌ W0 | ⬜ pending |
| 04-06-02 | 06 | 3 | DISC-04 | T-04-18 | `## Case generation protocol` states the type-implied, wrong-type and generic-expectation rules and the no-attack-payload boundary — locked by `TYPE_AND_RANGE_MARKERS` | unit (doc agreement) | `npm test -- scripts/discovery-surfaces.test.mjs` | ❌ W0 | ⬜ pending |
| 04-06-03 | 06 | 3 | DISC-05 | T-04-15, T-04-20 | `## Running generated cases` step 4 refuses a pending case by name and dispatches a secondary-role case through `--secondary` — locked by `PENDING_DISPATCH_MARKERS` | unit (doc agreement) | `npm test -- scripts/discovery-surfaces.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/discover-schema.test.mjs` — add cases covering `parseCheckBounds()` (plan 01), `parseCheckEnum()` and `extractPolicies()` (plan 02) (extends existing file, framework already present)
- [ ] `scripts/discovery.e2e.test.mjs` — extend with the bounds → four-boundary-cases end-to-end lock (plan 01) and the three-policy / empty-policies locks (plan 02)
- [ ] `scripts/discovery-surfaces.test.mjs` — add the role-guard and format-scope pattern locks (plan 03) and the three SKILL.md protocol-agreement blocks (plan 06) (extends existing file)
- [ ] `scripts/test-case-doc.test.mjs` — add cases covering the new `Ejecución` pending state, per the option selected at plan 04's decision checkpoint (extends existing file)
- [ ] `scripts/api-client.test.mjs` — add cases covering `--secondary`/`useSecondary` token resolution, both exit-2 refusals, and the `auth.credential` evidence field (plan 05) (extends existing file)
- [ ] `scripts/format-report.test.mjs` — add one assertion that the rendered `Auth:` line names the credential and carries no token value (plan 05) (extends existing file)

*No new test framework install needed — vitest is already configured and all target files already have sibling `*.test.mjs` files.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
