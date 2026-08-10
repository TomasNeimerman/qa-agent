// scripts/__fixtures__/mock-server.mjs
// Local Node http server fixture so HTTP paths are tested without a live target.

import { createServer } from 'node:http';

/**
 * Starts a minimal HTTP server on an ephemeral port serving the given routes.
 * `routes` is a map of `"METHOD path"` -> `{ status, body }` (body is
 * JSON-serialized automatically). Returns `{ url, close }`.
 */
export async function startMockServer(routes = {}) {
  const server = createServer((req, res) => {
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
