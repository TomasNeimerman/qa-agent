// scripts/format-report.mjs
// Reporting tier: reads results.json (never the conversation transcript) and
// renders the canonical Markdown report defined in
// references/report-template.md. Refuses to render any passed/failed case
// that is missing response evidence — this is SAFE-03's technical
// enforcement. Blocked (pending-confirmation) cases are exempt: a null
// response is the correct, expected shape for an action that was never sent.

import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export class EvidenceMissingError extends Error {}

function pad(n) {
  return String(n).padStart(2, '0');
}

function slugify(text) {
  return String(text ?? 'report')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report';
}

/**
 * Returns the report filename `YYYY-MM-DD-HHmm-<kebab-slug>.md` for the given
 * title and date (defaults to now).
 */
export function reportFileName(title, date = new Date()) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}-${hh}${mm}-${slugify(title)}.md`;
}

function renderHeaders(headers) {
  const entries = Object.entries(headers ?? {});
  if (entries.length === 0) return '`(none)`';
  return entries.map(([k, v]) => `\`${k}: ${v}\``).join(', ');
}

function renderBody(body) {
  if (body === null || body === undefined) return '`(empty)`';
  if (typeof body === 'object') {
    return '\n```json\n' + JSON.stringify(body, null, 2) + '\n```';
  }
  return '`' + String(body) + '`';
}

function renderChecks(checks) {
  if (!checks || checks.length === 0) return ['_(no checks recorded)_'];
  return checks.map((c) => {
    const label = c.kind === 'shape-observed' ? 'shape observed — ' : '';
    const mark = c.passed ? '✓' : '✗';
    return `- ${mark} ${label}${c.name}: expected \`${JSON.stringify(c.expected)}\`, actual \`${JSON.stringify(c.actual)}\``;
  });
}

/**
 * Composes reproduction steps for a failed case purely from stored evidence
 * — evidence.request, checks, and run.baseUrl — never from a narrative
 * field, so a fabricated repro step is structurally impossible. The auth
 * token is referred to only by its environment-variable name
 * ($QA_AGENT_TOKEN), never by its value (D-09).
 */
export function deriveReproSteps(caseObj, run = {}) {
  const method = caseObj?.evidence?.request?.method ?? '?';
  const path = caseObj?.evidence?.request?.url ?? '';
  const baseUrl = run?.baseUrl ?? '';
  const absoluteUrl = /^https?:\/\//i.test(path) ? path : `${baseUrl}${path}`;
  const body = caseObj?.evidence?.request?.body;
  const hasBody = body !== null && body !== undefined;
  const bodyText = hasBody ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';

  const checks = caseObj?.checks ?? [];
  const failedCheck = checks.find((c) => !c.passed);
  const observedStatus = caseObj?.evidence?.response?.status ?? '(no response)';
  const expectedStatus = failedCheck?.expected ?? '(unknown)';

  const steps = [];
  steps.push(
    `${method} ${absoluteUrl} — send with header \`Authorization: Bearer $QA_AGENT_TOKEN\``
  );
  if (hasBody) {
    steps.push(`Body: ${bodyText}`);
  }
  steps.push(`Observed response status \`${observedStatus}\`, expected \`${expectedStatus}\``);
  const curlBody = hasBody ? ` -d '${bodyText}'` : '';
  steps.push(
    `curl -X ${method} '${absoluteUrl}' -H "Authorization: Bearer $QA_AGENT_TOKEN"${curlBody}`
  );

  return steps;
}

/**
 * Renders a single case section. Throws EvidenceMissingError if the case's
 * status is passed/failed but evidence.response is null or absent — no
 * verdict may be rendered without the evidence that backs it (SAFE-03).
 * Blocked cases are exempt: a null response is the expected shape there.
 */
export function renderCase(caseObj, index, run = {}) {
  const { id, status, evidence, checks, verdict, blockedReason, reproSteps } = caseObj;
  const method = evidence?.request?.method ?? '?';
  const url = evidence?.request?.url ?? '?';
  const statusLabel = String(status ?? '').toUpperCase();

  if ((status === 'passed' || status === 'failed') && !evidence?.response) {
    throw new EvidenceMissingError(
      `EVIDENCE_MISSING: case ${id ?? index} has status "${status}" but no response evidence`
    );
  }

  const lines = [];
  lines.push(`## Case ${index} — ${method} ${url} — ${statusLabel}`);
  lines.push('');

  if (status === 'blocked') {
    lines.push('**Request (not sent):**');
    lines.push(`- Method: \`${method}\``);
    lines.push(`- URL: \`${url}\``);
    lines.push(`- Body: ${renderBody(evidence?.request?.body)}`);
    lines.push('');
    lines.push(`**Status:** ${blockedReason ?? 'Destructive action detected — case skipped.'}`);
    lines.push(
      'No request was sent for this case — this destructive action was detected and paused before dispatch.'
    );
    lines.push('');
  } else {
    lines.push('**Request:**');
    lines.push(`- Method: \`${method}\``);
    lines.push(`- URL: \`${url}\``);
    lines.push(`- Headers: ${renderHeaders(evidence?.request?.headers)}`);
    lines.push(`- Body: ${renderBody(evidence?.request?.body)}`);
    lines.push('');
    lines.push('**Response:**');
    lines.push(`- Status: \`${evidence.response.status}\``);
    lines.push(`- Headers: ${renderHeaders(evidence.response.headers)}`);
    lines.push(`- Body: ${renderBody(evidence.response.body)}`);
    lines.push('');
    lines.push('**Checks:**');
    lines.push(...renderChecks(checks));
    lines.push('');
    lines.push(`**Verdict:** ${verdict ?? statusLabel}`);
    lines.push('');

    if (status === 'failed') {
      const steps =
        reproSteps && reproSteps.length > 0 ? reproSteps : deriveReproSteps(caseObj, run);
      lines.push('**Reproduction steps:**');
      steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
      lines.push('');
    }
  }

  lines.push('---');

  return lines.join('\n');
}

/**
 * Returns { passed, failed, blocked, total } counts for a cases array.
 */
export function summarise(cases) {
  const passed = cases.filter((c) => c.status === 'passed').length;
  const failed = cases.filter((c) => c.status === 'failed').length;
  const blocked = cases.filter((c) => c.status === 'blocked').length;
  return { passed, failed, blocked, total: cases.length };
}

/**
 * Renders the full Markdown report from a results.json-shaped object, per
 * the structure defined in references/report-template.md: H1, metadata
 * block, a "Blocked pending confirmation" summary section when any blocked
 * cases exist, then one full case section per case in results.cases order.
 */
export function renderReport(results) {
  const { run, cases } = results;
  const { passed, failed, blocked } = summarise(cases);

  const now = new Date();
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const lines = [];
  lines.push(`# QA Report — ${run?.title ?? 'run'} — ${stamp}`);
  lines.push('');
  lines.push(`**Target:** ${run?.baseUrl ?? '(unknown)'}`);
  lines.push(`**Instruction:** "${run?.instruction ?? ''}"`);
  lines.push(
    `**Summary:** ${passed} passed · ${failed} failed · ${blocked} blocked (pending confirmation)`
  );
  lines.push('');

  const blockedCases = cases.filter((c) => c.status === 'blocked');
  if (blockedCases.length > 0) {
    lines.push('## Blocked pending confirmation');
    lines.push('');
    lines.push(
      'These actions were detected as destructive and were not sent — see each case below for the full reason.'
    );
    lines.push('');
    for (const c of blockedCases) {
      const method = c.evidence?.request?.method ?? '?';
      const url = c.evidence?.request?.url ?? '?';
      lines.push(`- ${method} ${url} — ${c.blockedReason ?? 'declined'}`);
    }
    lines.push('');
  }

  // Rendered in results.cases order, including blocked cases in full detail,
  // so the developer sees the reason twice: once as a quick-scan summary
  // above, once with full detail here at the case's original run position.
  cases.forEach((caseObj, i) => {
    lines.push(renderCase(caseObj, i + 1, run));
    lines.push('');
  });

  return lines.join('\n').trimEnd() + '\n';
}

/**
 * Returns a short chat-delivery summary (at most 15 lines regardless of case
 * count): the run title, the counts line, up to 5 failed-case lines and up
 * to 5 blocked-case lines (each with a remainder count beyond 5), and the
 * absolute path to the Markdown report (D-07's two-way delivery).
 */
export function chatSummary(results, reportPath) {
  const { run, cases } = results;
  const { passed, failed, blocked } = summarise(cases);

  const lines = [];
  lines.push(`QA Report — ${run?.title ?? 'run'}`);
  lines.push(`${passed} passed · ${failed} failed · ${blocked} blocked (pending confirmation)`);

  const failedCases = cases.filter((c) => c.status === 'failed');
  const blockedCases = cases.filter((c) => c.status === 'blocked');

  for (const c of failedCases.slice(0, 5)) {
    lines.push(`FAILED  ${c.evidence?.request?.method ?? '?'} ${c.evidence?.request?.url ?? '?'}`);
  }
  if (failedCases.length > 5) {
    lines.push(`...and ${failedCases.length - 5} more failed`);
  }

  for (const c of blockedCases.slice(0, 5)) {
    lines.push(`BLOCKED ${c.evidence?.request?.method ?? '?'} ${c.evidence?.request?.url ?? '?'}`);
  }
  if (blockedCases.length > 5) {
    lines.push(`...and ${blockedCases.length - 5} more blocked`);
  }

  lines.push(`Report: ${resolve(reportPath)}`);

  return lines.join('\n');
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
  const outDir = resolve(args['out-dir']);
  const title = args.title ?? 'report';

  const raw = readFileSync(resultsPath, 'utf8');
  const results = JSON.parse(raw);

  let markdown;
  try {
    markdown = renderReport(results);
  } catch (err) {
    if (err instanceof EvidenceMissingError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(5);
    }
    throw err;
  }

  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  const gitignorePath = resolve(outDir, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, '*\n');
  }

  const filename = reportFileName(title);
  const reportPath = resolve(outDir, filename);
  writeFileSync(reportPath, markdown);

  const stem = filename.replace(/\.md$/, '');
  const copyPath = resolve(outDir, `${stem}.results.json`);
  copyFileSync(resultsPath, copyPath);

  // Printed to stdout so the Bash tool's own output carries the summary the
  // orchestrator restates in chat (D-07's two-way delivery).
  process.stdout.write(`${chatSummary(results, reportPath)}\n`);
  process.exit(0);
}

// See api-client.mjs for why this resolves realpaths before comparing —
// a plain URL/string comparison breaks under the documented symlink/junction
// install method (README "Installation").
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
