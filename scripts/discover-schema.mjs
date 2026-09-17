// scripts/discover-schema.mjs
// Deterministic Supabase migration constraint extractor. This module opens
// files read-only and has no write path anywhere in it — it is the only
// tier in this phase permitted to decide what a SQL constraint says, because
// a policy predicate (`CREATE POLICY ... WITH CHECK (...)`) and a real data
// constraint (`CHECK (...)` on a column or table) share the same literal
// substring, and an eyeball pass over dozens of migration files gets that
// distinction wrong (03-RESEARCH.md Pattern 3 / Pitfall 2). Route/form
// discovery stays the orchestrator's own Glob/Grep/Read judgment — this
// script's whole surface is: read supabase/migrations/*.sql, parse, return
// JSON.
//
// CLI exit codes:
//   0 = discovery succeeded, exactly one line of JSON printed to stdout
//   2 = MigrationsDirError — the resolved migrations directory does not
//       exist; stderr names the path
//   8 = PathEscapeError — --project-root/--migrations-dir (or a file inside
//       the migrations directory, including a symlink target) resolved
//       outside the project root; stderr names both the root and the
//       rejected path. Refuse, never clamp (ASVS V5, T-03-01).
// Codes 3, 4, 5, 6, 7 are Phase 1/2 `api-client.mjs`/`ui-login.mjs` meanings
// and must not be reused here.

import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export class MigrationsDirError extends Error {}
export class PathEscapeError extends Error {}

// Per-file read cap (bytes). A `.sql` file larger than this is never opened
// with readFileSync — it is reported in the result's `skipped` array with
// reason "size" instead. This is the DoS mitigation for T-03-02: a
// pathological migration file degrades into a reported skip, not a hung
// parse or a memory blowup (ASVS V12).
export const MAX_MIGRATION_BYTES = 262144;

function countNewlines(text) {
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') count += 1;
  }
  return count;
}

/**
 * Resolves `candidate` (relative to `projectRoot` when not already
 * absolute) to an absolute real path, and returns it only when that path is
 * `projectRoot` itself or a descendant of it. Both sides are resolved to
 * real paths where the target exists (so a symlink inside the tree cannot
 * be used to point outside it) before the containment check runs. Throws
 * `PathEscapeError` naming both the root and the rejected path otherwise —
 * this never clamps a path back inside the root, it refuses outright
 * (ASVS V5, T-03-01).
 */
export function resolveWithinRoot(projectRoot, candidate) {
  const rootAbs = resolve(projectRoot);
  const candidateAbs = resolve(rootAbs, candidate);

  let rootReal = rootAbs;
  try {
    rootReal = realpathSync(rootAbs);
  } catch {
    // Root may not exist yet (surfaces later as MigrationsDirError); fall
    // back to the resolved-but-unreal path for the containment check.
  }

  let candidateReal = candidateAbs;
  try {
    candidateReal = realpathSync(candidateAbs);
  } catch {
    // Candidate may not exist (a deliberately escaping path, or a directory
    // discoverSchema hasn't created yet) — still must be checked.
  }

  const normalizedRoot = rootReal.endsWith(sep) ? rootReal : rootReal + sep;
  if (candidateReal === rootReal || candidateReal.startsWith(normalizedRoot)) {
    return candidateReal;
  }

  throw new PathEscapeError(
    `Path escapes project root: root=${rootReal}, rejected=${candidateReal}`
  );
}

/**
 * Reads `migrationsDir` and returns every regular file (or symlink — see
 * below) whose name ends with `.sql`, sorted lexicographically. Supabase
 * migration filenames are zero-padded and numbered (`0001_init.sql`,
 * `0002_...sql`), so a lexicographic sort is also chronological order. Uses
 * `readdirSync`, not the still-Experimental `fs.globSync` (03-RESEARCH.md
 * Environment Availability). Throws `MigrationsDirError` naming the path
 * when the directory does not exist.
 *
 * A `Dirent` for a symlink reports `isFile() === false` regardless of what
 * it points to, so filtering on `isFile()` alone silently dropped every
 * symlinked `.sql` migration before the per-file loop's `resolveWithinRoot`
 * containment check ever ran on it — making the module's own documented
 * "a symlink target resolved outside the project root" guarantee (see file
 * header) dead code for this vector (WR-02). Including `isSymbolicLink()`
 * entries here restores that: the per-file loop already resolves each
 * filename through `resolveWithinRoot` (which calls `realpathSync`,
 * following the link and checking the *resolved* target's containment)
 * before ever reading it.
 */
export function listMigrations(migrationsDir) {
  let entries;
  try {
    entries = readdirSync(migrationsDir, { withFileTypes: true });
  } catch {
    throw new MigrationsDirError(`Migrations directory not found: ${migrationsDir}`);
  }
  return entries
    .filter((e) => (e.isFile() || e.isSymbolicLink()) && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort();
}

/**
 * Returns `sql` with every `--` line comment and `/* *\/` block comment
 * replaced by equivalent-length whitespace, preserving every newline (and
 * therefore every subsequent line number) exactly as it was. Preserving
 * line numbers is the point: every constraint this module extracts carries
 * a `source.line`, and an off-by-one from comment stripping would make that
 * citation useless.
 */
export function stripSqlComments(sql) {
  let result = '';
  let i = 0;
  const n = sql.length;
  while (i < n) {
    if (sql[i] === '-' && sql[i + 1] === '-') {
      while (i < n && sql[i] !== '\n') {
        result += ' ';
        i += 1;
      }
    } else if (sql[i] === '/' && sql[i + 1] === '*') {
      result += '  ';
      i += 2;
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) {
        result += sql[i] === '\n' ? '\n' : ' ';
        i += 1;
      }
      if (i < n) {
        result += '  ';
        i += 2;
      }
    } else {
      result += sql[i];
      i += 1;
    }
  }
  return result;
}

/**
 * Returns every `CREATE TYPE <name> AS ENUM ( 'a', 'b', ... )` declaration
 * in `sql` as `{ name, values, source: { line } }`, values in declaration
 * order. Strips comments internally first so a `CHECK`-like or `ENUM`-like
 * token inside a comment is never mistaken for a real declaration.
 */
export function extractEnumTypes(sql) {
  const stripped = stripSqlComments(sql);
  const results = [];
  const re = /CREATE\s+TYPE\s+(\w+)\s+AS\s+ENUM\s*\(([^)]*)\)/gis;
  let match;
  while ((match = re.exec(stripped)) !== null) {
    const name = match[1];
    const values = [...match[2].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    const line = 1 + countNewlines(stripped.slice(0, match.index));
    results.push({ name, values, source: { line } });
  }
  return results;
}

/**
 * Recognises a numeric bound inside a `CHECK` expression string and returns
 * `{ min, max }`, with either side `null` when only one side resolved, or
 * `null` when neither resolved. This is D-10's "never invent a boundary"
 * discipline applied one level deeper than "no CHECK found at all": an
 * unrecognised expression shape (a value-set `IN (...)`, a multi-column
 * business rule like `num_nonnulls(a, b) = 1`, ...) is a different fact from
 * no constraint at all, and reports the same `null` either way rather than
 * guessing at a shape it doesn't recognise.
 *
 * Recognised shapes, tried in this precedence order — a two-sided
 * `BETWEEN <a> AND <b>` first (so a `BETWEEN` clause is never also read by
 * the comparison branches below), then the comparison operators `>=`, `<=`,
 * `>`, `<`. `>=`/`<=` yield their literal operand; a bare `>`/`<` is an
 * exclusive bound, so it yields the adjacent inclusive integer (operand + 1
 * / operand - 1) — an exclusive bound is not the same fact as an inclusive
 * one, and reporting it pre-adjusted lets the four-case boundary rule
 * (min-1/min/max/max+1) consume `bounds` directly without knowing whether
 * the original expression was inclusive or exclusive. The bare `>`/`<`
 * patterns are guarded with a negative lookahead so they never also match
 * the `>=`/`<=` forms (a `>=` would otherwise satisfy `>` too).
 *
 * Never widen this to a general SQL expression evaluator — anything outside
 * these five shapes returns `null`. The numeric patterns use a bounded digit
 * count (not an unbounded `\d+`) so a pathological migration file (untrusted
 * input from a target project, T-04-03) cannot make this regex set pursue
 * catastrophic backtracking.
 */
export function parseCheckBounds(checkExpr) {
  if (typeof checkExpr !== 'string') return null;

  const NUM = '-?\\d{1,15}(?:\\.\\d{1,15})?';

  const between = checkExpr.match(
    new RegExp(`\\bBETWEEN\\s+(${NUM})\\s+AND\\s+(${NUM})\\b`, 'i')
  );
  if (between) {
    return { min: Number(between[1]), max: Number(between[2]) };
  }

  const gte = checkExpr.match(new RegExp(`>=\\s*(${NUM})`));
  const lte = checkExpr.match(new RegExp(`<=\\s*(${NUM})`));
  const gt = checkExpr.match(new RegExp(`>(?!=)\\s*(${NUM})`));
  const lt = checkExpr.match(new RegExp(`<(?!=)\\s*(${NUM})`));

  const min = gte ? Number(gte[1]) : gt ? Number(gt[1]) + 1 : null;
  const max = lte ? Number(lte[1]) : lt ? Number(lt[1]) - 1 : null;

  return min !== null || max !== null ? { min, max } : null;
}

/**
 * Recognises a value-set membership test inside a `CHECK` expression string
 * — `<identifier> IN ('a', 'b', ...)` — and returns the literal values in
 * declaration order, or `null` for anything else. This is the second,
 * structurally different enum shape real migrations use: the existing
 * `CREATE TYPE ... AS ENUM` cross-reference (see the `enumMap` loop in
 * `discoverSchema()`) only recognises a column whose declared SQL *type*
 * names a declared enum, and never sees an inline `CHECK (col IN (...))`
 * because that shape carries no type-level declaration at all — the value
 * set lives only in the check expression string.
 *
 * Matches case-insensitively on the `IN` keyword and tolerates newlines and
 * surrounding whitespace inside the parens (real migrations wrap a long
 * value list across lines). Returns `null` when the parenthesised body is
 * not a comma-separated list of single-quoted literals only — most notably
 * a subquery membership test (`id IN (SELECT id FROM otra)`), which carries
 * no literal value set to report. Never widen this to parse a subquery's
 * result set or any other non-literal `IN` body; that is not this
 * function's job and an unrecognised shape must yield `null`, the same
 * "never invent a boundary" discipline `parseCheckBounds` already applies
 * (D-10).
 *
 * The literal-list test itself is a single quoted-literal repeated with no
 * ambiguous nested quantifiers (each alternative starts on a literal `'`
 * and `[^']*` cannot itself match a `'`), so it cannot pursue catastrophic
 * backtracking on a pathological migration file (T-04-03, untrusted input).
 */
export function parseCheckEnum(checkExpr) {
  if (typeof checkExpr !== 'string') return null;

  const inMatch = checkExpr.match(/\bIN\s*\(/i);
  if (!inMatch) return null;

  const openIndex = inMatch.index + inMatch[0].length - 1;
  const body = extractBalancedParens(checkExpr, openIndex);
  if (body === null) return null;

  const LITERAL_LIST_RE = /^\s*(?:'[^']*'\s*,\s*)*'[^']*'\s*$/;
  if (!LITERAL_LIST_RE.test(body)) return null;

  return [...body.matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

// Recognized column-level constraint keywords, tried in this order when
// scanning a column definition's trailing text for where the type token
// ends. Order matters only in that "NOT NULL" must be tried before a bare
// "NULL" would ever be (this module has no bare-NULL handling, so it is
// omitted).
const CONSTRAINT_KEYWORD_RE = /^\s*(NOT\s+NULL|UNIQUE|PRIMARY\s+KEY|REFERENCES|CHECK|DEFAULT)\b/i;

/**
 * Scans forward through `text` (everything after a column's name) tracking
 * paren depth, and returns the character index where the type token ends —
 * the first position at depth 0 where a constraint keyword begins. This is
 * what lets `numeric(12,2)` keep its own parentheses without them being
 * mistaken for a constraint expression (T-03 numeric-type pitfall): depth
 * only reaches 0 again after the type's own closing paren, and only then is
 * the keyword search allowed to match. Returns -1 when no keyword is found.
 */
function findTypeEnd(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (depth === 0 && CONSTRAINT_KEYWORD_RE.test(text.slice(i))) {
      return i;
    }
  }
  return -1;
}

/**
 * Returns the substring inside the first balanced parenthesis pair starting
 * at `text[openIndex]` (which must be `'('`), or null if unbalanced. Used
 * for both a column's inline `CHECK (...)` expression and a table-level
 * `ADD CONSTRAINT ... CHECK (...)` expression — an expression may itself
 * contain parens (`BETWEEN (a) AND (b)`), so a non-greedy regex cannot be
 * trusted to find the right closing paren.
 */
function extractBalancedParens(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === '(') depth += 1;
    else if (text[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(openIndex + 1, i);
      }
    }
  }
  return null;
}

/**
 * Parses one column definition of the form `<name> <type> [constraints]`
 * (already stripped of its trailing comma/semicolon) into
 * `{ column, type, notNull, unique, primaryKey, check, references }`.
 * Shared by CREATE TABLE column lines and ALTER TABLE ADD COLUMN statements
 * so both statement forms agree on constraint parsing.
 */
function parseColumnLine(line) {
  const trimmed = line.trim();
  const nameMatch = trimmed.match(/^(\w+)\s+([\s\S]*)$/);
  if (!nameMatch) return null;
  const column = nameMatch[1];
  const rest = nameMatch[2];

  const typeEnd = findTypeEnd(rest);
  const type = (typeEnd === -1 ? rest : rest.slice(0, typeEnd)).trim();
  const constraintsText = typeEnd === -1 ? '' : rest.slice(typeEnd);

  const notNull = /\bNOT\s+NULL\b/i.test(constraintsText);
  const unique = /\bUNIQUE\b/i.test(constraintsText);
  const primaryKey = /\bPRIMARY\s+KEY\b/i.test(constraintsText);

  let references = null;
  const refMatch = constraintsText.match(
    /REFERENCES\s+(\w+)\s*\(\s*(\w+)\s*\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT|NO\s+ACTION))?/i
  );
  if (refMatch) {
    references = {
      table: refMatch[1],
      column: refMatch[2],
      onDelete: refMatch[3] ? refMatch[3].toUpperCase().replace(/\s+/g, ' ') : null,
    };
  }

  let check = null;
  const checkMatch = constraintsText.match(/CHECK\s*\(/i);
  if (checkMatch) {
    const startParen = constraintsText.indexOf('(', checkMatch.index);
    check = extractBalancedParens(constraintsText, startParen);
  }

  return { column, type, notNull, unique, primaryKey, references, check };
}

/**
 * Splits `body` (the text inside a CREATE TABLE's outer parens) into
 * top-level entries by comma, ignoring commas nested inside a type's own
 * parens (e.g. `numeric(12,2)`) or a DEFAULT expression's parens (e.g.
 * `gen_random_uuid()`). Returns `{ text, startOffsetInBody }` per entry so
 * the caller can still compute each entry's absolute source line.
 */
function splitTopLevelByComma(body) {
  const entries = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === ',' && depth === 0) {
      entries.push({ text: body.slice(start, i), startOffsetInBody: start });
      start = i + 1;
    }
  }
  entries.push({ text: body.slice(start), startOffsetInBody: start });
  return entries;
}

function parseCreateTableStatement(stmtText, baseLine, file) {
  const records = [];
  const headerMatch = stmtText.match(/CREATE\s+TABLE\s+(\w+)\s*\(/i);
  if (!headerMatch) return records;
  const table = headerMatch[1];

  const openParenIndex = stmtText.indexOf('(', headerMatch.index);
  const body = extractBalancedParens(stmtText, openParenIndex);
  if (body === null) return records;

  const bodyStartIndex = openParenIndex + 1;
  const entries = splitTopLevelByComma(body);

  for (const entry of entries) {
    const text = entry.text.trim();
    if (!text) continue;

    // entry.text still carries its own leading whitespace/newline (the
    // separator that followed the previous entry's comma) — that leading
    // newline must be counted too, or every entry after the first column
    // in a multi-line CREATE TABLE cites one line too early (03-03
    // Task 3, found against the real franquix/dotax migrations: a
    // 3-column table reported column 2 on column 1's line and column 3
    // on column 2's line). Skip past it before counting.
    const leadingWs = entry.text.match(/^\s*/)[0].length;
    const absoluteIndex = bodyStartIndex + entry.startOffsetInBody + leadingWs;
    const line = baseLine + countNewlines(stmtText.slice(0, absoluteIndex));

    // A table-level constraint line (`CONSTRAINT ... CHECK (...)`, a bare
    // `CHECK (...)`, or a table-level `UNIQUE (...)`/`PRIMARY KEY (...)`)
    // carries no single column — only its own CHECK (if any) is a data
    // constraint worth recording; UNIQUE/PRIMARY KEY at the table level
    // name columns elsewhere and are not modelled as a separate record.
    if (/^(CONSTRAINT\s+\w+\s+)?(CHECK|UNIQUE|PRIMARY\s+KEY)\b/i.test(text)) {
      const checkMatch = text.match(/CHECK\s*\(/i);
      if (checkMatch) {
        const startParen = text.indexOf('(', checkMatch.index);
        const check = extractBalancedParens(text, startParen);
        records.push({
          table,
          column: null,
          type: null,
          notNull: false,
          unique: false,
          primaryKey: false,
          check,
          enumValues: null,
          references: null,
          origin: 'create_table',
          source: { file, line },
        });
      }
      continue;
    }

    const parsed = parseColumnLine(text);
    if (!parsed) continue;
    records.push({
      table,
      column: parsed.column,
      type: parsed.type || null,
      notNull: parsed.notNull,
      unique: parsed.unique,
      primaryKey: parsed.primaryKey,
      check: parsed.check,
      enumValues: null,
      references: parsed.references,
      origin: 'create_table',
      source: { file, line },
    });
  }

  return records;
}

function parseAlterTableStatement(stmtText, baseLine, file) {
  const addColumnMatch = stmtText.match(
    /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)\s+([\s\S]*)/i
  );
  if (addColumnMatch) {
    const table = addColumnMatch[1];
    const column = addColumnMatch[2];
    const rest = addColumnMatch[3].replace(/;\s*$/, '').trim();
    const parsed = parseColumnLine(`${column} ${rest}`);
    if (!parsed) return [];
    return [
      {
        table,
        column: parsed.column,
        type: parsed.type || null,
        notNull: parsed.notNull,
        unique: parsed.unique,
        primaryKey: parsed.primaryKey,
        check: parsed.check,
        enumValues: null,
        references: parsed.references,
        origin: 'alter_table',
        source: { file, line: baseLine },
      },
    ];
  }

  const addConstraintMatch = stmtText.match(
    /ALTER\s+TABLE\s+(\w+)\s+ADD\s+CONSTRAINT\s+\w+\s+CHECK\s*\(/i
  );
  if (addConstraintMatch) {
    const table = addConstraintMatch[1];
    const openParenIndex = addConstraintMatch.index + addConstraintMatch[0].length - 1;
    const check = extractBalancedParens(stmtText, openParenIndex);
    return [
      {
        table,
        column: null,
        type: null,
        notNull: false,
        unique: false,
        primaryKey: false,
        check,
        enumValues: null,
        references: null,
        origin: 'alter_table',
        source: { file, line: baseLine },
      },
    ];
  }

  return [];
}

/**
 * Splits `text` into top-level statements (separated by a `;` at paren
 * depth 0, outside a single-quoted string), returning `{ text, startIndex }`
 * pairs with `startIndex` the character offset of the statement's first
 * character (including any leading whitespace/newline carried over from the
 * previous statement's terminator) in `text`.
 */
function splitStatements(text) {
  const statements = [];
  let depth = 0;
  let inString = false;
  let buffer = '';
  let startIndex = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    buffer += ch;
    if (ch === "'") {
      inString = !inString;
    } else if (!inString) {
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      else if (ch === ';' && depth === 0) {
        statements.push({ text: buffer, startIndex });
        buffer = '';
        startIndex = i + 1;
      }
    }
  }
  if (buffer.trim().length > 0) {
    statements.push({ text: buffer, startIndex });
  }
  return statements;
}

/**
 * Returns every `CREATE POLICY` statement in `sql` as a structured record
 * `{ policyName, table, command, role, using, withCheck, source: { file, line } }`.
 * Built on the module's own existing machinery — `stripSqlComments` first
 * (so a `CREATE POLICY`-like token inside a comment never produces a
 * record, mirroring `extractConstraints`'s own comment-handling), then
 * `splitStatements`, then `countNewlines` for the line citation, then
 * `extractBalancedParens` for each clause body (`USING (...)`/`WITH CHECK
 * (...)` may themselves contain nested parens and `AND`/`OR` operators, so
 * a non-greedy regex cannot be trusted to find the right closing paren —
 * the exact reason `extractBalancedParens` exists in the first place).
 *
 * This is not a general SQL grammar parser — the observed grammar subset is
 * exactly `CREATE POLICY <name> ON <table> [AS PERMISSIVE|RESTRICTIVE]
 * [FOR ALL|SELECT|INSERT|UPDATE|DELETE] [TO <role>[, <role>...]]
 * [USING (...)] [WITH CHECK (...)]`, and that is the whole surface this
 * function models. `command` defaults to the literal `ALL` when the `FOR`
 * clause is absent. `role` is `null` when the `TO` clause is absent,
 * otherwise the role name(s) found, parsed leniently (a multi-role
 * `TO a, b` list is joined, not modelled as a typed list) — a policy form
 * this does not fully model must still yield a record rather than throw,
 * because a target repo using an unmodelled form is a coverage gap, not a
 * crash (04-RESEARCH.md Assumption A1).
 *
 * The `WITH CHECK` predicate this captures is a policy predicate, and it is
 * still never a data constraint — `extractConstraints`'s own `CREATE
 * POLICY` branch below keeps refusing to push a record for it (T-04-01):
 * this function and that one see the same statement text, but only this
 * one is allowed to turn it into structured output.
 */
export function extractPolicies(sql, { file }) {
  const stripped = stripSqlComments(sql);
  const statements = splitStatements(stripped);
  const records = [];

  for (const stmt of statements) {
    const leadingWs = stmt.text.match(/^\s*/)[0].length;
    const trimmedText = stmt.text.slice(leadingWs);
    if (!trimmedText.trim()) continue;
    if (!/^CREATE\s+POLICY\b/i.test(trimmedText)) continue;

    const headerMatch = trimmedText.match(/^CREATE\s+POLICY\s+(\w+)\s+ON\s+(\w+)/i);
    if (!headerMatch) continue;

    const absStart = stmt.startIndex + leadingWs;
    const line = 1 + countNewlines(stripped.slice(0, absStart));

    const policyName = headerMatch[1];
    const table = headerMatch[2];

    const commandMatch = trimmedText.match(/\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i);
    const command = commandMatch ? commandMatch[1].toUpperCase() : 'ALL';

    let role = null;
    const toMatch = trimmedText.match(/\bTO\s+([\s\S]*?)(?=\bUSING\s*\(|\bWITH\s+CHECK\s*\(|;|$)/i);
    if (toMatch) {
      const roles = toMatch[1]
        .replace(/;\s*$/, '')
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      role = roles.length > 0 ? roles.join(', ') : null;
    }

    let using = null;
    const usingMatch = trimmedText.match(/\bUSING\s*\(/i);
    if (usingMatch) {
      const openParen = trimmedText.indexOf('(', usingMatch.index);
      using = extractBalancedParens(trimmedText, openParen);
    }

    let withCheck = null;
    const withCheckMatch = trimmedText.match(/\bWITH\s+CHECK\s*\(/i);
    if (withCheckMatch) {
      const openParen = trimmedText.indexOf('(', withCheckMatch.index);
      withCheck = extractBalancedParens(trimmedText, openParen);
    }

    records.push({ policyName, table, command, role, using, withCheck, source: { file, line } });
  }

  return records;
}

/**
 * Scans `sql` statement by statement and returns a flat array of constraint
 * records (`table`, `column`, `type`, `notNull`, `unique`, `primaryKey`,
 * `check`, `enumValues`, `references`, `origin`, `source`). The returned
 * array also carries a non-index `policyWithCheckCount` property — an
 * informational count of every `WITH CHECK (` occurrence found inside a
 * `CREATE POLICY` statement, cross-checkable against `extractPolicies`'s
 * own `policies` array. The previous counter name and doc comment meant
 * "deliberately excluded" back when `CREATE POLICY` content was discarded
 * entirely; now that `extractPolicies` captures that content as structured
 * records, nothing here is skipped anymore — the field carries a new name
 * to match what it now means, an informational cross-check count, not a
 * record of something excluded. The disambiguation this function itself
 * enforces is unchanged: a `CHECK (` counts as a data constraint only when
 * its enclosing statement is a `CREATE TABLE` or `ALTER TABLE`, never a
 * `CREATE POLICY` — that branch below still refuses to push a constraint
 * record for policy content, exactly as before (T-04-01).
 */
export function extractConstraints(sql, { file }) {
  const stripped = stripSqlComments(sql);
  const statements = splitStatements(stripped);

  const records = [];
  let policyWithCheckCount = 0;

  for (const stmt of statements) {
    const leadingWs = stmt.text.match(/^\s*/)[0].length;
    const trimmedText = stmt.text.slice(leadingWs);
    if (!trimmedText.trim()) continue;

    const absStart = stmt.startIndex + leadingWs;
    const baseLine = 1 + countNewlines(stripped.slice(0, absStart));

    if (/^CREATE\s+POLICY\b/i.test(trimmedText)) {
      const matches = trimmedText.match(/WITH\s+CHECK\s*\(/gi);
      policyWithCheckCount += matches ? matches.length : 0;
      continue;
    }

    if (/^CREATE\s+TABLE\b/i.test(trimmedText)) {
      records.push(...parseCreateTableStatement(trimmedText, baseLine, file));
      continue;
    }

    if (/^ALTER\s+TABLE\b/i.test(trimmedText)) {
      records.push(...parseAlterTableStatement(trimmedText, baseLine, file));
      continue;
    }
    // Every other statement form (CREATE TYPE, CREATE INDEX, comments-only
    // remnants, ...) carries no column/table constraint this module models.
  }

  records.policyWithCheckCount = policyWithCheckCount;
  return records;
}

/**
 * Walks `migrationsDir` under `projectRoot` (both resolved through
 * `resolveWithinRoot`, and every individual file open routed through it
 * too, so a symlink inside the directory cannot escape the root either),
 * reads each `.sql` file (skipping and reporting any file over
 * `MAX_MIGRATION_BYTES` without ever loading it), parses constraints, enum
 * declarations and RLS policy statements, cross-references every column
 * whose `type` names a declared enum, and returns
 * `{ projectRoot, migrationsDir, files, skipped, enums, constraints, policies, policyWithCheckCount }`.
 * `policies` is always present, possibly an empty array for a project with
 * no `CREATE POLICY` statements — an empty array is a valid, honest result,
 * never treated as a discovery failure (D-03, T-04-10). This function never
 * writes anything — its whole surface is read, parse, return (T-03-03,
 * ASVS V1).
 */
export function discoverSchema({ projectRoot, migrationsDir = 'supabase/migrations' } = {}) {
  if (!projectRoot) {
    throw new Error('discoverSchema: projectRoot is required');
  }

  let rootReal;
  try {
    rootReal = realpathSync(resolve(projectRoot));
  } catch {
    rootReal = resolve(projectRoot);
  }

  const migrationsAbs = resolveWithinRoot(rootReal, migrationsDir);
  const fileNames = listMigrations(migrationsAbs);

  const files = [];
  const skipped = [];
  const enums = [];
  const constraints = [];
  const policies = [];
  let policyWithCheckCount = 0;

  for (const filename of fileNames) {
    const filePath = resolveWithinRoot(rootReal, join(migrationsAbs, filename));

    // listMigrations now admits symlinks (WR-02), so — unlike a plain file,
    // which is guaranteed to exist and be a regular file by the time
    // readdirSync reported it — a symlinked ".sql" entry can point at a
    // broken target or at a directory. resolveWithinRoot already ran
    // realpathSync on filePath, so a broken link surfaces here as statSync
    // throwing; report and skip rather than letting the whole discovery run
    // crash on one bad link.
    let stat;
    try {
      stat = statSync(filePath);
    } catch {
      skipped.push({ file: filename, reason: 'unreadable' });
      continue;
    }
    if (!stat.isFile()) {
      skipped.push({ file: filename, reason: 'not-a-file' });
      continue;
    }
    const { size } = stat;
    if (size > MAX_MIGRATION_BYTES) {
      skipped.push({ file: filename, reason: 'size', bytes: size });
      continue;
    }

    const sql = readFileSync(filePath, 'utf8');
    files.push(filename);

    for (const e of extractEnumTypes(sql)) {
      enums.push({ name: e.name, values: e.values, source: { file: filename, line: e.source.line } });
    }

    const fileConstraints = extractConstraints(sql, { file: filename });
    policyWithCheckCount += fileConstraints.policyWithCheckCount ?? 0;
    constraints.push(...fileConstraints);

    policies.push(...extractPolicies(sql, { file: filename }));
  }

  const enumMap = new Map(enums.map((e) => [e.name, e.values]));
  for (const c of constraints) {
    if (c.type && enumMap.has(c.type)) {
      c.enumValues = enumMap.get(c.type);
    }
    c.bounds = c.check ? parseCheckBounds(c.check) : null;
    // allowedValues is the unified field downstream generation reads: the
    // declared-enum cross-reference above when present, otherwise an inline
    // value-set CHECK, otherwise null. enumValues stays exactly as it was —
    // the provenance-specific field a reader can still use to tell a
    // declared enum from an inline CHECK set apart.
    c.allowedValues = c.enumValues ? c.enumValues : c.check ? parseCheckEnum(c.check) : null;
  }

  return {
    projectRoot: rootReal,
    migrationsDir: migrationsAbs,
    files,
    skipped,
    enums,
    constraints,
    policies,
    policyWithCheckCount,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = args['project-root'];
  const migrationsDir = args['migrations-dir'];

  if (!projectRoot || projectRoot === true) {
    process.stderr.write('--project-root is required\n');
    process.exit(2);
    return;
  }

  try {
    const result = discoverSchema({
      projectRoot,
      migrationsDir: migrationsDir === true ? undefined : migrationsDir,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(0);
  } catch (err) {
    if (err instanceof MigrationsDirError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(2);
      return;
    }
    if (err instanceof PathEscapeError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(8);
      return;
    }
    throw err;
  }
}

// See api-client.mjs for why this resolves realpaths before comparing — a
// plain URL/string comparison breaks under the documented symlink/junction
// install method (README "Installation").
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}
const isMain = isMainModule();
if (isMain) {
  main().catch((err) => {
    process.stderr.write(`${err.stack ?? err.message}\n`);
    process.exit(1);
  });
}
