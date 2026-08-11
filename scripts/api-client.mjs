// scripts/api-client.mjs
// Deterministic HTTP execution + evidence capture via Playwright APIRequestContext.
// This is the ONLY tier that ever dispatches an outbound HTTP request or sees the
// plaintext auth token. Everything it returns/prints/writes has already been
// redacted (see redactHeaders) before it leaves this module.
//
// CLI exit codes:
//   0 = case recorded (a passed case, a failed case, or a declined/blocked case
//       via --declined — all are a successful run of this script)
//   2 = ConfigError (QA_AGENT_BASE_URL / QA_AGENT_TOKEN not configured)
//   3 = confirmation required, nothing sent (destructive method without
//       --confirmed — see requiresConfirmation in scripts/destructive.mjs)
//   4 = target unreachable / request-level failure

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import dotenv from 'dotenv';
import { request } from 'playwright';
import { previewOf, requiresConfirmation } from './destructive.mjs';

export const RESULTS_SCHEMA_VERSION = 1;

export class ConfigError extends Error {}

const REDACTED_HEADER_KEYS = new Set([
  'authorization',
  'cookie',
  'x-api-key',
  'proxy-authorization',
]);

/**
 * Returns a shallow copy of `headers` with the values of any credential-bearing
 * header (authorization, cookie, x-api-key, proxy-authorization — case-insensitive
 * key match) replaced by the literal string "[REDACTED]".
 */
export function redactHeaders(headers) {
  const copy = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    copy[key] = REDACTED_HEADER_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return copy;
}

/**
 * Resolves configuration for a run: the base URL and the auth token.
 * Loads `.env.local` then `.env` from `projectRoot` (each optional, non-overriding)
 * before reading process.env, per D-09 / RESEARCH Standard Stack (dotenv).
 * Throws ConfigError with a specific, actionable message when either value is
 * absent — this is D-09's "fail loudly, never send an empty Authorization header".
 */
export function readConfig({ baseUrlArg, projectRoot } = {}) {
  const root = projectRoot ?? process.cwd();

  for (const filename of ['.env.local', '.env']) {
    const path = resolve(root, filename);
    if (existsSync(path)) {
      dotenv.config({ path, override: false });
    }
  }

  const baseUrl = baseUrlArg ?? process.env.QA_AGENT_BASE_URL;
  if (!baseUrl) {
    throw new ConfigError(
      'QA_AGENT_BASE_URL is not configured — pass --base-url or export QA_AGENT_BASE_URL'
    );
  }

  const token = process.env.QA_AGENT_TOKEN;
  if (!token) {
    throw new ConfigError(
      "QA_AGENT_TOKEN is not configured — export it in the shell that launched Claude Code, or set it in the target project's .env.local"
    );
  }

  return { baseUrl, token };
}

/**
 * Dispatches a single deterministic HTTP call via Playwright's APIRequestContext,
 * captures full request+response evidence (headers redacted), and returns the
 * case object shaped per the results.json contract.
 */
export async function runCase({ method, url, title, body, baseUrl, token, expectStatus }) {
  const m = method.toUpperCase();
  const lower = m.toLowerCase();

  const requestHeaders = { Authorization: `Bearer ${token}` };

  const context = await request.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: requestHeaders,
  });

  try {
    const startedAt = Date.now();
    let response;
    try {
      const options = body !== undefined && body !== null ? { data: body } : undefined;
      if (typeof context[lower] !== 'function') {
        throw new Error(`Unsupported HTTP method: ${m}`);
      }
      response = await context[lower](url, options);
    } catch (err) {
      const wrapped = new Error(`target unreachable: ${err.message}`);
      wrapped.cause = err;
      throw wrapped;
    }
    const durationMs = Date.now() - startedAt;

    const rawText = await response.text();
    let parsedBody;
    let isJson = true;
    try {
      parsedBody = rawText.length ? JSON.parse(rawText) : rawText;
    } catch {
      isJson = false;
      parsedBody = rawText;
    }

    const status = response.status();
    const expected = expectStatus ?? '2xx';
    const statusPassed =
      expected === '2xx' ? status >= 200 && status < 300 : Number(expected) === status;

    const checks = [
      {
        name: 'status',
        kind: 'status',
        expected,
        actual: status,
        passed: statusPassed,
      },
      {
        name: 'json-parseable',
        kind: 'shape-observed',
        expected: 'valid JSON body',
        actual: isJson ? 'valid JSON' : 'non-JSON text',
        passed: isJson,
      },
    ];

    const allPassed = checks.every((c) => c.passed);

    const caseObj = {
      id: `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title ?? `${m} ${url}`,
      status: allPassed ? 'passed' : 'failed',
      evidence: {
        request: {
          method: m,
          url,
          headers: redactHeaders(requestHeaders),
          body: body ?? null,
        },
        response: {
          status,
          ok: response.ok(),
          headers: redactHeaders(response.headers()),
          body: parsedBody,
          durationMs,
        },
      },
      checks,
      verdict: allPassed
        ? `PASSED — status ${status}, response is ${isJson ? 'valid JSON' : 'non-JSON text'}`
        : `FAILED — one or more checks failed (see checks[])`,
      reproSteps: [],
      blockedReason: null,
    };

    return caseObj;
  } finally {
    await context.dispose();
  }
}

/**
 * Appends `caseObj` to the results.json at `resultsPath`, creating the file
 * (seeded with the schema envelope) and any parent directories as needed.
 */
export function appendCase(resultsPath, caseObj, runMeta = {}) {
  const dir = dirname(resultsPath);
  if (dir && !existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  let results;
  if (existsSync(resultsPath)) {
    results = JSON.parse(readFileSync(resultsPath, 'utf8'));
  } else {
    results = {
      schemaVersion: RESULTS_SCHEMA_VERSION,
      run: {
        baseUrl: runMeta.baseUrl ?? null,
        instruction: runMeta.instruction ?? null,
        title: runMeta.title ?? null,
      },
      cases: [],
    };
  }

  results.cases.push(caseObj);
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  return results;
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
  const projectRoot = args['project-root'] ?? process.cwd();

  const method = args.method ?? 'GET';
  const m = method.toUpperCase();
  const url = args.url ?? '/';
  const title = args.title;
  const body = args.body !== undefined ? JSON.parse(args.body) : undefined;
  const expectStatus = args['expect-status'];
  const resultsPath = args.results ? resolve(args.results) : resolve(projectRoot, 'results.json');
  const confirmed = Boolean(args.confirmed);
  const declined = Boolean(args.declined);
  const readOnlyIntent = Boolean(args['read-only-intent']);
  const blockedReasonArg = typeof args['blocked-reason'] === 'string' ? args['blocked-reason'] : undefined;
  const baseUrlForPreview = args['base-url'] ?? process.env.QA_AGENT_BASE_URL;

  // The destructive-action gate (D-01–D-04) is evaluated here, before
  // readConfig() resolves the auth token, so an unconfirmed/declined
  // destructive call can never even cause a credential read. This gate runs
  // on every invocation — it cannot be disabled by an env var, a config
  // file, or any flag other than the per-call --confirmed, and there is no
  // bulk/session-wide approval mechanism (D-03, RESEARCH Anti-Patterns).

  if (declined) {
    // --declined short-circuits before any network work or config read.
    const placeholderHeaders = { Authorization: 'Bearer [not sent — declined before dispatch]' };
    const caseObj = {
      id: `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title ?? `${m} ${url}`,
      status: 'blocked',
      evidence: {
        request: {
          method: m,
          url,
          headers: redactHeaders(placeholderHeaders),
          body: body ?? null,
        },
        response: null,
      },
      checks: [],
      verdict: `NOT EXECUTED — ${m} ${url} was declined; no request was sent`,
      reproSteps: [],
      blockedReason:
        blockedReasonArg ??
        'The developer declined confirmation for this destructive call — no request was sent.',
    };

    appendCase(resultsPath, caseObj, { baseUrl: baseUrlForPreview ?? null, instruction: title, title });
    process.stdout.write(`${JSON.stringify(caseObj)}\n`);
    process.exit(0);
    return;
  }

  if (requiresConfirmation(m, { looksReadOnly: readOnlyIntent }) && !confirmed) {
    const preview = previewOf({ method: m, url, baseUrl: baseUrlForPreview, body });
    const payload = {
      status: 'needs_confirmation',
      preview,
      reason: `${m} ${preview.url} is a destructive call and requires --confirmed before it can be dispatched`,
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    process.exit(3);
    return;
  }

  let config;
  try {
    config = readConfig({ baseUrlArg: args['base-url'], projectRoot });
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(2);
    }
    throw err;
  }

  let caseObj;
  try {
    caseObj = await runCase({
      method,
      url,
      title,
      body,
      baseUrl: config.baseUrl,
      token: config.token,
      expectStatus,
    });
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(4);
  }

  appendCase(resultsPath, caseObj, {
    baseUrl: config.baseUrl,
    instruction: title,
    title,
  });

  process.stdout.write(`${JSON.stringify(caseObj)}\n`);
  process.exit(0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(1);
  });
}
