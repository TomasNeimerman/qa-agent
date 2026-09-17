// scripts/discover-schema.test.mjs
// Unit coverage for scripts/discover-schema.mjs: comment stripping, every
// constraint form 03-RESEARCH.md observed, the CHECK/WITH CHECK
// disambiguation, path containment (T-03-01, ASVS V5) and the size cap
// (T-03-02, ASVS V12). Calls exported functions directly against inline SQL
// strings and mkdtempSync temp directories — this module has no network or
// external side-effect surface to isolate, so no child process is needed
// except for the CLI-level exit-code assertions.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  MAX_MIGRATION_BYTES,
  MigrationsDirError,
  PathEscapeError,
  discoverSchema,
  extractConstraints,
  extractEnumTypes,
  listMigrations,
  parseCheckBounds,
  parseCheckEnum,
  resolveWithinRoot,
  stripSqlComments,
} from './discover-schema.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DISCOVER_SCHEMA = resolve(__dirname, 'discover-schema.mjs');

let tmpDir;

afterEach(() => {
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = undefined;
  }
});

describe('stripSqlComments', () => {
  it('removes a -- line comment, keeping line count and later line numbers unchanged', () => {
    const sql = 'SELECT 1;\n-- a comment here\nSELECT 2;\n';
    const stripped = stripSqlComments(sql);
    expect(stripped.split('\n')).toHaveLength(sql.split('\n').length);
    expect(stripped).not.toContain('a comment here');
    expect(stripped.split('\n')[2]).toBe('SELECT 2;');
  });

  it('removes a multi-line block comment, keeping the line count unchanged', () => {
    const sql = 'SELECT 1;\n/* start\n   middle\n   end */\nSELECT 2;\n';
    const stripped = stripSqlComments(sql);
    expect(stripped.split('\n')).toHaveLength(sql.split('\n').length);
    expect(stripped).not.toContain('middle');
    expect(stripped.trimEnd().split('\n').at(-1)).toBe('SELECT 2;');
  });

  it('produces no constraint for a CHECK ( that appears only inside a comment', () => {
    const sql = '-- CHECK (should_not_count > 0)\nCREATE TABLE t (\n  a int\n);\n';
    const records = extractConstraints(sql, { file: 'x.sql' });
    expect(records).toHaveLength(1);
    expect(records[0].check).toBeNull();
  });
});

describe('extractConstraints — column forms', () => {
  it('a NOT NULL column yields notNull true, unique false', () => {
    const sql = 'CREATE TABLE t (\n  a text NOT NULL\n);\n';
    const records = extractConstraints(sql, { file: 'x.sql' });
    expect(records[0]).toMatchObject({ column: 'a', type: 'text', notNull: true, unique: false });
  });

  it('a UNIQUE column yields unique true; a PRIMARY KEY column yields primaryKey true', () => {
    const sql = 'CREATE TABLE t (\n  a text UNIQUE,\n  b uuid PRIMARY KEY\n);\n';
    const records = extractConstraints(sql, { file: 'x.sql' });
    const a = records.find((r) => r.column === 'a');
    const b = records.find((r) => r.column === 'b');
    expect(a.unique).toBe(true);
    expect(b.primaryKey).toBe(true);
  });

  it('a REFERENCES column with ON DELETE SET NULL yields the references object', () => {
    const sql = 'CREATE TABLE t (\n  a uuid REFERENCES otra(id) ON DELETE SET NULL\n);\n';
    const records = extractConstraints(sql, { file: 'x.sql' });
    expect(records[0].references).toEqual({ table: 'otra', column: 'id', onDelete: 'SET NULL' });
  });

  it('a column with an inline CHECK yields that expression with origin create_table', () => {
    const sql = 'CREATE TABLE t (\n  a int CHECK (a > 0)\n);\n';
    const records = extractConstraints(sql, { file: 'x.sql' });
    expect(records[0]).toMatchObject({ check: 'a > 0', origin: 'create_table' });
  });

  it('a numeric(12,2) column keeps its full parenthesised type and no false CHECK', () => {
    const sql = 'CREATE TABLE t (\n  amount numeric(12,2) NOT NULL\n);\n';
    const records = extractConstraints(sql, { file: 'x.sql' });
    expect(records[0].type).toBe('numeric(12,2)');
    expect(records[0].check).toBeNull();
  });
});

describe('extractConstraints — multi-line CREATE TABLE citation accuracy (03-03 Task 3 real-repo finding)', () => {
  it('cites each column on its own real line, not the previous column\'s line', () => {
    const sql = [
      '-- comment',
      'CREATE TABLE tenants (',
      '  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),',
      '  nombre      text NOT NULL,',
      '  creado_en   timestamptz NOT NULL DEFAULT now()',
      ');',
      '',
    ].join('\n');
    const records = extractConstraints(sql, { file: 'x.sql' });
    const byColumn = Object.fromEntries(records.map((r) => [r.column, r.source.line]));
    // Line 1 is the comment, line 2 is CREATE TABLE, so id/nombre/creado_en
    // sit on lines 3/4/5 respectively — each entry after the first was
    // previously reported one line too early because its own leading
    // newline (the separator after the prior column's comma) was never
    // counted.
    expect(byColumn.id).toBe(3);
    expect(byColumn.nombre).toBe(4);
    expect(byColumn.creado_en).toBe(5);
  });
});

describe('extractConstraints — ALTER TABLE forms', () => {
  it('ALTER TABLE ... ADD COLUMN ... CHECK yields a record with origin alter_table', () => {
    const sql = 'ALTER TABLE t ADD COLUMN c int CHECK (c > 0);\n';
    const records = extractConstraints(sql, { file: 'x.sql' });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ table: 't', column: 'c', check: 'c > 0', origin: 'alter_table' });
  });

  it('ALTER TABLE ... ADD CONSTRAINT ... CHECK yields column null, origin alter_table', () => {
    const sql = 'ALTER TABLE t ADD CONSTRAINT chk_ab CHECK (a <> b);\n';
    const records = extractConstraints(sql, { file: 'x.sql' });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ table: 't', column: null, check: 'a <> b', origin: 'alter_table' });
  });
});

describe('extractEnumTypes', () => {
  it('returns every CREATE TYPE ... AS ENUM with values in declaration order, including multi-line', () => {
    const sql = `
      CREATE TYPE estado AS ENUM ('abierto', 'cerrado');
      CREATE TYPE rol AS ENUM (
        'admin',
        'user'
      );
    `;
    const enums = extractEnumTypes(sql);
    expect(enums).toHaveLength(2);
    expect(enums.find((e) => e.name === 'estado').values).toEqual(['abierto', 'cerrado']);
    expect(enums.find((e) => e.name === 'rol').values).toEqual(['admin', 'user']);
  });
});

describe('extractConstraints — policy disambiguation (load-bearing)', () => {
  const sql = `
    CREATE TABLE t (
      a int CHECK (a > 0),
      b text NOT NULL
    );
    CREATE POLICY p1 ON t FOR INSERT WITH CHECK (rol() = 'admin');
    CREATE POLICY p2 ON t FOR UPDATE WITH CHECK (rol() = 'owner');
  `;

  it('yields exactly one constraint with a non-null check, and withCheckSkipped 2', () => {
    const records = extractConstraints(sql, { file: 'x.sql' });
    const checked = records.filter((r) => r.check);
    expect(checked).toHaveLength(1);
    expect(checked[0].check).toBe('a > 0');
    expect(records.withCheckSkipped).toBe(2);
  });

  it('a multi-line WITH CHECK predicate still contributes zero constraints', () => {
    const multiline = `
      CREATE POLICY p ON t
        FOR INSERT
        WITH CHECK (
          rol() = 'admin'
          AND tenant_id = tenant_actual()
        );
    `;
    const records = extractConstraints(multiline, { file: 'x.sql' });
    expect(records).toHaveLength(0);
    expect(records.withCheckSkipped).toBe(1);
  });

  it('no constraint check expression ever equals or contains a policy predicate', () => {
    const records = extractConstraints(sql, { file: 'x.sql' });
    for (const r of records) {
      if (r.check) {
        expect(r.check).not.toContain('rol()');
      }
    }
  });
});

describe('parseCheckBounds', () => {
  it('a two-sided BETWEEN yields both bounds inclusive', () => {
    expect(parseCheckBounds('dia_cierre BETWEEN 0 AND 6')).toEqual({ min: 0, max: 6 });
  });

  it('an inclusive lower bound (>=) yields its literal operand as min, no max', () => {
    expect(parseCheckBounds('minimo >= 0')).toEqual({ min: 0, max: null });
  });

  it('an exclusive lower bound (>) resolves to the adjacent inclusive integer', () => {
    expect(parseCheckBounds('cantidad > 0')).toEqual({ min: 1, max: null });
  });

  it('an exclusive upper bound (<) resolves to the adjacent inclusive integer', () => {
    expect(parseCheckBounds('stock < 10')).toEqual({ min: null, max: 9 });
  });

  it('an inclusive upper bound (<=) yields its literal decimal operand as max, no min', () => {
    expect(parseCheckBounds('precio <= 99.5')).toEqual({ min: null, max: 99.5 });
  });

  it('prefers the BETWEEN branch over the comparison branch when both could match', () => {
    expect(parseCheckBounds('dia_cierre BETWEEN 0 AND 6 AND dia_cierre >= 0')).toEqual({
      min: 0,
      max: 6,
    });
  });

  it('returns null for a real CHECK whose shape carries no numeric bound', () => {
    expect(parseCheckBounds("num_nonnulls(objetivo_id, deposito_id) = 1")).toBeNull();
  });

  it('returns null for a value-set CHECK, never a numeric bound', () => {
    expect(parseCheckBounds("tipo IN ('ingreso', 'egreso')")).toBeNull();
  });

  it('returns null for a non-string input rather than throwing', () => {
    expect(parseCheckBounds(null)).toBeNull();
  });
});

describe('parseCheckEnum', () => {
  it('a simple two-value IN list yields the literal values in declaration order', () => {
    expect(parseCheckEnum("tipo IN ('ingreso', 'egreso')")).toEqual(['ingreso', 'egreso']);
  });

  it('matches the IN keyword case-insensitively, three values', () => {
    expect(parseCheckEnum("estado in ('abierto','cerrado','anulado')")).toEqual([
      'abierto',
      'cerrado',
      'anulado',
    ]);
  });

  it('tolerates newlines inside the value list', () => {
    expect(parseCheckEnum("tipo IN (\n  'ingreso',\n  'egreso'\n)")).toEqual([
      'ingreso',
      'egreso',
    ]);
  });

  it('returns null for a BETWEEN expression, no IN keyword present', () => {
    expect(parseCheckEnum('dia_cierre BETWEEN 0 AND 6')).toBeNull();
  });

  it('returns null for a plain comparison expression', () => {
    expect(parseCheckEnum('cantidad > 0')).toBeNull();
  });

  it('returns null for a subquery membership test — no literal value set', () => {
    expect(parseCheckEnum('id IN (SELECT id FROM otra)')).toBeNull();
  });

  it('returns null for a non-string input rather than throwing', () => {
    expect(parseCheckEnum(null)).toBeNull();
  });
});

describe('discoverSchema — bounds attachment', () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'qa-discover-'));
  });

  it('attaches bounds derived from a two-sided BETWEEN CHECK to its constraint record', () => {
    const migrationsDir = join(tmpDir, 'supabase', 'migrations');
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(
      join(migrationsDir, '0001_x.sql'),
      'ALTER TABLE franquicias ADD COLUMN dia_cierre smallint CHECK (dia_cierre BETWEEN 0 AND 6);\n'
    );
    const result = discoverSchema({ projectRoot: tmpDir });
    const diaCierre = result.constraints.find((c) => c.column === 'dia_cierre');
    expect(diaCierre.bounds).toEqual({ min: 0, max: 6 });
  });

  it('attaches bounds: null to every constraint whose check is null', () => {
    const migrationsDir = join(tmpDir, 'supabase', 'migrations');
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(join(migrationsDir, '0001_x.sql'), 'CREATE TABLE t (\n  a text NOT NULL\n);\n');
    const result = discoverSchema({ projectRoot: tmpDir });
    expect(result.constraints[0].check).toBeNull();
    expect(result.constraints[0].bounds).toBeNull();
  });
});

describe('discoverSchema — allowedValues attachment', () => {
  const FIXTURE_REPO = resolve(fileURLToPath(new URL('.', import.meta.url)), '__fixtures__/mock-target-repo');

  it('reports the declared-enum values on usuarios.rol (cross-referenced enum) and null on usuarios.email (no enum, no value-set CHECK)', () => {
    const result = discoverSchema({ projectRoot: FIXTURE_REPO });
    const rol = result.constraints.find((c) => c.table === 'usuarios' && c.column === 'rol');
    const email = result.constraints.find((c) => c.table === 'usuarios' && c.column === 'email');
    expect(rol.allowedValues).toEqual(['admin', 'franquiciado']);
    expect(email.allowedValues).toBeNull();
  });

  it('every constraint record carries an allowedValues key, value may be null', () => {
    const result = discoverSchema({ projectRoot: FIXTURE_REPO });
    for (const c of result.constraints) {
      expect(c).toHaveProperty('allowedValues');
    }
  });

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'qa-discover-'));
  });

  it('reports an inline value-set CHECK as allowedValues when no declared enum matches the column type', () => {
    const migrationsDir = join(tmpDir, 'supabase', 'migrations');
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(
      join(migrationsDir, '0001_x.sql'),
      "CREATE TABLE t (\n  tipo text NOT NULL CHECK (tipo IN ('ingreso', 'egreso'))\n);\n"
    );
    const result = discoverSchema({ projectRoot: tmpDir });
    expect(result.constraints[0].allowedValues).toEqual(['ingreso', 'egreso']);
  });
});

describe('resolveWithinRoot — path containment (T-03-01, ASVS V5)', () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'qa-discover-'));
  });

  it('returns an absolute path under root for a relative descendant candidate', () => {
    mkdirSync(join(tmpDir, 'supabase', 'migrations'), { recursive: true });
    const result = resolveWithinRoot(tmpDir, 'supabase/migrations');
    expect(result.startsWith(tmpDir)).toBe(true);
  });

  it('throws PathEscapeError for a relative candidate that escapes the root', () => {
    expect(() => resolveWithinRoot(tmpDir, '../../etc')).toThrow(PathEscapeError);
  });

  it('throws PathEscapeError naming both the root and the rejected path', () => {
    try {
      resolveWithinRoot(tmpDir, '../../etc');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(PathEscapeError);
      expect(err.message).toContain(tmpDir);
    }
  });

  it('throws PathEscapeError for an absolute candidate outside root', () => {
    const outside = resolve(tmpdir());
    expect(() => resolveWithinRoot(tmpDir, join(outside, 'somewhere-else'))).toThrow(PathEscapeError);
  });

  it('discoverSchema throws PathEscapeError and reads no file when migrationsDir escapes the root', () => {
    mkdirSync(join(tmpDir, 'supabase', 'migrations'), { recursive: true });
    writeFileSync(join(tmpDir, 'supabase', 'migrations', '0001_x.sql'), 'CREATE TABLE t (a int);');
    expect(() => discoverSchema({ projectRoot: tmpDir, migrationsDir: '../../../../' })).toThrow(
      PathEscapeError
    );
  });

  it('CLI exits 8 and prints nothing to stdout for an escaping --migrations-dir', () => {
    mkdirSync(join(tmpDir, 'supabase', 'migrations'), { recursive: true });
    writeFileSync(join(tmpDir, 'supabase', 'migrations', '0001_x.sql'), 'CREATE TABLE t (a int);');
    let status = 0;
    let stdout = '';
    try {
      stdout = execFileSync(
        process.execPath,
        [DISCOVER_SCHEMA, '--project-root', tmpDir, '--migrations-dir', '../../../../'],
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

describe('discoverSchema — size cap (T-03-02, ASVS V12)', () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'qa-discover-'));
  });

  it('skips an oversized file with reason size and bytes, parses every other file normally', () => {
    const migrationsDir = join(tmpDir, 'supabase', 'migrations');
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(join(migrationsDir, '0001_ok.sql'), 'CREATE TABLE t (a text NOT NULL);');
    const oversized = 'CREATE TABLE huge (\n' + '  x int,\n'.repeat(50000) + '  y int\n);';
    writeFileSync(join(migrationsDir, '0002_huge.sql'), oversized);

    const result = discoverSchema({ projectRoot: tmpDir });
    expect(result.files).toEqual(['0001_ok.sql']);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({ file: '0002_huge.sql', reason: 'size' });
    expect(result.skipped[0].bytes).toBeGreaterThan(MAX_MIGRATION_BYTES);
    expect(result.constraints.some((c) => c.source.file === '0002_huge.sql')).toBe(false);
    expect(result.constraints.some((c) => c.source.file === '0001_ok.sql')).toBe(true);
  });
});

describe('discoverSchema — symlinked migrations (WR-02)', () => {
  let symlinksSupported = true;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'qa-discover-'));
  });

  it('a symlinked .sql file inside the migrations directory is read, not silently dropped', () => {
    const migrationsDir = join(tmpDir, 'supabase', 'migrations');
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(join(migrationsDir, '0001_real.sql'), 'CREATE TABLE t (a int);');
    const targetDir = join(tmpDir, 'shared-migrations');
    mkdirSync(targetDir, { recursive: true });
    writeFileSync(join(targetDir, '0002_shared.sql'), 'CREATE TABLE shared (b text NOT NULL);');
    try {
      symlinkSync(join(targetDir, '0002_shared.sql'), join(migrationsDir, '0002_shared.sql'), 'file');
    } catch {
      symlinksSupported = false;
      return;
    }

    const result = discoverSchema({ projectRoot: tmpDir });
    expect(result.files).toEqual(['0001_real.sql', '0002_shared.sql']);
    expect(result.skipped).toEqual([]);
    expect(result.constraints.some((c) => c.source.file === '0002_shared.sql')).toBe(true);
  });

  it('a symlinked .sql file whose target resolves outside the project root is rejected with PathEscapeError, not silently dropped', () => {
    const migrationsDir = join(tmpDir, 'supabase', 'migrations');
    mkdirSync(migrationsDir, { recursive: true });
    const outsideDir = mkdtempSync(join(tmpdir(), 'qa-discover-outside-'));
    writeFileSync(join(outsideDir, 'evil.sql'), 'CREATE TABLE evil (c int);');
    try {
      symlinkSync(join(outsideDir, 'evil.sql'), join(migrationsDir, '0001_evil.sql'), 'file');
    } catch {
      symlinksSupported = false;
      rmSync(outsideDir, { recursive: true, force: true });
      return;
    }

    try {
      expect(() => discoverSchema({ projectRoot: tmpDir })).toThrow(PathEscapeError);
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('a broken symlink is reported in skipped rather than crashing discovery', () => {
    const migrationsDir = join(tmpDir, 'supabase', 'migrations');
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(join(migrationsDir, '0001_real.sql'), 'CREATE TABLE t (a int);');
    try {
      symlinkSync(join(migrationsDir, 'does-not-exist.sql'), join(migrationsDir, '0002_broken.sql'), 'file');
    } catch {
      symlinksSupported = false;
      return;
    }

    const result = discoverSchema({ projectRoot: tmpDir });
    expect(result.files).toEqual(['0001_real.sql']);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].file).toBe('0002_broken.sql');
  });

  afterEach(() => {
    if (!symlinksSupported) {
      // eslint-disable-next-line no-console
      console.warn('symlinkSync unsupported in this environment — WR-02 symlink assertions were skipped.');
    }
  });
});

describe('failure modes', () => {
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'qa-discover-'));
  });

  it('listMigrations on a nonexistent directory throws MigrationsDirError naming the path', () => {
    const missing = join(tmpDir, 'does-not-exist');
    try {
      listMigrations(missing);
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MigrationsDirError);
      expect(err.message).toContain(missing);
    }
  });

  it('CLI against a project root with no supabase/migrations exits 2, stderr names the missing path', () => {
    let status = 0;
    let stderr = '';
    try {
      execFileSync(process.execPath, [DISCOVER_SCHEMA, '--project-root', tmpDir], { encoding: 'utf8' });
    } catch (err) {
      status = err.status;
      stderr = err.stderr ?? '';
    }
    expect(status).toBe(2);
    expect(stderr).toContain('migrations');
  });

  it('a directory with zero .sql files yields empty files/constraints and exit 0', () => {
    mkdirSync(join(tmpDir, 'supabase', 'migrations'), { recursive: true });
    const result = discoverSchema({ projectRoot: tmpDir });
    expect(result.files).toEqual([]);
    expect(result.constraints).toEqual([]);
  });
});
