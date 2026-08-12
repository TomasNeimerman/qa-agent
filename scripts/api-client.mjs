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
//   4 = target unreachable / request-level failure (including a failed
//       preflight reachability probe)
//   5 = evidence missing (reserved for scripts/format-report.mjs)
//   6 = production-looking target refused (see looksLikeProduction) —
//       --allow-non-local unlocks it, this is a stop-and-ask, not a ban
//
// CLI startup check order (documented once, here, since the order itself is
// the guarantee): 1) confirmation gate — nothing is sent and no credential
// is read for an unconfirmed/declined destructive call; 2) production-target
// check — refuses a production-looking host before the token is even read;
// 3) readConfig — resolves QA_AGENT_BASE_URL and an auth mechanism (a
// QA_AGENT_TOKEN bearer token, a --storage-state path from a prior UI login,
// or both — see API-03), loud failure (exit 2) if the base URL is missing or
// no auth mechanism at all is present; storage-state path resolution happens
// inside this same step, so it still sits behind the confirmation gate;
// 4) preflight — a single reachability probe against the resolved base URL;
// 5) dispatch — runCase actually sends the request. Widening the method set
// or adding new checks later must preserve this order, not add a bypass
// around any earlier step.

import { basename, dirname, resolve } from 'node:path';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { request } from 'playwright';
import { z } from 'zod';
import { previewOf, requiresConfirmation } from './destructive.mjs';

export const RESULTS_SCHEMA_VERSION = 1;

export class ConfigError extends Error {}

// Explicit dispatch map — the only way a method string reaches the
// Playwright context. A typo or an unrecognised method (e.g. "PURGE") must
// never become a dynamic property lookup on the context (T-01-20); it must
// throw before any network activity instead.
export const DISPATCH = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
  HEAD: 'head',
};

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
export function readConfig({ baseUrlArg, projectRoot, storageStatePath } = {}) {
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

  // A mistyped --storage-state path must never silently degrade into an
  // unauthenticated request (RESEARCH Pitfall 4, T-02-05) — checked before
  // the auth-mechanism check below so a typo is named specifically, even
  // when a QA_AGENT_TOKEN is also present.
  if (storageStatePath && !existsSync(storageStatePath)) {
    throw new ConfigError(
      `--storage-state points at a file that does not exist: ${storageStatePath} — check the path from the prior UI login, or omit the flag to run without a UI session`
    );
  }

  const token = process.env.QA_AGENT_TOKEN;
  // A Phase 2 UI-driven run has no QA_AGENT_TOKEN at all but does have a
  // valid storageStatePath from a prior UI login (API-03) — that is not a
  // missing-auth condition. Throw only when neither mechanism is present.
  // The message keeps Phase 1's literal "QA_AGENT_TOKEN is not configured"
  // phrasing (relied on by 01-04's tracer.e2e.test.mjs) while also naming
  // --storage-state as the second, equally valid mechanism.
  if (!token && !storageStatePath) {
    throw new ConfigError(
      "QA_AGENT_TOKEN is not configured, and no --storage-state path was given — export " +
        "QA_AGENT_TOKEN in the shell that launched Claude Code (or set it in the target " +
        "project's .env.local), or pass --storage-state <path> from a prior UI login (API-03)."
    );
  }

  return { baseUrl, token, storageStatePath };
}

const NON_PROD_KEYWORDS = ['staging', 'stage', 'dev', 'test', 'qa', 'preview', 'sandbox'];
const NON_PROD_SUFFIXES = ['.local', '.localhost', 'vercel.app', 'netlify.app'];

function isPrivateIPv4(hostname) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/**
 * Returns true when `baseUrl`'s hostname does not look like localhost, a
 * private-range IPv4 address, or a named non-production environment
 * (staging/stage/dev/test/qa/preview/sandbox anywhere in the hostname, or a
 * `.local`/`.localhost`/`vercel.app`/`netlify.app` suffix). An unparseable
 * base URL, and any other unrecognised public hostname, is treated as
 * production — per the project's PITFALLS rule that the default target must
 * never be production, the safe default under uncertainty is to stop and
 * ask (T-01-16), not to silently proceed.
 */
export function looksLikeProduction(baseUrl) {
  let hostname;
  try {
    hostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return true;
  }

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost')
  ) {
    return false;
  }

  if (isPrivateIPv4(hostname)) return false;
  if (NON_PROD_KEYWORDS.some((kw) => hostname.includes(kw))) return false;
  if (NON_PROD_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return false;

  return true;
}

/**
 * Issues a single lightweight reachability probe against `baseUrl`'s root —
 * HEAD first, falling back to GET when the server rejects HEAD (405/501) or
 * a transport error occurs — with a short timeout. Resolves on ANY HTTP
 * response, including 4xx: this answers "is something listening and
 * speaking HTTP", not "is the app healthy". Rejects with a "target
 * unreachable" error naming `baseUrl` on a transport failure, so a down
 * target fails the whole run fast (exit 4) instead of producing a report
 * full of misleading per-case failures (RESEARCH Environment Availability).
 */
export async function preflight(baseUrl, token, storageStatePath) {
  const context = await request.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    storageState: storageStatePath ?? undefined,
    timeout: 5000,
  });

  try {
    let response;
    try {
      response = await context.head('/');
      if (response.status() === 405 || response.status() === 501) {
        response = await context.get('/');
      }
    } catch {
      try {
        response = await context.get('/');
      } catch (getErr) {
        const wrapped = new Error(`target unreachable: ${baseUrl} — ${getErr.message}`);
        wrapped.cause = getErr;
        throw wrapped;
      }
    }
    return response;
  } finally {
    await context.dispose();
  }
}

/**
 * Builds a loose zod schema for "shape observed" validation (D-05, D-10).
 * With no field names, returns `z.unknown()` — with no specification to be
 * strict against, there is nothing to check beyond JSON-parseability. With
 * names, returns an object schema requiring exactly those fields (each typed
 * `z.unknown()`, so the field's own value is never judged) while tolerating
 * any other unnamed key — zod object schemas ignore unrecognised keys by
 * default, and Phase 1 has no OpenAPI/Postman source to be strict against
 * (RESEARCH pitfall 4). Never call `.strict()` here: an extra key the
 * developer never mentioned must never fail this check. This is a hint
 * inferred from one observed response, not ground truth — the report labels
 * every check built from this schema "shape observed", never "contract
 * validated".
 */
export function buildShapeSchema(fieldNames = []) {
  if (!fieldNames || fieldNames.length === 0) {
    return z.unknown();
  }
  const shape = Object.fromEntries(fieldNames.map((name) => [name, z.unknown()]));
  return z.object(shape);
}

/**
 * Composes a one-line verdict sentence strictly from the check objects —
 * naming the method, URL, status, and (on failure) the first failed check —
 * never free-authored narrative.
 */
function composeVerdict({ method, url, status, checks }) {
  const allPassed = checks.every((c) => c.passed);
  if (allPassed) {
    return `PASSED — ${method} ${url} responded ${status}`;
  }
  const firstFailed = checks.find((c) => !c.passed);
  return (
    `FAILED — ${method} ${url} responded ${status}; ` +
    `${firstFailed.name} failed (expected ${JSON.stringify(firstFailed.expected)}, ` +
    `got ${JSON.stringify(firstFailed.actual)})`
  );
}

/**
 * Dispatches a single deterministic HTTP call via Playwright's APIRequestContext,
 * captures full request+response evidence (headers redacted), and returns the
 * case object shaped per the results.json contract.
 */
export async function runCase({
  method,
  url,
  title,
  body,
  baseUrl,
  token,
  storageStatePath,
  expectStatus,
  expectFields,
}) {
  const m = String(method ?? '').toUpperCase();
  const dispatchKey = DISPATCH[m];
  if (!dispatchKey) {
    throw new Error(`Unsupported HTTP method: ${m}`);
  }

  const absoluteUrl = new URL(url, baseUrl).toString();
  const requestHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const authMechanism = token && storageStatePath ? 'both' : token ? 'bearer' : storageStatePath ? 'storageState' : 'none';

  const context = await request.newContext({
    baseURL: baseUrl,
    extraHTTPHeaders: requestHeaders,
    storageState: storageStatePath ?? undefined,
  });

  try {
    const startedAt = Date.now();
    let response;
    try {
      const options = body !== undefined && body !== null ? { data: body } : undefined;
      response = await context[dispatchKey](url, options);
    } catch (err) {
      const wrapped = new Error(`target unreachable: ${absoluteUrl} — ${err.message}`);
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

    const fieldNames = Array.isArray(expectFields) ? expectFields.filter(Boolean) : [];
    if (fieldNames.length > 0) {
      const result = buildShapeSchema(fieldNames).safeParse(parsedBody);
      const actual = result.success
        ? 'all present'
        : result.error.issues.map((issue) => issue.path.join('.')).join(', ') || 'shape mismatch';
      checks.push({
        name: `fields present: ${fieldNames.join(', ')}`,
        kind: 'shape-observed',
        expected: fieldNames,
        actual,
        passed: result.success,
      });
    }

    const allPassed = checks.every((c) => c.passed);

    let verdict = composeVerdict({ method: m, url: absoluteUrl, status, checks });
    if (status === 401 || status === 403) {
      verdict +=
        ` Note: repeated ${status} responses across cases usually indicate a ` +
        'QA_AGENT_TOKEN problem rather than an application defect.';
    }

    const caseObj = {
      id: `case-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title ?? `${m} ${url}`,
      status: allPassed ? 'passed' : 'failed',
      evidence: {
        request: {
          method: m,
          url: absoluteUrl,
          headers: redactHeaders(requestHeaders),
          body: body ?? null,
          auth: {
            mechanism: authMechanism,
            storageStateFile: storageStatePath ? basename(storageStatePath) : null,
          },
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
      verdict,
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
  const expectStatus = args['expect-status'] !== undefined ? Number(args['expect-status']) : undefined;
  const expectFields =
    typeof args['expect-fields'] === 'string'
      ? args['expect-fields']
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  const resultsPath = args.results ? resolve(args.results) : resolve(projectRoot, 'results.json');
  const confirmed = Boolean(args.confirmed);
  const declined = Boolean(args.declined);
  const readOnlyIntent = Boolean(args['read-only-intent']);
  const blockedReasonArg = typeof args['blocked-reason'] === 'string' ? args['blocked-reason'] : undefined;
  const allowNonLocal = Boolean(args['allow-non-local']);
  const baseUrlForPreview = args['base-url'] ?? process.env.QA_AGENT_BASE_URL;
  const storageStateArg =
    typeof args['storage-state'] === 'string' ? resolve(args['storage-state']) : undefined;

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

  // Production-target check (T-01-16, T-01-17): evaluated before readConfig
  // resolves the token, so a refused target never causes the credential to
  // even be read. Only checked when a base URL is actually known — a
  // missing base URL falls through to readConfig's own "not configured"
  // error instead of crashing here.
  if (baseUrlForPreview && looksLikeProduction(baseUrlForPreview) && !allowNonLocal) {
    process.stderr.write(
      `Refusing to run against ${baseUrlForPreview} — it looks like a production target. ` +
        `Pass --allow-non-local to proceed.\n`
    );
    process.exit(6);
    return;
  }

  let config;
  try {
    config = readConfig({
      baseUrlArg: args['base-url'],
      projectRoot,
      storageStatePath: storageStateArg,
    });
  } catch (err) {
    if (err instanceof ConfigError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(2);
    }
    throw err;
  }

  try {
    await preflight(config.baseUrl, config.token, config.storageStatePath);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(4);
    return;
  }

  let caseObj;
  try {
    caseObj = await runCase({
      method,
      url,
      title,
      body,
      baseUrl: config.baseUrl,
      storageStatePath: config.storageStatePath,
      token: config.token,
      expectStatus,
      expectFields,
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

// Resolve both sides through realpathSync before comparing — a plain URL/string
// comparison breaks when the skill is invoked through a symlink or Windows
// junction (the documented install method, README "Installation"), because
// Node resolves import.meta.url to the link's real target while
// process.argv[1] keeps the literal invoked path.
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
