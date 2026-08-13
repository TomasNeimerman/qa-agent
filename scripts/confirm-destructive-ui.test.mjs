// scripts/confirm-destructive-ui.test.mjs
// Unit coverage for the UI PreToolUse hook backstop: decideForUiToolCall()
// (the pure decision function) and the stdin/stdout hook protocol wired
// around it. Mirrors confirm-destructive.test.mjs's two-describe structure.

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { UI_GATED_TOOLS, decideForUiToolCall } from './confirm-destructive-ui.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const HOOK_SCRIPT = resolve(__dirname, 'confirm-destructive-ui.mjs');

describe('decideForUiToolCall', () => {
  it('asks for a browser_click on a destructive element, naming the element and the tool', () => {
    const decision = decideForUiToolCall('mcp__playwright__browser_click', {
      element: 'Eliminar cliente button',
      ref: 'e12',
    });

    expect(decision).toBeDefined();
    expect(decision.hookSpecificOutput.permissionDecision).toBe('ask');
    expect(decision.hookSpecificOutput.permissionDecisionReason).toContain('Eliminar cliente button');
    expect(decision.hookSpecificOutput.permissionDecisionReason).toContain('mcp__playwright__browser_click');
  });

  it('stays out of the way for a browser_click on a benign element', () => {
    const decision = decideForUiToolCall('mcp__playwright__browser_click', {
      element: 'Guardar button',
      ref: 'e9',
    });

    expect(decision).toBeUndefined();
  });

  it('asks for a browser_click with an empty or missing element — unnamed is gated', () => {
    expect(decideForUiToolCall('mcp__playwright__browser_click', { element: '', ref: 'e1' })).toBeDefined();
    expect(decideForUiToolCall('mcp__playwright__browser_click', { ref: 'e1' })).toBeDefined();
  });

  it('stays out of the way for browser_fill_form when no field label is destructive', () => {
    const decision = decideForUiToolCall('mcp__playwright__browser_fill_form', {
      fields: [{ name: 'Contraseña', value: 's3cr3t-value' }],
    });

    expect(decision).toBeUndefined();
  });

  it('asks for browser_fill_form when a field label is destructive', () => {
    const decision = decideForUiToolCall('mcp__playwright__browser_fill_form', {
      fields: [{ name: 'Confirmar pago', value: '1000' }],
    });

    expect(decision).toBeDefined();
    expect(decision.hookSpecificOutput.permissionDecision).toBe('ask');
  });

  it('never leaks a field value into the decision reason for any browser_fill_form input', () => {
    const decision = decideForUiToolCall('mcp__playwright__browser_fill_form', {
      fields: [
        { name: 'Contraseña', value: 's3cr3t-value' },
        { name: 'Confirmar pago', value: 's3cr3t-value' },
      ],
    });

    expect(decision).toBeDefined();
    expect(JSON.stringify(decision)).not.toContain('s3cr3t-value');
  });

  it('asks for a browser_type on a destructive element regardless of the typed text', () => {
    const decision = decideForUiToolCall('mcp__playwright__browser_type', {
      element: 'Eliminar',
      text: 'x',
      submit: true,
    });

    expect(decision).toBeDefined();
    expect(decision.hookSpecificOutput.permissionDecision).toBe('ask');
  });

  it('never gates read-only or navigation tools', () => {
    expect(decideForUiToolCall('mcp__playwright__browser_navigate', { url: 'http://x.test' })).toBeUndefined();
    expect(decideForUiToolCall('mcp__playwright__browser_snapshot', {})).toBeUndefined();
    expect(decideForUiToolCall('mcp__playwright__browser_take_screenshot', {})).toBeUndefined();
  });

  it('never matches the Bash tool or an unrelated MCP server, so it never competes with confirm-destructive.mjs', () => {
    expect(decideForUiToolCall('Bash', { command: 'node scripts/api-client.mjs --method DELETE --url /api/x' })).toBeUndefined();
    expect(decideForUiToolCall('mcp__other-server__some_tool', { element: 'Eliminar' })).toBeUndefined();
  });

  it('exports UI_GATED_TOOLS naming exactly the three interaction tools', () => {
    expect(UI_GATED_TOOLS).toEqual([
      'mcp__playwright__browser_click',
      'mcp__playwright__browser_fill_form',
      'mcp__playwright__browser_type',
    ]);
  });
});

describe('confirm-destructive-ui.mjs stdin/stdout hook protocol', () => {
  it('produces exactly one JSON object on stdout with permissionDecision ask, exit 0', () => {
    const payload = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'mcp__playwright__browser_click',
      tool_input: { element: 'Eliminar cliente button', ref: 'e12' },
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

  it('writes nothing for a benign element payload', () => {
    const payload = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'mcp__playwright__browser_click',
      tool_input: { element: 'Guardar button', ref: 'e9' },
    });

    const result = spawnSync(process.execPath, [HOOK_SCRIPT], {
      input: payload,
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  it('fails open on non-JSON stdin: exits 0 and emits nothing', () => {
    const result = spawnSync(process.execPath, [HOOK_SCRIPT], {
      input: 'not json at all {{{',
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
