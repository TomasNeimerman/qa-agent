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
    expect(found.titulo).toContain('dia_cierre limite superior mas 1');
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

  it('throws when the resolved case\'s own block carries a forbidden dispatch flag (CR-01)', () => {
    const mutated = golden.replace(
      '- **Pasos:** POST /api/categorias con body `{ "nombre": "Alquiler", "tipo": "egreso" }`.',
      '- **Pasos:** POST /api/categorias con body `{ "nombre": "Alquiler", "tipo": "egreso" }` --confirmed --allow-non-local.'
    );
    let thrown;
    try {
      findCase(mutated, 'case-1');
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(TestCaseFormatError);
    expect(thrown.message).toContain('case-1');
    expect(thrown.message).toContain('--confirmed');
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

describe('parseTestCasesDoc — surface structure', () => {
  it('throws when a surface heading has no "**Origen del surface:**" line, naming the surface (WR-03)', () => {
    const mutated = golden.replace(
      '## POST /api/categorias\n\n**Origen del surface:** app/api/categorias/route.ts:12-41\n',
      '## POST /api/categorias\n'
    );
    let thrown;
    try {
      parseTestCasesDoc(mutated);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(TestCaseFormatError);
    expect(thrown.message).toContain('Origen del surface');
    expect(thrown.message).toContain('POST /api/categorias');
  });
});

describe('validateTestCasesDoc — the valid document', () => {
  it('returns valid with counts totalling 14 cases summing correctly by Tipo and Ejecución', () => {
    const result = validateTestCasesDoc(golden);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.counts.cases).toBe(14);
    const tipoSum = Object.values(result.counts.byTipo).reduce((a, b) => a + b, 0);
    const ejecucionSum = Object.values(result.counts.byEjecucion).reduce((a, b) => a + b, 0);
    expect(tipoSum).toBe(14);
    expect(ejecucionSum).toBe(14);
    expect(result.counts.surfaces).toBeGreaterThanOrEqual(2);
  });

  it('parseTestCasesDoc captures every surface\'s Origen del surface line, blank line and all (WR-03 regression)', () => {
    // The format's own worked example puts a blank line between a surface
    // heading and its Origen line, and the golden fixture matches that —
    // this locks in that the blank-line-skip added for WR-03 does not
    // regress the ordinary case into a false "missing" error, and that
    // `origen` is actually populated rather than silently left ''.
    const doc = parseTestCasesDoc(golden);
    expect(doc.surfaces.length).toBeGreaterThanOrEqual(2);
    for (const surface of doc.surfaces) {
      expect(surface.origen).toBeTruthy();
    }
    expect(doc.surfaces[0].origen).toBe('app/api/categorias/route.ts:12-41');
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

  it('a surface heading with no "**Origen del surface:**" line is invalid, naming the surface (WR-03)', () => {
    const mutated = golden.replace(
      '## POST /api/categorias\n\n**Origen del surface:** app/api/categorias/route.ts:12-41\n',
      '## POST /api/categorias\n'
    );
    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Origen del surface') && e.includes('POST /api/categorias'))).toBe(true);
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

  it('a forbidden dispatch flag inside the metadata **Instrucción:** field is invalid (WR-04)', () => {
    const mutated = golden.replace(
      '**Instrucción:** (vacío — escaneo completo, no instrucción puntual)',
      '**Instrucción:** correr con --confirmed siempre'
    );
    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('--confirmed') && e.toLowerCase().includes('metadata'))).toBe(true);
  });

  it('a forbidden dispatch flag inside a surface heading is invalid (WR-04)', () => {
    const mutated = golden.replace('## POST /api/categorias', '## POST /api/categorias --confirmed');
    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('--confirmed') && e.includes('POST /api/categorias'))).toBe(true);
  });

  it('a single deleted case reports exactly one gap, not a cascade of false gaps for every case after it (WR-01)', () => {
    // Delete case-5's entire block (its heading through the line before
    // case-6's heading), leaving 1, 2, 3, 4, 6, 7, ... — the exact D-06
    // "case deleted by hand" scenario. Before the WR-01 fix, expectedIndex
    // never resynced to the ID actually found, so every case from case-6
    // onward was also flagged as a gap.
    const lines = golden.split('\n');
    const case5Start = lines.findIndex((l) => l.startsWith('### case-5 —'));
    const case6Start = lines.findIndex((l) => l.startsWith('### case-6 —'));
    expect(case5Start).toBeGreaterThan(-1);
    expect(case6Start).toBeGreaterThan(case5Start);
    const mutated = [...lines.slice(0, case5Start), ...lines.slice(case6Start)].join('\n');

    const result = validateTestCasesDoc(mutated);
    expect(result.valid).toBe(false);
    const gapErrors = result.errors.filter((e) => e.includes('sequence gap'));
    expect(gapErrors).toHaveLength(1);
    expect(gapErrors[0]).toContain('case-5');
    expect(gapErrors[0]).toContain('case-6');
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
    expect(parsed.counts.cases).toBe(14);
  });

  it('exits 0 for --file plus --case, printing that single case as JSON', () => {
    const { status, stdout } = runCli(['--file', GOLDEN_DOC_PATH, '--case', 'case-1']);
    expect(status).toBe(0);
    const parsed = JSON.parse(stdout.trimEnd());
    expect(parsed.id).toBe('case-1');
  });

  it('exits 9 (never 0) for --file plus --case against a hand-edited case carrying a forbidden dispatch flag (CR-01)', () => {
    // Reproduces the review's verified repro: a case's Pasos field
    // hand-edited to contain "--confirmed --allow-non-local" must now be
    // rejected by the exact CLI invocation SKILL.md's "## Running generated
    // cases" step 3 documents, not handed back verbatim with exit 0.
    const badDoc = golden.replace(
      '- **Pasos:** POST /api/categorias con body `{ "nombre": "Alquiler", "tipo": "egreso" }`.',
      '- **Pasos:** DELETE /api/franquicias/1 --confirmed --allow-non-local.'
    );
    const filePath = join(tmpDir, 'flagged.md');
    writeFileSync(filePath, badDoc);
    const { status, stdout, stderr } = runCli(['--file', filePath, '--case', 'case-1']);
    expect(status).toBe(9);
    expect(stdout).toBe('');
    expect(stderr).toContain('case-1');
    expect(stderr).toContain('--confirmed');
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

describe('the scoped golden document (DISC-03 metadata variant)', () => {
  const SCOPED_DOC_PATH = resolve(__dirname, '__fixtures__/sample-test-cases-scoped.md');
  const scoped = readFileSync(SCOPED_DOC_PATH, 'utf8');

  it('parses and validates cleanly', () => {
    expect(() => parseTestCasesDoc(scoped)).not.toThrow();
    const result = validateTestCasesDoc(scoped);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('has a metadata origin and instruction that differ from the full-scan golden document', () => {
    const fullScan = parseTestCasesDoc(golden);
    const doc = parseTestCasesDoc(scoped);
    expect(doc.metadata.origen).not.toBe(fullScan.metadata.origen);
    expect(doc.metadata.instruccion).not.toBe(fullScan.metadata.instruccion);
    expect(doc.metadata.origen).toContain('Instrucción puntual');
    expect(doc.metadata.instruccion).toBeTruthy();
  });

  it('has the same case structure (five fields + Ejecución, grouped by surface) as the full-scan document', () => {
    const doc = parseTestCasesDoc(scoped);
    expect(doc.surfaces.length).toBeGreaterThanOrEqual(1);
    const allCases = doc.surfaces.flatMap((s) => s.cases);
    expect(allCases.length).toBeGreaterThanOrEqual(3);
    for (const c of allCases) {
      expect(c.titulo).toBeTruthy();
      expect(c.precondiciones).toBeTruthy();
      expect(c.pasos).toBeTruthy();
      expect(c.resultadoEsperado).toBeTruthy();
      expect(CASE_TYPES).toContain(c.tipo);
      expect(EXECUTION_MODES).toContain(c.ejecucion);
    }
  });

  it('names individual files on its scope line, never a glob pattern', () => {
    const doc = parseTestCasesDoc(scoped);
    expect(doc.metadata.alcance).not.toMatch(/\*/);
    expect(doc.metadata.alcance).toContain('app/login/actions.ts');
    expect(doc.metadata.alcance).toContain('app/login/page.tsx');
  });

  it('is not byte-identical to the full-scan golden document', () => {
    expect(scoped).not.toBe(golden);
  });
});
