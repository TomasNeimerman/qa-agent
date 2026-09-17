// scripts/discovery.e2e.test.mjs
// The tracer end-to-end lock for 03-01-PLAN.md Task 1: fixture repo ->
// discover-schema.mjs JSON -> conforming test-cases document that cites the
// discovered constraint. This file was written first, before any
// implementation existed, and watched red — see 03-01-SUMMARY.md.

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  discoverSchema,
  MigrationsDirError,
  PathEscapeError,
} from './discover-schema.mjs';
import { parseTestCasesDoc, TestCaseFormatError, validateTestCasesDoc } from './test-case-doc.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DISCOVER_SCHEMA = resolve(__dirname, 'discover-schema.mjs');
const FIXTURE_REPO = resolve(__dirname, '__fixtures__/mock-target-repo');
const GOLDEN_DOC_PATH = resolve(__dirname, '__fixtures__/sample-test-cases.md');

describe('discovery e2e — schema tier', () => {
  const result = discoverSchema({ projectRoot: FIXTURE_REPO });

  it('lists migrations in lexicographic (chronological) order', () => {
    expect(result.files).toEqual(['0001_init.sql', '0002_franquicias_horario.sql']);
  });

  it('extracts the rol_usuario enum', () => {
    const rolUsuario = result.enums.find((e) => e.name === 'rol_usuario');
    expect(rolUsuario).toBeDefined();
    expect(rolUsuario.values).toEqual(['admin', 'franquiciado']);
  });

  it('extracts usuarios.nombre as a NOT NULL text column', () => {
    const nombre = result.constraints.find(
      (c) => c.table === 'usuarios' && c.column === 'nombre'
    );
    expect(nombre).toBeDefined();
    expect(nombre.type).toBe('text');
    expect(nombre.notNull).toBe(true);
  });

  it('extracts categorias.nombre as UNIQUE', () => {
    const nombre = result.constraints.find(
      (c) => c.table === 'categorias' && c.column === 'nombre'
    );
    expect(nombre).toBeDefined();
    expect(nombre.unique).toBe(true);
  });

  it('cross-references usuarios.rol against the declared enum', () => {
    const rol = result.constraints.find(
      (c) => c.table === 'usuarios' && c.column === 'rol'
    );
    expect(rol).toBeDefined();
    expect(rol.type).toBe('rol_usuario');
    expect(rol.enumValues).toEqual(['admin', 'franquiciado']);
  });

  it('extracts usuarios.tenant_id as a CASCADE foreign key to tenants(id)', () => {
    const tenantId = result.constraints.find(
      (c) => c.table === 'usuarios' && c.column === 'tenant_id'
    );
    expect(tenantId).toBeDefined();
    expect(tenantId.references).toEqual({
      table: 'tenants',
      column: 'id',
      onDelete: 'CASCADE',
    });
  });

  it('finds exactly one data CHECK across the whole fixture set, never a policy predicate', () => {
    const checked = result.constraints.filter((c) => c.check);
    expect(checked).toHaveLength(1);
    expect(checked[0].check).toBe('dia_cierre BETWEEN 0 AND 6');
    expect(checked[0].column).toBe('dia_cierre');
    expect(checked[0].origin).toBe('alter_table');
    expect(checked[0].source.file).toBe('0002_franquicias_horario.sql');
  });

  it('reports a machine-readable bounds object on the dia_cierre constraint record (D-09)', () => {
    const diaCierre = result.constraints.find((c) => c.column === 'dia_cierre');
    expect(diaCierre).toBeDefined();
    expect(diaCierre.bounds).toEqual({ min: 0, max: 6 });
  });

  it('returns a top-level policies array of length 3, one record per fixture CREATE POLICY', () => {
    expect(result.policies).toHaveLength(3);
    const byTable = Object.fromEntries(result.policies.map((p) => [p.table, p]));
    for (const table of ['usuarios', 'categorias', 'franquicias']) {
      expect(byTable[table]).toBeDefined();
      expect(byTable[table].command).toBe('INSERT');
      expect(byTable[table].withCheck).toBeTruthy();
      expect(byTable[table].source.file).toBe('0001_init.sql');
      expect(byTable[table].source.line).toBeGreaterThan(0);
      expect(Number.isInteger(byTable[table].source.line)).toBe(true);
    }
  });

  it('counts the three policy WITH CHECK predicates as policyWithCheckCount', () => {
    expect(result.policyWithCheckCount).toBe(3);
  });

  it('gives every constraint a bare source.file present in files and a positive source.line', () => {
    for (const c of result.constraints) {
      expect(result.files).toContain(c.source.file);
      expect(c.source.line).toBeGreaterThan(0);
      expect(Number.isInteger(c.source.line)).toBe(true);
    }
  });
});

describe('discovery e2e — RLS-free project (D-03, Pitfall 3)', () => {
  let tmpDir;

  afterEach(() => {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
      tmpDir = undefined;
    }
  });

  it('a migrations directory containing no CREATE POLICY yields an empty policies array, without error', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'qa-discover-no-rls-'));
    const migrationsDir = join(tmpDir, 'supabase', 'migrations');
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(join(migrationsDir, '0001_init.sql'), 'CREATE TABLE t (\n  a text NOT NULL\n);\n');

    const result = discoverSchema({ projectRoot: tmpDir });
    expect(result.policies).toEqual([]);
    expect(result.policyWithCheckCount).toBe(0);
  });
});

describe('discovery e2e — document tier', () => {
  const markdown = readFileSync(GOLDEN_DOC_PATH, 'utf8');
  const doc = parseTestCasesDoc(markdown);
  const allCases = doc.surfaces.flatMap((s) => s.cases);

  it('parses non-empty metadata', () => {
    expect(doc.metadata.generado).toBeTruthy();
    expect(doc.metadata.origen).toBeTruthy();
    expect(doc.metadata.instruccion).toBeTruthy();
    expect(doc.metadata.router).toBeTruthy();
    expect(doc.metadata.alcance).toBeTruthy();
  });

  it('has at least 2 surfaces and exactly 14 flattened cases', () => {
    expect(doc.surfaces.length).toBeGreaterThanOrEqual(2);
    expect(allCases).toHaveLength(14);
  });

  it('has case IDs case-1 through case-14, in order, no duplicates, no gaps', () => {
    expect(allCases.map((c) => c.id)).toEqual(
      Array.from({ length: 14 }, (_, i) => `case-${i + 1}`)
    );
  });

  it('has every required field non-empty and every enum field in range', () => {
    for (const c of allCases) {
      expect(c.titulo).toBeTruthy();
      expect(c.precondiciones).toBeTruthy();
      expect(c.pasos).toBeTruthy();
      expect(c.resultadoEsperado).toBeTruthy();
      expect(['positivo', 'negativo', 'edge']).toContain(c.tipo);
      expect(['API', 'UI']).toContain(c.ejecucion);
    }
  });

  it('has at least one positivo and at least one negativo case', () => {
    expect(allCases.some((c) => c.tipo === 'positivo')).toBe(true);
    expect(allCases.some((c) => c.tipo === 'negativo')).toBe(true);
  });

  it('cites a file-and-line for every negativo/edge case', () => {
    const citationPattern = /[\w./-]+:\d+/;
    for (const c of allCases) {
      if (c.tipo === 'negativo' || c.tipo === 'edge') {
        expect(c.resultadoEsperado).toMatch(citationPattern);
      }
    }
  });

  it('rejects a document whose second case heading has a gap (case-1 then case-3)', () => {
    const gapDoc = [
      '# Casos de Prueba — gap',
      '**Generado:** x',
      '**Origen:** x',
      '**Instrucción:** x',
      '**Router:** x',
      '**Alcance:** x',
      '',
      '## Surface',
      '',
      '**Origen del surface:** x:1',
      '',
      '### case-1 — First',
      '- **Precondiciones:** a',
      '- **Pasos:** b',
      '- **Resultado esperado:** c',
      '- **Tipo:** positivo',
      '- **Ejecución:** API',
      '',
      '### case-3 — Third',
      '- **Precondiciones:** a',
      '- **Pasos:** b',
      '- **Resultado esperado:** c',
      '- **Tipo:** positivo',
      '- **Ejecución:** API',
      '',
    ].join('\n');

    let thrown;
    try {
      parseTestCasesDoc(gapDoc);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(TestCaseFormatError);
    expect(thrown.message).toContain('case-2');
    expect(thrown.message).toContain('case-3');
  });

  it('rejects a case block missing its Ejecución bullet', () => {
    const missingEjecucion = [
      '# Casos de Prueba — missing-field',
      '**Generado:** x',
      '**Origen:** x',
      '**Instrucción:** x',
      '**Router:** x',
      '**Alcance:** x',
      '',
      '## Surface',
      '',
      '**Origen del surface:** x:1',
      '',
      '### case-1 — First',
      '- **Precondiciones:** a',
      '- **Pasos:** b',
      '- **Resultado esperado:** c',
      '- **Tipo:** positivo',
      '',
    ].join('\n');

    let thrown;
    try {
      parseTestCasesDoc(missingEjecucion);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(TestCaseFormatError);
    expect(thrown.message).toContain('Ejecución');
    expect(thrown.message).toContain('case-1');
  });
});

describe('discovery e2e — cross-tier link', () => {
  const result = discoverSchema({ projectRoot: FIXTURE_REPO });
  const markdown = readFileSync(GOLDEN_DOC_PATH, 'utf8');
  const doc = parseTestCasesDoc(markdown);
  const allCases = doc.surfaces.flatMap((s) => s.cases);

  it('feeds the schema tier into the document: a case cites the same dia_cierre check the schema found', () => {
    const checked = result.constraints.filter((c) => c.check);
    expect(checked).toHaveLength(1);
    expect(checked[0].column).toBe('dia_cierre');

    const diaCierreCase = allCases.find((c) => c.resultadoEsperado.includes('dia_cierre'));
    expect(diaCierreCase).toBeDefined();
  });

  it('groups a case under a surface matching the fixture route handler on disk', () => {
    const categoriasSurface = doc.surfaces.find((s) => s.heading.includes('/api/categorias'));
    expect(categoriasSurface).toBeDefined();
    expect(categoriasSurface.cases.length).toBeGreaterThan(0);
  });

  it('turns the discovered dia_cierre bounds into exactly four boundary cases (min-1/min/max/max+1), each appearing in exactly one case Pasos', () => {
    const diaCierre = result.constraints.find((c) => c.column === 'dia_cierre');
    expect(diaCierre.bounds).toEqual({ min: 0, max: 6 });
    const boundaryValues = [
      diaCierre.bounds.min - 1,
      diaCierre.bounds.min,
      diaCierre.bounds.max,
      diaCierre.bounds.max + 1,
    ];
    expect(boundaryValues).toEqual([-1, 0, 6, 7]);

    const diaCierreSurface = doc.surfaces.find((s) => s.heading.includes('día de cierre'));
    expect(diaCierreSurface).toBeDefined();

    for (const value of boundaryValues) {
      const matches = diaCierreSurface.cases.filter((c) =>
        c.pasos.includes(`dia_cierre: ${value}`)
      );
      expect(matches).toHaveLength(1);
    }
  });

  it('validates the golden document back through validateTestCasesDoc as valid, carrying 14 cases', () => {
    const { valid, errors, counts } = validateTestCasesDoc(markdown);
    expect(errors).toEqual([]);
    expect(valid).toBe(true);
    expect(counts.cases).toBe(14);
  });
});

describe('discovery e2e — CLI', () => {
  it('exits 0 and prints exactly one line of JSON', () => {
    const stdout = execFileSync(
      process.execPath,
      [DISCOVER_SCHEMA, '--project-root', FIXTURE_REPO],
      { encoding: 'utf8' }
    );
    const lines = stdout.trimEnd().split('\n');
    expect(lines).toHaveLength(1);
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });

  it('exits 8 and prints nothing to stdout when --migrations-dir escapes the project root', () => {
    let stdout = '';
    let status = 0;
    try {
      stdout = execFileSync(
        process.execPath,
        [DISCOVER_SCHEMA, '--project-root', FIXTURE_REPO, '--migrations-dir', '../../../../'],
        { encoding: 'utf8' }
      );
    } catch (err) {
      status = err.status;
      stdout = err.stdout ?? '';
    }
    expect(status).toBe(8);
    expect(stdout.trim()).toBe('');
  });
});
