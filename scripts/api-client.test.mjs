// scripts/api-client.test.mjs
// Unit + integration coverage for the full API execution engine: method
// dispatch with bodies (Task 1), status/shape validation (Task 2), and
// preflight/production-target safety (Task 3) of plan 01-04.

import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  DISPATCH,
  appendCase,
  buildShapeSchema,
  looksLikeProduction,
  preflight,
  readConfig,
  redactHeaders,
  runCase,
} from './api-client.mjs';
import { startMockServer } from './__fixtures__/mock-server.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const API_CLIENT = resolve(__dirname, 'api-client.mjs');
const MOCK_SERVER_PROCESS = resolve(__dirname, '__fixtures__/mock-server-process.mjs');
const TOKEN = 'test-token-api-client-xyz';

// `mock` is an in-process fixture — safe for direct runCase()/buildShapeSchema()
// unit calls made from this same test process. `cliMock` is a sibling OS
// process (same pattern as destructive.test.mjs / tracer.e2e.test.mjs): a CLI
// test spawns api-client.mjs as a *child* of this process, and a child
// connecting back to a socket held by its own direct parent is not
// guaranteed reachable in every sandboxed environment, whereas
// sibling-to-sibling loopback traffic is unaffected.
let mock;
let cliMockProc;
let cliMockUrl;
let tmpDir;

function startMockServerProcess(routes) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(process.execPath, [MOCK_SERVER_PROCESS, JSON.stringify(routes)], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let buf = '';
    const onData = (chunk) => {
      buf += chunk.toString();
      const match = buf.match(/READY (\S+)/);
      if (match) {
        proc.stdout.off('data', onData);
        resolvePromise({ proc, url: match[1] });
      }
    };
    proc.stdout.on('data', onData);
    proc.once('error', reject);
    setTimeout(() => reject(new Error('mock server process did not become ready in time')), 10000);
  });
}

async function cliRequestLog() {
  const res = await fetch(`${cliMockUrl}/__requests`);
  return res.json();
}

async function resetCliRequestLog() {
  await fetch(`${cliMockUrl}/__reset`, { method: 'POST' });
}

beforeAll(async () => {
  mock = await startMockServer({
    'GET /api/clients-partial': { status: 200, body: { clients: [] } },
    'GET /api/unauthorized': { status: 401, body: { error: 'unauthorized' } },
  });

  const { proc, url } = await startMockServerProcess({
    'GET /api/clients-partial': { status: 200, body: { clients: [] } },
    'GET /api/unauthorized': { status: 401, body: { error: 'unauthorized' } },
  });
  cliMockProc = proc;
  cliMockUrl = url;
});

afterAll(async () => {
  await mock.close();
  cliMockProc?.kill();
});

beforeEach(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), 'qa-agent-api-client-'));
  mock.reset();
  await resetCliRequestLog();
});

function runClient(args, { expectFailure = false, env = {} } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [API_CLIENT, ...args], {
      env: { ...process.env, QA_AGENT_TOKEN: TOKEN, ...env },
      encoding: 'utf8',
    });
    if (expectFailure) {
      throw new Error('expected api-client.mjs to exit non-zero, but it exited 0');
    }
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    if (!expectFailure) throw err;
    return { status: err.status, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? '' };
  }
}

describe('DISPATCH', () => {
  it('maps every supported method to a lower-case APIRequestContext verb', () => {
    expect(DISPATCH).toEqual({
      GET: 'get',
      POST: 'post',
      PUT: 'put',
      PATCH: 'patch',
      DELETE: 'delete',
      HEAD: 'head',
    });
  });
});

describe('runCase — method dispatch', () => {
  it('GET returns evidence.response.status 200, evidence.request.method GET, and logs one GET', async () => {
    const caseObj = await runCase({
      method: 'GET',
      url: '/api/clients',
      baseUrl: mock.url,
      token: TOKEN,
    });

    expect(caseObj.evidence.response.status).toBe(200);
    expect(caseObj.evidence.request.method).toBe('GET');
    expect(mock.requests.length).toBe(1);
    expect(mock.requests[0].method).toBe('GET');
  });

  it('POST with a body sends it as the JSON payload, echoed back and recorded', async () => {
    const payload = { name: 'Acme Corp', email: 'test@example.com' };
    const caseObj = await runCase({
      method: 'POST',
      url: '/api/clients',
      body: payload,
      baseUrl: mock.url,
      token: TOKEN,
    });

    expect(caseObj.evidence.response.body).toEqual(payload);
    expect(caseObj.evidence.request.body).toEqual(payload);
    expect(mock.requests.length).toBe(1);
    expect(mock.requests[0].method).toBe('POST');
  });

  it('PUT with a body behaves the same way and the server log records a PUT', async () => {
    const payload = { name: 'Updated Corp' };
    const caseObj = await runCase({
      method: 'PUT',
      url: '/api/clients',
      body: payload,
      baseUrl: mock.url,
      token: TOKEN,
    });

    expect(caseObj.evidence.response.body).toEqual(payload);
    expect(caseObj.evidence.request.body).toEqual(payload);
    expect(mock.requests[0].method).toBe('PUT');
  });

  it('DELETE against a 204 route produces status 204 and an empty-string body, not a crash', async () => {
    const caseObj = await runCase({
      method: 'DELETE',
      url: '/api/clients/1',
      baseUrl: mock.url,
      token: TOKEN,
    });

    expect(caseObj.evidence.response.status).toBe(204);
    expect(caseObj.evidence.response.body).toBe('');
  });

  it('PATCH is dispatched as PATCH', async () => {
    const caseObj = await runCase({
      method: 'PATCH',
      url: '/api/clients',
      body: { name: 'Patched' },
      baseUrl: mock.url,
      token: TOKEN,
    });

    expect(caseObj.evidence.request.method).toBe('PATCH');
    expect(mock.requests[0].method).toBe('PATCH');
  });

  it('an unsupported method throws an error naming the method, before any network call', async () => {
    await expect(
      runCase({ method: 'PURGE', url: '/api/clients', baseUrl: mock.url, token: TOKEN })
    ).rejects.toThrow(/PURGE/);
    expect(mock.requests.length).toBe(0);
  });

  it('a 404 with a JSON error body is a recorded failed verdict, never a thrown exception', async () => {
    const caseObj = await runCase({
      method: 'GET',
      url: '/api/missing',
      baseUrl: mock.url,
      token: TOKEN,
    });

    expect(caseObj.status).toBe('failed');
    expect(caseObj.evidence.response.status).toBe(404);
    expect(caseObj.evidence.response.body).toEqual({ error: 'not found' });
  });
});

describe('runCase — baseURL behaviour (EXEC-04)', () => {
  it('hits the mock when baseUrl is the mock origin', async () => {
    const caseObj = await runCase({
      method: 'GET',
      url: '/api/clients',
      baseUrl: mock.url,
      token: TOKEN,
    });
    expect(caseObj.evidence.response.status).toBe(200);
  });

  it('resolves evidence.request.url against a different host string without needing that host to exist', async () => {
    // 127.0.0.1:1 is a closed, privileged port on any normal machine — the
    // dispatch fails fast (connection refused) with no DNS round trip, but
    // the resolved absolute URL is still recorded on the thrown error's
    // message, proving the baseUrl argument (not the mock's own baseUrl)
    // drove the resolution.
    const otherBaseUrl = 'http://127.0.0.1:1';
    await expect(
      runCase({ method: 'GET', url: '/api/clients', baseUrl: otherBaseUrl, token: TOKEN })
    ).rejects.toThrow(new RegExp(`${otherBaseUrl}/api/clients`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

describe('readConfig — baseUrlArg vs QA_AGENT_BASE_URL (D-09)', () => {
  const ORIGINAL_ENV = process.env.QA_AGENT_BASE_URL;
  const ORIGINAL_TOKEN = process.env.QA_AGENT_TOKEN;

  beforeEach(() => {
    process.env.QA_AGENT_BASE_URL = 'http://env-base.example.invalid';
    process.env.QA_AGENT_TOKEN = TOKEN;
  });

  afterAll(() => {
    if (ORIGINAL_ENV === undefined) delete process.env.QA_AGENT_BASE_URL;
    else process.env.QA_AGENT_BASE_URL = ORIGINAL_ENV;
    if (ORIGINAL_TOKEN === undefined) delete process.env.QA_AGENT_TOKEN;
    else process.env.QA_AGENT_TOKEN = ORIGINAL_TOKEN;
  });

  it('resolves to the environment value when no baseUrlArg is given', () => {
    const config = readConfig({ baseUrlArg: undefined, projectRoot: tmpDir });
    expect(config.baseUrl).toBe('http://env-base.example.invalid');
  });

  it('resolves to the explicit argument when both are set — the argument wins', () => {
    const config = readConfig({ baseUrlArg: 'http://explicit:1234', projectRoot: tmpDir });
    expect(config.baseUrl).toBe('http://explicit:1234');
  });
});

describe('readConfig — auth-mechanism coverage (API-03, RESEARCH Pitfall 4)', () => {
  const ORIGINAL_TOKEN = process.env.QA_AGENT_TOKEN;

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.QA_AGENT_TOKEN;
    else process.env.QA_AGENT_TOKEN = ORIGINAL_TOKEN;
  });

  it('with a token and no storageStatePath, behaves exactly as before', () => {
    process.env.QA_AGENT_TOKEN = TOKEN;
    const config = readConfig({ baseUrlArg: 'http://example.invalid', projectRoot: tmpDir });
    expect(config.token).toBe(TOKEN);
    expect(config.storageStatePath).toBeUndefined();
  });

  it('with a storageStatePath pointing at a real file and no QA_AGENT_TOKEN, returns without throwing', () => {
    delete process.env.QA_AGENT_TOKEN;
    const storageStatePath = join(tmpDir, 'real-storage-state.json');
    writeFileSync(storageStatePath, JSON.stringify({ cookies: [], origins: [] }));

    const config = readConfig({
      baseUrlArg: 'http://example.invalid',
      projectRoot: tmpDir,
      storageStatePath,
    });
    expect(config.token).toBeUndefined();
    expect(config.storageStatePath).toBe(storageStatePath);
  });

  it('with neither a token nor a storageStatePath, throws ConfigError naming both QA_AGENT_TOKEN and --storage-state', () => {
    delete process.env.QA_AGENT_TOKEN;
    let threw = false;
    try {
      readConfig({ baseUrlArg: 'http://example.invalid', projectRoot: tmpDir });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('QA_AGENT_TOKEN');
      expect(err.message).toContain('--storage-state');
    }
    expect(threw).toBe(true);
  });

  it('with a storageStatePath pointing at a file that does not exist, throws ConfigError naming that path', () => {
    process.env.QA_AGENT_TOKEN = TOKEN;
    const missingPath = join(tmpDir, 'does-not-exist-storage-state.json');

    let threw = false;
    try {
      readConfig({ baseUrlArg: 'http://example.invalid', projectRoot: tmpDir, storageStatePath: missingPath });
    } catch (err) {
      threw = true;
      expect(err.message).toContain(missingPath);
    }
    expect(threw).toBe(true);
  });
});

describe('readConfig — secondary credential (D-01)', () => {
  const ORIGINAL_TOKEN = process.env.QA_AGENT_TOKEN;
  const ORIGINAL_SECONDARY = process.env.QA_AGENT_TOKEN_SECONDARY;
  const SECONDARY_TOKEN = 'test-token-secondary-xyz';

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.QA_AGENT_TOKEN;
    else process.env.QA_AGENT_TOKEN = ORIGINAL_TOKEN;
    if (ORIGINAL_SECONDARY === undefined) delete process.env.QA_AGENT_TOKEN_SECONDARY;
    else process.env.QA_AGENT_TOKEN_SECONDARY = ORIGINAL_SECONDARY;
  });

  it('with useSecondary true and both tokens set, resolves the secondary value as token — never the primary', () => {
    process.env.QA_AGENT_TOKEN = TOKEN;
    process.env.QA_AGENT_TOKEN_SECONDARY = SECONDARY_TOKEN;

    const config = readConfig({ baseUrlArg: 'http://example.invalid', projectRoot: tmpDir, useSecondary: true });
    expect(config.token).toBe(SECONDARY_TOKEN);
    expect(config.token).not.toBe(TOKEN);
  });

  it('with useSecondary true and QA_AGENT_TOKEN_SECONDARY unset, throws ConfigError naming the variable and the flag — never falls back to the primary token', () => {
    process.env.QA_AGENT_TOKEN = TOKEN;
    delete process.env.QA_AGENT_TOKEN_SECONDARY;

    let threw = false;
    try {
      readConfig({ baseUrlArg: 'http://example.invalid', projectRoot: tmpDir, useSecondary: true });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('QA_AGENT_TOKEN_SECONDARY');
      expect(err.message).toContain('--secondary');
    }
    expect(threw).toBe(true);
  });

  it('with useSecondary true and a storageStatePath pointing at a real file, throws ConfigError naming both flags regardless of which tokens are set', () => {
    process.env.QA_AGENT_TOKEN = TOKEN;
    process.env.QA_AGENT_TOKEN_SECONDARY = SECONDARY_TOKEN;
    const storageStatePath = join(tmpDir, 'secondary-conflict-storage-state.json');
    writeFileSync(storageStatePath, JSON.stringify({ cookies: [], origins: [] }));

    let threw = false;
    try {
      readConfig({ baseUrlArg: 'http://example.invalid', projectRoot: tmpDir, useSecondary: true, storageStatePath });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('--secondary');
      expect(err.message).toContain('--storage-state');
    }
    expect(threw).toBe(true);
  });

  it('with useSecondary true and a storageStatePath that does not exist, throws the two-identities ConfigError, not the mistyped-path one — the contradiction is named first', () => {
    delete process.env.QA_AGENT_TOKEN;
    delete process.env.QA_AGENT_TOKEN_SECONDARY;
    const missingPath = join(tmpDir, 'does-not-exist-secondary-storage-state.json');

    let threw = false;
    try {
      readConfig({
        baseUrlArg: 'http://example.invalid',
        projectRoot: tmpDir,
        useSecondary: true,
        storageStatePath: missingPath,
      });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('--secondary');
      expect(err.message).toContain('--storage-state');
      expect(err.message).not.toContain(missingPath);
    }
    expect(threw).toBe(true);
  });

  it('with useSecondary omitted or false, the primary path is byte-identical to before: reads QA_AGENT_TOKEN and its absent-credential message still contains the literal scripts/tracer.e2e.test.mjs pins', () => {
    process.env.QA_AGENT_TOKEN = TOKEN;
    delete process.env.QA_AGENT_TOKEN_SECONDARY;
    const config = readConfig({ baseUrlArg: 'http://example.invalid', projectRoot: tmpDir });
    expect(config.token).toBe(TOKEN);

    delete process.env.QA_AGENT_TOKEN;
    let threw = false;
    try {
      readConfig({ baseUrlArg: 'http://example.invalid', projectRoot: tmpDir });
    } catch (err) {
      threw = true;
      expect(err.message).toContain('QA_AGENT_TOKEN is not configured');
    }
    expect(threw).toBe(true);
  });

  it('returns useSecondary on the result object alongside baseUrl, token and storageStatePath', () => {
    process.env.QA_AGENT_TOKEN = TOKEN;
    process.env.QA_AGENT_TOKEN_SECONDARY = SECONDARY_TOKEN;

    const primary = readConfig({ baseUrlArg: 'http://example.invalid', projectRoot: tmpDir });
    expect(primary.useSecondary).toBe(false);

    const secondary = readConfig({ baseUrlArg: 'http://example.invalid', projectRoot: tmpDir, useSecondary: true });
    expect(secondary.useSecondary).toBe(true);
  });

  it('CLI: --secondary with QA_AGENT_TOKEN_SECONDARY absent from the environment exits 2, names the variable in stderr, and sends no request', async () => {
    const resultsPath = join(tmpDir, 'results.json');
    const env = { ...process.env, QA_AGENT_TOKEN: TOKEN };
    delete env.QA_AGENT_TOKEN_SECONDARY;

    let threw = false;
    try {
      execFileSync(
        process.execPath,
        [API_CLIENT, '--method', 'GET', '--url', '/api/clients', '--base-url', cliMockUrl, '--secondary', '--results', resultsPath],
        { env, encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      expect(err.status).toBe(2);
      expect(err.stderr.toString()).toContain('QA_AGENT_TOKEN_SECONDARY');
    }
    expect(threw).toBe(true);

    const log = await cliRequestLog();
    expect(log.length).toBe(0);
  });

  it('CLI: --secondary --storage-state <path> exits 2 with the two-identities message naming both flags, and sends no request', async () => {
    const resultsPath = join(tmpDir, 'results.json');
    const storageStatePath = join(tmpDir, 'cli-secondary-storage-state.json');
    writeFileSync(storageStatePath, JSON.stringify({ cookies: [], origins: [] }));

    let threw = false;
    try {
      execFileSync(
        process.execPath,
        [
          API_CLIENT,
          '--method',
          'GET',
          '--url',
          '/api/clients',
          '--base-url',
          cliMockUrl,
          '--secondary',
          '--storage-state',
          storageStatePath,
          '--results',
          resultsPath,
        ],
        { env: { ...process.env, QA_AGENT_TOKEN: TOKEN }, encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      expect(err.status).toBe(2);
      expect(err.stderr.toString()).toContain('--secondary');
      expect(err.stderr.toString()).toContain('--storage-state');
    }
    expect(threw).toBe(true);

    const log = await cliRequestLog();
    expect(log.length).toBe(0);
  });

  it('CLI: DELETE --secondary without --confirmed still exits 3 and reads no credential at all — the confirmation gate still runs first', async () => {
    const resultsPath = join(tmpDir, 'results.json');
    const env = { ...process.env };
    delete env.QA_AGENT_TOKEN_SECONDARY;

    const { status } = runClient(
      ['--method', 'DELETE', '--url', '/api/clients/1', '--base-url', cliMockUrl, '--secondary', '--results', resultsPath],
      { expectFailure: true, env }
    );

    expect(status).toBe(3);
    const log = await cliRequestLog();
    expect(log.length).toBe(0);
  });
});

describe('runCase — evidence.request.auth mechanism (API-03)', () => {
  it('records mechanism "bearer" with a token and no storageStatePath', async () => {
    const caseObj = await runCase({ method: 'GET', url: '/api/clients', baseUrl: mock.url, token: TOKEN });
    expect(caseObj.evidence.request.auth).toEqual({ mechanism: 'bearer', storageStateFile: null });
  });

  it('records mechanism "storageState" with only a storageStatePath, and storageStateFile as the basename only', async () => {
    const storageStatePath = join(tmpDir, 'auth-mechanism-storage-state.json');
    writeFileSync(storageStatePath, JSON.stringify({ cookies: [], origins: [] }));

    const caseObj = await runCase({
      method: 'GET',
      url: '/api/clients',
      baseUrl: mock.url,
      storageStatePath,
    });
    expect(caseObj.evidence.request.auth.mechanism).toBe('storageState');
    expect(caseObj.evidence.request.auth.storageStateFile).toBe('auth-mechanism-storage-state.json');
    expect(JSON.stringify(caseObj)).not.toContain(tmpDir.replace(/\\/g, '\\\\'));
  });

  it('records mechanism "both" when a token and a storageStatePath are both present', async () => {
    const storageStatePath = join(tmpDir, 'both-mechanism-storage-state.json');
    writeFileSync(storageStatePath, JSON.stringify({ cookies: [], origins: [] }));

    const caseObj = await runCase({
      method: 'GET',
      url: '/api/clients',
      baseUrl: mock.url,
      token: TOKEN,
      storageStatePath,
    });
    expect(caseObj.evidence.request.auth.mechanism).toBe('both');
  });

  it('no case object anywhere in a results file contains any cookie value from the storage-state file', async () => {
    const storageStatePath = join(tmpDir, 'cookie-secrecy-storage-state.json');
    const secretCookieValue = 'super-secret-session-token-value';
    writeFileSync(
      storageStatePath,
      JSON.stringify({
        cookies: [
          {
            name: 'qa_session',
            value: secretCookieValue,
            domain: '127.0.0.1',
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: false,
            sameSite: 'Lax',
          },
        ],
        origins: [],
      })
    );

    const caseObj = await runCase({
      method: 'GET',
      url: '/api/clients',
      baseUrl: mock.url,
      storageStatePath,
    });

    const resultsPath = join(tmpDir, 'cookie-secrecy-results.json');
    appendCase(resultsPath, caseObj, { baseUrl: mock.url });
    const resultsRaw = readFileSync(resultsPath, 'utf8');
    expect(resultsRaw).not.toContain(secretCookieValue);
  });
});

describe('redactHeaders', () => {
  it('redacts every credential-bearing header, including inbound set-cookie (CR-1, 02-REVIEW.md)', () => {
    const redacted = redactHeaders({
      authorization: 'Bearer secret-token',
      cookie: 'session=abc123',
      'set-cookie': 'session=rotated-value; HttpOnly',
      'x-api-key': 'key-xyz',
      'proxy-authorization': 'Basic secret',
      'content-type': 'application/json',
    });
    expect(redacted.authorization).toBe('[REDACTED]');
    expect(redacted.cookie).toBe('[REDACTED]');
    expect(redacted['set-cookie']).toBe('[REDACTED]');
    expect(redacted['x-api-key']).toBe('[REDACTED]');
    expect(redacted['proxy-authorization']).toBe('[REDACTED]');
    expect(redacted['content-type']).toBe('application/json');
  });

  it('matches header keys case-insensitively', () => {
    const redacted = redactHeaders({ 'Set-Cookie': 'session=abc123' });
    expect(redacted['Set-Cookie']).toBe('[REDACTED]');
  });
});

describe('buildShapeSchema', () => {
  it('with no field names, succeeds for any JSON value — nothing beyond parseability to observe', () => {
    const schema = buildShapeSchema([]);
    expect(schema.safeParse({ anything: 1 }).success).toBe(true);
    expect(schema.safeParse([1, 2, 3]).success).toBe(true);
    expect(schema.safeParse('a string').success).toBe(true);
    expect(schema.safeParse(null).success).toBe(true);
  });

  it('with named fields, succeeds when unnamed extra keys are present — extras never fail the check', () => {
    const schema = buildShapeSchema(['clients', 'total']);
    const result = schema.safeParse({ clients: [], total: 0, extra: 1 });
    expect(result.success).toBe(true);
  });

  it('with named fields, fails when a named field is missing, and names it in the error', () => {
    const schema = buildShapeSchema(['clients', 'total']);
    const result = schema.safeParse({ clients: [] });
    expect(result.success).toBe(false);
    const paths = result.error.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('total');
  });

  it('uses safeParse semantics — a mismatch never throws', () => {
    const schema = buildShapeSchema(['total']);
    expect(() => schema.safeParse({})).not.toThrow();
  });
});

describe('runCase — status expectations', () => {
  it('expectStatus 201 against a 200 route fails with a status check naming expected/actual', async () => {
    const caseObj = await runCase({
      method: 'GET',
      url: '/api/clients',
      baseUrl: mock.url,
      token: TOKEN,
      expectStatus: 201,
    });

    expect(caseObj.status).toBe('failed');
    const statusCheck = caseObj.checks.find((c) => c.name === 'status');
    expect(statusCheck).toMatchObject({ expected: 201, actual: 200, passed: false });
  });

  it('no expectStatus against a 200 route passes with expected "2xx"; against a 500 route it fails', async () => {
    const okCase = await runCase({ method: 'GET', url: '/api/clients', baseUrl: mock.url, token: TOKEN });
    const okCheck = okCase.checks.find((c) => c.name === 'status');
    expect(okCheck).toMatchObject({ expected: '2xx', passed: true });

    const boomCase = await runCase({ method: 'GET', url: '/api/boom', baseUrl: mock.url, token: TOKEN });
    const boomCheck = boomCase.checks.find((c) => c.name === 'status');
    expect(boomCheck).toMatchObject({ expected: '2xx', passed: false });
  });
});

describe('runCase — shape observation (expectFields)', () => {
  it('expectFields against a body carrying all named fields produces a passing shape-observed check', async () => {
    const caseObj = await runCase({
      method: 'GET',
      url: '/api/clients',
      baseUrl: mock.url,
      token: TOKEN,
      expectFields: ['clients', 'total'],
    });

    const shapeCheck = caseObj.checks.find((c) => c.name.startsWith('fields present'));
    expect(shapeCheck.kind).toBe('shape-observed');
    expect(shapeCheck.passed).toBe(true);
  });

  it('expectFields against a body missing a named field fails that check and the overall case', async () => {
    const caseObj = await runCase({
      method: 'GET',
      url: '/api/clients-partial',
      baseUrl: mock.url,
      token: TOKEN,
      expectFields: ['clients', 'total'],
    });

    const shapeCheck = caseObj.checks.find((c) => c.name.startsWith('fields present'));
    expect(shapeCheck.passed).toBe(false);
    expect(String(shapeCheck.actual)).toContain('total');
    expect(caseObj.status).toBe('failed');
  });

  it('against a text/plain route, json-parseable fails but the raw text is still captured', async () => {
    const caseObj = await runCase({ method: 'GET', url: '/api/text', baseUrl: mock.url, token: TOKEN });

    const jsonCheck = caseObj.checks.find((c) => c.name === 'json-parseable');
    expect(jsonCheck.passed).toBe(false);
    expect(caseObj.evidence.response.body).toBe('hello world');
  });

  it('no check anywhere claims contract/specification conformance — shape checks are always labelled shape-observed', async () => {
    const caseObj = await runCase({
      method: 'GET',
      url: '/api/clients',
      baseUrl: mock.url,
      token: TOKEN,
      expectFields: ['clients', 'total'],
    });

    for (const check of caseObj.checks) {
      if (check.kind === 'shape-observed') {
        expect(check.name.toLowerCase()).not.toMatch(/contract|specification/);
      }
    }
  });
});

describe('CLI — --expect-status and --expect-fields', () => {
  it('threads --expect-status and comma-separated --expect-fields into runCase', () => {
    const resultsPath = join(tmpDir, 'results.json');

    const { status, stdout } = runClient([
      '--method',
      'GET',
      '--url',
      '/api/clients',
      '--base-url',
      cliMockUrl,
      '--expect-status',
      '200',
      '--expect-fields',
      'clients,total',
      '--results',
      resultsPath,
    ]);

    expect(status).toBe(0);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.checks.find((c) => c.name === 'status').expected).toBe(200);
    expect(parsed.checks.some((c) => c.name.startsWith('fields present'))).toBe(true);
  });
});

describe('looksLikeProduction', () => {
  it('is false for localhost and 127.0.0.1', () => {
    expect(looksLikeProduction('http://localhost:3000')).toBe(false);
    expect(looksLikeProduction('http://127.0.0.1:8080')).toBe(false);
  });

  it('is false for a private-range IPv4 host', () => {
    expect(looksLikeProduction('http://192.168.1.9:3000')).toBe(false);
    expect(looksLikeProduction('http://10.0.0.5:8080')).toBe(false);
    expect(looksLikeProduction('http://172.20.0.4:8080')).toBe(false);
  });

  it('is false for hosts containing staging/dev/test/preview/qa/sandbox, or a .local suffix, or vercel.app', () => {
    expect(looksLikeProduction('https://staging.acme.com')).toBe(false);
    expect(looksLikeProduction('https://dev.acme.com')).toBe(false);
    expect(looksLikeProduction('https://test-api.acme.com')).toBe(false);
    expect(looksLikeProduction('https://preview.acme.com')).toBe(false);
    expect(looksLikeProduction('https://qa.acme.com')).toBe(false);
    expect(looksLikeProduction('https://sandbox.acme.com')).toBe(false);
    expect(looksLikeProduction('http://myapp.local')).toBe(false);
    expect(looksLikeProduction('https://my-app-git-branch.vercel.app')).toBe(false);
  });

  it('is true for an unrecognised public host — the safe default under uncertainty is production', () => {
    expect(looksLikeProduction('https://app.datax.com.ar')).toBe(true);
    expect(looksLikeProduction('https://prod.example.com')).toBe(true);
  });
});

describe('preflight', () => {
  it('resolves without throwing against a running target', async () => {
    await expect(preflight(mock.url, TOKEN)).resolves.toBeDefined();
  });

  it('rejects with a message containing "target unreachable" and the base URL for a closed port', async () => {
    const throwaway = await startMockServer();
    const closedUrl = throwaway.url;
    await throwaway.close();

    await expect(preflight(closedUrl, TOKEN)).rejects.toThrow(/target unreachable/);
    await expect(preflight(closedUrl, TOKEN)).rejects.toThrow(
      new RegExp(closedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  });

  it('the CLI maps a failed preflight to exit 4 with a "target unreachable" message and sends no case-bearing request', async () => {
    const throwaway = await startMockServer();
    const closedUrl = throwaway.url;
    await throwaway.close();

    const resultsPath = join(tmpDir, 'results.json');
    const { status, stderr } = runClient(
      ['--method', 'GET', '--url', '/api/clients', '--base-url', closedUrl, '--results', resultsPath],
      { expectFailure: true }
    );

    expect(status).toBe(4);
    expect(stderr).toContain('target unreachable');
    expect(stderr).toContain(closedUrl);

    // The closed port can never have received anything, so this is really a
    // sanity check that the CLI test's own mock server (a separate host) was
    // never touched by this invocation either.
    const log = await cliRequestLog();
    expect(log.length).toBe(0);
  });
});

describe('CLI — production-target refusal (exit 6)', () => {
  it('refuses a production-looking base URL without --allow-non-local: exit 6, message names host and flag, sends nothing', async () => {
    const resultsPath = join(tmpDir, 'results.json');

    const { status, stderr } = runClient(
      [
        '--method',
        'GET',
        '--url',
        '/api/clients',
        '--base-url',
        'https://app.acme.com',
        '--results',
        resultsPath,
      ],
      { expectFailure: true }
    );

    expect(status).toBe(6);
    expect(stderr).toContain('app.acme.com');
    expect(stderr).toContain('--allow-non-local');

    const log = await cliRequestLog();
    expect(log.length).toBe(0);
  });

  it('with --allow-non-local, proceeds past the production gate (fails later for an unrelated, expected reason)', () => {
    const resultsPath = join(tmpDir, 'results.json');

    // app.acme.invalid guarantees DNS failure (RFC 2606 .invalid TLD) — fast
    // and hermetic, no live external host required. The point of this test
    // is that the gate no longer stops the run at exit 6; a subsequent,
    // unrelated failure (unreachable target) is expected and fine.
    const { status } = runClient(
      [
        '--method',
        'GET',
        '--url',
        '/api/clients',
        '--base-url',
        'https://app.acme.invalid',
        '--allow-non-local',
        '--results',
        resultsPath,
      ],
      { expectFailure: true }
    );

    expect(status).not.toBe(6);
  });
});

describe('CLI — loud misconfiguration (exit 2), before any network activity', () => {
  it('QA_AGENT_TOKEN absent from the child environment exits 2 with a specific message, sends nothing', async () => {
    const resultsPath = join(tmpDir, 'results.json');
    const env = { ...process.env, QA_AGENT_BASE_URL: undefined };
    delete env.QA_AGENT_TOKEN;

    let threw = false;
    try {
      execFileSync(
        process.execPath,
        [API_CLIENT, '--method', 'GET', '--url', '/api/clients', '--base-url', cliMockUrl, '--results', resultsPath],
        { env, encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      expect(err.status).toBe(2);
      expect(err.stderr.toString()).toContain('QA_AGENT_TOKEN is not configured');
    }
    expect(threw).toBe(true);

    const log = await cliRequestLog();
    expect(log.length).toBe(0);
  });

  it('neither --base-url nor QA_AGENT_BASE_URL exits 2 with a specific message', () => {
    const resultsPath = join(tmpDir, 'results.json');
    const env = { ...process.env, QA_AGENT_TOKEN: TOKEN };
    delete env.QA_AGENT_BASE_URL;

    let threw = false;
    try {
      execFileSync(
        process.execPath,
        [API_CLIENT, '--method', 'GET', '--url', '/api/clients', '--results', resultsPath],
        { env, encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      expect(err.status).toBe(2);
      expect(err.stderr.toString()).toContain('QA_AGENT_BASE_URL is not configured');
    }
    expect(threw).toBe(true);
  });
});

describe('runCase — 401/403 verdict hint (T-01-18)', () => {
  it('a 401 response produces a normal failed case whose verdict hints at a QA_AGENT_TOKEN problem', async () => {
    const caseObj = await runCase({
      method: 'GET',
      url: '/api/unauthorized',
      baseUrl: mock.url,
      token: TOKEN,
    });

    expect(caseObj.status).toBe('failed');
    expect(caseObj.evidence.response.status).toBe(401);
    expect(caseObj.verdict).toContain('QA_AGENT_TOKEN');
  });
});

describe('confirmation gate still fires first after the method set widened', () => {
  it('a POST via the CLI without --confirmed and without --read-only-intent exits 3 and sends zero requests', async () => {
    const resultsPath = join(tmpDir, 'results.json');

    const { status } = runClient(
      [
        '--method',
        'POST',
        '--url',
        '/api/clients',
        '--base-url',
        cliMockUrl,
        '--body',
        JSON.stringify({ name: 'x' }),
        '--results',
        resultsPath,
      ],
      { expectFailure: true }
    );

    expect(status).toBe(3);
    const log = await cliRequestLog();
    expect(log.length).toBe(0);
  });
});
