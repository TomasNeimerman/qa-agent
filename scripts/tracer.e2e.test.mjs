// scripts/tracer.e2e.test.mjs
// End-to-end regression lock for the tracer slice: mock server -> api-client.mjs
// -> results.json -> format-report.mjs -> Markdown report, with token redaction
// and evidence-enforcement asserted at every hop.

import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const API_CLIENT = resolve(__dirname, 'api-client.mjs');
const FORMAT_REPORT = resolve(__dirname, 'format-report.mjs');
const MOCK_SERVER_PROCESS = resolve(__dirname, '__fixtures__/mock-server-process.mjs');
const TOKEN = 'test-token-abc123';

// The mock server is booted as its own OS process (a sibling to the
// api-client.mjs child this file spawns via execFileSync below), not
// in-process inside the test runner — a child process connecting back to a
// socket held by its own direct parent is not guaranteed to be reachable in
// every sandboxed execution environment, whereas sibling-to-sibling loopback
// traffic is unaffected. This keeps the fixture itself (`startMockServer`)
// a plain reusable export while isolating the process topology quirk here.
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

beforeAll(async () => {
  const { proc, url } = await startMockServerProcess({
    'GET /api/clients': {
      status: 200,
      body: { clients: [{ id: 1, name: 'Acme' }], total: 1 },
    },
  });
  mockServerProc = proc;
  mockServerUrl = url;
});

afterAll(() => {
  mockServerProc?.kill();
});

describe('tracer: /qa-agent GET /api/clients', () => {
  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'qa-agent-tracer-'));
  });

  it('runs api-client.mjs and produces a passed evidence-backed case', () => {
    const resultsPath = join(tmpDir, 'results.json');

    const stdout = execFileSync(
      process.execPath,
      [
        API_CLIENT,
        '--method',
        'GET',
        '--url',
        '/api/clients',
        '--base-url',
        mockServerUrl,
        '--title',
        'GET /api/clients',
        '--results',
        resultsPath,
      ],
      {
        env: { ...process.env, QA_AGENT_TOKEN: TOKEN },
        encoding: 'utf8',
      }
    );

    const parsed = JSON.parse(stdout.trim());
    expect(parsed.status).toBe('passed');
    expect(parsed.evidence.response.status).toBe(200);
    expect(parsed.evidence.response.body.total).toBe(1);

    const resultsRaw = readFileSync(resultsPath, 'utf8');
    const results = JSON.parse(resultsRaw);
    expect(results.schemaVersion).toBe(1);
    expect(results.cases.length).toBe(1);

    expect(stdout).not.toContain(TOKEN);
    expect(resultsRaw).not.toContain(TOKEN);
    expect(parsed.evidence.request.headers.Authorization).toBe('[REDACTED]');

    global.__tracerResultsPath = resultsPath;
  });

  it('runs format-report.mjs and writes a redacted Markdown report', () => {
    const resultsPath = global.__tracerResultsPath;
    const outDir = join(tmpDir, 'qa-reports');

    const stdout = execFileSync(
      process.execPath,
      [
        FORMAT_REPORT,
        '--results',
        resultsPath,
        '--out-dir',
        outDir,
        '--title',
        'client-crud',
      ],
      { encoding: 'utf8' }
    );

    expect(stdout).toBeTruthy();

    const mdFiles = readdirSync(outDir).filter((f) => f.endsWith('.md'));
    expect(mdFiles.length).toBe(1);

    const gitignore = readFileSync(join(outDir, '.gitignore'), 'utf8');
    expect(gitignore).toContain('*');

    const markdown = readFileSync(join(outDir, mdFiles[0]), 'utf8');
    expect(markdown).toContain('GET');
    expect(markdown).toContain('/api/clients');
    expect(markdown).toContain('200');
    expect(markdown).toContain('PASSED');
    expect(markdown).toContain('[REDACTED]');
    expect(markdown).not.toContain(TOKEN);
  });

  it('exits 2 with a specific message when QA_AGENT_TOKEN is unset', () => {
    const resultsPath = join(tmpDir, 'no-token-results.json');
    const env = { ...process.env };
    delete env.QA_AGENT_TOKEN;

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
          mockServerUrl,
          '--title',
          'GET /api/clients',
          '--results',
          resultsPath,
        ],
        { env, encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      expect(err.status).toBe(2);
      expect(err.stderr.toString()).toContain('QA_AGENT_TOKEN is not configured');
    }
    expect(threw).toBe(true);

    let resultsExist = true;
    try {
      readFileSync(resultsPath, 'utf8');
    } catch {
      resultsExist = false;
    }
    expect(resultsExist).toBe(false);
  });

  it('format-report.mjs exits non-zero with EVIDENCE_MISSING for an evidence-less verdict', () => {
    const badResultsPath = join(tmpDir, 'bad-results.json');
    const badResults = {
      schemaVersion: 1,
      run: { baseUrl: mockServerUrl, instruction: 'x', title: 'bad' },
      cases: [
        {
          id: 'c1',
          title: 'GET /api/clients',
          status: 'passed',
          evidence: { request: { method: 'GET', url: '/api/clients', headers: {}, body: null }, response: null },
          checks: [],
          verdict: 'PASSED',
          reproSteps: [],
          blockedReason: null,
        },
      ],
    };
    writeFileSync(badResultsPath, JSON.stringify(badResults, null, 2));

    const badOutDir = join(tmpDir, 'bad-qa-reports');
    mkdirSync(badOutDir, { recursive: true });

    let threw = false;
    try {
      execFileSync(
        process.execPath,
        [FORMAT_REPORT, '--results', badResultsPath, '--out-dir', badOutDir, '--title', 'bad'],
        { encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      expect(err.status).not.toBe(0);
      expect(err.stderr.toString()).toContain('EVIDENCE_MISSING');
    }
    expect(threw).toBe(true);
  });
});
