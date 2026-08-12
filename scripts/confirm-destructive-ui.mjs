// scripts/confirm-destructive-ui.mjs
// PreToolUse hook backstop for the UI destructive-action confirmation gate,
// retargeted from Phase 1's Bash-command-string parsing to Playwright MCP's
// tool-name and structured-argument shape.
//
// The orchestrator's own prompted classification (SKILL.md's
// "## UI confirmation protocol", using references/ui-destructive-classification.md)
// is the PRIMARY block — it is what actually decides whether to pause before
// issuing an interaction tool call. This hook is the SECONDARY, hardening
// layer: it matches any Playwright MCP click/type/fill-form call aimed at a
// destructive-looking element and escalates it to Claude Code's own
// permission dialog, independent of whatever the orchestrator believes it
// already asked.
//
// Unlike Phase 1's confirm-destructive.mjs, this hook receives structured
// MCP tool arguments (tool_input is the actual call arguments object, e.g.
// `{ element: "Eliminar cliente button", ref: "e12" }`), not a Bash command
// string — so it reads fields off tool_input directly instead of running a
// regex over a command line.
//
// Deliberately makes no attempt to detect whether the orchestrator already
// asked. The hook's entire value is that it fires anyway.
//
// Failing open here (any parse error -> exit 0, print nothing) is safe for
// the same reason Phase 1's confirm-destructive.mjs fails open: the
// orchestrator-level pause is the primary block, not this hook — a malformed
// PreToolUse payload must never wedge every MCP tool call the agent makes.

import { pathToFileURL } from 'node:url';
import { requiresConfirmationForElement } from './ui-destructive.mjs';

// The server-key half of these names ("playwright") must match the key
// chosen in .mcp.json by plan 02-03. If that plan registers the server
// under a different key, these strings change with it.
export const UI_GATED_TOOLS = [
  'mcp__playwright__browser_click',
  'mcp__playwright__browser_fill_form',
  'mcp__playwright__browser_type',
];

/**
 * Returns undefined when `toolName`/`toolInput` does not need to pause, or a
 * PreToolUse `hookSpecificOutput` decision object (permissionDecision: "ask")
 * when it does.
 *
 * - Returns undefined immediately for any tool not in UI_GATED_TOOLS —
 *   including read-only/navigation tools and unrelated MCP servers, so this
 *   hook never competes with Phase 1's confirm-destructive.mjs.
 * - For a click or a type, classifies on `toolInput.element` alone.
 * - For a fill-form, classifies on the concatenation of each field's `name`
 *   and `element` material only — never `field.value`, `toolInput.text`, or
 *   any other argument carrying content being typed, since a fill-form call
 *   during a re-authentication prompt could legitimately carry a password
 *   and this hook's output goes straight into a permission dialog and the
 *   transcript.
 */
export function decideForUiToolCall(toolName, toolInput) {
  if (!UI_GATED_TOOLS.includes(toolName)) {
    return undefined;
  }

  const input = toolInput ?? {};
  let labelMaterial;
  let describedElement;

  if (toolName === 'mcp__playwright__browser_fill_form') {
    const fields = Array.isArray(input.fields) ? input.fields : [];
    labelMaterial = fields
      .map((field) => `${field?.name ?? ''} ${field?.element ?? ''}`)
      .join(' ');
    describedElement = fields.map((field) => field?.name ?? field?.element ?? '(unnamed field)').join(', ');
  } else {
    labelMaterial = input.element;
    describedElement = input.element || '(no accessible name)';
  }

  if (!requiresConfirmationForElement(labelMaterial)) {
    return undefined;
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `Destructive-looking browser action — ${toolName} targeting "${describedElement}" requires explicit confirmation before it can run.`,
    },
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const raw = await readStdin();

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // Fail open: malformed input must never wedge every MCP tool call.
    process.exit(0);
    return;
  }

  const toolName = payload?.tool_name;
  const toolInput = payload?.tool_input;
  const decision = decideForUiToolCall(toolName, toolInput);

  if (decision) {
    process.stdout.write(`${JSON.stringify(decision)}\n`);
  }

  process.exit(0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
