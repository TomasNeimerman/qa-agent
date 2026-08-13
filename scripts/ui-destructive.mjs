// scripts/ui-destructive.mjs
// Mechanical (element-text-based) half of the UI destructive-action confirmation
// gate (D-06) — the browser sibling of scripts/destructive.mjs's method-based
// classification. This module holds no project configuration of any kind — no
// per-app element allowlist, no denylist file, no selector map — D-06 requires
// none. The judgment call on an ambiguous label (is "Cancelar" here a dismiss
// action or a real cancellation?) belongs to the orchestrator, reading
// references/ui-destructive-classification.md, not to this module. A keyword
// hit here decides only whether to pause, never whether an action is
// permitted — confirmation always unlocks execution (Phase 1's D-02).

// Spanish-first, per D-06: the target apps (DATAX/dotax/franquix) are
// Spanish-language, and an English-only list would silently wave through a
// Spanish "Eliminar" button. English equivalents are added as a supplement
// because component libraries frequently ship English default labels even in
// an otherwise-Spanish UI. Truncated stems (e.g. "enviar notificaci") are
// used deliberately so both the accented and unaccented spelling of a word
// match without needing Unicode normalisation.
export const UI_DESTRUCTIVE_KEYWORDS = [
  // D-06's five literal keywords
  'eliminar',
  'borrar',
  'cancelar',
  'confirmar pago',
  'dar de baja',
  // Deletion and removal
  'quitar',
  'suprimir',
  // Account / record lifecycle
  'anular',
  'suspender',
  'desactivar',
  'restablecer',
  'resetear',
  'vaciar',
  'archivar',
  // Financial mutation
  'pagar',
  'cobrar',
  'facturar',
  'reembolsar',
  // Permission and role change
  'rechazar',
  'revocar',
  'cambiar rol',
  'cambiar permiso',
  // Real outbound messaging
  'enviar email',
  'enviar correo',
  'enviar notificaci',
  'enviar recordatorio',
  // English equivalents (bilingual component libraries)
  'delete',
  'remove',
  'cancel',
  'deactivate',
  'revoke',
  'refund',
  'pay',
  'send email',
];

/**
 * Returns true when an element whose visible text is `text` and whose
 * accessible-name supplement is `ariaLabel` must not be clicked, typed into,
 * or filled without an explicit developer confirmation on that one element.
 *
 * - Both sources are joined into one lowercased haystack and checked as one —
 *   a keyword in either the visible text or the aria-label gates the element.
 * - An empty, whitespace-only, `undefined` or `null` haystack returns true:
 *   an element with no accessible name at all (e.g. an icon-only button) is
 *   the exact case the Security Domain table calls out as needing to fail
 *   closed, since a name-based classifier cannot tell an icon-only delete
 *   button from an icon-only save button.
 * - Matching is case-insensitive and substring-based, so "eliminar" inside
 *   "Eliminar definitivamente" hits.
 */
export function requiresConfirmationForElement(text, { ariaLabel } = {}) {
  const haystack = `${text ?? ''} ${ariaLabel ?? ''}`.toLowerCase().trim();

  if (haystack === '') return true;

  return UI_DESTRUCTIVE_KEYWORDS.some((kw) => haystack.includes(kw));
}

/**
 * Builds the preview payload shown to the developer at the UI confirmation
 * pause point: the element's visible text, its aria-label, its snapshot ref
 * and the current page URL. Built by explicit field assignment — never by
 * spreading the caller's object — so a `browser_fill_form` argument object
 * (which carries the values being typed) can never leak a typed value,
 * including a typed password, into the confirmation prompt the developer
 * sees.
 */
export function previewOfElement({ text, ariaLabel, ref, url }) {
  return {
    text: text ?? null,
    ariaLabel: ariaLabel ?? null,
    ref: ref ?? null,
    url: url ?? null,
  };
}
