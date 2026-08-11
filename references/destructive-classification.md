# Destructive-Action Classification

This is the judgment rubric the orchestrator applies **before** invoking
`scripts/api-client.mjs` for each test case (SKILL.md `## Confirmation
protocol`, step 1). It decides only whether to pause and ask, never whether
an action is permitted — see the closing note below (D-02).

## Method Table

| Method | Gated? | Notes |
|---|---|---|
| `GET`, `HEAD`, `OPTIONS` | Never | Always safe to dispatch without confirmation. |
| `POST`, `PUT`, `PATCH` | Gated, unless clearly read-only | Pass `--read-only-intent` only when the endpoint's *effect* is a search/filter/query, not a mutation. |
| `DELETE` | Always | No exceptions. `--read-only-intent` has no effect on DELETE — `requiresConfirmation("DELETE", …)` is `true` regardless of what is passed. |
| Anything else (e.g. `PURGE`) | Gated | Unknown methods are treated as destructive — the classifier never waves an unrecognised method through. |

## Worked Examples — Read-Only Mutating Endpoints (`--read-only-intent` applies)

These are POST/PUT/PATCH calls whose body carries filter/search criteria and
whose response is a collection or a query result — no state changes:

- `POST /api/clients/search` with body `{ "name": "acme" }` — returns a
  filtered list of existing clients; nothing is created or changed.
- `POST /api/reports/query` with body `{ "dateFrom": "...", "dateTo": "..." }`
  — returns aggregated report data; nothing is written.
- `POST /api/invoices/filter` with body `{ "status": "overdue" }` — returns a
  filtered collection; nothing is written.

## Worked Counter-Examples — Stay Gated Despite Looking Innocuous

These look like simple POSTs but cause real state change, and remain gated:

- `POST /api/invoices` with body `{ "clientId": 1, "amount": 500 }` — creates
  a real invoice.
- `PUT /api/users/7` with body `{ "role": "admin" }` — changes a user's
  permission level.
- `POST /api/notifications/send` with body `{ "to": "client@example.com" }` —
  sends a real notification email.
- Anything under a `/payments` or `/billing` path, regardless of the verb or
  how the endpoint name reads — always treated as destructive.

## Tie-Breaker

When an endpoint's effect is genuinely uncertain — the name is ambiguous, the
body could plausibly cause a write, or there's no way to tell from the
instruction alone whether it mutates state — **treat it as destructive and
ask**. Never guess toward "probably read-only" to avoid a pause; the cost of
one extra confirmation is far lower than the cost of an unconfirmed mutation.

## What This Rubric Does Not Decide

This rubric decides only whether to pause before dispatch — it never decides
whether an action is *permitted*. There is no absolute blacklist in this
project: every destructive action, once confirmed in the moment, is
executable (D-02). A `DELETE` classified here as "always gated" is still
runnable the instant the developer says yes to that specific call.
