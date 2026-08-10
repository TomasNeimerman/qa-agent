# Feature Research

**Domain:** AI-powered QA testing agent (Claude Code skill — web UI testing, API testing, test case generation)
**Researched:** 2026-08-10
**Confidence:** MEDIUM

## Context Recap

This is an internal Claude Code skill for a small dev team, run on-demand against arbitrary Next.js/Supabase apps (localhost or staging). v1 explicitly excludes: CI/CD-triggered runs, and generating reusable versioned test code files left in the repo — v1 delivers reports and documented test cases only, not Playwright/pytest suites. Core pain point: repetitive manual regression testing and form validation testing.

The commercial landscape below (QA Wolf, Momentic, Testim, Reflect, browser-use, Playwright MCP) is useful for calibrating what "table stakes" and "differentiator" mean in this domain — but this project is NOT building a SaaS competitor to them. It's building the equivalent of their AI-authoring/exploration engine, repackaged as a single-user, on-demand Claude Code skill. Many of their features (hosted infra, team dashboards, managed QA staff, CI orchestration) are explicitly out of scope per PROJECT.md and are called out as anti-features below.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete for a "QA agent."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Autonomous exploration/navigation of the target app (browser-driven) | Every AI QA tool in the space (QA Wolf, Momentic, Reflect, browser-use, Playwright MCP) leads with "AI explores your app and figures out what to test" — this is the baseline capability that separates an "AI QA agent" from a static test runner | MEDIUM | Playwright MCP gives Claude Code a real browser with accessibility-tree-based element identification (no vision model needed for standard controls) — this is the natural foundation given the project already runs inside Claude Code |
| Natural-language-directed testing ("test the customer signup flow") | Users of AI testing tools expect to describe intent in plain English rather than write selectors/scripts by hand (Momentic, Reflect, Testim's Agentic Test Automation all lead with this) | LOW-MEDIUM | Directly matches PROJECT.md's "accept instructions in natural language" requirement |
| Form validation coverage (required fields, invalid formats, boundary values) | Explicitly the stated core pain point in PROJECT.md; also universally cited as a QA best practice (boundary value analysis catches a disproportionate share of bugs) | MEDIUM | Needs a systematic checklist approach: required/optional, type mismatches, min/max length, min/max numeric bounds, special characters, empty string vs whitespace |
| Negative/edge-case testing, not just happy path | Every source on AI QA best practices calls out that the common mistake is testing only ideal scenarios; AI-native tools differentiate by discovering edge cases autonomously | MEDIUM-HIGH | Requires the agent to reason about "what should fail" not just "what should succeed" — inputs out of range, wrong types, permission/auth edge cases, network errors |
| API/endpoint testing (status codes, schema/contract validation, error responses) | Postman Agent Mode, Keploy, and others treat this as core; PROJECT.md explicitly requires it | MEDIUM | Can largely be done via direct HTTP calls (curl/fetch) rather than a browser — much cheaper/faster than UI-driving for API-only checks |
| Self-contained readable report of what was tested, what passed/failed, and why | Universal expectation — QA Wolf, Reflect, Testim all provide execution reports with logs/evidence; PROJECT.md requires this explicitly and it is the only "deliverable" of v1 | LOW-MEDIUM | Should include: scope tested, pass/fail per case, reproduction steps for failures, and evidence (screenshots at minimum since a "video" pipeline is disproportionate for v1) |
| Documented test cases (not just ad hoc actions) | PROJECT.md requires "generate test cases... documented"; also the AI test-case-generation market (TestCollab, Autify, etc.) treats structured test cases (steps + expected result) as the deliverable, separate from execution | LOW-MEDIUM | Test case = title, preconditions, steps, expected result, priority/type (positive/negative/edge) — independent of whether it was actually executed |
| Dual environment targeting (localhost vs staging URL) | PROJECT.md requirement; also standard across all commercial tools (they all support "point at any URL") | LOW | Mostly a matter of accepting a base URL parameter and handling local dev quirks (self-signed certs, slower cold starts, seeded test data assumptions) |
| Code-aware discovery (inspect the repo to infer what to test) | PROJECT.md's "dual discovery" requirement — distinguishes this from pure black-box tools like QA Wolf/Reflect which only see the rendered UI | MEDIUM-HIGH | This is actually a differentiator relative to the commercial landscape (see below) but is "table stakes" for THIS project given it's explicitly required and running inside Claude Code (which already has repo access) |
| Handling of authentication/login before testing protected flows | Every real app has an auth wall; without this the agent can't reach 90% of what needs testing | MEDIUM | Needs a way to accept test credentials/session info per project without hardcoding secrets into the skill itself |

### Differentiators (Competitive Advantage)

Features that set this tool apart — either from generic manual testing, or relative to what commercial AI QA tools optimize for. Should align with Core Value: eliminating repetitive manual regression/form testing.

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Hybrid discovery: code-reading + natural-language instruction in one agent | Commercial tools are almost all black-box (browser-only) OR code-only (unit test generators) — few blend "read the Next.js routes/Supabase schema to infer test surface" with "also accept a one-off natural language request." Because it runs inside Claude Code with repo access, this project can infer form fields, validation rules, and API contracts directly from source (Zod schemas, Supabase table constraints, route handlers) rather than only from rendered HTML | HIGH | This is the single biggest differentiator vs. QA Wolf/Momentic/Reflect, which infer everything from the live DOM and therefore miss constraints that never surface as visible UI hints (e.g. a DB-level NOT NULL constraint with no client-side validation) |
| Zero setup / zero recording step, works on any project on day 1 | Most commercial tools require an onboarding/recording phase per app (Reflect/Testim/Momentic all start from "record your first test"); this project's stated goal is "no adaptation needed per project" | MEDIUM-HIGH | Relies on the code-aware discovery above plus conventions common to the team's stack (Next.js App Router, Supabase) — reasonable to assume, but should degrade gracefully on unfamiliar stacks |
| Smoke-test-post-deploy mode (fast, narrow, essential-flows-only) | Explicit PROJECT.md requirement; differentiates from "full regression every time" tools by letting the user ask for a cheap/fast pass vs. a deep pass | LOW-MEDIUM | Essentially a scoped variant of the same agent — "test only the top N critical flows" — low additional engineering once core agent exists |
| Root-cause-oriented failure reporting (not just pass/fail) | QA Wolf's differentiator is a human team that diagnoses *why* something failed, not just that it did; an AI agent can approximate this by inspecting console errors, network failures, and relevant source around the failure point | MEDIUM-HIGH | High value for a small team without dedicated QA — turns "the button didn't work" into "the POST /api/clients 500'd because `cuit` failed a regex added in the last migration" |
| Cost/scope control — user chooses depth (quick smoke vs. deep regression vs. single-flow) | Long AI browser sessions can blow up token/time cost; commercial tools hide this behind a subscription, but a Claude Code skill runs on the user's own usage/budget | LOW-MEDIUM | Simple but important: expose a mode flag (quick / standard / deep) so a "smoke test" doesn't cost the same as full regression |
| Test case generation that reflects real domain rules (CUIT/CUIL formats, Argentine tax logic, multi-tenant scoping) from the team's own codebases | Generic AI test-case generators produce generic edge cases (empty string, SQL injection, unicode); a code-aware agent operating on DATAX/dotax can generate cases tied to actual business validation (e.g., "invalid CUIT checksum", "user without MANAGER role accessing endpoint") | MEDIUM | Directly serves the stated pain point (form validation + flows specific to their own domain) rather than generic OWASP-style boilerplate |
| Self-healing-lite: agent adapts to minor selector/copy changes within a single run without failing the whole test | Commercial self-healing (Testim's Smart Locators, mabl, Reflect) is the most-cited AI differentiator in the space — but full ML-based self-healing (persisted, learned confidence scores over many runs) is disproportionate for v1's single-run, on-demand model | LOW (scoped down) | v1 version: agent uses semantic/accessibility-based element finding (like Playwright MCP's accessibility tree) so it doesn't hard-fail on a renamed CSS class *within the same run* — this is "good enough" self-healing without building a persistent locator-learning system |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good — and are common in the commercial space — but are wrong for this project's v1 scope or team.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|----------------|------------------|-------------|
| Generating persisted, versioned test code (Playwright/pytest files committed to the repo) | Every commercial code-based tool (Playwright, and even "codeless" tools like Reflect) eventually offers export-to-code; feels like the "real" endpoint of test automation | Explicitly out of scope in PROJECT.md ("v1 se enfoca en reportes y casos documentados, no en dejar suites de test versionadas"); also adds huge maintenance burden (someone now owns a test suite that must be kept green) that contradicts the "on-demand, low-friction" goal | Documented test cases (human-readable, in a report) + ad hoc execution each time; revisit codegen only if/when the team wants CI-gated regression later |
| CI/CD-triggered automatic runs on every PR/deploy | This is the default expectation for "real" test automation (QA Wolf, Momentic, Reflect all sell CI integration as a headline feature) | Explicitly out of scope in PROJECT.md v1; also implies infra (queueing, scheduling, notification, flake-tolerance policy) far beyond a Claude Code skill invoked on demand | Keep it manual/on-demand; a human runs `/qa-agent` when they want a check (e.g., right before or after a deploy) |
| Persistent, cross-run self-healing / locator-learning system (like Testim's Smart Locators with weighted historical confidence) | It's the most hyped AI-QA feature in every vendor's marketing | Requires a persistent store of locator history per project, tuned over many runs — massive overkill for a tool with no CI trigger and irregular, on-demand usage; each run essentially starts cold anyway | Use accessibility-tree/semantic element identification within a single run (good enough resilience for one-shot testing); don't build learning/persistence infrastructure |
| Managed "human QA team in the loop" model (à la QA Wolf) | Attractive because it guarantees zero false positives and someone else fixes broken tests | Wrong operating model entirely — this is an internal skill for the team itself, not an outsourced service; also implies ongoing headcount/cost this team doesn't want | The Claude Code agent itself does the triage/root-cause step (console errors, network logs, relevant source) instead of a human intermediary |
| Multi-user / multi-tenant access control, team dashboards, shared run history across users | Every commercial SaaS tool needs this since they serve many customers; feels like a "complete product" checkbox | Explicitly out of scope in PROJECT.md ("acceso se comparte informalmente por ahora"); adds auth, storage, and UI surface with zero value for a handful of devs on one Claude Code install each | Distribute the skill via `~/.claude/skills/`; reports are per-run local artifacts (files/output), no shared backend needed |
| Cross-browser / cross-device (Safari, Firefox, real iOS/Android device) execution matrix | QA Wolf and others heavily market broad device/browser coverage as a value prop | For an internal Next.js/Supabase app tested by developers pre-release, a single modern Chromium context covers the overwhelming majority of real bugs found; multi-browser adds proportionally more infra/time than value at this stage | Single browser (Chromium via Playwright) for v1; revisit only if a browser-specific bug class actually appears |
| Full visual regression testing (pixel-diffing against a golden baseline, like Applitools) | It's a headline AI-QA feature (Reflect, Applitools) and "catches things a script misses" | Requires maintaining baseline screenshots per page/state that must be manually re-approved after every legitimate UI change — high maintenance overhead disproportionate to an on-demand, no-persisted-suite tool | Ad hoc screenshot capture on failure (for the human to eyeball in the report), not systematic baseline diffing |
| AI agent given broad, unsupervised write access to run destructive actions (e.g., freely creating/deleting real data, hitting payment/production endpoints) during exploration | Feels natural since "autonomous exploration" implies clicking everything, including delete/pay buttons | Testing against staging/local is explicitly the scope, but even there an agent that free-clicks destructive actions can corrupt shared staging data or trigger real side effects (emails, webhooks, third-party API calls) other devs rely on | Agent should treat destructive/irreversible actions (delete, payment, send-email, admin role changes) as requiring explicit user confirmation or a documented "avoid list," not something to click blindly during exploration |

## Feature Dependencies

```
Code-aware discovery (repo inspection)
    └──enhances──> Form validation coverage
                       └──requires──> Autonomous browser exploration/navigation

Autonomous browser exploration/navigation
    └──requires──> Auth/login handling (to reach protected flows)

Natural-language-directed testing
    └──enhances──> Autonomous browser exploration/navigation

API/endpoint testing
    ──independent of── Autonomous browser exploration/navigation
    (API testing can run without a browser at all — direct HTTP calls)

Negative/edge-case testing
    └──requires──> Form validation coverage
    └──enhances──> Documented test cases

Documented test cases (generation)
    └──independent of── Execution (can exist without ever being run)

Report of results
    └──requires──> (Autonomous browser exploration/navigation OR API/endpoint testing) [something must have executed]

Smoke-test-post-deploy mode
    └──requires──> Autonomous browser exploration/navigation
    └──requires──> Report of results
    (it is a scoped/fast configuration of the same execution engine)

Root-cause-oriented failure reporting
    └──requires──> Report of results
    └──enhances──> Code-aware discovery (uses repo access to explain WHY, not just WHAT, failed)

Self-healing-lite (semantic element finding)
    └──enhances──> Autonomous browser exploration/navigation
    └──conflicts with── Persisted cross-run self-healing (anti-feature; different architecture — stateless per-run vs. learned state)

Generating persisted test code (anti-feature)
    └──conflicts with── Documented test cases (v1 chooses docs+reports, not code, as the deliverable)

CI/CD-triggered runs (anti-feature)
    └──conflicts with── On-demand invocation model (core operating assumption of the whole project)
```

### Dependency Notes

- **Code-aware discovery enhances form validation coverage:** reading Zod schemas, Supabase table constraints, and API route validation gives the agent ground truth about what "invalid" means, rather than guessing from placeholder text or client-side-only hints in the DOM. This should be built early since it strengthens almost every other table-stakes feature.
- **Autonomous browser exploration requires auth/login handling:** without a way to get past login, the agent can only test public pages — a small fraction of real regression risk in an internal business app. This is a hard prerequisite, not a nice-to-have, and should land in the same phase as basic navigation.
- **API/endpoint testing is independent of browser automation:** it can be built and shipped as a lighter-weight capability (HTTP client + schema/status assertions) without waiting on the browser-driving engine — worth sequencing as an earlier, lower-complexity phase if the roadmap wants a fast early win.
- **Negative/edge-case testing requires form validation coverage:** you can't generate meaningful "what should fail" cases without first having a systematic model of "what fields/constraints exist" from the form validation work.
- **Smoke-test mode requires the full execution engine and reporting:** it's not a separate feature, just a "run fewer, higher-priority flows" configuration — sequence it after the core engine, not before.
- **Root-cause-oriented failure reporting enhances (but doesn't require) code-aware discovery:** basic failure reporting (screenshot + error message) can ship without repo access; the "explain why by reading source" upgrade is a natural v1.x enhancement once both pieces exist.
- **Self-healing-lite conflicts architecturally with persisted cross-run self-healing:** don't half-build the persisted version — pick the stateless, single-run semantic-matching approach and treat true learned self-healing as explicitly deferred, not a partial implementation.
- **The two headline anti-features (persisted test code, CI-triggered runs) each conflict directly with a core in-scope feature** (documented test cases as the deliverable; on-demand invocation as the operating model) — they are not just "extra work to skip," they represent a different product shape, which is why PROJECT.md calls them out explicitly rather than leaving them as unstated gaps.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept per PROJECT.md's Active requirements.

- [ ] Autonomous browser exploration + natural-language-directed testing (single Chromium context, via Playwright/Playwright MCP) — this is the execution engine everything else sits on
- [ ] Auth/login handling for protected flows — without it most real testing is unreachable
- [ ] Form validation coverage (required fields, invalid formats, boundary values) — the explicitly stated core pain point
- [ ] Negative/edge-case test generation and execution — directly required, and cheap to add once form coverage exists
- [ ] API/endpoint testing (status codes, schema/contract checks, error responses) — can ship in parallel with browser work since it's architecturally independent
- [ ] Code-aware discovery (read repo to infer forms/routes/schemas) + accept natural-language ad hoc instructions (dual discovery) — the key differentiator and directly required
- [ ] Dual environment targeting (localhost / staging URL param)
- [ ] Documented test case output (structured: steps, expected result, type) — independent of whether executed
- [ ] Readable results report (what was tested, pass/fail, why, evidence) — the only tangible "deliverable" of a run
- [ ] Smoke-test-post-deploy mode (scoped/fast pass over essential flows)
- [ ] Packaged as an installable Claude Code skill (`~/.claude/skills/`), invocable via slash command, distributable to the team

### Add After Validation (v1.x)

Features to add once the core loop (explore → test → report) is proven useful in real usage.

- [ ] Root-cause-oriented failure diagnosis (correlate console/network errors with relevant source code, not just screenshot + pass/fail) — trigger: team finds itself re-diagnosing failures manually after reports
- [ ] Self-healing-lite via accessibility-tree/semantic element matching to reduce false failures from minor markup churn within a run — trigger: agent reports "element not found" failures that are actually just renamed classes/ids
- [ ] Depth/mode control exposed explicitly (quick smoke / standard / deep regression) as a first-class flag rather than implicit — trigger: token/time cost becomes noticeable or annoying in daily use
- [ ] Domain-specific edge-case libraries seeded from the team's actual business rules (CUIT/CUIL validation, multi-tenant role scoping, Argentine date/currency formats) — trigger: generic edge cases start missing real bugs specific to DATAX/dotax domain logic

### Future Consideration (v2+)

Features to defer until the on-demand skill model itself is validated — these represent a materially different product shape.

- [ ] Generating persisted, versioned test code (Playwright/pytest files committed to repo) — defer until the team decides it wants a maintained regression suite, not just on-demand checks
- [ ] CI/CD-triggered automatic runs — defer until the team wants gating, not just visibility
- [ ] Cross-browser/cross-device execution matrix — defer until a browser-specific bug class is actually observed
- [ ] Full visual regression (pixel-diff baselines) — defer; high maintenance cost not justified without a persisted suite to anchor baselines against
- [ ] Persisted, learned self-healing (locator confidence scores across runs) — defer; requires infrastructure disproportionate to on-demand usage patterns
- [ ] Multi-user/team dashboards, shared run history — defer indefinitely per PROJECT.md unless distribution model changes

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Autonomous browser exploration/navigation | HIGH | MEDIUM | P1 |
| Auth/login handling | HIGH | MEDIUM | P1 |
| Form validation coverage | HIGH | MEDIUM | P1 |
| Negative/edge-case testing | HIGH | MEDIUM | P1 |
| API/endpoint testing | HIGH | LOW-MEDIUM | P1 |
| Code-aware + natural-language dual discovery | HIGH | HIGH | P1 |
| Dual environment targeting (local/staging) | MEDIUM | LOW | P1 |
| Documented test case generation | HIGH | LOW-MEDIUM | P1 |
| Results report | HIGH | LOW-MEDIUM | P1 |
| Smoke-test-post-deploy mode | MEDIUM | LOW | P1 |
| Installable/distributable skill packaging | MEDIUM | LOW | P1 |
| Root-cause-oriented failure diagnosis | HIGH | MEDIUM-HIGH | P2 |
| Self-healing-lite (semantic element matching) | MEDIUM | LOW-MEDIUM | P2 |
| Explicit depth/mode control (quick/standard/deep) | MEDIUM | LOW | P2 |
| Domain-specific edge-case libraries | MEDIUM | MEDIUM | P2 |
| Persisted versioned test code generation | LOW (for this team's stated goals) | HIGH | P3 |
| CI/CD-triggered runs | LOW (explicitly deferred) | HIGH | P3 |
| Cross-browser/device matrix | LOW | HIGH | P3 |
| Full visual regression (pixel-diff baselines) | LOW | HIGH | P3 |
| Persisted/learned self-healing | LOW | HIGH | P3 |
| Multi-user dashboards/shared history | LOW | MEDIUM-HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | QA Wolf | Momentic | Testim | Reflect.run | browser-use | Playwright MCP | Our Approach |
|---------|---------|----------|--------|-------------|-------------|-----------------|--------------|
| Test authoring input | Autonomous exploration + managed human team | Plain-English descriptions | Recorder + AI/agentic authoring | Recording or natural-language prompts | LLM-driven task instructions | Agent writes/runs/self-debugs scripts live | Natural language + code-aware repo inspection (dual discovery) |
| Element identification | Proprietary AI (undisclosed) | AI runtime interpretation, no code export | Smart Locators (weighted ML confidence across attributes) | Auto-adapting scripts | LLM decision-making per action | Accessibility tree by default (no vision needed) | Accessibility-tree/semantic matching (via Playwright MCP), reinforced by code-level knowledge of forms/schemas |
| Self-healing | Yes (multiple healing types, per QA Wolf's own taxonomy) | Yes, resilient to DOM changes | Yes, Smart Locators with adjustable confidence weighting | Yes, auto-adapts to UI changes | N/A (agent re-reasons each run, no persisted state) | N/A (stateless per session) | Self-healing-lite: stateless semantic matching within a run, no persisted learning (v1.x) |
| Exported/reusable code | Yes, "production-grade" test code | No — vendor lock-in, no export | Partial (platform-centric) | No (no-code platform) | Yes (framework code, open source) | Yes (can generate Playwright scripts) | Explicitly NOT generating persisted repo code in v1 (anti-feature) |
| API testing | Yes, integrated | Not a focus (browser-first) | Not a focus (browser-first) | Yes, integrated | No (browser-focused) | No (browser-focused) | First-class, and architecturally independent of the browser engine |
| CI/CD integration | Yes, core offering | Yes, via CLI | Yes | Yes | N/A (library, not a platform) | Possible but not the point | Explicitly out of scope for v1 (anti-feature) |
| Visual regression | Not primary focus | Not primary focus | Not primary focus | Yes, built-in | No | Screenshot comparison possible, not systematic | Ad hoc screenshots on failure only, no baseline diffing (v1) |
| Operating model | Managed service (human team in loop) | Self-serve SaaS platform | Self-serve SaaS platform | Self-serve SaaS platform | Open-source library, self-hosted | Open-source MCP server, self-hosted | Self-hosted, single-user, on-demand Claude Code skill — closest in spirit to browser-use + Playwright MCP, but purpose-built for QA workflows with code-aware discovery |

## Sources

- QA Wolf official site, blog, and third-party reviews (GeeksforGeeks, Bug0, TheCTOClub, G2) — MEDIUM confidence, cross-corroborated across vendor and independent sources
- Momentic official site/blog, Bug0 review, Shiplight AI comparison — MEDIUM confidence
- Testim official site, QA Wolf blog on self-healing types, Momentic blog comparison, Medium/Shiplight coverage — MEDIUM confidence, cross-corroborated
- Reflect.run (SmartBear) official site and third-party tool directories (TechBriefly, LogicWeb, TestingTools.ai) — MEDIUM confidence
- browser-use GitHub repo, browser-use.com benchmark post, Firecrawl "best browser agents" roundup — MEDIUM confidence
- Playwright MCP guides: Microsoft for Developers blog, testomat.io, Bug0, QASkills.sh, MCP.Directory — MEDIUM confidence, cross-corroborated across independent technical write-ups
- AI test case generation: TestQuality, TestCollab, Autify blog posts (2026) — MEDIUM confidence
- AI API testing: Postman official solutions page, Keploy official site, LogRocket and DEV Community roundups — MEDIUM confidence
- Self-healing/visual regression: GeeksforGeeks, testomat.io, mabl official site, Tricentis ShiftSync, Crosscheck blog — MEDIUM confidence, cross-corroborated
- Form validation / edge-case / negative testing best practices: QATouch, testRigor, QATestLab, VirtuosoQA — MEDIUM confidence
- Claude Code QA skill ecosystem: agentskills/agentskills and petrkindlmann/qa-skills GitHub repos, mcpmarket.com, TestCollab, QASkills.sh — MEDIUM confidence (community/marketplace sources, cross-corroborated on general pattern but not authoritative)
- Smoke/regression/flaky-test tooling: DigitalOcean, TestRail, TestDino, OwlityAI, arXiv paper on flaky test generation — MEDIUM confidence
- Note: all sources gathered via general web search (no context7/official-docs access needed for this market-landscape question); no single-source LOW-confidence claims are presented as authoritative above. Dollar figures and percentages (e.g. "60-80% coverage," "$1.01B market") are vendor/analyst-reported and should be treated as directional, not precise.

---
*Feature research for: AI-powered QA testing agent (Claude Code skill)*
*Researched: 2026-08-10*
