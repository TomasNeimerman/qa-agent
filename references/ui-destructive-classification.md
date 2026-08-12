# UI Destructive-Element Classification

This is the judgment rubric the orchestrator applies **before** issuing any
Playwright MCP interaction tool call (`browser_click`, `browser_fill_form`,
`browser_type`) — the UI sibling of `references/destructive-classification.md`.
It decides only whether to pause and ask, never whether an action is
permitted — see the closing note below (D-02).

## Keyword Table

Grouped by the destructive categories `scripts/ui-destructive.mjs` matches.
The list is **Spanish-first on purpose**: the target apps (DATAX, dotax,
franquix) are Spanish-language, and an English-only list would silently wave
through an `Eliminar` button. English equivalents are listed alongside as a
supplement, since component libraries frequently ship English default labels
even inside an otherwise-Spanish UI.

| Category | Spanish | English |
|---|---|---|
| Deletion and removal | `eliminar`, `borrar`, `quitar`, `suprimir` | `delete`, `remove` |
| Account lifecycle | `dar de baja`, `suspender`, `desactivar`, `restablecer`, `resetear`, `vaciar`, `archivar` | `cancel`, `deactivate` |
| Financial mutation | `confirmar pago`, `pagar`, `cobrar`, `facturar`, `reembolsar` | `pay`, `refund` |
| Permission and role change | `rechazar`, `revocar`, `cambiar rol`, `cambiar permiso` | `revoke` |
| Real outbound messaging | `enviar email`, `enviar correo`, `enviar notificaci[ón]`, `enviar recordatorio` | `send email` |
| General cancellation | `cancelar`, `anular` | `cancel` |

## Worked Examples — Gated

These are elements the orchestrator must pause on before clicking, typing
into, or filling:

- A button labelled `Eliminar cliente`.
- A menu item labelled `Dar de baja`.
- A `Confirmar pago` button in a checkout flow.
- An `Enviar recordatorio por email` action that dispatches a real message.
- An icon-only button whose accessible name is empty — no readable text and
  no aria-label at all.

## Worked Counter-Examples — Not Gated

- `Guardar` on a form the developer explicitly asked to submit.
- `Buscar` and `Filtrar`.
- `Ver detalle`.
- `Exportar a Excel`.
- Pagination controls such as `Siguiente` and `Volver`.

## The `Cancelar` Ambiguity

D-06 names `cancelar` as a destructive keyword because it cancels orders,
subscriptions and appointments in the target apps. The classifier therefore
also gates a modal's dismiss button of the same name (a "Cancelar" button
that just closes a dialog without side effects). That extra pause is the
intended trade — the orchestrator should state in the chat summary that it
read the label as a dismiss action when it believes that is the case, and
still ask, rather than silencing the keyword. Never special-case `Cancelar`
to skip the pause based on context alone; the cost of one extra confirmation
on a harmless dismiss is far lower than the cost of missing a real
cancellation.

## Tie-Breaker

When an element's effect is genuinely uncertain — an ambiguous label, an icon
with no name, an unfamiliar term — **treat it as destructive and ask**. Never
guess toward "probably harmless" to avoid a pause; the cost of one extra
confirmation is far lower than the cost of an unconfirmed mutation.

## What This Rubric Does Not Decide

This rubric decides only whether to pause before an interaction — it never
decides whether an action is *permitted*. There is no absolute blacklist in
this project: every destructive-looking click, once confirmed in the moment,
is executable (D-02). An `Eliminar` button classified here as "always gated"
is still clickable the instant the developer says yes to that specific
interaction.
