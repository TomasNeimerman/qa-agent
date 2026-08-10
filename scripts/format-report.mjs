// scripts/format-report.mjs
// Reporting tier: reads results.json (never the conversation transcript) and
// renders a Markdown report. Refuses to render any passed/failed case that is
// missing response evidence — this is SAFE-03's technical enforcement.

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
  if (typeof body === 'string') return '`' + body + '`';
  return '`' + JSON.stringify(body) + '`';
}

/**
 * Renders a single case section. Throws EvidenceMissingError if the case's
 * status is passed/failed but evidence.response is null or absent — no
 * verdict may be rendered without the evidence that backs it (SAFE-03).
 */
export function renderCase(caseObj, index) {
  const { id, title, status, evidence, verdict, blockedReason } = caseObj;
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
  lines.push('**Request:**');
  lines.push(`- Method: \`${method}\``);
  lines.push(`- URL: \`${url}\``);
  lines.push(`- Headers: ${renderHeaders(evidence?.request?.headers)}`);
  lines.push(`- Body: ${renderBody(evidence?.request?.body)}`);
  lines.push('');

  if (evidence?.response) {
    lines.push('**Response:**');
    lines.push(`- Status: \`${evidence.response.status}\``);
    lines.push(`- Body: ${renderBody(evidence.response.body)}`);
    lines.push('');
  } else if (status === 'blocked') {
    lines.push(`**Status:** Destructive action detected. ${blockedReason ?? 'Case skipped, no request was sent.'}`);
    lines.push('');
  }

  lines.push(`**Verdict:** ${verdict ?? statusLabel}`);
  lines.push('');
  lines.push('---');

  return lines.join('\n');
}

/**
 * Renders the full Markdown report from a results.json-shaped object.
 */
export function renderReport(results) {
  const { run, cases } = results;
  const passed = cases.filter((c) => c.status === 'passed').length;
  const failed = cases.filter((c) => c.status === 'failed').length;
  const blocked = cases.filter((c) => c.status === 'blocked').length;

  const now = new Date();
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const lines = [];
  lines.push(`# QA Report — ${run?.title ?? 'run'} — ${stamp}`);
  lines.push('');
  lines.push(`**Target:** ${run?.baseUrl ?? '(unknown)'}`);
  lines.push(`**Instruction:** "${run?.instruction ?? ''}"`);
  lines.push(`**Summary:** ${passed} passed · ${failed} failed · ${blocked} blocked`);
  lines.push('');

  cases.forEach((caseObj, i) => {
    lines.push(renderCase(caseObj, i + 1));
    lines.push('');
  });

  return lines.join('\n').trimEnd() + '\n';
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

  const passed = results.cases.filter((c) => c.status === 'passed').length;
  const failed = results.cases.filter((c) => c.status === 'failed').length;
  const blocked = results.cases.filter((c) => c.status === 'blocked').length;

  process.stdout.write(`${reportPath}\n`);
  process.stdout.write(`${passed} passed · ${failed} failed · ${blocked} blocked\n`);
  process.exit(0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(1);
  });
}
