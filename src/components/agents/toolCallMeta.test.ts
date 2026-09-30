import { describe, expect, it } from 'vitest';
import {
  extractCommand,
  primaryLocation,
  toolKindKey,
  toolStatusKey,
} from '@/components/agents/toolCallMeta';

describe('toolCallMeta', () => {
  it('maps kinds and statuses to agentPanel keys', () => {
    expect(toolKindKey('execute')).toBe('agentPanel.tool.kind.execute');
    expect(toolKindKey(undefined)).toBe('agentPanel.tool.kind.other');
    expect(toolStatusKey('in_progress')).toBe('agentPanel.tool.status.in_progress');
    expect(toolStatusKey(undefined)).toBe('agentPanel.tool.status.pending');
  });

  it('extracts shell commands from string and object inputs (S3 shell scenario)', () => {
    expect(extractCommand('  npm test  ')).toBe('npm test');
    expect(extractCommand({ command: 'git status', timeout: 30 })).toBe('git status');
    expect(extractCommand({ cmd: 'echo hi' })).toBe('echo hi');
    expect(extractCommand('')).toBeNull();
    expect(extractCommand(null)).toBeNull();
    expect(extractCommand(42)).toBeNull();
  });

  it('falls back to the single string value or JSON', () => {
    expect(extractCommand({ prompt: 'only' })).toBe('only');
    expect(extractCommand({ a: 'x', b: 'y' })).toBe('{"a":"x","b":"y"}');
    expect(extractCommand({})).toBeNull();
  });

  it('truncates very long commands', () => {
    const cmd = extractCommand('x'.repeat(5000));
    expect(cmd?.length).toBeLessThanOrEqual(2001);
  });

  it('prefers locations over diff paths', () => {
    expect(primaryLocation({ locations: [{ path: 'a.txt', line: 3 }] })).toBe('a.txt');
    expect(
      primaryLocation({ content: [{ type: 'diff', path: 'b.txt', newText: 'x' }] }),
    ).toBe('b.txt');
    expect(primaryLocation({})).toBeNull();
  });
});
