// scripts/test-case-doc.mjs
// Reader for qa-reports/<run-id>-test-cases.md, never a writer. D-01 chose
// Markdown-only for the case document with no JSON intermediate, so unlike
// format-report.mjs there is no renderer here — the orchestrator's own
// Write tool authors the document (see SKILL.md's "## Case generation
// protocol"). This module exists so that reading a case back at
// execution-request time (D-11) is deterministic instead of a grep result
// the orchestrator interprets by eye — the exact anti-pattern this project
// already refuses for HTTP verdicts (project Anti-Pattern 3), and the
// mechanism that collides on "case-1" vs "case-12" if done by substring
// match (03-RESEARCH.md Pitfall 5).
//
// The structure this module reads is the contract defined in
// references/test-case-format.md — see that file before changing anything
// here, since the two must never drift apart.
//
// CLI exit codes:
//   0 = document valid (or, with --case, the requested case was found and
//       printed) — exactly one line of JSON on stdout
//   2 = --file is missing, or the given path does not exist; stderr names
//       what is missing
//   9 = the document failed to parse or validate (a missing field, an
//       out-of-set Tipo/Ejecución, a duplicate or gapped ID, a missing
//       citation, or a forbidden dispatch flag) — the full error list is
//       written to stderr before any case from it is acted on
// Codes 3-8 keep the meanings scripts/api-client.mjs and
// scripts/discover-schema.mjs already assigned them and are never reused
// here.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export class TestCaseFormatError extends Error {}

// Anchored at the start of a line, requires a level-3 heading, the case id,
// a literal space-emdash-space delimiter, then the title. Anchoring on the
// delimiter (never a bare "case-N") is what makes the lookup collision-proof
// — "case-1" is a substring of "case-12", but "### case-1 — " never matches
// inside "### case-12 — " (03-RESEARCH.md Pitfall 5).
export const CASE_HEADING_PATTERN = /^### (case-\d+) — (.+)$/;

// The five bullet labels, in the fixed order references/test-case-format.md
// requires under every case heading.
export const CASE_FIELDS = ['Precondiciones', 'Pasos', 'Resultado esperado', 'Tipo', 'Ejecución'];

export const CASE_TYPES = ['positivo', 'negativo', 'edge'];
export const EXECUTION_MODES = ['API', 'UI'];

// The three scripts/api-client.mjs CLI flags that pre-approve or bypass its
// destructive-action gate: --confirmed dispatches a call the confirmation
// protocol would otherwise pause on, --read-only-intent waves a mutating
// method through without a pause, and --allow-non-local unlocks a
// production-looking target. A generated test-case document is written at
// discovery time and read back later, at execution-request time (D-06,
// D-11) — a flag sitting inside it would be an approval nobody actually
// gave in the moment the case is run, which is exactly what the
// confirmation protocol (SKILL.md `## Confirmation protocol`) exists to
// prevent. validateTestCasesDoc rejects any document carrying one of these
// literals, by name, before any case from it is acted on.
export const FORBIDDEN_DISPATCH_FLAGS = Object.freeze([
  '--confirmed',
  '--read-only-intent',
  '--allow-non-local',
]);

const METADATA_KEYS = [
  ['Generado', 'generado'],
  ['Origen', 'origen'],
  ['Instrucción', 'instruccion'],
  ['Router', 'router'],
  ['Alcance', 'alcance'],
];

const SURFACE_HEADING_RE = /^## (.+)$/;
const ORIGEN_DEL_SURFACE_RE = /^\*\*Origen del surface:\*\*\s*(.*)$/;
const BULLET_RE = /^-?\s*\*\*([^*]+):\*\*\s*(.*)$/;

// A path fragment followed by a colon and one or more digits — the
// file-and-line citation references/test-case-format.md's citation rule
// requires inside every negativo/edge case's Resultado esperado.
const CITATION_RE = /[\w./-]+:\d+/;

function parseMetadata(lines, startIndex) {
  const metadata = {};
  let i = startIndex;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (SURFACE_HEADING_RE.test(line)) break;
    const match = line.match(BULLET_RE);
    if (!match) continue;
    const label = match[1].trim();
    const value = match[2].trim();
    const entry = METADATA_KEYS.find(([key]) => key === label);
    if (entry) metadata[entry[1]] = value;
  }
  return { metadata, nextIndex: i };
}

// Scans forward from a case heading, collecting the recognised bullet
// fields, until the next case heading or surface heading. Never throws —
// this is the shared, non-throwing scan both parseCaseBlock (which adds the
// throwing checks parseTestCasesDoc needs) and validateTestCasesDoc (which
// collects every problem instead of stopping at the first) build on, so the
// two never drift apart on what counts as a field.
function scanCaseFields(lines, headingIndex) {
  const fields = {};
  let i = headingIndex + 1;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (CASE_HEADING_PATTERN.test(line) || SURFACE_HEADING_RE.test(line)) break;
    const match = line.match(BULLET_RE);
    if (!match) continue;
    const label = match[1].trim();
    if (CASE_FIELDS.includes(label)) {
      fields[label] = match[2].trim();
    }
  }
  return { fields, nextIndex: i };
}

function parseCaseBlock(lines, headingIndex, id, title) {
  const { fields, nextIndex } = scanCaseFields(lines, headingIndex);

  for (const field of CASE_FIELDS) {
    if (!fields[field]) {
      throw new TestCaseFormatError(
        `Case ${id} is missing its required "${field}" field`
      );
    }
  }

  const tipo = fields['Tipo'];
  if (!CASE_TYPES.includes(tipo)) {
    throw new TestCaseFormatError(
      `Case ${id} has an invalid Tipo "${tipo}" — must be one of ${CASE_TYPES.join(', ')}`
    );
  }

  const ejecucion = fields['Ejecución'];
  if (!EXECUTION_MODES.includes(ejecucion)) {
    throw new TestCaseFormatError(
      `Case ${id} has an invalid Ejecución "${ejecucion}" — must be one of ${EXECUTION_MODES.join(', ')}`
    );
  }

  return {
    id,
    index: Number(id.slice('case-'.length)),
    titulo: title.trim(),
    precondiciones: fields['Precondiciones'],
    pasos: fields['Pasos'],
    resultadoEsperado: fields['Resultado esperado'],
    tipo,
    ejecucion,
    line: headingIndex + 1,
    nextIndex,
  };
}

/**
 * Parses a conforming `qa-reports/<run-id>-test-cases.md` document (the
 * contract defined in references/test-case-format.md) into
 * `{ title, metadata, surfaces }`, where `metadata` carries `generado`,
 * `origen`, `instruccion`, `router` and `alcance`, and each surface is
 * `{ heading, origen, cases }` with every case
 * `{ id, index, titulo, precondiciones, pasos, resultadoEsperado, tipo, ejecucion, line }`.
 * Throws `TestCaseFormatError` — naming the offending case ID and the
 * specific problem — for a missing required field, an out-of-set `Tipo` or
 * `Ejecución` value, a duplicate ID, an ID sequence that is not gapless from
 * `case-1`, or a surface heading with no `**Origen del surface:**` line
 * (WR-03). A silent skip is the failure mode this function exists to avoid:
 * a malformed case that parsed to `undefined` would be a case nobody
 * noticed was dropped.
 */
export function parseTestCasesDoc(markdown) {
  const lines = markdown.split(/\r?\n/);

  const h1Line = lines.find((l) => l.startsWith('# '));
  if (!h1Line) {
    throw new TestCaseFormatError('Document is missing its H1 title line ("# Casos de Prueba — ...")');
  }
  const title = h1Line.replace(/^#\s*/, '').trim();

  const { metadata, nextIndex } = parseMetadata(lines, 0);
  for (const [label, key] of METADATA_KEYS) {
    if (!metadata[key]) {
      throw new TestCaseFormatError(`Document metadata is missing "${label}"`);
    }
  }

  const surfaces = [];
  let i = nextIndex;
  let expectedIndex = 1;
  const seenIds = new Set();

  while (i < lines.length) {
    const surfaceMatch = lines[i].match(SURFACE_HEADING_RE);
    if (!surfaceMatch) {
      i += 1;
      continue;
    }
    const heading = surfaceMatch[1].trim();
    i += 1;

    // references/test-case-format.md's "Section order" (item 3) requires
    // every "##" surface heading to be followed by an "**Origen del
    // surface:**" line — a non-negotiable structural requirement, not an
    // optional one. Before WR-03, a missing line here just wasn't consumed
    // and parsing silently moved on, leaving `origen: ''` with no error —
    // exactly the silent-skip failure mode this module's own doc comment
    // says it exists to avoid. Blank lines are skipped first: the format's
    // own worked example puts a blank line between the heading and the
    // Origen line, matching how every other block-scan in this module
    // (scanCaseFields, parseMetadata) already treats a blank line as
    // insignificant rather than as content.
    let originLine = i;
    while (originLine < lines.length && lines[originLine].trim() === '') originLine += 1;
    const origenMatch = originLine < lines.length ? lines[originLine].match(ORIGEN_DEL_SURFACE_RE) : null;
    if (!origenMatch) {
      throw new TestCaseFormatError(
        `Surface "${heading}" is missing its required "**Origen del surface:**" line`
      );
    }
    const origen = origenMatch[1].trim();
    i = originLine + 1;

    const cases = [];
    while (i < lines.length && !SURFACE_HEADING_RE.test(lines[i])) {
      const headingMatch = lines[i].match(CASE_HEADING_PATTERN);
      if (!headingMatch) {
        i += 1;
        continue;
      }
      const [, id, title] = headingMatch;

      if (seenIds.has(id)) {
        throw new TestCaseFormatError(`Duplicate case ID "${id}" — case IDs must be unique within the document`);
      }
      const expectedId = `case-${expectedIndex}`;
      if (id !== expectedId) {
        throw new TestCaseFormatError(
          `Case ID sequence gap: expected "${expectedId}", found "${id}"`
        );
      }
      seenIds.add(id);
      expectedIndex += 1;

      const parsed = parseCaseBlock(lines, i, id, title);
      cases.push({
        id: parsed.id,
        index: parsed.index,
        titulo: parsed.titulo,
        precondiciones: parsed.precondiciones,
        pasos: parsed.pasos,
        resultadoEsperado: parsed.resultadoEsperado,
        tipo: parsed.tipo,
        ejecucion: parsed.ejecucion,
        line: parsed.line,
      });
      i = parsed.nextIndex;
    }

    surfaces.push({ heading, origen, cases });
  }

  return { title, metadata, surfaces };
}

/**
 * Looks up exactly one case by its short ID (`findCase(doc, 'case-1')`, or
 * the bare number `findCase(doc, '1')`) using `CASE_HEADING_PATTERN` — the
 * same anchored pattern `parseTestCasesDoc` scans with, requiring the full
 * ID followed by the " — " heading delimiter. This is what keeps a lookup
 * for `case-1` from ever matching inside the heading for `case-12`: a bare
 * substring test would find "case-1" as a prefix of "case-12" and return
 * the wrong case, or two at once, the moment a document has 10+ cases
 * (03-RESEARCH.md Pitfall 5). Returns the case's fields plus the surface
 * heading it is grouped under. Throws `TestCaseFormatError` when the ID is
 * not present (naming the requested ID and listing every ID the document
 * does contain) or when it is ambiguous — two headings claiming the same ID
 * — because an ambiguous document must never resolve silently to the first
 * match. Also throws `TestCaseFormatError` if the resolved case's own block
 * contains a literal from `FORBIDDEN_DISPATCH_FLAGS` (CR-01) — this is what
 * keeps a dispatch-time lookup (the CLI's `--case` branch, or any other
 * caller) from ever handing back a `Pasos` value that already carries a
 * pre-approval like `--confirmed`, independent of whether the caller also
 * ran `validateTestCasesDoc` over the whole document first.
 */
export function findCase(markdown, caseId) {
  const id = /^\d+$/.test(String(caseId)) ? `case-${caseId}` : String(caseId);
  const lines = markdown.split(/\r?\n/);

  let currentSurface = null;
  const allIds = [];
  const matches = [];

  for (let i = 0; i < lines.length; i += 1) {
    const surfaceMatch = lines[i].match(SURFACE_HEADING_RE);
    if (surfaceMatch) {
      currentSurface = surfaceMatch[1].trim();
      continue;
    }
    const headingMatch = lines[i].match(CASE_HEADING_PATTERN);
    if (!headingMatch) continue;
    const [, foundId, title] = headingMatch;
    allIds.push(foundId);
    if (foundId === id) {
      matches.push({ index: i, title, surface: currentSurface });
    }
  }

  if (matches.length === 0) {
    throw new TestCaseFormatError(
      `Case "${id}" not found. This document contains: ${allIds.join(', ') || '(no cases)'}`
    );
  }
  if (matches.length > 1) {
    throw new TestCaseFormatError(
      `Case ID "${id}" is ambiguous — it appears in ${matches.length} headings in this document; ` +
        `an ambiguous document is never resolved to the first match`
    );
  }

  const { index, title, surface } = matches[0];
  const parsed = parseCaseBlock(lines, index, id, title);

  // Mirrors the FORBIDDEN_DISPATCH_FLAGS scan validateTestCasesDoc runs over
  // every case block, applied here to the single resolved case's own block
  // text. This is deliberately enforced at this layer (not only by the CLI's
  // --case branch) so every current and future caller of findCase — the
  // documented `--file <path> --case <id>` dispatch-time lookup included —
  // gets the same guarantee, independent of whether the caller also chose to
  // validate the whole document first (CR-01).
  const blockText = lines.slice(index, parsed.nextIndex).join('\n');
  for (const flag of FORBIDDEN_DISPATCH_FLAGS) {
    if (blockText.includes(flag)) {
      throw new TestCaseFormatError(
        `Case "${id}" contains forbidden dispatch flag "${flag}" — a case document must never ` +
          `pre-approve an action; the confirmation protocol runs at execution time, not generation time`
      );
    }
  }

  return {
    id: parsed.id,
    index: parsed.index,
    titulo: parsed.titulo,
    precondiciones: parsed.precondiciones,
    pasos: parsed.pasos,
    resultadoEsperado: parsed.resultadoEsperado,
    tipo: parsed.tipo,
    ejecucion: parsed.ejecucion,
    line: parsed.line,
    surface,
  };
}

/**
 * Validates a test-cases document against every rule
 * `references/test-case-format.md` states, collecting every violation
 * instead of throwing on the first — a developer fixing a hand-edited
 * document needs the whole list in one pass, not one error per re-run.
 * Returns `{ valid, errors, warnings, counts }`, where `counts` carries
 * `surfaces`, `cases`, `byTipo` (positivo/negativo/edge) and `byEjecucion`
 * (API/UI) totals. Checks: every surface heading is followed by a
 * `**Origen del surface:**` line (WR-03); every required field present;
 * `Tipo` and `Ejecución` in their allowed sets; no duplicate ID; no gap in
 * the `case-N` sequence starting from 1; every `negativo`/`edge` case
 * carries a file-and-line citation in its `Resultado esperado`; and no case
 * block contains a literal from `FORBIDDEN_DISPATCH_FLAGS` — a generated document
 * that pre-approves an action would route a destructive call around the
 * confirmation gate, and this is the check that makes shipping that
 * accidentally impossible.
 */
export function validateTestCasesDoc(markdown) {
  const errors = [];
  const warnings = [];
  const lines = markdown.split(/\r?\n/);

  const h1Line = lines.find((l) => l.startsWith('# '));
  if (!h1Line) {
    errors.push('Document is missing its H1 title line ("# Casos de Prueba — ...")');
  }

  const { metadata, nextIndex } = parseMetadata(lines, 0);
  for (const [label, key] of METADATA_KEYS) {
    if (!metadata[key]) {
      errors.push(`Document metadata is missing "${label}"`);
    }
  }

  const counts = {
    surfaces: 0,
    cases: 0,
    byTipo: { positivo: 0, negativo: 0, edge: 0 },
    byEjecucion: { API: 0, UI: 0 },
  };

  let i = nextIndex;
  let expectedIndex = 1;
  const seenIds = new Set();

  while (i < lines.length) {
    const surfaceMatch = lines[i].match(SURFACE_HEADING_RE);
    if (!surfaceMatch) {
      i += 1;
      continue;
    }
    counts.surfaces += 1;
    const surfaceHeading = surfaceMatch[1].trim();
    i += 1;

    // Mirrors the parseTestCasesDoc throw above (WR-03): a "##" surface
    // heading with no "**Origen del surface:**" line is a structural
    // violation, collected here rather than thrown so a single validation
    // pass still reports every other problem in the document too. Blank
    // lines are skipped first — see the parseTestCasesDoc comment for why.
    let originLine = i;
    while (originLine < lines.length && lines[originLine].trim() === '') originLine += 1;
    if (originLine < lines.length && ORIGEN_DEL_SURFACE_RE.test(lines[originLine])) {
      i = originLine + 1;
    } else {
      errors.push(`Surface "${surfaceHeading}" is missing its required "**Origen del surface:**" line`);
    }

    while (i < lines.length && !SURFACE_HEADING_RE.test(lines[i])) {
      const headingMatch = lines[i].match(CASE_HEADING_PATTERN);
      if (!headingMatch) {
        i += 1;
        continue;
      }
      const [, id] = headingMatch;
      counts.cases += 1;

      if (seenIds.has(id)) {
        errors.push(`Duplicate case ID "${id}" — case IDs must be unique within the document`);
      } else {
        seenIds.add(id);
      }

      const expectedId = `case-${expectedIndex}`;
      if (id !== expectedId) {
        errors.push(`Case ID sequence gap: expected "${expectedId}", found "${id}"`);
      }
      // Resync from the ID actually found rather than blindly incrementing
      // (WR-01) — otherwise one real gap cascades into a spurious error for
      // every case that follows it, burying the one genuine problem in noise
      // and defeating this function's whole point of collecting every
      // violation in one pass.
      const foundNum = Number(id.slice('case-'.length));
      expectedIndex = (Number.isInteger(foundNum) ? foundNum : expectedIndex) + 1;

      const { fields, nextIndex: caseNext } = scanCaseFields(lines, i);

      for (const field of CASE_FIELDS) {
        if (!fields[field]) {
          errors.push(`Case ${id} is missing its required "${field}" field`);
        }
      }

      const tipo = fields['Tipo'];
      if (tipo) {
        if (!CASE_TYPES.includes(tipo)) {
          errors.push(`Case ${id} has an invalid Tipo "${tipo}" — must be one of ${CASE_TYPES.join(', ')}`);
        } else {
          counts.byTipo[tipo] += 1;
        }
      }

      const ejecucion = fields['Ejecución'];
      if (ejecucion) {
        if (!EXECUTION_MODES.includes(ejecucion)) {
          errors.push(
            `Case ${id} has an invalid Ejecución "${ejecucion}" — must be one of ${EXECUTION_MODES.join(', ')}`
          );
        } else {
          counts.byEjecucion[ejecucion] += 1;
        }
      }

      if (tipo === 'negativo' || tipo === 'edge') {
        const resultado = fields['Resultado esperado'] ?? '';
        if (!CITATION_RE.test(resultado)) {
          errors.push(
            `Case ${id} — Tipo "${tipo}" requires a file-and-line citation in "Resultado esperado"`
          );
        }
      }

      const blockText = lines.slice(i, caseNext).join('\n');
      for (const flag of FORBIDDEN_DISPATCH_FLAGS) {
        if (blockText.includes(flag)) {
          errors.push(
            `Case ${id} contains forbidden dispatch flag "${flag}" — a case document must never ` +
              `pre-approve an action; the confirmation protocol runs at execution time, not generation time`
          );
        }
      }

      i = caseNext;
    }
  }

  return { valid: errors.length === 0, errors, warnings, counts };
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
  const filePath = typeof args.file === 'string' ? resolve(args.file) : undefined;

  if (!filePath) {
    process.stderr.write('--file is required\n');
    process.exit(2);
    return;
  }
  if (!existsSync(filePath)) {
    process.stderr.write(`File not found: ${filePath}\n`);
    process.exit(2);
    return;
  }

  const markdown = readFileSync(filePath, 'utf8');

  if (typeof args.case === 'string') {
    try {
      const found = findCase(markdown, args.case);
      process.stdout.write(`${JSON.stringify(found)}\n`);
      process.exit(0);
    } catch (err) {
      if (err instanceof TestCaseFormatError) {
        process.stderr.write(`${err.message}\n`);
        process.exit(9);
        return;
      }
      throw err;
    }
    return;
  }

  const result = validateTestCasesDoc(markdown);
  if (!result.valid) {
    process.stderr.write(`${result.errors.join('\n')}\n`);
    process.exit(9);
    return;
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}

// See api-client.mjs for why this resolves realpaths before comparing —
// a plain URL/string comparison breaks under the documented symlink/junction
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
