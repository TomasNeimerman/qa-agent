// scripts/ui-case.test.mjs
// Unit and CLI coverage for buildUiCase's construction contract, its
// evidence-refusal rule (SAFE-03's browser-side enforcement point), and the
// CLI's exit-code mapping. Fixtures are hand-built so no browser or HTTP
// target is required.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { appendCase } from './api-client.mjs';
import { UI_ACTIONS, UiEvidenceMissingError, buildUiCase } from './ui-case.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const UI_CASE = resolve(__dirname, 'ui-case.mjs');

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'qa-agent-ui-case-'));
});

describe('UI_ACTIONS', () => {
  it('is the closed set navigate/click/fill/submit/assert', () => {
    expect(UI_ACTIONS).toEqual(['navigate', 'click', 'fill', 'submit', 'assert']);
  });
});

describe('buildUiCase — contract', () => {
  it('a passed case has kind "ui", the given status, and evidence.request/response carrying the action, element, URL and snapshot', () => {
    const c = buildUiCase({
      title: 'alta de cliente',
      status: 'passed',
      action: 'click',
      element: 'Guardar',
      url: 'http://x.test/clients/new',
      snapshot: 'button "Guardar" [ref=e9]',
    });

    expect(c.kind).toBe('ui');
    expect(c.status).toBe('passed');
    expect(c.evidence.request.action).toBe('click');
    expect(c.evidence.request.element).toBe('Guardar');
    expect(c.evidence.request.url).toBe('http://x.test/clients/new');
    expect(c.evidence.response.snapshot).toBe('button "Guardar" [ref=e9]');
  });

  it('carries every key the Phase 1 case contract requires', () => {
    const c = buildUiCase({
      title: 'alta de cliente',
      status: 'passed',
      action: 'click',
      element: 'Guardar',
      url: 'http://x.test/clients/new',
      snapshot: 'button "Guardar" [ref=e9]',
    });

    for (const key of ['id', 'title', 'status', 'evidence', 'checks', 'verdict', 'reproSteps', 'blockedReason']) {
      expect(c).toHaveProperty(key);
    }
  });

  it('throws UiEvidenceMissingError naming the title for a passed status with no snapshot text', () => {
    expect(() =>
      buildUiCase({ title: 'alta de cliente', status: 'passed', action: 'click', element: 'Guardar', url: 'http://x.test/a' })
    ).toThrow(UiEvidenceMissingError);

    try {
      buildUiCase({ title: 'alta de cliente', status: 'passed', action: 'click', element: 'Guardar', url: 'http://x.test/a' });
    } catch (err) {
      expect(err.message).toContain('alta de cliente');
    }
  });

  it('throws UiEvidenceMissingError naming the title for a failed status with empty snapshot text', () => {
    expect(() =>
      buildUiCase({
        title: 'alta de cliente falla',
        status: 'failed',
        action: 'submit',
        element: 'Guardar',
        url: 'http://x.test/a',
        snapshot: '',
      })
    ).toThrow(UiEvidenceMissingError);
  });

  it('a blocked case with no snapshot has evidence.response null and blockedReason set — exempt like an API case', () => {
    const c = buildUiCase({
      title: 'eliminar cliente',
      status: 'blocked',
      action: 'click',
      element: 'Eliminar',
      url: 'http://x.test/clients/1',
      blockedReason: 'The developer declined confirmation for this destructive click.',
    });

    expect(c.evidence.response).toBeNull();
    expect(c.blockedReason).toBe('The developer declined confirmation for this destructive click.');
  });

  it('produces one ui-observed check with expected/actual/passed when expected and observed are supplied', () => {
    const c = buildUiCase({
      title: 'alta de cliente',
      status: 'failed',
      action: 'submit',
      element: 'Guardar',
      url: 'http://x.test/clients/new',
      snapshot: 'alert "error de validacion"',
      expected: 'lista con el cliente nuevo',
      observed: 'error de validacion',
    });

    expect(c.checks).toHaveLength(1);
    expect(c.checks[0].kind).toBe('ui-observed');
    expect(c.checks[0].expected).toBe('lista con el cliente nuevo');
    expect(c.checks[0].actual).toBe('error de validacion');
    expect(c.checks[0].passed).toBe(false);
  });

  it('with no expected value, checks holds one non-empty entry asserting the action completed with a snapshot captured', () => {
    const c = buildUiCase({
      title: 'alta de cliente',
      status: 'passed',
      action: 'click',
      element: 'Guardar',
      url: 'http://x.test/clients/new',
      snapshot: 'button "Guardar" [ref=e9]',
    });

    expect(c.checks.length).toBeGreaterThan(0);
    expect(c.checks[0].passed).toBe(true);
  });

  it('truncates snapshot text longer than the configured cap and appends an explicit truncation marker', () => {
    const longSnapshot = 'x'.repeat(30000);
    const c = buildUiCase({
      title: 'huge tree',
      status: 'passed',
      action: 'click',
      element: 'Guardar',
      url: 'http://x.test/a',
      snapshot: longSnapshot,
    });

    expect(c.evidence.response.snapshot.length).toBeLessThan(longSnapshot.length);
    expect(c.evidence.response.snapshot).toMatch(/truncated/i);
  });

  it('does not truncate snapshot text at or under the cap', () => {
    const shortSnapshot = 'button "Guardar" [ref=e9]';
    const c = buildUiCase({
      title: 'small tree',
      status: 'passed',
      action: 'click',
      element: 'Guardar',
      url: 'http://x.test/a',
      snapshot: shortSnapshot,
    });

    expect(c.evidence.response.snapshot).toBe(shortSnapshot);
  });

  it('composes verdict from stored fields (status, action, element, URL) rather than a free-text argument', () => {
    const c = buildUiCase({
      title: 'alta de cliente',
      status: 'passed',
      action: 'click',
      element: 'Guardar',
      url: 'http://x.test/clients/new',
      snapshot: 'button "Guardar" [ref=e9]',
    });

    expect(c.verdict).toContain('click');
    expect(c.verdict).toContain('Guardar');
    expect(c.verdict).toContain('http://x.test/clients/new');
    expect(c.verdict.toUpperCase()).toContain('PASSED');
  });

  it('composes a FAILED verdict naming the first failed check', () => {
    const c = buildUiCase({
      title: 'alta de cliente falla',
      status: 'failed',
      action: 'submit',
      element: 'Guardar',
      url: 'http://x.test/clients/new',
      snapshot: 'alert "error de validacion"',
      expected: 'lista con el cliente nuevo',
      observed: 'error de validacion',
    });

    expect(c.verdict.toUpperCase()).toContain('FAILED');
    expect(c.verdict).toContain('lista con el cliente nuevo');
    expect(c.verdict).toContain('error de validacion');
  });

  it('throws a plain (non-UiEvidenceMissingError) error for an action outside UI_ACTIONS', () => {
    expect(() =>
      buildUiCase({ title: 't', status: 'passed', action: 'delete-everything', element: 'x', url: 'http://x.test/a', snapshot: 's' })
    ).toThrow(/Unsupported UI action/);
  });
});

describe('CLI', () => {
  it('a full invocation exits 0 and appends exactly one case, alongside an existing API case', () => {
    const resultsPath = join(tmpDir, 'results.json');
    appendCase(
      resultsPath,
      {
        id: 'case-api-1',
        title: 'GET /api/clients',
        status: 'passed',
        evidence: {
          request: { method: 'GET', url: 'http://x.test/api/clients', headers: {}, body: null },
          response: { status: 200, ok: true, headers: {}, body: {}, durationMs: 5 },
        },
        checks: [],
        verdict: 'PASSED',
        reproSteps: [],
        blockedReason: null,
      },
      { baseUrl: 'http://x.test', instruction: 'i', title: 't' }
    );

    const snapshotFile = join(tmpDir, 'snap.txt');
    writeFileSync(snapshotFile, 'button "Guardar" [ref=e9]');

    const out = execFileSync(
      process.execPath,
      [
        UI_CASE,
        '--results',
        resultsPath,
        '--title',
        'alta de cliente',
        '--status',
        'passed',
        '--action',
        'click',
        '--element',
        'Guardar',
        '--url',
        'http://x.test/clients/new',
        '--snapshot-file',
        snapshotFile,
      ],
      { encoding: 'utf8' }
    );

    expect(JSON.parse(out).kind).toBe('ui');

    const results = JSON.parse(readFileSync(resultsPath, 'utf8'));
    expect(results.cases).toHaveLength(2);
    expect(results.cases[0].id).toBe('case-api-1');
    expect(results.cases[1].kind).toBe('ui');
  });

  it('--status passed with a non-existent --snapshot-file exits 5 and appends nothing', () => {
    const resultsPath = join(tmpDir, 'results.json');
    const missingSnapshotFile = join(tmpDir, 'does-not-exist.txt');

    let threw = false;
    try {
      execFileSync(
        process.execPath,
        [
          UI_CASE,
          '--results',
          resultsPath,
          '--title',
          'alta de cliente',
          '--status',
          'passed',
          '--action',
          'click',
          '--element',
          'Guardar',
          '--url',
          'http://x.test/clients/new',
          '--snapshot-file',
          missingSnapshotFile,
        ],
        { encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      expect(err.status).toBe(5);
    }
    expect(threw).toBe(true);
    expect(existsSync(resultsPath)).toBe(false);
  });

  it('--status blocked --blocked-reason with no --snapshot-file exits 0 and appends one blocked case', () => {
    const resultsPath = join(tmpDir, 'results.json');

    const out = execFileSync(
      process.execPath,
      [
        UI_CASE,
        '--results',
        resultsPath,
        '--title',
        'eliminar cliente',
        '--status',
        'blocked',
        '--action',
        'click',
        '--element',
        'Eliminar',
        '--url',
        'http://x.test/clients/1',
        '--blocked-reason',
        'The developer declined confirmation for this destructive click.',
      ],
      { encoding: 'utf8' }
    );

    const caseObj = JSON.parse(out);
    expect(caseObj.status).toBe('blocked');
    expect(caseObj.evidence.response).toBeNull();

    const results = JSON.parse(readFileSync(resultsPath, 'utf8'));
    expect(results.cases).toHaveLength(1);
    expect(results.cases[0].status).toBe('blocked');
  });

  it('an unrecognised --action exits 2 and appends nothing', () => {
    const resultsPath = join(tmpDir, 'results.json');

    let threw = false;
    try {
      execFileSync(
        process.execPath,
        [
          UI_CASE,
          '--results',
          resultsPath,
          '--title',
          't',
          '--status',
          'passed',
          '--action',
          'teleport',
          '--element',
          'x',
          '--url',
          'http://x.test/a',
        ],
        { encoding: 'utf8' }
      );
    } catch (err) {
      threw = true;
      expect(err.status).toBe(2);
    }
    expect(threw).toBe(true);
    expect(existsSync(resultsPath)).toBe(false);
  });
});
