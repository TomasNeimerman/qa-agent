// scripts/format-report.test.mjs
// Unit coverage for the report template renderer: report structure, three-state
// (passed/failed/blocked) rendering, and evidence enforcement (SAFE-03).
// Fixtures are hand-built so no HTTP or filesystem target is required.

import { describe, expect, it } from 'vitest';
import {
  EvidenceMissingError,
  renderCase,
  renderReport,
  reportFileName,
  summarise,
} from './format-report.mjs';

function makeRun(overrides = {}) {
  return {
    title: 'client-crud',
    baseUrl: 'http://localhost:3000',
    instruction: 'proba GET /api/clients y POST /api/clients',
    ...overrides,
  };
}

function passedCase() {
  return {
    id: 'case-1',
    title: 'GET /api/clients',
    status: 'passed',
    evidence: {
      request: { method: 'GET', url: '/api/clients', headers: { Authorization: '[REDACTED]' }, body: null },
      response: {
        status: 200,
        ok: true,
        headers: {},
        body: { clients: [{ id: 1, name: 'Acme' }], total: 1 },
        durationMs: 12,
      },
    },
    checks: [{ name: 'status', kind: 'status', expected: '2xx', actual: 200, passed: true }],
    verdict: 'PASSED — status 200',
    reproSteps: [],
    blockedReason: null,
  };
}

function passedCase2() {
  return {
    id: 'case-2',
    title: 'GET /api/health',
    status: 'passed',
    evidence: {
      request: { method: 'GET', url: '/api/health', headers: { Authorization: '[REDACTED]' }, body: null },
      response: { status: 200, ok: true, headers: {}, body: { ok: true }, durationMs: 4 },
    },
    checks: [{ name: 'status', kind: 'status', expected: '2xx', actual: 200, passed: true }],
    verdict: 'PASSED — status 200',
    reproSteps: [],
    blockedReason: null,
  };
}

function failedCase() {
  return {
    id: 'case-3',
    title: 'POST /api/clients',
    status: 'failed',
    evidence: {
      request: {
        method: 'POST',
        url: '/api/clients',
        headers: { Authorization: '[REDACTED]' },
        body: { name: '', email: 'test@example.com' },
      },
      response: { status: 500, ok: false, headers: {}, body: { error: 'Internal Server Error' }, durationMs: 22 },
    },
    checks: [
      { name: 'status', kind: 'status', expected: 400, actual: 500, passed: false },
      { name: 'json-parseable', kind: 'shape-observed', expected: 'valid JSON body', actual: 'valid JSON', passed: true },
    ],
    verdict: 'FAILED — expected 400, got 500',
    reproSteps: [],
    blockedReason: null,
  };
}

function blockedCase() {
  return {
    id: 'case-4',
    title: 'DELETE /api/clients/42',
    status: 'blocked',
    evidence: {
      request: { method: 'DELETE', url: '/api/clients/42', headers: { Authorization: '[REDACTED]' }, body: null },
      response: null,
    },
    checks: [],
    verdict: 'NOT EXECUTED — declined',
    reproSteps: [],
    blockedReason: 'The developer declined confirmation for this destructive call.',
  };
}

function fourCaseResults() {
  return {
    schemaVersion: 1,
    run: makeRun(),
    cases: [passedCase(), passedCase2(), failedCase(), blockedCase()],
  };
}

// Extracts the Markdown text belonging to the Nth "## Case N — ..." section,
// from its heading up to (but not including) the next "## Case" heading.
function caseSection(markdown, index) {
  const headingRe = new RegExp(`## Case ${index} —[^\\n]*`);
  const match = markdown.match(headingRe);
  if (!match) return '';
  const start = markdown.indexOf(match[0]);
  const rest = markdown.slice(start + match[0].length);
  const nextHeadingMatch = rest.match(/\n## Case \d+ —/);
  const end = nextHeadingMatch ? start + match[0].length + nextHeadingMatch.index : markdown.length;
  return markdown.slice(start, end);
}

describe('summarise', () => {
  it('counts passed, failed, blocked and total', () => {
    const counts = summarise(fourCaseResults().cases);
    expect(counts).toEqual({ passed: 2, failed: 1, blocked: 1, total: 4 });
  });
});

describe('renderReport — structure', () => {
  it('summary line reports 2 passed, 1 failed, 1 blocked (pending confirmation)', () => {
    const markdown = renderReport(fourCaseResults());
    expect(markdown).toContain('2 passed');
    expect(markdown).toContain('1 failed');
    expect(markdown).toContain('1 blocked (pending confirmation)');
  });

  it('emits one ## Case heading per case, in results.cases order, ending in PASSED/FAILED/BLOCKED', () => {
    const markdown = renderReport(fourCaseResults());
    const headings = [...markdown.matchAll(/## Case \d+ —.*— (PASSED|FAILED|BLOCKED)/g)].map((m) => m[1]);
    expect(headings).toEqual(['PASSED', 'PASSED', 'FAILED', 'BLOCKED']);
  });

  it('renders full request and response for a passed case (D-08)', () => {
    const markdown = renderReport(fourCaseResults());
    const section = caseSection(markdown, 1);
    expect(section).toContain('GET');
    expect(section).toContain('/api/clients');
    expect(section).toContain('200');
    expect(section).toContain('Acme');
  });

  it('renders full request and response plus a quoting Verdict for a failed case', () => {
    const markdown = renderReport(fourCaseResults());
    const section = caseSection(markdown, 3);
    expect(section).toContain('POST');
    expect(section).toContain('/api/clients');
    expect(section).toContain('500');
    expect(section).toMatch(/\*\*Verdict:\*\*.*(400.*500|500.*400)/s);
  });

  it('renders a blocked case with method/URL/reason, no request sent, and no Response block', () => {
    const markdown = renderReport(fourCaseResults());
    const section = caseSection(markdown, 4);
    expect(section).toContain('DELETE');
    expect(section).toContain('/api/clients/42');
    expect(section).toContain('The developer declined confirmation');
    expect(section.toLowerCase()).toContain('no request was sent');
    expect(section).not.toContain('**Response:**');
  });

  it('labels a shape-observed check as "shape observed" rather than a formal contract check', () => {
    const markdown = renderReport(fourCaseResults());
    const section = caseSection(markdown, 3);
    expect(section.toLowerCase()).toContain('shape observed');
  });

  it('lists blocked cases in a "Blocked pending confirmation" section', () => {
    const markdown = renderReport(fourCaseResults());
    expect(markdown).toContain('## Blocked pending confirmation');
  });
});

describe('renderReport — evidence enforcement (SAFE-03)', () => {
  it('throws EvidenceMissingError when a passed case has evidence.response null', () => {
    const results = fourCaseResults();
    results.cases[0].evidence.response = null;
    expect(() => renderReport(results)).toThrow(EvidenceMissingError);
  });

  it('throws EvidenceMissingError when a failed case has evidence absent entirely', () => {
    const results = fourCaseResults();
    delete results.cases[2].evidence;
    expect(() => renderReport(results)).toThrow(EvidenceMissingError);
  });

  it('does NOT throw for a blocked case with evidence.response null', () => {
    const results = { schemaVersion: 1, run: makeRun(), cases: [blockedCase()] };
    expect(() => renderReport(results)).not.toThrow();
  });
});

describe('reportFileName', () => {
  it('produces YYYY-MM-DD-HHmm-kebab-slug.md', () => {
    const name = reportFileName('client crud', new Date('2026-08-10T14:32:00'));
    expect(name).toMatch(/^2026-08-10-1432-client-crud\.md$/);
  });
});

// renderCase is exercised indirectly through renderReport above (same code
// path). This direct call confirms the export exists and behaves the same
// in isolation, matching the plan's exports contract.
describe('renderCase (direct)', () => {
  it('renders a single passed case section given an index', () => {
    const section = renderCase(passedCase(), 1);
    expect(section).toContain('## Case 1 — GET /api/clients — PASSED');
  });
});
