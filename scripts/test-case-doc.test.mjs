// scripts/test-case-doc.test.mjs
// Unit coverage for plan 03-03 Task 1: anchored case lookup (findCase),
// full document validation (validateTestCasesDoc) and the CLI's exit codes.
// Every invalid subject in this file is the committed golden document
// (scripts/__fixtures__/sample-test-cases.md) with exactly one thing
// mutated, so a failing assertion points at the rule under test rather than
// at the fixture (03-03-PLAN.md Task 1 action (a)).

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CASE_FIELDS,
  CASE_HEADING_PATTERN,
  CASE_TYPES,
  EXECUTION_MODES,
  FORBIDDEN_DISPATCH_FLAGS,
  TestCaseFormatError,
  findCase,
  parseTestCasesDoc,
  validateTestCasesDoc,
} from './test-case-doc.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const TEST_CASE_DOC = resolve(__dirname, 'test-case-doc.mjs');
const GOLDEN_DOC_PATH = resolve(__dirname, '__fixtures__/sample-test-cases.md');
// Normalised to \n — the fixture is committed with CRLF line endings, and
// every mutation below targets a literal multi-line needle. Both
// findCase/validateTestCasesDoc split on /\r?\n/ internally, so an LF-only
// copy parses identically; normalising here just keeps every needle in this
// file a single, unambiguous literal.
const golden = readFileSync(GOLDEN_DOC_PATH, 'utf8').replace(/\r\n/g, '\n');

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'qa-testcasedoc-'));
});

afterEach(() => {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

function runCli(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [TEST_CASE_DOC, ...args], {
      encoding: 'utf8',
      ...opts,
    });
    return { status: 0, stdout, stderr: '' };
  } catch (err) {
    return { status: err.status, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

describe('findCase — anchored lookup, the collision case', () => {
  it('case-1 returns the case whose id is exactly case-1, not case-12', () => {
    const a = findCase(golden, 'case-1');
    const b = findCase(golden, 'case-12');
    expect(a.id).toBe('case-1');
    expect(b.id).toBe('case-12');
    expect(a.titulo).not.toBe(b.titulo);
  });

  it('case-12 returns the twelfth case', () => {
    const found = findCase(golden, 'case-12');
    expect(found.id).toBe('case-12');
    expect(found.titulo).toContain('Rol fuera del dominio enumerado');
  });

  it('a bare number resolves to the qualified form and returns the same object', () => {
    const bare = findCase(golden, '1');
    const qualified = findCase(golden, 'case-1');
    expect(bare).toEqual(qualified);
  });

  it('carries the surface heading the case was grouped under', () => {
    const found = findCase(golden, 'case-1');
    expect(found.surface).toBe('POST /api/categorias');
  });

  it('case-99 throws TestCaseFormatError naming case-99 and listing the contained IDs', () => {
    let thrown;
    try {
      findCase(golden, 'case-99');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(TestCaseFormatError);
    expect(thrown.message).toContain('case-99');
    expect(thrown.message).toContain('case-1');
    expect(thrown.message).toContain('case-12');
  });

  it('throws rather than returning the first match when two headings claim the same ID', () => {
    const lines = golden.split('\n');
    const collision = lines
      .map((line) => (line.startsWith('### case-2 —') ? line.replace('case-2', 'case-1') : line))
      .join('\n');

    let thrown;
    try {
      findCase(collision, 'case-1');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(TestCaseFormatError);
    expect(thrown.message).toContain('case-1');
  });
});

describe('validateTestCasesDoc — the valid document', () => {
  it('returns valid with counts totalling 12 cases summing correctly by Tipo and Ejecución', () => {
    const result = validateTestCasesDoc(golden);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.counts.cases).toBe(12);
    const tipoSum = Object.values(result.counts.byTipo).reduce((a, b) => a + b, 0);
    const ejecucionSum = Object.values(result.counts.byEjecucion).reduce((a, b) => a + b, 0);
    expect(tipoSum).toBe(12);
    expect(ejecucionSum).toBe(12);
    expect(result.counts.surfaces).toBeGreaterThanOrEqual(2);
  });
});

describe('validateTestCasesDoc — one assertion per failure mode', () => {
  it('a case block missing one of the five required bullets is invalid, naming the label and case ID', () => {
    const mutated = golden.replace(
      "- **Tipo:** positivo\n- **Ejecución:** API\n\n### case-2",
      '- **Ejecución:** API\n\n### case-2'
    );
    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Tipo') && e.includes('case-1'))).toBe(true);
  });

  it('a Tipo value outside the allowed set is invalid, naming the offending value', () => {
    const mutated = golden.replace('- **Tipo:** positivo\n- **Ejecución:** API\n\n### case-2', '- **Tipo:** invalido\n- **Ejecución:** API\n\n### case-2');
    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('invalido'))).toBe(true);
  });

  it('an Ejecución value outside the allowed set is invalid, naming the offending value', () => {
    const mutated = golden.replace(
      '### case-1 — Alta de categoría con datos válidos\n- **Precondiciones:** Usuario autenticado con rol `admin`.\n- **Pasos:** POST /api/categorias con body `{ "nombre": "Alquiler", "tipo": "egreso" }`.\n- **Resultado esperado:** 200, `{ ok: true, categoria: { nombre: "Alquiler", tipo: "egreso" } }`.\n- **Tipo:** positivo\n- **Ejecución:** API',
      '### case-1 — Alta de categoría con datos válidos\n- **Precondiciones:** Usuario autenticado con rol `admin`.\n- **Pasos:** POST /api/categorias con body `{ "nombre": "Alquiler", "tipo": "egreso" }`.\n- **Resultado esperado:** 200, `{ ok: true, categoria: { nombre: "Alquiler", tipo: "egreso" } }`.\n- **Tipo:** positivo\n- **Ejecución:** MOVIL'
    );
    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('MOVIL'))).toBe(true);
  });

  it('a duplicate ID is invalid, naming the ID involved', () => {
    const mutated = golden.replace('### case-2 —', '### case-1 —');
    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('duplicate') && e.includes('case-1'))).toBe(true);
  });

  it('a sequence with a gap is invalid, naming the ID involved', () => {
    const mutated = golden.replace('### case-2 —', '### case-3 —');
    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('case-2'))).toBe(true);
  });

  it('a sequence not starting at one is invalid, naming the ID involved', () => {
    const mutated = golden.replace('### case-1 —', '### case-2 —');
    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('case-1'))).toBe(true);
  });

  it('a negativo case with no file-and-line citation is invalid, naming that case ID', () => {
    const mutated = golden.replace(
      '- **Resultado esperado:** 401, `{ error: "No autenticado" }` (app/api/categorias/route.ts:15, mensaje literal).',
      '- **Resultado esperado:** 401, `{ error: "No autenticado" }`.'
    );
    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('case-2') && e.toLowerCase().includes('citation'))).toBe(true);
  });

  it('a positivo case with no citation is valid — the citation rule only applies to negativo/edge', () => {
    // case-1 is positivo and already carries no file:line citation in golden.
    const result = validateTestCasesDoc(golden);
    expect(result.errors.some((e) => e.includes('case-1') && e.toLowerCase().includes('citation'))).toBe(false);
  });

  it('a document containing a forbidden dispatch flag anywhere is invalid, naming the flag and the case', () => {
    const mutated = golden.replace(
      '- **Pasos:** POST /api/categorias con body `{ "nombre": "Alquiler", "tipo": "egreso" }`.',
      '- **Pasos:** POST /api/categorias con body `{ "nombre": "Alquiler", "tipo": "egreso" }` usando --confirmed.'
    );
    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('--confirmed') && e.includes('case-1'))).toBe(true);
  });

  it('collects every error rather than throwing on the first', () => {
    let mutated = golden.replace('### case-2 —', '### case-1 —'); // duplicate
    mutated = mutated.replace('- **Tipo:** invalido\n', '- **Tipo:** invalido\n'); // no-op guard
    mutated = mutated.replace(
      '- **Resultado esperado:** 401, `{ error: "No autenticado" }` (app/api/categorias/route.ts:15, mensaje literal).',
      '- **Resultado esperado:** 401, `{ error: "No autenticado" }`.'
    );
    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('CLI', () => {
  it('exits 0 for the golden document, printing one JSON line whose valid flag matches the direct call', () => {
    const { status, stdout } = runCli(['--file', GOLDEN_DOC_PATH]);
    expect(status).toBe(0);
    const lines = stdout.trimEnd().split('\n');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.valid).toBe(true);
    expect(parsed.counts.cases).toBe(12);
  });

  it('exits 0 for --file plus --case, printing that single case as JSON', () => {
    const { status, stdout } = runCli(['--file', GOLDEN_DOC_PATH, '--case', 'case-1']);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout.trimEnd());
    expect(parsed.id).toBe('case-1');
  });

  it('exits 9 for a document with a missing field, naming the offending case ID in stderr', () => {
    const badDoc = golden.replace('- **Tipo:** positivo\n- **Ejecución:** API\n\n### case-2', '- **Ejecución:** API\n\n### case-2');
    const filePath = join(tmpDir, 'bad.md');
    writeFileSync(filePath, badDoc);
    const { status, stderr } = runCli(['--file', filePath]);
    expect(status).toBe(9);
    expect(stderr).toContain('case-1');
  });

  it('exits 2 with no --file argument', () => {
    const { status } = runCli([]);
    expect(status).toBe(2);
  });

  it('exits 2 against a path that does not exist, naming the path', () => {
    const missing = join(tmpDir, 'does-not-exist.md');
    const { status, stderr } = runCli(['--file', missing]);
    expect(status).toBe(2);
    expect(stderr).toContain(missing);
  });
});

describe('exports', () => {
  it('exposes every symbol this plan and the next one build on', () => {
    expect(typeof parseTestCasesDoc).toBe('function');
    expect(typeof findCase).toBe('function');
    expect(typeof validateTestCasesDoc).toBe('function');
    expect(Array.isArray(FORBIDDEN_DISPATCH_FLAGS)).toBe(true);
    expect(FORBIDDEN_DISPATCH_FLAGS).toHaveLength(3);
    expect(CASE_HEADING_PATTERN).toBeInstanceOf(RegExp);
    expect(CASE_FIELDS).toContain('Tipo');
    expect(CASE_TYPES).toEqual(['positivo', 'negativo', 'edge']);
    expect(EXECUTION_MODES).toEqual(['API', 'UI']);
  });

  it('every FORBIDDEN_DISPATCH_FLAGS literal is a real api-client.mjs flag', () => {
    const apiClientSrc = readFileSync(resolve(__dirname, 'api-client.mjs'), 'utf8');
    for (const flag of FORBIDDEN_DISPATCH_FLAGS) {
      expect(apiClientSrc).toContain(flag.replace(/^--/, ''));
    }
  });
});
