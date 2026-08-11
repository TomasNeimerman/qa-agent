# Report template

This document is the canonical structure contract `scripts/format-report.mjs`
must emit. `format-report.mjs` is the only writer of this format — every line
in a rendered report must be traceable to a field in the run's `results.json`,
never to the conversation transcript or the orchestrator's own narration
(project Pitfall 1: hallucinated success). Headers are always rendered from
the already-redacted stored copy (`evidence.request.headers` /
`evidence.response.headers`) — this file never re-reads a credential from the
environment.

## Section order

A rendered QA report has exactly these sections, in this order:

1. H1 title — `# QA Report — <run title> — <YYYY-MM-DD HH:mm>`
2. Metadata block — `**Target:**`, `**Instruction:**`, `**Summary:**`
3. `## Blocked pending confirmation` — only present when the run has at
   least one blocked case; a quick-scan list so the developer sees what did
   not run before reading the full case-by-case detail
4. `## Case N — <METHOD> <url> — <STATUS>` — one section per case, in the
   same order as `results.cases` (this includes blocked cases — they appear
   both in the quick-scan list above and in full detail here, in their
   original run position)

## 1. H1 title

```
# QA Report — client-crud — 2026-08-10 14:32
```

The run title comes from `run.title`; the timestamp is the moment the report
was rendered (not the moment the run started).

## 2. Metadata block

```
**Target:** http://localhost:3000
**Instruction:** "proba GET /api/clients y POST /api/clients"
**Summary:** 2 passed · 1 failed · 1 blocked (pending confirmation)
```

- `**Target:**` is `run.baseUrl`.
- `**Instruction:**` is the developer's verbatim natural-language instruction
  (`run.instruction`), quoted as-is — never paraphrased.
- `**Summary:**` is the four-way count in the exact form
  `N passed · N failed · N blocked (pending confirmation)`, even when a count
  is zero (`0 passed · 0 failed · 0 blocked (pending confirmation)` is valid
  for an empty run).

## 3. Blocked pending confirmation (conditional)

Present only when `results.cases` contains at least one case with
`status: "blocked"`. One bullet per blocked case, in run order:

```
## Blocked pending confirmation

These actions were detected as destructive and were not sent — see each
case below for the full reason.

- DELETE /api/clients/42 — The developer declined confirmation for this
  destructive call — no request was sent.
```

This section is a summary only — the full per-case detail for every blocked
case still appears below in section 4, at its normal run position.

## 4. Case sections

Each case renders as `## Case N — <METHOD> <url> — <STATUS>`, where `STATUS`
is `PASSED`, `FAILED`, or `BLOCKED` (uppercased `case.status`). The body of
the section differs by status.

### PASSED and FAILED

```
**Request:**
- Method: `POST`
- URL: `/api/clients`
- Headers: `Authorization: [REDACTED]`
- Body: `{"name": "", "email": "test@example.com"}`

**Response:**
- Status: `500`
- Headers: `(none)`
- Body: `{"error": "Internal Server Error"}`

**Checks:**
- status: expected `400`, actual `500`
- shape observed — json-parseable: expected `"valid JSON body"`, actual `"valid JSON"`

**Verdict:** FAILED — expected 400, got 500

**Reproduction steps:** (FAILED only — see below)
1. ...
```

- `**Request:**` and `**Response:**` bullet lists render Method, URL,
  Headers, and Body (Request) / Status, Headers, and Body (Response) — the
  full request and response, not a status code and short message (D-08).
  This applies to both PASSED and FAILED cases equally.
- `**Checks:**` renders every entry from `case.checks` as expected-versus-
  actual with a pass/fail marker. Any check whose `kind` is `shape-observed`
  is prefixed with the label `shape observed —` (see the closing note below
  for why).
- `**Verdict:**` is `case.verdict` verbatim.
- `**Reproduction steps:**` appears only on FAILED cases — see
  "Reproduction steps" below. PASSED and BLOCKED cases never carry this
  block.
- Bodies render as a fenced json block when the value parses as an object or
  array, and as inline code otherwise.

### BLOCKED

```
**Request (not sent):**
- Method: `DELETE`
- URL: `/api/clients/42`
- Body: `(empty)`

**Status:** The developer declined confirmation for this destructive call.
No request was sent for this case — this destructive action was detected
and paused before dispatch.
```

- `**Request (not sent):**` renders Method, URL, and Body only — no Headers
  bullet, since no request was ever constructed with real headers to show.
- `**Status:**` gives `case.blockedReason` verbatim.
- An explicit statement that no HTTP request was issued always follows,
  containing the literal phrase "no request was sent" so it is unambiguous
  even to a quick skim.
- No `**Response:**` block at all — there is no response to show for an
  action that was never sent.

## Reproduction steps (FAILED cases only)

A FAILED case's `**Reproduction steps:**` block is a numbered list appearing
immediately after `**Verdict:**` and before the closing `---` separator.

- When `case.reproSteps` is a non-empty array, those strings are rendered
  verbatim, in order — a future executor that captures better steps at call
  time wins over the generic deriver.
- Otherwise, the steps are derived purely from `case.evidence.request`,
  `case.checks`, and `run.baseUrl` via `deriveReproSteps()` — never from any
  narrative field, so a fabricated repro step is structurally impossible.
  The derived steps are, in order: (1) the method and absolute URL, noting
  that the request carries a bearer `Authorization` header built from the
  `$QA_AGENT_TOKEN` environment variable — referenced by name only, never by
  value (D-09); (2) the request body as JSON, present only when the request
  actually had a body; (3) the observed response status alongside the
  expected status drawn from the case's first failed check; (4) a
  copy-pasteable single-line `curl` command that reads the token from the
  same shell variable.
- PASSED and BLOCKED cases never carry a `**Reproduction steps:**` block —
  there is nothing to reproduce for a case that already passed, and nothing
  was ever sent for a case that was blocked.

## Why shape checks are labelled "observed"

Phase 1 has no OpenAPI or Postman specification to validate against (D-05).
Any `kind: "shape-observed"` check in `case.checks` is therefore a hint drawn
from the developer's own natural-language instruction, or from a single
observed response — not a contract assertion against a known-correct schema.
Presenting a `safeParse` pass as "contract validated" would over-state its
authority (project Pitfall 2, the oracle problem; RESEARCH.md Pitfall 4).
Every shape check in the rendered report therefore carries the explicit label
`shape observed —` so a developer reading the report never mistakes a guess
for a specification.
