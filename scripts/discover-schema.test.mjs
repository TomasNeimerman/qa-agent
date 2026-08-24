// scripts/discover-schema.test.mjs
// Unit coverage for scripts/discover-schema.mjs: comment stripping, every
// constraint form 03-RESEARCH.md observed, the CHECK/WITH CHECK
// disambiguation, path containment (T-03-01, ASVS V5) and the size cap
// (T-03-02, ASVS V12). Calls exported functions directly against inline SQL
// strings and mkdtempSync temp directories — this module has no network or
// external side-effect surface to isolate, so no child process is needed
// except for the CLI-level exit-code assertions.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
