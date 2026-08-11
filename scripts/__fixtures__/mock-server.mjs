// scripts/__fixtures__/mock-server.mjs
// Local Node http server fixture so HTTP paths are tested without a live target.

import { createServer } from 'node:http';

/**
 * Starts a minimal HTTP server on an ephemeral port serving the given routes.
 * `routes` is a map of `"METHOD path"` -> `{ status, body }` (body is
 * JSON-serialized automatically). Returns `{ url, close }`.
 *
 * Every incoming request (except introspection calls to `/__requests` and
 * `/__reset` themselves) is appended to an in-memory log of `{ method, url }`
 * entries, retrievable via `GET /__requests` and clearable via
 * `POST /__reset` — this lets tests assert "zero HTTP requests reached the
 * server" without needing a separate process-log mechanism.
 */
export async function startMockServer(routes = {}) {
  const requestLog = [];

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/__requests') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(requestLog));
      return;
    }
    if (req.method === 'POST' && req.url === '/__reset') {
      requestLog.length = 0;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    requestLog.push({ method: req.method, url: req.url });

    const key = `${req.method} ${req.url}`;
    const route = routes[key];
    if (!route) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    const body = typeof route.body === 'string' ? route.body : JSON.stringify(route.body);
    res.writeHead(route.status ?? 200, { 'Content-Type': 'application/json' });
    res.end(body);
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
