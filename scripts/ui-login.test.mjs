// scripts/ui-login.test.mjs
// Unit coverage for credential resolution (readUiCredentials), form-field
// location (findLoginFields), and login-flow failure modes (performLogin,
// the ui-login.mjs CLI) — the two credential shapes from RESEARCH Pitfall 4
// each failing loudly and independently.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { UiConfigError, findLoginFields, performLogin, readUiCredentials } from './ui-login.mjs';
import { startMockLoginApp } from './__fixtures__/mock-login-app.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const UI_LOGIN = resolve(__dirname, 'ui-login.mjs');
const MOCK_LOGIN_APP = resolve(__dirname, '__fixtures__/mock-login-app.mjs');

const FIXTURE_USER = 'qa-login-test-user';
const FIXTURE_PASSWORD = 'Correct-Fixture-Pw-9!';
const WRONG_PASSWORD = 'definitely-wrong-password';

// `mock` is an in-process fixture — safe for direct findLoginFields()/
// performLogin() calls made from this same test process. `cliMock` is a
// sibling OS process (same pattern as api-client.test.mjs's cliMock /
// tracer.e2e.test.mjs): a child spawned by this process cannot reliably
// reach a socket held by its own direct parent in every sandboxed
// environment, whereas sibling-to-sibling loopback traffic is unaffected.
let mock;
let cliMockProc;
let cliMockUrl;
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

function envWithUiCreds(extra = {}) {
  const env = { ...process.env, ...extra };
  delete env.QA_AGENT_TOKEN;
  return env;
}

beforeAll(async () => {
  mock = await startMockLoginApp({ user: FIXTURE_USER, password: FIXTURE_PASSWORD });

  const { proc, url } = await startMockLoginAppProcess({ user: FIXTURE_USER, password: FIXTURE_PASSWORD });
  cliMockProc = proc;
  cliMockUrl = url;
}, 20000);

afterAll(async () => {
  await mock.close();
  cliMockProc?.kill();
});

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'qa-agent-ui-login-'));
});

describe('readUiCredentials', () => {
  const ORIGINAL_USER = process.env.QA_AGENT_UI_USER;
  const ORIGINAL_PASSWORD = process.env.QA_AGENT_UI_PASSWORD;

  afterEach(() => {
    if (ORIGINAL_USER === undefined) delete process.env.QA_AGENT_UI_USER;
    else process.env.QA_AGENT_UI_USER = ORIGINAL_USER;
    if (ORIGINAL_PASSWORD === undefined) delete process.env.QA_AGENT_UI_PASSWORD;
    else process.env.QA_AGENT_UI_PASSWORD = ORIGINAL_PASSWORD;
  });

  it('returns both values when both env vars are set', () => {
    process.env.QA_AGENT_UI_USER = 'someone';
    process.env.QA_AGENT_UI_PASSWORD = 'secret';

    const creds = readUiCredentials({ projectRoot: tmpDir });
    expect(creds).toEqual({ user: 'someone', password: 'secret' });
  });

  it('throws UiConfigError naming both variables when QA_AGENT_UI_USER is unset', () => {
    delete process.env.QA_AGENT_UI_USER;
    process.env.QA_AGENT_UI_PASSWORD = 'secret';

    let threw = false;
    try {
      readUiCredentials({ projectRoot: tmpDir });
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(UiConfigError);
      expect(err.message).toContain('QA_AGENT_UI_USER');
      expect(err.message).toContain('QA_AGENT_UI_PASSWORD');
    }
    expect(threw).toBe(true);
  });

  it('throws UiConfigError naming both variables when QA_AGENT_UI_PASSWORD is unset', () => {
    process.env.QA_AGENT_UI_USER = 'someone';
    delete process.env.QA_AGENT_UI_PASSWORD;

    let threw = false;
    try {
      readUiCredentials({ projectRoot: tmpDir });
    } catch (err) {
      threw = true;
      expect(err).toBeInstanceOf(UiConfigError);
      expect(err.message).toContain('QA_AGENT_UI_USER');
      expect(err.message).toContain('QA_AGENT_UI_PASSWORD');
    }
    expect(threw).toBe(true);
  });

  it('throws UiConfigError naming both variables when either value is empty or whitespace-only', () => {
    process.env.QA_AGENT_UI_USER = '   ';
    process.env.QA_AGENT_UI_PASSWORD = 'secret';
    expect(() => readUiCredentials({ projectRoot: tmpDir })).toThrow(UiConfigError);

    process.env.QA_AGENT_UI_USER = 'someone';
    process.env.QA_AGENT_UI_PASSWORD = '';
    expect(() => readUiCredentials({ projectRoot: tmpDir })).toThrow(UiConfigError);
  });
});

describe('findLoginFields', () => {
  it("resolves all three controls against the fixture's /login page", async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`${mock.url}/login`);

      const { userField, passField, submitButton } = await findLoginFields(page);
      expect(await userField.count()).toBe(1);
      expect(await passField.count()).toBe(1);
      expect(await submitButton.count()).toBe(1);
    } finally {
      await browser.close();
    }
  }, 20000);
});

describe('performLogin', () => {
  const ORIGINAL_USER = process.env.QA_AGENT_UI_USER;
  const ORIGINAL_PASSWORD = process.env.QA_AGENT_UI_PASSWORD;

  afterEach(() => {
    if (ORIGINAL_USER === undefined) delete process.env.QA_AGENT_UI_USER;
    else process.env.QA_AGENT_UI_USER = ORIGINAL_USER;
    if (ORIGINAL_PASSWORD === undefined) delete process.env.QA_AGENT_UI_PASSWORD;
    else process.env.QA_AGENT_UI_PASSWORD = ORIGINAL_PASSWORD;
  });

  it('returns a cookieNames array containing qa_session and no cookie values', async () => {
    process.env.QA_AGENT_UI_USER = FIXTURE_USER;
    process.env.QA_AGENT_UI_PASSWORD = FIXTURE_PASSWORD;

    const storageStatePath = join(tmpDir, 'perform-login-storage-state.json');
    const result = await performLogin({
      baseUrl: mock.url,
      storageStatePath,
      timeoutMs: 10000,
    });

    expect(result.cookieNames).toContain('qa_session');
    for (const name of result.cookieNames) {
      expect(typeof name).toBe('string');
    }
    expect(JSON.stringify(result)).not.toContain(FIXTURE_PASSWORD);
  }, 20000);
});

describe('CLI — missing UI credentials (exit 2)', () => {
  it('exits 2, writes no file at the target path, and names both variables', () => {
    const storageStatePath = join(tmpDir, 's.json');
    const env = envWithUiCreds();
    delete env.QA_AGENT_UI_USER;
    delete env.QA_AGENT_UI_PASSWORD;

    let threw = false;
    try {
      execFileSync(
        process.execPath,
        [UI_LOGIN, '--base-url', cliMockUrl, '--storage-state', storageStatePath, '--timeout', '5000'],
        { env, encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      expect(err.status).toBe(2);
      const combined = `${err.stdout?.toString() ?? ''}${err.stderr?.toString() ?? ''}`;
      expect(combined).toContain('QA_AGENT_UI_USER');
      expect(combined).toContain('QA_AGENT_UI_PASSWORD');
    }
    expect(threw).toBe(true);
    expect(existsSync(storageStatePath)).toBe(false);
  }, 15000);
});

describe('CLI — rejected UI credentials (exit 7)', () => {
  it('exits 7, writes no file, and never leaks either password value', () => {
    const storageStatePath = join(tmpDir, 's-rejected.json');
    const env = envWithUiCreds({ QA_AGENT_UI_USER: FIXTURE_USER, QA_AGENT_UI_PASSWORD: WRONG_PASSWORD });

    let threw = false;
    try {
      execFileSync(
        process.execPath,
        [UI_LOGIN, '--base-url', cliMockUrl, '--storage-state', storageStatePath, '--timeout', '5000'],
        { env, encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      expect(err.status).toBe(7);
      const combined = `${err.stdout?.toString() ?? ''}${err.stderr?.toString() ?? ''}`;
      expect(combined).not.toContain(WRONG_PASSWORD);
      expect(combined).not.toContain(FIXTURE_PASSWORD);
    }
    expect(threw).toBe(true);
    expect(existsSync(storageStatePath)).toBe(false);
  }, 15000);
});

describe('CLI — unreachable target (exit 4, not 7)', () => {
  it('exits 4 against a closed port — distinguishable from rejected credentials', () => {
    const storageStatePath = join(tmpDir, 's-unreachable.json');
    const env = envWithUiCreds({ QA_AGENT_UI_USER: FIXTURE_USER, QA_AGENT_UI_PASSWORD: FIXTURE_PASSWORD });

    let threw = false;
    try {
      execFileSync(
        process.execPath,
        [UI_LOGIN, '--base-url', 'http://127.0.0.1:1', '--storage-state', storageStatePath, '--timeout', '3000'],
        { env, encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      expect(err.status).toBe(4);
    }
    expect(threw).toBe(true);
    expect(existsSync(storageStatePath)).toBe(false);
  }, 15000);
});
