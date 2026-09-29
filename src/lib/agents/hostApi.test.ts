import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock of the Tauri core module: a Channel that lets the test push events, and a recording invoke.
const state = vi.hoisted(() => ({
  channels: [] as { onmessage: (m: unknown) => void }[],
  invoke: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({
  Channel: class {
    onmessage: (m: unknown) => void = () => {};
    constructor() {
      state.channels.push(this);
    }
  },
  invoke: state.invoke,
}));

import {
  buildStartParams,
  cancelAgentPrompt,
  closeAgentSession,
  installClaudeAdapter,
  respondAgentPermission,
  sendAgentPrompt,
  startAgentSession,
} from '@/lib/agents/hostApi';
import { BUILTIN_AGENTS } from '@/lib/agents/registry';
import {
  agentErrorKey,
  parseAgentError,
  parseAgentEvent,
  type AgentErrorCode,
  type AgentEvent,
} from '@/lib/agents/types';
import { getDictionary } from '@/lib/i18n';

const claude = BUILTIN_AGENTS.find((a) => a.id === 'claude-code')!;
const agy = BUILTIN_AGENTS.find((a) => a.id === 'agy')!;

beforeEach(() => {
  state.channels.length = 0;
  state.invoke.mockReset();
});

describe('startAgentSession (mock subscription)', () => {
  it('passes registry data to the host and streams typed events to the subscriber', async () => {
    state.invoke.mockResolvedValue('sess-1');
    const seen: AgentEvent[] = [];
    const id = await startAgentSession(claude, { projectDir: 'C:/p', isTrusted: true }, (e) =>
      seen.push(e),
    );
    expect(id).toBe('sess-1');
    const [cmd, args] = state.invoke.mock.calls[0];
    expect(cmd).toBe('start_agent_session');
    expect(args.params).toMatchObject({
      agentId: 'claude-code',
      projectDir: 'C:/p',
      trusted: true,
      useGlobalSettings: false,
      launch: { command: 'node' },
    });
    expect(args.onEvent).toBe(state.channels[0]);

    const ch = state.channels[0];
    ch.onmessage({
      type: 'started',
      sessionId: 'sess-1',
      agentId: 'claude-code',
      cwd: 'C:/p',
      agentName: 'a',
      agentVersion: '1',
      loadSession: true,
      modes: null,
    });
    ch.onmessage({
      type: 'update',
      sessionId: 'sess-1',
      update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hi' } },
    });
    ch.onmessage({
      type: 'permissionRequest',
      sessionId: 'sess-1',
      requestId: 'perm-1',
      toolCall: { toolCallId: 't' },
      options: [{ optionId: 'allow', name: 'Allow', kind: 'allow_once' }],
      reason: 'shell',
    });
    ch.onmessage({ type: 'promptDone', sessionId: 'sess-1', stopReason: 'end_turn' });
    expect(seen.map((e) => e.type)).toEqual(['started', 'update', 'permissionRequest', 'promptDone']);
  });

  it('drops payloads that are not known events', async () => {
    state.invoke.mockResolvedValue('s');
    const seen: AgentEvent[] = [];
    await startAgentSession(claude, { projectDir: 'C:/p', isTrusted: true }, (e) => seen.push(e));
    const ch = state.channels[0];
    ch.onmessage(null);
    ch.onmessage('text');
    ch.onmessage({ type: 'nope', sessionId: 's' });
    ch.onmessage({ type: 'update', sessionId: 's', update: {} });
    ch.onmessage({ type: 'permissionRequest', sessionId: 's' });
    expect(seen).toEqual([]);
  });

  it('refuses untrusted or missing folders before calling the backend', async () => {
    await expect(
      startAgentSession(claude, { projectDir: 'C:/p', isTrusted: false }, () => {}),
    ).rejects.toThrow('untrusted');
    await expect(
      startAgentSession(claude, { projectDir: null, isTrusted: true }, () => {}),
    ).rejects.toThrow('no-project');
    expect(state.invoke).not.toHaveBeenCalled();
  });

  it('does not start terminal-mode agents over ACP', () => {
    expect(() => buildStartParams(agy, { projectDir: 'C:/p', isTrusted: true })).toThrow();
  });

  it('forwards the D-018 toggle and MCP servers', () => {
    const p = buildStartParams(claude, {
      projectDir: 'C:/p',
      isTrusted: true,
      useGlobalSettings: true,
      mcpServers: [{ name: 'vanilla', url: 'http://127.0.0.1:1/mcp', bearerToken: 't' }],
    });
    expect(p.useGlobalSettings).toBe(true);
    expect(p.mcpServers).toHaveLength(1);
    expect(p.sessionOptions).toEqual(claude.sessionOptions);
  });
});

describe('session commands', () => {
  it('maps to the Rust command names and argument names', async () => {
    state.invoke.mockResolvedValue('end_turn');
    await sendAgentPrompt('s', 'do it');
    await cancelAgentPrompt('s');
    await respondAgentPermission('s', 'perm-1', 'allow');
    await respondAgentPermission('s', 'perm-2', null);
    await closeAgentSession('s');
    expect(state.invoke.mock.calls).toEqual([
      ['send_agent_prompt', { sessionId: 's', text: 'do it' }],
      ['cancel_agent_prompt', { sessionId: 's' }],
      ['respond_agent_permission', { sessionId: 's', requestId: 'perm-1', optionId: 'allow' }],
      ['respond_agent_permission', { sessionId: 's', requestId: 'perm-2', optionId: null }],
      ['close_agent_session', { sessionId: 's' }],
    ]);
  });

  it('streams adapter install events', async () => {
    state.invoke.mockResolvedValue({ installed: true, version: '0.83.0', pinned: true, entry: 'x' });
    const logs: string[] = [];
    const status = await installClaudeAdapter((e) => {
      if (e.kind === 'log') logs.push(e.line);
    });
    state.channels[0].onmessage({ kind: 'log', stream: 'stdout', line: 'added 106 packages' });
    expect(status.pinned).toBe(true);
    expect(logs).toEqual(['added 106 packages']);
  });
});

describe('event and error helpers', () => {
  it('accepts every documented event type', () => {
    for (const type of [
      'started',
      'update',
      'permissionRequest',
      'permissionResolved',
      'promptSent',
      'promptDone',
      'fsAccess',
      'stderr',
      'error',
      'closed',
    ]) {
      const e = { type, sessionId: 's', update: { sessionUpdate: 'plan' }, requestId: 'r', options: [] };
      expect(parseAgentEvent(e)).not.toBeNull();
    }
  });

  it('parses host error codes and has a message for each', () => {
    expect(parseAgentError('adapter-not-found:C:\\x\\a.js')).toEqual({
      code: 'adapter-not-found',
      detail: 'C:\\x\\a.js',
    });
    expect(parseAgentError('not-trusted')).toEqual({ code: 'not-trusted', detail: '' });
    expect(parseAgentError(new Error('boom')).code).toBe('unknown');
    const ko = getDictionary('ko') as Record<string, string>;
    const en = getDictionary('en') as Record<string, string>;
    const codes: (AgentErrorCode | 'unknown')[] = [
      'not-trusted',
      'outside-workspace',
      'invalid-spec',
      'adapter-not-found',
      'spawn',
      'initialize',
      'session',
      'busy',
      'no-session',
      'closed',
      'protocol',
      'too-many-sessions',
      'empty-prompt',
      'prompt-too-large',
      'unknown',
    ];
    for (const code of codes) {
      expect(ko[agentErrorKey(code)], code).toBeTruthy();
      expect(en[agentErrorKey(code)], code).toBeTruthy();
    }
  });
});
