// scripts/__fixtures__/mock-server.mjs
// Local Node http server fixture so HTTP paths are tested without a live target.

import { createServer } from 'node:http';

// Default routes available on every mock server instance unless the caller's
// own `routes` map supplies the same "METHOD path" key (caller routes always
// win). These cover the full method set plus the error/edge-case routes
// Task 1 of plan 01-04 needs: an echo route per mutating method, a 204
// no-body DELETE, a 500 JSON error, a 404 JSON error, and a text/plain body.
const DEFAULT_ROUTES = {
  'GET /api/clients': { status: 200, body: { clients: [{ id: 1, name: 'Acme' }], total: 1 } },
  'POST /api/clients': { echo: true, status: 201 },
  'PUT /api/clients': { echo: true, status: 200 },
  'PATCH /api/clients': { echo: true, status: 200 },
  'DELETE /api/clients/1': { status: 204 },
  'GET /api/boom': { status: 500, body: { error: 'internal server error' } },
  'GET /api/missing': { status: 404, body: { error: 'not found' } },
  'GET /api/text': { status: 200, contentType: 'text/plain', body: 'hello world' },
};

function writeJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Starts a minimal HTTP server on an ephemeral port serving the given routes
 * merged on top of DEFAULT_ROUTES (caller routes win on key collision).
 * `routes` is a map of `"METHOD path"` -> `{ status, body }` (body is
 * JSON-serialized automatically), `{ echo: true, status }` (responds with
 * the parsed request body back as JSON), or `{ status, contentType, body }`
 * for a non-JSON content type. Returns `{ url, close, requests, reset }`.
 *
 * Every incoming request (except introspection calls to `/__requests` and
 * `/__reset` themselves) is appended to an in-memory log of
 * `{ method, url, body }` entries. `requests` is that same live array,
 * directly readable by in-process callers (e.g. a test that imports
 * `startMockServer` and calls `runCase` in the same process); `reset()`
 * clears it directly. `GET /__requests` / `POST /__reset` remain available
 * over HTTP for out-of-process callers (a sibling test process talking to
 * this server only over loopback) — that HTTP surface intentionally still
 * returns only `{ method, url }` per entry, preserving the shape earlier
 * sibling-plan tests already assert against.
 */
export async function startMockServer(routes = {}) {
  const requestLog = [];
  const merged = { ...DEFAULT_ROUTES, ...routes };

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/__requests') {
      writeJson(
        res,
        200,
        requestLog.map(({ method, url }) => ({ method, url }))
      );
      return;
    }
    if (req.method === 'POST' && req.url === '/__reset') {
      requestLog.length = 0;
      writeJson(res, 200, { ok: true });
      return;
    }

    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let parsedBody = null;
      if (raw.length) {
        try {
          parsedBody = JSON.parse(raw);
        } catch {
          parsedBody = raw;
        }
      }

      requestLog.push({ method: req.method, url: req.url, body: parsedBody });

      const key = `${req.method} ${req.url}`;
      const route = merged[key];

      if (!route) {
        writeJson(res, 404, { error: 'not found' });
        return;
      }

      if (route.echo) {
        writeJson(res, route.status ?? 200, parsedBody ?? {});
        return;
      }

      if (route.contentType && route.contentType !== 'application/json') {
        res.writeHead(route.status ?? 200, { 'Content-Type': route.contentType });
        res.end(typeof route.body === 'string' ? route.body : String(route.body ?? ''));
        return;
      }

      if (route.status === 204 || route.body === undefined) {
        res.writeHead(route.status ?? 204);
        res.end();
        return;
      }

      const body = typeof route.body === 'string' ? route.body : JSON.stringify(route.body);
      res.writeHead(route.status ?? 200, { 'Content-Type': 'application/json' });
      res.end(body);
    });
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
    requests: requestLog,
    reset: () => {
      requestLog.length = 0;
    },
  };
}
