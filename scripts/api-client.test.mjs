// scripts/api-client.test.mjs
// Unit + integration coverage for the full API execution engine: method
// dispatch with bodies (Task 1), status/shape validation (Task 2), and
// preflight/production-target safety (Task 3) of plan 01-04.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DISPATCH, readConfig, runCase } from './api-client.mjs';
import { startMockServer } from './__fixtures__/mock-server.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const API_CLIENT = resolve(__dirname, 'api-client.mjs');
const TOKEN = 'test-token-api-client-xyz';

let mock;
let tmpDir;

beforeAll(async () => {
  mock = await startMockServer({
    'GET /api/clients-partial': { status: 200, body: { clients: [] } },
    'GET /api/unauthorized': { status: 401, body: { error: 'unauthorized' } },
  });
});

afterAll(async () => {
  await mock.close();
});

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'qa-agent-api-client-'));
  mock.reset();
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

describe('confirmation gate still fires first after the method set widened', () => {
  it('a POST via the CLI without --confirmed and without --read-only-intent exits 3 and sends zero requests', () => {
    const resultsPath = join(tmpDir, 'results.json');

    const { status } = runClient(
      [
        '--method',
        'POST',
        '--url',
        '/api/clients',
        '--base-url',
        mock.url,
        '--body',
        JSON.stringify({ name: 'x' }),
        '--results',
        resultsPath,
      ],
      { expectFailure: true }
    );

    expect(status).toBe(3);
    expect(mock.requests.length).toBe(0);
  });
});
