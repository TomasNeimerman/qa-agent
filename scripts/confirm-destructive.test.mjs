// scripts/confirm-destructive.test.mjs
// Unit coverage for the PreToolUse hook backstop: decideForCommand() (the pure
// decision function) and the stdin/stdout hook protocol wired around it.

import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decideForCommand } from './confirm-destructive.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const HOOK_SCRIPT = resolve(__dirname, 'confirm-destructive.mjs');

describe('decideForCommand', () => {
  it('asks for a DELETE api-client command, naming the method and URL', () => {
    const decision = decideForCommand(
      'node scripts/api-client.mjs --method DELETE --url /api/clients/42'
    );
    expect(decision).toBeDefined();
    expect(decision.hookSpecificOutput.permissionDecision).toBe('ask');
    expect(decision.hookSpecificOutput.permissionDecisionReason).toContain('DELETE');
    expect(decision.hookSpecificOutput.permissionDecisionReason).toContain('/api/clients/42');
  });

  it('still asks when --confirmed is already present — that is precisely the hook\'s job', () => {
    const decision = decideForCommand(
      'node scripts/api-client.mjs --method DELETE --url /api/clients/42 --confirmed'
    );
    expect(decision).toBeDefined();
    expect(decision.hookSpecificOutput.permissionDecision).toBe('ask');
  });

  it('stays out of the way for a POST carrying --read-only-intent', () => {
    const decision = decideForCommand(
      'node scripts/api-client.mjs --method POST --url /api/search --read-only-intent'
    );
    expect(decision).toBeUndefined();
  });

  it('stays out of the way for a plain GET', () => {
    const decision = decideForCommand('node scripts/api-client.mjs --method GET --url /api/clients');
    expect(decision).toBeUndefined();
  });

  it('does not match format-report.mjs commands', () => {
    const decision = decideForCommand('node scripts/format-report.mjs --results r.json');
    expect(decision).toBeUndefined();
  });

  it('does not match unrelated commands', () => {
    const decision = decideForCommand('ls -la');
    expect(decision).toBeUndefined();
  });
});

describe('confirm-destructive.mjs stdin/stdout hook protocol', () => {
  it('produces exactly one JSON object on stdout with permissionDecision ask, exit 0', () => {
    const payload = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: {
        command: 'node scripts/api-client.mjs --method DELETE --url /api/clients/42',
      },
    });

    const result = spawnSync(process.execPath, [HOOK_SCRIPT], {
      input: payload,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split('\n').filter(Boolean);
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe('ask');
  });

  it('fails open on non-JSON stdin: exits 0 and emits nothing', () => {
    const result = spawnSync(process.execPath, [HOOK_SCRIPT], {
      input: 'not json at all {{{',
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('emits nothing on stdout for a non-destructive command payload', () => {
    const payload = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: {
        command: 'node scripts/api-client.mjs --method GET --url /api/clients',
      },
    });

    const result = spawnSync(process.execPath, [HOOK_SCRIPT], {
      input: payload,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
