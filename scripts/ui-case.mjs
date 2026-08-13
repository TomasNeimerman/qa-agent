// scripts/ui-case.mjs
// Deterministic tier that turns an OBSERVED browser step into a recorded
// verdict — the browser sibling of api-client.mjs's runCase/appendCase pair.
// The orchestrator supplies what it observed (the action it issued, the
// element it targeted, the page URL, and the accessibility snapshot text
// captured immediately after the action) — it never supplies the verdict
// sentence itself. A passed or failed case with no captured snapshot is
// refused at construction, because SAFE-03 requires every verdict to be
// backed by evidence captured at the moment of the action, and a browser
// step has no HTTP response to serve as that evidence the way api-client.mjs
// cases already have.
//
// CLI exit codes — shares api-client.mjs's table for the meanings they
// share, never renumbers them:
//   0 = case recorded (passed, failed, or blocked are all a successful run)
//   2 = bad or missing argument, including an action outside UI_ACTIONS
//   5 = evidence missing — no --snapshot-file, or the file does not exist,
//       for a passed/failed case (mirrors format-report.mjs's exit 5)

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendCase } from './api-client.mjs';

// The closed set of recordable UI actions. An action outside this set is an
// error raised before any work is done — mirroring how DISPATCH in
// api-client.mjs refuses an unmapped HTTP method rather than falling through
// to a dynamic lookup (T-01-20's sibling guarantee, applied to the browser).
export const UI_ACTIONS = ['navigate', 'click', 'fill', 'submit', 'assert'];

export class UiEvidenceMissingError extends Error {}

// A large accessibility tree must never bloat results.json without the
// reader knowing something was cut — snapshot text beyond this cap is
// truncated and an explicit marker is appended so truncation is never
// silent.
const SNAPSHOT_CHAR_CAP = 20000;
const TRUNCATION_MARKER = '\n\n[... snapshot truncated — exceeded the 20000-character cap ...]';

function truncateSnapshot(snapshot) {
  if (typeof snapshot !== 'string' || snapshot.length <= SNAPSHOT_CHAR_CAP) {
    return snapshot;
  }
  return snapshot.slice(0, SNAPSHOT_CHAR_CAP) + TRUNCATION_MARKER;
}

/**
 * Builds the `checks` array for a UI case (never empty, except for a
 * blocked case, mirroring api-client.mjs's --declined case): one entry when
 * an `expected` value was supplied (kind `ui-observed`, comparing `expected`
 * to `observed`), otherwise one entry asserting only that the action
 * completed and a snapshot was captured — an empty checks array would render
 * as a verdict with nothing behind it.
 */
function buildChecks({ status, action, element, expected, observed }) {
  if (status === 'blocked') return [];

  if (expected !== undefined) {
    return [
      {
        name: `${action} on "${element ?? '(unnamed element)'}" — observed value`,
        kind: 'ui-observed',
        expected,
        actual: observed ?? null,
        passed: status === 'passed',
      },
    ];
  }

  return [
    {
      name: `${action} on "${element ?? '(unnamed element)'}" completed with a snapshot captured`,
      kind: 'ui-observed',
      expected: 'action completed and an accessibility snapshot was captured',
      actual:
        status === 'passed'
          ? 'action completed and a snapshot was captured'
          : 'action did not complete as expected',
      passed: status === 'passed',
    },
  ];
}

/**
 * Composes a one-line verdict sentence strictly from the case's own stored
 * fields — status, action, element, URL, and (on failure) the first failed
 * check — in the same style as api-client.mjs's composeVerdict. Never
 * accepts a free-text argument, so a fabricated verdict is structurally
 * impossible.
 */
function composeUiVerdict({ status, action, element, url, checks, blockedReason }) {
  const target = `${action} on "${element ?? '(unnamed element)'}" at ${url ?? '(no URL)'}`;

  if (status === 'blocked') {
    return `NOT EXECUTED — ${target} was blocked; ${blockedReason ?? 'no reason given'}`;
  }
  if (status === 'passed') {
    return `PASSED — ${target}`;
  }

  const firstFailed = (checks ?? []).find((c) => !c.passed);
  if (!firstFailed) {
    return `FAILED — ${target}`;
  }
  return (
    `FAILED — ${target}; ${firstFailed.name} failed ` +
    `(expected ${JSON.stringify(firstFailed.expected)}, got ${JSON.stringify(firstFailed.actual)})`
  );
}

/**
 * Turns one observed browser step into a case object satisfying Phase 1's
 * results.json contract exactly, with an added `kind: 'ui'` field.
 *
 * - `evidence.request` carries `method: 'UI'` (so renderCase's existing
 *   reads of `evidence.request.method`/`.url` keep working unchanged for a
 *   UI case), `url`, `action`, `element`, `body: null` and `headers: {}`.
 * - `evidence.response` is null for a blocked case. Otherwise it carries
 *   `snapshot` (truncated per SNAPSHOT_CHAR_CAP), `screenshot` (a path or
 *   null), `url` (the page URL observed after the action) and `durationMs`.
 * - Throws UiEvidenceMissingError, naming the title, when the status is
 *   passed or failed and the snapshot text is absent or empty — refused at
 *   construction, not at render (SAFE-03's second-earliest enforcement
 *   point; scripts/format-report.mjs is the first-earliest for API cases and
 *   the render-time backstop for this one).
 * - Throws a plain Error, naming the action, when `action` is outside
 *   UI_ACTIONS — before any other validation runs.
 */
export function buildUiCase({
  title,
  status,
  action,
  element,
  url,
  snapshot,
  screenshotPath,
  expected,
  observed,
  blockedReason,
  durationMs,
} = {}) {
  if (!UI_ACTIONS.includes(action)) {
    throw new Error(
      `Unsupported UI action: "${action}" — must be one of ${UI_ACTIONS.join(', ')}`
    );
  }

  const isBlocked = status === 'blocked';
  const hasSnapshot = typeof snapshot === 'string' && snapshot.length > 0;

  if (!isBlocked && (status === 'passed' || status === 'failed') && !hasSnapshot) {
    throw new UiEvidenceMissingError(
      `UI_EVIDENCE_MISSING: case "${title ?? `${action} ${element ?? ''}`.trim()}" has status ` +
        `"${status}" but no captured accessibility snapshot`
    );
  }

  const checks = buildChecks({ status, action, element, expected, observed });

  const evidenceResponse = isBlocked
    ? null
    : {
        snapshot: truncateSnapshot(snapshot),
        screenshot: screenshotPath ?? null,
        url: url ?? null,
        durationMs: durationMs ?? null,
      };

  const verdict = composeUiVerdict({ status, action, element, url, checks, blockedReason });

  return {
    id: `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: title ?? `${action} ${element ?? ''}`.trim(),
    status,
    kind: 'ui',
    evidence: {
      request: {
        method: 'UI',
        url: url ?? null,
        action,
        element: element ?? null,
        body: null,
        headers: {},
      },
      response: evidenceResponse,
    },
    checks,
    verdict,
    reproSteps: [],
    blockedReason: isBlocked ? (blockedReason ?? null) : null,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const resultsPath = resolve(args.results);
  const title = typeof args.title === 'string' ? args.title : undefined;
  const status = args.status;
  const action = args.action;
  const element = typeof args.element === 'string' ? args.element : undefined;
  const url = typeof args.url === 'string' ? args.url : undefined;
  const screenshotPath = typeof args.screenshot === 'string' ? args.screenshot : undefined;
  const expected = typeof args.expected === 'string' ? args.expected : undefined;
  const observed = typeof args.observed === 'string' ? args.observed : undefined;
  const blockedReason =
    typeof args['blocked-reason'] === 'string' ? args['blocked-reason'] : undefined;
  const durationMs = args['duration-ms'] !== undefined ? Number(args['duration-ms']) : undefined;

  // Validate the action before touching the filesystem at all — an
  // unrecognised action must exit 2, never 5, regardless of whether a
  // --snapshot-file was even supplied.
  if (!UI_ACTIONS.includes(action)) {
    process.stderr.write(
      `Unsupported UI action: "${action}" — must be one of ${UI_ACTIONS.join(', ')}\n`
    );
    process.exit(2);
    return;
  }

  // The orchestrator writes the raw browser_snapshot output to a file with
  // the Write tool, and this CLI reads that file rather than accepting the
  // snapshot as an inline argument — so what gets recorded is the tool's own
  // output, not the model's paraphrase of it, and a multi-kilobyte
  // accessibility tree never has to survive shell quoting.
  let snapshot;
  const snapshotFileArg =
    typeof args['snapshot-file'] === 'string' ? resolve(args['snapshot-file']) : undefined;
  if (snapshotFileArg) {
    if (!existsSync(snapshotFileArg)) {
      process.stderr.write(
        `UI_EVIDENCE_MISSING: --snapshot-file does not exist: ${snapshotFileArg}\n`
      );
      process.exit(5);
      return;
    }
    snapshot = readFileSync(snapshotFileArg, 'utf8');
  }

  let caseObj;
  try {
    caseObj = buildUiCase({
      title,
      status,
      action,
      element,
      url,
      snapshot,
      screenshotPath,
      expected,
      observed,
      blockedReason,
      durationMs,
    });
  } catch (err) {
    if (err instanceof UiEvidenceMissingError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(5);
      return;
    }
    process.stderr.write(`${err.message}\n`);
    process.exit(2);
    return;
  }

  // One results writer for both case kinds, never a second implementation —
  // appendCase is imported from api-client.mjs, not reimplemented here.
  appendCase(resultsPath, caseObj, { baseUrl: url ?? null, instruction: title, title });

  process.stdout.write(`${JSON.stringify(caseObj)}\n`);
  process.exit(0);
}

// Resolve both sides through realpathSync before comparing — matches
// api-client.mjs's isMainModule() fix for Windows junction/symlink installs.
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}
const isMain = isMainModule();
if (isMain) {
  main().catch((err) => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(1);
  });
}
