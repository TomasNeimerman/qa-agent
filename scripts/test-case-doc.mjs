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

function parseCaseBlock(lines, headingIndex, id, title) {
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
    nextIndex: i,
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
 * `Ejecución` value, a duplicate ID, or an ID sequence that is not gapless
 * from `case-1`. A silent skip is the failure mode this function exists to
 * avoid: a malformed case that parsed to `undefined` would be a case nobody
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

    let origen = '';
    if (i < lines.length) {
      const origenMatch = lines[i].match(ORIGEN_DEL_SURFACE_RE);
      if (origenMatch) {
        origen = origenMatch[1].trim();
        i += 1;
      }
    }

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
