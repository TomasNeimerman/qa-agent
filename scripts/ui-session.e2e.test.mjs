// scripts/ui-session.e2e.test.mjs
// End-to-end lock on this phase's tracer path: env credentials -> a real
// Chromium browser login -> a storageState artifact on disk -> Phase 1's
// APIRequestContext reusing that session with QA_AGENT_TOKEN absent for the
// entire duration (EXEC-03, API-03, D-07, D-08).

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const UI_LOGIN = resolve(__dirname, 'ui-login.mjs');
const API_CLIENT = resolve(__dirname, 'api-client.mjs');
const MOCK_LOGIN_APP = resolve(__dirname, '__fixtures__/mock-login-app.mjs');

const FIXTURE_USER = 'qa-session-user';
const FIXTURE_PASSWORD = 'S3cure-Fixture-Pass!';
const LOGIN_TIMEOUT_MS = '10000';

// mock-login-app.mjs is started as its own OS process (a sibling to the
// ui-login.mjs/api-client.mjs children this file spawns), for the same
// reason tracer.e2e.test.mjs and api-client.test.mjs boot their mock server
// as a sibling process: a child connecting back to a socket held by its own
// direct parent is not guaranteed reachable in every sandboxed environment.
let mockProc;
let mockUrl;
let tmpDir;

function startMockLoginAppProcess(config) {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(process.execPath, [MOCK_LOGIN_APP, JSON.stringify(config)], {
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
    setTimeout(() => reject(new Error('mock login app did not become ready in time')), 15000);
  });
}

function envWithoutToken(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.QA_AGENT_TOKEN;
  return env;
}

beforeAll(async () => {
  const { proc, url } = await startMockLoginAppProcess({ user: FIXTURE_USER, password: FIXTURE_PASSWORD });
  mockProc = proc;
  mockUrl = url;
}, 20000);

afterAll(() => {
  mockProc?.kill();
});

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'qa-agent-ui-session-'));
});

describe('ui-session e2e: login -> storageState -> authenticated API call', () => {
  it(
    'logs in as the QA_AGENT_UI_USER test user and writes a storageState file holding a qa_session cookie',
    () => {
      const storageStatePath = join(tmpDir, 'storage-state.json');

      const stdout = execFileSync(
        process.execPath,
        [UI_LOGIN, '--base-url', mockUrl, '--storage-state', storageStatePath, '--timeout', LOGIN_TIMEOUT_MS],
        {
          env: envWithoutToken({ QA_AGENT_UI_USER: FIXTURE_USER, QA_AGENT_UI_PASSWORD: FIXTURE_PASSWORD }),
          encoding: 'utf8',
        }
      );

      const lines = stdout.trim().split('\n').filter(Boolean);
      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]);
      expect(parsed.status).toBe('logged_in');

      // The fixture password must appear in neither stream (T-02-01).
      expect(stdout).not.toContain(FIXTURE_PASSWORD);

      expect(existsSync(storageStatePath)).toBe(true);
      const written = JSON.parse(readFileSync(storageStatePath, 'utf8'));
      expect(Array.isArray(written.cookies)).toBe(true);
      expect(written.cookies.some((c) => c.name === 'qa_session')).toBe(true);
    },
    20000
  );

  it(
    'neither stdout nor stderr of the login process contains the fixture password',
    () => {
      const storageStatePath = join(tmpDir, 'storage-state-2.json');

      let stdout = '';
      let stderr = '';
      try {
        stdout = execFileSync(
          process.execPath,
          [UI_LOGIN, '--base-url', mockUrl, '--storage-state', storageStatePath, '--timeout', LOGIN_TIMEOUT_MS],
          {
            env: envWithoutToken({ QA_AGENT_UI_USER: FIXTURE_USER, QA_AGENT_UI_PASSWORD: FIXTURE_PASSWORD }),
            encoding: 'utf8',
          }
        );
      } catch (err) {
        stdout = err.stdout?.toString() ?? '';
        stderr = err.stderr?.toString() ?? '';
      }

      expect(stdout).not.toContain(FIXTURE_PASSWORD);
      expect(stderr).not.toContain(FIXTURE_PASSWORD);
    },
    20000
  );

  it(
    'api-client.mjs authenticates GET /api/me as the UI-authenticated user via --storage-state, with QA_AGENT_TOKEN absent',
    () => {
      const storageStatePath = join(tmpDir, 'storage-state-3.json');

      execFileSync(
        process.execPath,
        [UI_LOGIN, '--base-url', mockUrl, '--storage-state', storageStatePath, '--timeout', LOGIN_TIMEOUT_MS],
        {
          env: envWithoutToken({ QA_AGENT_UI_USER: FIXTURE_USER, QA_AGENT_UI_PASSWORD: FIXTURE_PASSWORD }),
          encoding: 'utf8',
        }
      );

      const resultsPath = join(tmpDir, 'results.json');
      const stdout = execFileSync(
        process.execPath,
        [
          API_CLIENT,
          '--method',
          'GET',
          '--url',
          '/api/me',
          '--base-url',
          mockUrl,
          '--storage-state',
          storageStatePath,
          '--title',
          'GET /api/me as the UI-authenticated user',
          '--results',
          resultsPath,
        ],
        { env: envWithoutToken(), encoding: 'utf8' }
      );

      const parsed = JSON.parse(stdout.trim());
      expect(parsed.status).toBe('passed');
      expect(parsed.evidence.response.status).toBe(200);
      expect(parsed.evidence.response.body.user).toBe(FIXTURE_USER);

      const results = JSON.parse(readFileSync(resultsPath, 'utf8'));
      expect(results.cases.length).toBe(1);
    },
    20000
  );

  it('omitting --storage-state with QA_AGENT_TOKEN absent exits 2 — no auth mechanism at all is a configuration failure', () => {
    const resultsPath = join(tmpDir, 'results-no-auth.json');

    let threw = false;
    try {
      execFileSync(
        process.execPath,
        [API_CLIENT, '--method', 'GET', '--url', '/api/me', '--base-url', mockUrl, '--results', resultsPath],
        { env: envWithoutToken(), encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      expect(err.status).toBe(2);
    }
    expect(threw).toBe(true);
    expect(existsSync(resultsPath)).toBe(false);
  });

  it('a --storage-state file written from an empty context (no cookies) exits 0 but records a failed 401 case', () => {
    // The standard minimal empty Playwright storageState shape — equivalent
    // to context.storageState() called on a context that never logged in.
    const emptyStorageStatePath = join(tmpDir, 'empty-storage-state.json');
    writeFileSync(emptyStorageStatePath, JSON.stringify({ cookies: [], origins: [] }));

    const resultsPath = join(tmpDir, 'results-empty.json');
    const stdout = execFileSync(
      process.execPath,
      [
        API_CLIENT,
        '--method',
        'GET',
        '--url',
        '/api/me',
        '--base-url',
        mockUrl,
        '--storage-state',
        emptyStorageStatePath,
        '--title',
        'GET /api/me with an empty session',
        '--results',
        resultsPath,
      ],
      { env: envWithoutToken(), encoding: 'utf8' }
    );

    const parsed = JSON.parse(stdout.trim());
    expect(parsed.status).toBe('failed');
    expect(parsed.evidence.response.status).toBe(401);
  });
});
