# Phase 5 — API Coverage Declaration

**Checked:** 2026-09-21
**Hook:** `api-coverage` (plan:pre contribution)
**Detector result:** `{"detected":false,"signals":[]}` — re-confirmed by reading
`05-CONTEXT.md` and the ROADMAP Phase 5 section directly.

No external API integration: this phase adds a deterministic case-selection rule over an
already-generated local document (test-cases.md) and tightens installation docs — no new
external API, SDK, or service is integrated.

## Why the detector is right here

Every artifact Phase 5 touches already exists in this repo and was built in Phases 1–4:

| Touched | Kind | Introduced by |
|---|---|---|
| `scripts/test-case-doc.mjs` | local Node module (document reader) | Phase 3 |
| `scripts/discover-schema.mjs` | local Node module (SQL/route discovery) | Phase 3/4 |
| `scripts/api-client.mjs`, `scripts/ui-login.mjs`, `scripts/ui-case.mjs`, `scripts/format-report.mjs` | local Node modules, reused **unchanged** (D-07) | Phase 1/2 |
| `SKILL.md`, `references/mcp-setup.md` | documentation | Phase 1/2 |

The only network traffic a smoke run produces is the same HTTP dispatch
`scripts/api-client.mjs` already performs against the *target project under test* — the
developer's own localhost or staging host, not a third-party API this phase integrates.
Playwright MCP (`@playwright/mcp`) was registered and its package legitimacy human-verified
in Phase 2 (`references/mcp-setup.md` `## Package legitimacy`); Phase 5 adds no new server,
no new SDK, and no new vendor dependency.

No capability matrix is produced, because there is no external API surface to matrix.
