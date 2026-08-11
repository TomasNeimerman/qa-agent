// scripts/confirm-destructive.mjs
// PreToolUse hook backstop for the destructive-action confirmation gate.
//
// scripts/api-client.mjs's own exit-3 gate (scripts/destructive.mjs) is the
// PRIMARY block SAFE-01 rests on — it is what actually refuses to dispatch an
// unconfirmed destructive call, and it cannot be bypassed by anything short of
// editing the script. This hook is the SECONDARY, hardening layer: it matches
// any Bash invocation of api-client.mjs for a destructive method — including
// one that already carries --confirmed — and escalates it to Claude Code's own
// permission dialog, which per the hooks documentation is a separate
// enforcement path from the tool's own logic and survives
// `--dangerously-skip-permissions`.
//
// Deliberately ignore --confirmed when deciding: this hook's entire value is
// that it fires anyway, regardless of what the caller already claims.
//
// Failing open here (any parse error -> exit 0, print nothing) is safe
// because the script-level gate is the primary block, not this hook — a
// malformed PreToolUse payload must never wedge every Bash call the agent
// makes.

import { pathToFileURL } from 'node:url';
import { requiresConfirmation } from './destructive.mjs';

const METHOD_RE = /--method[=\s]+"?([A-Za-z]+)"?/;
const URL_RE = /--url[=\s]+"?(\S+?)"?(?:\s|$)/;
const READ_ONLY_INTENT_RE = /--read-only-intent\b/;

/**
 * Returns undefined when `command` does not need to pause, or a PreToolUse
 * `hookSpecificOutput` decision object (permissionDecision: "ask") when it
 * does. Returns undefined for any command that doesn't invoke
 * `api-client.mjs` at all.
 */
export function decideForCommand(command) {
  if (typeof command !== 'string' || !command.includes('api-client.mjs')) {
    return undefined;
  }

  const methodMatch = command.match(METHOD_RE);
  const urlMatch = command.match(URL_RE);
  const method = methodMatch ? methodMatch[1] : 'GET';
  const url = urlMatch ? urlMatch[1] : '(unknown url)';
  const looksReadOnly = READ_ONLY_INTENT_RE.test(command);

  if (!requiresConfirmation(method, { looksReadOnly })) {
    return undefined;
  }

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: `Destructive API call — ${method.toUpperCase()} ${url} requires explicit confirmation before it can run.`,
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
    // Fail open: malformed input must never wedge every Bash call.
    process.exit(0);
    return;
  }

  const command = payload?.tool_input?.command;
  const decision = decideForCommand(command);

  if (decision) {
    process.stdout.write(`${JSON.stringify(decision)}\n`);
  }

  process.exit(0);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main();
}
