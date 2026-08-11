// scripts/api-client.test.mjs
// Unit + integration coverage for the full API execution engine: method
// dispatch with bodies (Task 1), status/shape validation (Task 2), and
// preflight/production-target safety (Task 3) of plan 01-04.

import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DISPATCH, buildShapeSchema, readConfig, runCase } from './api-client.mjs';
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
