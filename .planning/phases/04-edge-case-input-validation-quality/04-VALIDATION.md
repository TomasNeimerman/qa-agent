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
| 04-01-01 | 01 | 1 | DISC-04 | — | `parseCheckBounds()` returns `{min,max}` for `BETWEEN`/`>=`/`<=`/`>`/`<` shapes, `null` for unrecognized expressions | unit | `npm test -- scripts/discover-schema.test.mjs` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | DISC-04 | — | `parseCheckEnum()` extracts `IN ('a','b',...)` value lists from a raw check expression | unit | `npm test -- scripts/discover-schema.test.mjs` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | DISC-04 | — | Generated test-cases.md contains exactly 4 boundary cases (min-1/min/max/max+1) for a two-sided bounded field, fewer for one-sided, none for unbounded | integration | `npm test -- scripts/discovery.e2e.test.mjs` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 1 | DISC-05 | T-04-01 | `extractPolicies()` returns correctly-typed records for `FOR SELECT/INSERT/UPDATE/DELETE/ALL`, with/without `TO`, with/without `WITH CHECK` | unit | `npm test -- scripts/discover-schema.test.mjs` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | DISC-05 | — | `readConfig({ useSecondary: true })` resolves `QA_AGENT_TOKEN_SECONDARY` and throws a named `ConfigError` when absent | unit | `npm test -- scripts/api-client.test.mjs` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 1 | DISC-05 | T-04-02 | Secondary credential is redacted by the existing `redactHeaders()` path with no new redaction code | unit | `npm test -- scripts/api-client.test.mjs` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 1 | DISC-05 | — | `test-case-doc.mjs` accepts the new pending `Ejecución` state and `## Running generated cases` refuses to dispatch it | unit + integration | `npm test -- scripts/test-case-doc.test.mjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/discover-schema.test.mjs` — add cases covering `extractPolicies()`, `parseCheckBounds()`, `parseCheckEnum()` (extends existing file, framework already present)
- [ ] `scripts/api-client.test.mjs` — add cases covering `--secondary`/`useSecondary` token resolution and its missing-credential `ConfigError` (extends existing file)
- [ ] `scripts/test-case-doc.test.mjs` — add cases covering the new `Ejecución` state, per Open Question 1's resolution (extends existing file)
- [ ] Possibly extend `scripts/discovery.e2e.test.mjs` with a fixture proving end-to-end boundary-case generation against a fixture migration file with a two-sided `CHECK`

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
