// scripts/__fixtures__/mock-login-app.mjs
// Dependency-free node:http fixture serving a real login form (D-03's
// proving ground — the form carries no CSS-selector hook beyond the
// id/for pairing a <label> needs to have an accessible name at all), a
// cookie-gated dashboard, and a cookie-gated JSON API. This is the target
// ui-login.mjs logs into and scripts/api-client.mjs's --storage-state flag
// authenticates against (EXEC-03, API-03).
//
// Dual mode, same convention as mock-server-process.mjs: imported directly
// it exports startMockLoginApp(); invoked as a process entry point (`node
// mock-login-app.mjs '{"user":"...","password":"..."}'`) it starts the
// server and prints "READY <url>" on stdout, shutting down on the stdin
// line "shutdown". The entry-point check is resolved through realpathSync
// on both sides, matching the isMainModule() fix api-client.mjs already
// carries for Windows junction installs.

import { randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const DEFAULT_USER = 'qa-test-user';
const DEFAULT_PASSWORD = 'CorrectHorseBatteryStaple!';

// The labels below are bound to their inputs via for/id — required for
// getByRole('textbox', { name }) to resolve an accessible name at all — and
// carry no other selector hook (no data-testid, no helper class) a
// per-project CSS selector could shortcut to instead.
function renderLoginPage({ error = false } = {}) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Ingresar</title></head>
<body>
${error ? '<p role="alert">Credenciales inválidas</p>' : ''}
<form method="POST" action="/login">
  <label for="usuario-field">Usuario</label>
  <input type="text" id="usuario-field" name="usuario" />
  <label for="password-field">Contraseña</label>
  <input type="password" id="password-field" name="password" />
  <button type="submit">Ingresar</button>
</form>
</body>
</html>`;
}

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) cookies[key] = value;
  }
  return cookies;
}

function writeHtml(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(body);
}

function writeJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Starts a dependency-free HTTP server on an ephemeral port serving a real
 * login form (`GET /login` / `POST /login`), a cookie-gated dashboard
 * (`GET /dashboard`) and a cookie-gated JSON API (`GET /api/me`), plus a
 * `HEAD /` route so api-client.mjs's preflight() probe succeeds against
 * this fixture. Returns `{ url, close() }`.
 */
export async function startMockLoginApp({ user = DEFAULT_USER, password = DEFAULT_PASSWORD } = {}) {
  const sessions = new Set();

  const server = createServer((req, res) => {
    const [pathname] = req.url.split('?');

    if (req.method === 'HEAD' && pathname === '/') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'GET' && pathname === '/login') {
      writeHtml(res, 200, renderLoginPage());
      return;
    }

    if (req.method === 'POST' && pathname === '/login') {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const parsed = new URLSearchParams(raw);
        const submittedUser = parsed.get('usuario') ?? '';
        const submittedPassword = parsed.get('password') ?? '';

        if (submittedUser === user && submittedPassword === password) {
          const token = randomBytes(16).toString('hex');
          sessions.add(token);
          res.writeHead(302, {
            Location: '/dashboard',
            'Set-Cookie': `qa_session=${token}; Path=/; HttpOnly`,
          });
          res.end();
          return;
        }

        writeHtml(res, 401, renderLoginPage({ error: true }));
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/dashboard') {
      const cookies = parseCookies(req.headers.cookie);
      if (cookies.qa_session && sessions.has(cookies.qa_session)) {
        writeHtml(res, 200, '<!DOCTYPE html><html><body><h1>Panel de control</h1></body></html>');
        return;
      }
      res.writeHead(302, { Location: '/login' });
      res.end();
      return;
    }

    if (req.method === 'GET' && pathname === '/api/me') {
      const cookies = parseCookies(req.headers.cookie);
      if (cookies.qa_session && sessions.has(cookies.qa_session)) {
        writeJson(res, 200, { user });
        return;
      }
      writeJson(res, 401, { error: 'no session' });
      return;
    }

    writeJson(res, 404, { error: 'not found' });
  });

  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolvePromise());
  });

  const address = server.address();
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    close: () =>
      new Promise((resolvePromise) => {
        server.close(() => resolvePromise());
      }),
  };
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const configArg = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const app = await startMockLoginApp(configArg);
  process.stdout.write(`READY ${app.url}\n`);

  process.stdin.resume();
  process.stdin.on('data', (data) => {
    if (data.toString().trim() === 'shutdown') {
      app.close().then(() => process.exit(0));
    }
  });
}
