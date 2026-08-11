// scripts/destructive.mjs
// Mechanical (method-based) half of the destructive-action confirmation gate (D-01).
// This module holds no project configuration of any kind — no allowlist file, no
// denylist file, no per-project overrides — D-01 states none is needed. The
// "looksReadOnly" judgment (is this POST actually a search/filter?) is supplied
// by the orchestrator's own reasoning before calling requiresConfirmation; this
// module never infers it itself. No method is ever permanently barred here —
// confirmation always unlocks execution (D-02); this module only decides whether
// to pause, never whether an action is permitted.

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const DESTRUCTIVE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Returns true when `method` must not be dispatched without an explicit
 * `--confirmed` flag on that exact invocation.
 *
 * - DELETE is always true, regardless of `looksReadOnly` — per D-01 the
 *   read-only escape never applies to DELETE.
 * - POST/PUT/PATCH are true unless the caller states `looksReadOnly: true`
 *   (a search/filter endpoint judged read-only by the orchestrator).
 * - GET/HEAD/OPTIONS are always false.
 * - Any unrecognised method string is treated as gated (true) — unknown
 *   means gated, never waved through.
 */
export function requiresConfirmation(method, { looksReadOnly = false } = {}) {
  const m = String(method ?? '').toUpperCase();

  if (m === 'DELETE') return true;
  if (m === 'POST' || m === 'PUT' || m === 'PATCH') return !looksReadOnly;
  if (SAFE_METHODS.has(m)) return false;

  // Unrecognised method (e.g. PURGE) — gate it, never wave it through.
  return true;
}

/**
 * Builds the preview payload shown to the developer at the confirmation pause
 * point (D-03): the uppercased method, the absolute URL resolved against
 * baseUrl, and the body (or null). Built by explicit field assignment — never
 * by spreading the request object — so no header can ever reach the preview.
 */
export function previewOf({ method, url, baseUrl, body }) {
  const m = String(method ?? '').toUpperCase();
  const resolvedUrl = new URL(url, baseUrl).toString();

  return {
    method: m,
    url: resolvedUrl,
    body: body ?? null,
  };
}
