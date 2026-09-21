---
status: issues_found
files_reviewed: 19
findings:
  critical: 1
  warning: 1
  info: 3
  total: 5
---

# Code Review — Phase 02 (Browser Execution Engine)

## Summary
The UI-login credential isolation (D-08), the fail-closed destructive-element
classifier, and the `previewOfElement`/fill-form value exclusion are all
implemented correctly and are backed by tests that specifically try to break
them. One real gap survives: `api-client.mjs`'s header redaction list omits
`set-cookie`, so a response that sets or rotates a session cookie is written
into `results.json`, the copied `<run>.results.json`, the rendered Markdown
report, and the CLI's own stdout (which lands in the conversation transcript)
completely unredacted — the same class of live-session-credential leak the
rest of this phase went out of its way to prevent for the storage-state file
and the UI password. A secondary, already-acknowledged risk (the PreToolUse
hook's live-session firing being unverified) is restated here since it
directly weakens the two-layer story `SKILL.md` claims for the destructive-UI
gate.

## Findings

### CR-1: `redactHeaders` never redacts `Set-Cookie`, leaking session credentials into results.json, the Markdown report, and stdout
**File:** C:\qa-agent\scripts\api-client.mjs:58-76 (also used at lines 378, 488; consumed by `format-report.mjs`'s `renderHeaders`)
**Severity:** Critical

`REDACTED_HEADER_KEYS` is `['authorization', 'cookie', 'x-api-key', 'proxy-authorization']` — it has no entry for `set-cookie`. `runCase()` calls `redactHeaders(response.headers())` at line 378 and stores the result verbatim in `evidence.response.headers`, which is then:
- written to `results.json` via `appendCase`,
- copied byte-for-byte into `qa-reports/<run>.results.json` by `format-report.mjs`,
- rendered into the Markdown report body by `renderHeaders()` (format-report.mjs:48-52), and
- printed to stdout by `api-client.mjs`'s own `process.stdout.write(JSON.stringify(caseObj))` (line 580), which flows straight into the orchestrating Claude Code session's transcript exactly like the plaintext password D-08 was designed to keep out of it.

Any target endpoint that sets or rotates a session cookie on response (a login endpoint tested via `api-client.mjs` directly, or any authenticated endpoint that refreshes a session/CSRF cookie) will have that cookie's live value — the functional equivalent of the storage-state file's contents — written in plaintext to disk and echoed into chat. This directly contradicts `SKILL.md`'s stated guarantee ("writes a Markdown report — with the auth token redacted everywhere") and the design intent that motivated `redactHeaders` in the first place (its own docstring: "any credential-bearing header ... replaced by the literal string '[REDACTED]'" — Set-Cookie is a credential-bearing header by definition).

Confirmed via the project's own fixture: `scripts/__fixtures__/mock-login-app.mjs:107` sets `Set-Cookie: qa_session=<token>; Path=/; HttpOnly` on `POST /login` — a response shape `api-client.mjs` would faithfully capture and leak if that endpoint were exercised as an API case rather than through `ui-login.mjs`. The existing test `api-client.test.mjs` "no case object anywhere in a results file contains any cookie value from the storage-state file" only proves the *outbound* cookie (attached via `--storage-state`) isn't logged in the request headers — it does not exercise an *inbound* `Set-Cookie` response header at all, so this gap has no test coverage today.

**Fix:** add `'set-cookie'` (and ideally a prefix/substring guard for header names containing `cookie`) to `REDACTED_HEADER_KEYS` in `api-client.mjs`, and add a regression test asserting a mock response with `Set-Cookie` never appears verbatim in `results.json`, the rendered report, or the CLI's stdout.

### WR-1: The PreToolUse hook's live-session firing remains unverified, so the destructive-UI gate's "two independent layers" claim may currently be one layer in practice
**File:** C:\qa-agent\scripts\confirm-destructive-ui.mjs (whole file); C:\qa-agent\SKILL.md:294-308
**Severity:** Warning

`confirm-destructive-ui.mjs` itself is implemented correctly — it classifies on `element`/field `name` only (never a typed value), fails open only on a JSON parse error (the accepted, documented posture since the orchestrator-level pause is meant to be primary), and its unit/CLI-protocol tests are solid. The residual risk isn't in this file's logic; it's that `SKILL.md` itself states plainly: "The hook layer's live-session firing is unverified as of Phase 1's UAT (Test 4) — a skill-frontmatter `PreToolUse` hook was not observed firing in that session, root cause undiagnosed." That means the "two independent layers" defense-in-depth story this phase relies on for gating `Eliminar`/`Confirmar pago` clicks against a **real browser with real credentials** may, in the currently-shipped state, reduce to a single layer: the orchestrator's own prompted discipline, with no code-level backstop actually intercepting the tool call if the orchestrator's reasoning slips. Given this phase explicitly runs real browser automation against real (if local/staging) targets, this is worth escalating from a documentation footnote to a release-blocking action item — verify hook firing end-to-end (a live Claude Code session with the skill installed, attempting a `browser_click` on an `Eliminar`-labelled element) before relying on it as a safety net, or update `SKILL.md` to stop describing it as a "hardening layer" until confirmed.

### IN-1: Accessibility snapshots recorded verbatim could incidentally carry sensitive field values for some component libraries
**File:** C:\qa-agent\scripts\ui-case.mjs:40-45, 129-192
**Severity:** Info

`buildUiCase` stores the raw `browser_snapshot` text (truncated only by length, never filtered) into `evidence.response.snapshot`, which is rendered verbatim into the Markdown report. `previewOfElement` in `ui-destructive.mjs` is careful to build the *confirmation prompt* by explicit field assignment so a typed value can never leak into that dialog — but no equivalent filtering exists for the full-page snapshot text ultimately written to the report. Most accessibility trees expose only role/name, not a text/password input's live value, so this is low-probability in practice; it's noted here because a custom component that mirrors an input's value into a visible label or `aria-label` (e.g., a "confirm what you typed" UI pattern) would have that value captured and persisted with no redaction path. No action required unless a target app is known to do this — flagging for awareness only.

### IN-2: `ui-login.mjs` reads/validates credentials only after the login page navigation succeeds
**File:** C:\qa-agent\scripts\ui-login.mjs:112-137
**Severity:** Info

`performLogin` calls `page.goto(loginUrl, ...)` before calling `readUiCredentials()`. This means a run with both an unreachable `--base-url` and missing `QA_AGENT_UI_USER`/`QA_AGENT_UI_PASSWORD` exits `4` (transport failure) rather than `2` (configuration error), which is a slightly less specific diagnostic than `api-client.mjs`'s documented check order (confirmation → production-target → config → preflight). Not a security issue — no credential is sent to the target before the config check — but worth aligning for consistency with the check-order guarantee `api-client.mjs` documents explicitly in its own header comment.

### IN-3: Default storage-state filename has only minute-level granularity
**File:** C:\qa-agent\scripts\ui-login.mjs:210-217
**Severity:** Info

`defaultStorageStatePath` stamps the filename as `<YYYY-MM-DD-HHmm>-storage-state.json`. Two `ui-login.mjs` invocations inside the same minute without an explicit `--storage-state` path (e.g., a retried login after a transient failure) will silently overwrite each other's session file. `SKILL.md`'s run protocol always passes an explicit `--storage-state <run-id>-storage-state.json`, so this default path is unlikely to be hit in the documented flow — flagging only as a latent footgun for any future direct invocation that omits the flag.
