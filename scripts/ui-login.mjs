// scripts/ui-login.mjs
// Deterministic Playwright-core login script (D-08). This is the ONLY tier
// that ever sees the plaintext QA_AGENT_UI_PASSWORD: the value is read from
// process.env inside THIS process only, used solely in a page.fill() call
// against the password locator, and is never returned, printed, logged, or
// written to any artifact this script produces. This is exactly why D-08
// makes the login step script-driven instead of routing it through
// orchestrator-issued Playwright MCP tool calls (02-RESEARCH.md, Common
// Pitfalls #1) — an MCP tool call would require the orchestrator's own
// reasoning to construct the password as a literal string argument, putting
// it directly into the conversation transcript.
//
// CLI exit codes — extends, never renumbers, api-client.mjs's table:
//   0 = logged in, storageState written
//   2 = UiConfigError (QA_AGENT_UI_USER / QA_AGENT_UI_PASSWORD not configured)
//   4 = navigation/transport failure reaching the login page
//   7 = LoginFailedError (credentials rejected, or no post-login signal)
// Codes 3, 5 and 6 stay reserved for their api-client.mjs meanings.

import { existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { chromium } from 'playwright';

export class UiConfigError extends Error {}
export class LoginFailedError extends Error {}

/**
 * Resolves the UI test-user credentials for a browser login: loads
 * `.env.local` then `.env` from `projectRoot` (default `process.cwd()`)
 * exactly like api-client.mjs's readConfig, then reads QA_AGENT_UI_USER and
 * QA_AGENT_UI_PASSWORD from process.env. A missing OR empty/whitespace-only
 * value for either variable throws UiConfigError naming BOTH variable names
 * — a message naming only the missing half sends the developer looking in
 * the wrong place — and never partially proceeds with an empty credential.
 */
export function readUiCredentials({ projectRoot } = {}) {
  const root = projectRoot ?? process.cwd();

  for (const filename of ['.env.local', '.env']) {
    const path = resolve(root, filename);
    if (existsSync(path)) {
      dotenv.config({ path, override: false });
    }
  }

  const user = process.env.QA_AGENT_UI_USER;
  const password = process.env.QA_AGENT_UI_PASSWORD;

  const userMissing = !user || !String(user).trim();
  const passwordMissing = !password || !String(password).trim();

  if (userMissing || passwordMissing) {
    throw new UiConfigError(
      'A UI login was requested but the credentials are not configured — set both ' +
        'QA_AGENT_UI_USER and QA_AGENT_UI_PASSWORD (export them in the shell that ' +
        "launched Claude Code, or set them in the target project's .env.local) before " +
        'running ui-login.mjs.'
    );
  }

  return { user, password };
}

/**
 * Locates the username/email field, the password field, and the submit
 * control on the current page purely by accessibility role and accessible
 * name (D-03) — no CSS selector keyed to any specific target project's
 * markup. The username field falls back to `input[type="email"]` and then
 * `input[type="text"]` only when the role query resolves to nothing; the
 * password field is located by its input type (a password input has no
 * distinct accessibility role, so its type is the accessible signal); the
 * submit control falls back to `button[type="submit"]` under the same
 * "only when the role query matches nothing" rule.
 */
export async function findLoginFields(page) {
  let userField = page
    .getByRole('textbox', { name: /usuario|user(name)?|correo|e-?mail|login/i })
    .first();
  if ((await userField.count()) === 0) {
    userField = page.locator('input[type="email"]').first();
    if ((await userField.count()) === 0) {
      userField = page.locator('input[type="text"]').first();
    }
  }

  const passField = page.locator('input[type="password"]').first();

  let submitButton = page
    .getByRole('button', { name: /iniciar|ingresar|entrar|acceder|log ?in|sign ?in|continuar/i })
    .first();
  if ((await submitButton.count()) === 0) {
    submitButton = page.locator('button[type="submit"]').first();
  }

  return { userField, passField, submitButton };
}

/**
 * Launches a single Chromium browser + context + page (D-02), navigates to
 * `loginPath` on `baseUrl`, resolves credentials and form fields, submits
 * the login form, then waits for a positive post-login signal (the page URL
 * no longer on `loginPath`, or the password field detached) before writing
 * `storageState` to `storageStatePath` — a half-authenticated session never
 * reaches the written file. Closes the context and browser in a `finally`
 * on every path, including a thrown error, so no Chromium process leaks on
 * failure. Returns `{ storageStatePath, postLoginUrl, cookieNames }`, where
 * `cookieNames` is read back from the WRITTEN FILE (never live cookie
 * values) — this is a session credential, its values must never surface.
 */
export async function performLogin({
  baseUrl,
  loginPath = '/login',
  storageStatePath,
  timeoutMs = 15000,
  headless = true,
} = {}) {
  const browser = await chromium.launch({ headless });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const loginUrl = new URL(loginPath, baseUrl).toString();
    try {
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    } catch (err) {
      const wrapped = new Error(`unable to reach login page: ${loginUrl} — ${err.message}`);
      wrapped.cause = err;
      throw wrapped;
    }

    // readUiCredentials can throw UiConfigError here — it propagates past
    // this function's own catch blocks (neither of which wrap it) straight
    // up to the CLI, which maps it to exit 2. No storage-state file exists
    // at this point either way.
    const { user, password } = readUiCredentials();
    const { userField, passField, submitButton } = await findLoginFields(page);

    try {
      await userField.fill(user, { timeout: timeoutMs });
      await passField.fill(password, { timeout: timeoutMs });
      await submitButton.click({ timeout: timeoutMs });
    } catch {
      throw new LoginFailedError(
        `Login failed at ${baseUrl} (${loginPath}) — the login form was not found, or ` +
          'could not be filled/submitted.'
      );
    }

    const urlChanged = page
      .waitForURL((url) => !url.pathname.startsWith(loginPath), { timeout: timeoutMs })
      .then(() => true)
      .catch(() => false);
    const fieldDetached = passField
      .waitFor({ state: 'detached', timeout: timeoutMs })
      .then(() => true)
      .catch(() => false);
    const [changed, detached] = await Promise.all([urlChanged, fieldDetached]);

    if (!changed && !detached) {
      throw new LoginFailedError(
        `Login failed at ${baseUrl} (${loginPath}) — the supplied QA_AGENT_UI_USER was ` +
          'rejected, or no post-login state change was observed.'
      );
    }

    const postLoginUrl = page.url();

    const resolvedPath = resolve(storageStatePath);
    mkdirSync(dirname(resolvedPath), { recursive: true });
    await context.storageState({ path: resolvedPath });

    const written = JSON.parse(readFileSync(resolvedPath, 'utf8'));
    const cookieNames = (written.cookies ?? []).map((c) => c.name);

    return { storageStatePath: resolvedPath, postLoginUrl, cookieNames };
  } finally {
    await browser.close();
  }
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

function defaultStorageStatePath(projectRoot) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-` +
    `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return resolve(projectRoot, 'qa-reports', `${stamp}-storage-state.json`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = args['project-root'] ?? process.cwd();

  const baseUrl = args['base-url'];
  if (!baseUrl) {
    process.stderr.write('--base-url is required\n');
    process.exit(2);
    return;
  }

  const loginPath = args['login-path'] ?? '/login';
  const storageStatePath = args['storage-state']
    ? resolve(args['storage-state'])
    : defaultStorageStatePath(projectRoot);
  const timeoutMs = args.timeout ? Number(args.timeout) : 15000;
  const headless = !args.headed;

  let result;
  try {
    result = await performLogin({ baseUrl, loginPath, storageStatePath, timeoutMs, headless });
  } catch (err) {
    if (err instanceof UiConfigError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(2);
      return;
    }
    if (err instanceof LoginFailedError) {
      process.stderr.write(`${err.message}\n`);
      process.exit(7);
      return;
    }
    process.stderr.write(`${err.message}\n`);
    process.exit(4);
    return;
  }

  const payload = {
    status: 'logged_in',
    storageStatePath: result.storageStatePath,
    postLoginUrl: result.postLoginUrl,
    cookieNames: result.cookieNames,
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exit(0);
}

// Resolve both sides through realpathSync before comparing — matches
// api-client.mjs's isMainModule() fix for Windows junction installs.
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
