// scripts/destructive.test.mjs
// Unit coverage for the destructive-method classifier (requiresConfirmation,
// previewOf) and integration coverage for the confirmation gate wired into
// api-client.mjs (--confirmed / --declined / --read-only-intent, exit code 3,
// the "blocked" third result state).

import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { previewOf, requiresConfirmation } from './destructive.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const API_CLIENT = resolve(__dirname, 'api-client.mjs');
const MOCK_SERVER_PROCESS = resolve(__dirname, '__fixtures__/mock-server-process.mjs');
const TOKEN = 'test-token-destructive-abc';

describe('requiresConfirmation', () => {
  it('is true for DELETE, case-insensitively, and even when looksReadOnly is true', () => {
    expect(requiresConfirmation('DELETE')).toBe(true);
    expect(requiresConfirmation('delete')).toBe(true);
    expect(requiresConfirmation('DELETE', { looksReadOnly: true })).toBe(true);
  });

  it('is true for POST/PUT/PATCH with no options, false when looksReadOnly is true', () => {
    for (const method of ['POST', 'PUT', 'PATCH']) {
      expect(requiresConfirmation(method)).toBe(true);
      expect(requiresConfirmation(method, { looksReadOnly: true })).toBe(false);
    }
  });

  it('is false for GET, HEAD and OPTIONS in both option states', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(requiresConfirmation(method)).toBe(false);
      expect(requiresConfirmation(method, { looksReadOnly: true })).toBe(false);
    }
  });

  it('gates an unrecognised method — unknown means gated, never waved through', () => {
    expect(requiresConfirmation('PURGE')).toBe(true);
  });
});

describe('previewOf', () => {
  it('returns the resolved absolute URL, uppercased method and body, with no headers key', () => {
    const preview = previewOf({
      method: 'delete',
      url: '/api/clients/42',
      baseUrl: 'http://x.test',
      body: { a: 1 },
    });

    expect(preview.method).toBe('DELETE');
    expect(preview.url).toBe('http://x.test/api/clients/42');
    expect(preview.body).toEqual({ a: 1 });
    expect(preview.headers).toBeUndefined();
    expect('headers' in preview).toBe(false);
  });
});

describe('confirmation gate wired into api-client.mjs', () => {
  let mockServerProc;
  let mockServerUrl;
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

  async function requestLog() {
    const res = await fetch(`${mockServerUrl}/__requests`);
    return res.json();
  }

  async function resetRequestLog() {
    await fetch(`${mockServerUrl}/__reset`, { method: 'POST' });
  }

  function runClient(args, { expectFailure = false } = {}) {
    try {
      const stdout = execFileSync(process.execPath, [API_CLIENT, ...args], {
        env: { ...process.env, QA_AGENT_TOKEN: TOKEN },
        encoding: 'utf8',
      });
      if (expectFailure) {
        throw new Error('expected api-client.mjs to exit non-zero, but it exited 0');
      }
      return { status: 0, stdout };
    } catch (err) {
      if (!expectFailure) throw err;
      return { status: err.status, stdout: err.stdout?.toString() ?? '' };
    }
  }

  beforeAll(async () => {
    const { proc, url } = await startMockServerProcess({
      'GET /api/clients': { status: 200, body: { clients: [], total: 0 } },
      'DELETE /api/clients/42': { status: 200, body: { deleted: true } },
      'POST /api/search': { status: 200, body: { results: [] } },
    });
    mockServerProc = proc;
    mockServerUrl = url;
  });

  afterAll(() => {
    mockServerProc?.kill();
  });

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'qa-agent-destructive-'));
    await resetRequestLog();
  });

  it('refuses an unconfirmed DELETE: exits 3, prints needs_confirmation with a matching preview, appends nothing, sends zero requests', () => {
    const resultsPath = join(tmpDir, 'results.json');

    const { status, stdout } = runClient(
      [
        '--method',
        'DELETE',
        '--url',
        '/api/clients/42',
        '--base-url',
        mockServerUrl,
        '--results',
        resultsPath,
      ],
      { expectFailure: true }
    );

    expect(status).toBe(3);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.status).toBe('needs_confirmation');
    expect(parsed.preview.method).toBe('DELETE');
    expect(parsed.preview.url).toBe(`${mockServerUrl}/api/clients/42`);
    expect(parsed.preview).not.toHaveProperty('headers');
    expect(typeof parsed.reason).toBe('string');
    expect(parsed.reason.length).toBeGreaterThan(0);

    let resultsExist = true;
    try {
      readFileSync(resultsPath, 'utf8');
    } catch {
      resultsExist = false;
    }
    expect(resultsExist).toBe(false);

    return requestLog().then((log) => {
      expect(log.length).toBe(0);
    });
  });

  it('dispatches a confirmed DELETE: exits 0, appends one case, mock records exactly one DELETE', async () => {
    const resultsPath = join(tmpDir, 'results.json');

    const { status, stdout } = runClient([
      '--method',
      'DELETE',
      '--url',
      '/api/clients/42',
      '--base-url',
      mockServerUrl,
      '--results',
      resultsPath,
      '--confirmed',
    ]);

    expect(status).toBe(0);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.status).toBe('passed');

    const results = JSON.parse(readFileSync(resultsPath, 'utf8'));
    expect(results.cases.length).toBe(1);

    const log = await requestLog();
    expect(log.length).toBe(1);
    expect(log[0]).toEqual({ method: 'DELETE', url: '/api/clients/42' });
  });

  it('dispatches an unconfirmed POST carrying --read-only-intent (the search/filter carve-out)', async () => {
    const resultsPath = join(tmpDir, 'results.json');

    const { status } = runClient([
      '--method',
      'POST',
      '--url',
      '/api/search',
      '--base-url',
      mockServerUrl,
      '--results',
      resultsPath,
      '--read-only-intent',
    ]);

    expect(status).toBe(0);
    const log = await requestLog();
    expect(log.length).toBe(1);
    expect(log[0]).toEqual({ method: 'POST', url: '/api/search' });
  });

  it('still gates an unconfirmed DELETE even with --read-only-intent', () => {
    const resultsPath = join(tmpDir, 'results.json');

    const { status } = runClient(
      [
        '--method',
        'DELETE',
        '--url',
        '/api/clients/42',
        '--base-url',
        mockServerUrl,
        '--results',
        resultsPath,
        '--read-only-intent',
      ],
      { expectFailure: true }
    );

    expect(status).toBe(3);
  });

  it('records a declined case as blocked, sends zero requests, and does not poison the run', async () => {
    const resultsPath = join(tmpDir, 'results.json');

    const { status, stdout } = runClient([
      '--declined',
      '--method',
      'DELETE',
      '--url',
      '/api/clients/42',
      '--base-url',
      mockServerUrl,
      '--title',
      'DELETE client 42',
      '--results',
      resultsPath,
    ]);

    expect(status).toBe(0);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.status).toBe('blocked');

    let results = JSON.parse(readFileSync(resultsPath, 'utf8'));
    expect(results.cases.length).toBe(1);
    const blockedCase = results.cases[0];
    expect(blockedCase.status).toBe('blocked');
    expect(blockedCase.evidence.response).toBeNull();
    expect(typeof blockedCase.blockedReason).toBe('string');
    expect(blockedCase.blockedReason.length).toBeGreaterThan(0);
    expect(blockedCase.evidence.request.method).toBe('DELETE');

    const log = await requestLog();
    expect(log.length).toBe(0);

    // A subsequent normal GET against the same results file still appends and exits 0.
    const { status: getStatus } = runClient([
      '--method',
      'GET',
      '--url',
      '/api/clients',
      '--base-url',
      mockServerUrl,
      '--results',
      resultsPath,
    ]);
    expect(getStatus).toBe(0);

    results = JSON.parse(readFileSync(resultsPath, 'utf8'));
    expect(results.cases.length).toBe(2);
    expect(results.cases[1].status).toBe('passed');
  });
});
