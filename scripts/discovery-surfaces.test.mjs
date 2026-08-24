// scripts/discovery-surfaces.test.mjs
//
// This file is a proof that the detection patterns documented in
// references/discovery-nextjs.md actually find the Next.js file shapes they
// claim to find, and that the doc and this file have not drifted apart. It
// is NOT a component of the runtime discovery path — at run time the
// orchestrator applies these same rules through its own Glob and Grep tool
// calls, exactly as SKILL.md's `## Discovery protocol` describes. Nothing
// exported here is imported by SKILL.md or by any production script.

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const APP_FIXTURE = resolve(__dirname, '__fixtures__/mock-target-repo');
const PAGES_FIXTURE = resolve(__dirname, '__fixtures__/mock-target-repo-pages');
const HYBRID_FIXTURE = resolve(__dirname, '__fixtures__/mock-target-repo-hybrid');
const DOC_PATH = resolve(__dirname, '../references/discovery-nextjs.md');
const SKILL_PATH = resolve(__dirname, '../SKILL.md');

// --- Pattern constants --------------------------------------------------
// Every pattern below is documented in references/discovery-nextjs.md —
// the "pattern doc agreement" describe block is the anti-drift lock: a
// pattern the doc no longer states fails that test.

export const API_ROUTE_GLOB = 'app/**/route.ts';
export const PAGES_API_GLOB = 'pages/api/**/*.ts';
export const PAGE_GLOB = 'app/**/page.tsx';
export const SERVER_ACTION_MARKER = "'use server'";
export const VERB_EXPORT_PATTERN =
  /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g;
export const PAGES_HANDLER_PATTERN =
  /export\s+default\s+async\s+function\s+\w+\s*\(\s*req\s*,\s*res\s*\)/;
export const IMPERATIVE_ERROR_PATTERN =
  /NextResponse\.json\(\s*\{\s*error:\s*'([^']*)'\s*\}\s*,\s*\{\s*status:\s*(\d{3})\s*\}\s*\)/g;
export const EXCLUDED_DIRS = ['node_modules', '.next', 'dist', 'build', 'out', 'coverage', '.git'];

// --- Helpers --------------------------------------------------------------

/** Minimal glob-to-RegExp: supports '**' (zero or more path segments,
 *  including none) and '*' (any run of non-slash characters) — the only
 *  two glob shapes any pattern above uses. */
function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') {
        out += '(?:.*/)?';
        i++;
      } else {
        out += '.*';
      }
    } else if (c === '*') {
      out += '[^/]*';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      out += `\\${c}`;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

/** Walks `root` recursively (via `readdirSync`'s stable `recursive`
 *  option) and returns the root-relative, forward-slash paths of every
 *  file matching `glob`, skipping any path with a directory segment named
 *  in `excluded`. */
export function walkFixture(root, { glob, excluded = EXCLUDED_DIRS } = {}) {
  const pattern = globToRegExp(glob);
  const results = [];
  const entries = readdirSync(root, { withFileTypes: true, recursive: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const parentDir = entry.parentPath ?? entry.path;
    const relDir = relative(root, parentDir).split(sep).join('/');
    if (relDir.split('/').some((seg) => excluded.includes(seg))) continue;
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (pattern.test(relPath)) results.push(relPath);
  }
  return results.sort();
}

/** Classifies a discovered page.tsx as server-action-backed or
 *  client-fetch-backed, per references/discovery-nextjs.md's ordered
 *  form-mechanism check: a colocated actions.ts carrying the server
 *  directive wins even when a fetch() call is also present in the page. */
export function classifyFormSurface(pageFilePath) {
  const dir = dirname(pageFilePath);
  const actionsFilePath = join(dir, 'actions.ts');
  if (existsSync(actionsFilePath)) {
    const actionsContent = readFileSync(actionsFilePath, 'utf8');
    if (actionsContent.includes(SERVER_ACTION_MARKER)) {
      return { mechanism: 'server-action', actionsFile: actionsFilePath };
    }
  }
  const pageContent = readFileSync(pageFilePath, 'utf8');
  const hasForm = /<form[\s>]/.test(pageContent);
  const fetchMatch = pageContent.match(/fetch\(\s*['"`](\/api\/[^'"`]*)['"`]/);
  if (hasForm && fetchMatch) {
    return { mechanism: 'client-fetch', resolvedApi: fetchMatch[1] };
  }
  return { mechanism: 'unknown' };
}

/** Detects the target project's router layout from its folder structure
 *  (D-08) — see references/discovery-nextjs.md's router-layout heuristic.
 *  Four named outcomes: `app`, `pages`, `both`, `unknown` — `unknown` is a
 *  distinct, nameable outcome, never an empty success, since the protocol
 *  has to stop and ask rather than emit an empty document. */
export function detectRouterLayout(projectRoot) {
  const appDir = join(projectRoot, 'app');
  const pagesApiDir = join(projectRoot, 'pages', 'api');
  const appHasSurface =
    existsSync(appDir) &&
    (walkFixture(projectRoot, { glob: API_ROUTE_GLOB }).length > 0 ||
      walkFixture(projectRoot, { glob: PAGE_GLOB }).length > 0);
  const pagesHasHandlers =
    existsSync(pagesApiDir) && walkFixture(projectRoot, { glob: PAGES_API_GLOB }).length > 0;

  if (appHasSurface && pagesHasHandlers) return { layout: 'both', roots: ['app', 'pages/api'] };
  if (appHasSurface) return { layout: 'app', roots: ['app'] };
  if (pagesHasHandlers) return { layout: 'pages', roots: ['pages/api'] };
  return { layout: 'unknown', roots: [] };
}

/** Reads the Pages Router method-switch shape's handled verbs — not a
 *  documented pattern constant in its own right (the Pages Router handler
 *  shape itself is what PAGES_HANDLER_PATTERN identifies); this is a
 *  test-only helper for reading what a matched handler actually does. */
function extractHandledMethods(content) {
  return [...content.matchAll(/req\.method\s*===\s*'(\w+)'/g)].map((m) => m[1]);
}

// --- Pattern doc agreement (anti-drift lock) -------------------------------

describe('pattern doc agreement (anti-drift lock)', () => {
  const doc = readFileSync(DOC_PATH, 'utf8');
  const skill = readFileSync(SKILL_PATH, 'utf8');

  it('states every glob and marker literal', () => {
    expect(doc).toContain(API_ROUTE_GLOB);
    expect(doc).toContain(PAGE_GLOB);
    expect(doc).toContain(SERVER_ACTION_MARKER);
  });

  it('states every Task-1 regex pattern source', () => {
    expect(doc).toContain(VERB_EXPORT_PATTERN.source);
    expect(doc).toContain(IMPERATIVE_ERROR_PATTERN.source);
  });

  it('states every excluded directory, in the doc and in SKILL.md', () => {
    for (const dir of EXCLUDED_DIRS) {
      expect(doc).toContain(dir);
      expect(skill).toContain(dir);
    }
  });

  it('states the Pages Router glob and handler pattern (added in Task 2)', () => {
    expect(doc).toContain(PAGES_API_GLOB);
    expect(doc).toContain(PAGES_HANDLER_PATTERN.source);
  });

  it('names every router-layout outcome detectRouterLayout can return', () => {
    for (const layout of ['app', 'pages', 'both', 'unknown']) {
      expect(doc).toContain(layout);
    }
  });
});

// --- API-handler discovery -------------------------------------------------

describe('API-handler discovery — app-router fixture', () => {
  it('finds exactly the two API handlers', () => {
    const routes = walkFixture(APP_FIXTURE, { glob: API_ROUTE_GLOB });
    expect(routes).toEqual(['app/api/categorias/route.ts', 'app/api/registro/route.ts']);
  });

  it('extracts the categorias handler verb set', () => {
    const content = readFileSync(join(APP_FIXTURE, 'app/api/categorias/route.ts'), 'utf8');
    const verbs = [...content.matchAll(VERB_EXPORT_PATTERN)].map((m) => m[1]);
    expect(verbs).toEqual(['GET', 'POST']);
  });

  it('extracts the registro handler verb set', () => {
    const content = readFileSync(join(APP_FIXTURE, 'app/api/registro/route.ts'), 'utf8');
    const verbs = [...content.matchAll(VERB_EXPORT_PATTERN)].map((m) => m[1]);
    expect(verbs).toEqual(['POST']);
  });

  it('extracts at least four imperative validation checks from categorias, each 4xx with a literal message', () => {
    const content = readFileSync(join(APP_FIXTURE, 'app/api/categorias/route.ts'), 'utf8');
    const matches = [...content.matchAll(IMPERATIVE_ERROR_PATTERN)];
    expect(matches.length).toBeGreaterThanOrEqual(4);
    for (const m of matches) {
      const status = Number(m[2]);
      expect(status).toBeGreaterThanOrEqual(400);
      expect(status).toBeLessThan(500);
      expect(m[1].length).toBeGreaterThan(0);
    }
  });
});

// --- Form discovery ---------------------------------------------------------

describe('form discovery — app-router fixture', () => {
  it('finds exactly the two pages', () => {
    const pages = walkFixture(APP_FIXTURE, { glob: PAGE_GLOB });
    expect(pages).toEqual(['app/login/page.tsx', 'app/registro/page.tsx']);
  });

  it('classifies /login as server-action, with no fetch() call in its page', () => {
    const pagePath = join(APP_FIXTURE, 'app/login/page.tsx');
    const result = classifyFormSurface(pagePath);
    expect(result.mechanism).toBe('server-action');
    const pageContent = readFileSync(pagePath, 'utf8');
    expect(pageContent).not.toContain('fetch(');
  });

  it('classifies /registro as client-fetch, resolving to the registro API handler on disk', () => {
    expect(existsSync(join(APP_FIXTURE, 'app/registro/actions.ts'))).toBe(false);
    const pagePath = join(APP_FIXTURE, 'app/registro/page.tsx');
    const result = classifyFormSurface(pagePath);
    expect(result.mechanism).toBe('client-fetch');
    expect(result.resolvedApi).toBe('/api/registro');
    const routes = walkFixture(APP_FIXTURE, { glob: API_ROUTE_GLOB });
    expect(routes).toContain(`app${result.resolvedApi}/route.ts`);
  });

  it('never returns server-action for /registro nor client-fetch for /login', () => {
    const loginResult = classifyFormSurface(join(APP_FIXTURE, 'app/login/page.tsx'));
    const registroResult = classifyFormSurface(join(APP_FIXTURE, 'app/registro/page.tsx'));
    expect(loginResult.mechanism).not.toBe('client-fetch');
    expect(registroResult.mechanism).not.toBe('server-action');
  });
});

describe('form mechanism tie-break — server-action wins when both signals are present', () => {
  let dir;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('pins server-action precedence against a synthetic fixture', () => {
    dir = mkdtempSync(join(tmpdir(), 'qa-agent-tie-break-'));
    writeFileSync(
      join(dir, 'page.tsx'),
      "'use client';\nexport default function Page() {\n  fetch('/api/both');\n  return <form></form>;\n}\n"
    );
    writeFileSync(join(dir, 'actions.ts'), "'use server'\nexport async function bothAction() {}\n");
    const result = classifyFormSurface(join(dir, 'page.tsx'));
    expect(result.mechanism).toBe('server-action');
  });
});

// --- Router layout detection (D-08) -----------------------------------------

describe('router layout detection', () => {
  it('detects app-only layout on the app-router fixture', () => {
    const result = detectRouterLayout(APP_FIXTURE);
    expect(result.layout).toBe('app');
    expect(result.roots).toEqual(['app']);
  });

  it('detects pages-only layout on the pages-router fixture', () => {
    const result = detectRouterLayout(PAGES_FIXTURE);
    expect(result.layout).toBe('pages');
    expect(result.roots).toEqual(['pages/api']);
  });

  it('detects both when a project has both layouts present', () => {
    const result = detectRouterLayout(HYBRID_FIXTURE);
    expect(result.layout).toBe('both');
    expect(result.roots).toEqual(['app', 'pages/api']);
  });

  it('returns unknown with no roots for neither layout — a distinct nameable outcome', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qa-agent-unknown-layout-'));
    try {
      const result = detectRouterLayout(dir);
      expect(result.layout).toBe('unknown');
      expect(result.roots).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not classify an app directory with no handler or page file as layout app', () => {
    const dir = mkdtempSync(join(tmpdir(), 'qa-agent-empty-app-'));
    try {
      mkdirSync(join(dir, 'app'), { recursive: true });
      const result = detectRouterLayout(dir);
      expect(result.layout).not.toBe('app');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// --- Pages Router handler shape ---------------------------------------------

describe('Pages Router handler shape', () => {
  it('finds exactly one pages API handler', () => {
    const handlers = walkFixture(PAGES_FIXTURE, { glob: PAGES_API_GLOB });
    expect(handlers).toEqual(['pages/api/legacy.ts']);
  });

  it('matches the default-export handler with PAGES_HANDLER_PATTERN', () => {
    const content = readFileSync(join(PAGES_FIXTURE, 'pages/api/legacy.ts'), 'utf8');
    expect(PAGES_HANDLER_PATTERN.test(content)).toBe(true);
  });

  it('finds nothing when the App Router verb pattern is applied to a Pages Router file', () => {
    const content = readFileSync(join(PAGES_FIXTURE, 'pages/api/legacy.ts'), 'utf8');
    const verbs = [...content.matchAll(VERB_EXPORT_PATTERN)];
    expect(verbs).toHaveLength(0);
  });

  it("reads the method switch's handled verb set", () => {
    const content = readFileSync(join(PAGES_FIXTURE, 'pages/api/legacy.ts'), 'utf8');
    expect(extractHandledMethods(content)).toEqual(['GET', 'POST']);
  });
});

// --- Hybrid layout handling --------------------------------------------------

describe('hybrid layout handling', () => {
  it('finds both the app-side page and the pages-side handler, neither empty', () => {
    const pages = walkFixture(HYBRID_FIXTURE, { glob: PAGE_GLOB });
    const handlers = walkFixture(HYBRID_FIXTURE, { glob: PAGES_API_GLOB });
    expect(pages.length).toBeGreaterThan(0);
    expect(handlers.length).toBeGreaterThan(0);
  });
});

// --- Exclusions --------------------------------------------------------------

describe('exclusions', () => {
  let dir;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('walks past node_modules and .next, finding only the real handler', () => {
    dir = mkdtempSync(join(tmpdir(), 'qa-agent-exclusions-'));
    mkdirSync(join(dir, 'node_modules/pkg/app/api/x'), { recursive: true });
    writeFileSync(join(dir, 'node_modules/pkg/app/api/x/route.ts'), 'export async function GET() {}');
    mkdirSync(join(dir, '.next/server/app/api/y'), { recursive: true });
    writeFileSync(join(dir, '.next/server/app/api/y/route.ts'), 'export async function GET() {}');
    mkdirSync(join(dir, 'app/api/z'), { recursive: true });
    writeFileSync(join(dir, 'app/api/z/route.ts'), 'export async function GET() {}');
    const routes = walkFixture(dir, { glob: API_ROUTE_GLOB });
    expect(routes).toEqual(['app/api/z/route.ts']);
  });
});
