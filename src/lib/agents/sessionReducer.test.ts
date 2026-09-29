import { describe, expect, it } from 'vitest';
import type { AgentEvent } from '@/lib/agents/types';
import { EMPTY_STORE, getActiveSession } from '@/lib/agents/session';
import { contentText, sessionReducer } from '@/lib/agents/sessionReducer';

function started(sessionId = 's1'): AgentEvent {
  return {
    type: 'started',
    sessionId,
    agentId: 'claude-code',
    cwd: 'C:/p',
    agentName: 'Claude',
    agentVersion: '1',
    loadSession: false,
    modes: null,
  };
}

function chunk(sessionId: string, text: string): AgentEvent {
  return {
    type: 'update',
    sessionId,
    update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } },
  };
}

describe('sessionReducer (T2.7 event folding)', () => {
  it('creates a session on started and selects it', () => {
    const next = sessionReducer(EMPTY_STORE, { type: 'event', event: started() });
    expect(next.activeSessionId).toBe('s1');
    expect(next.order).toEqual(['s1']);
    const active = getActiveSession(next);
    expect(active?.agentId).toBe('claude-code');
    expect(active?.status).toBe('active');
    expect(active?.blocks).toEqual([]);
  });

  it('ignores events for unknown sessions', () => {
    const next = sessionReducer(EMPTY_STORE, { type: 'event', event: chunk('nope', 'hi') });
    expect(next).toBe(EMPTY_STORE);
  });

  it('appends consecutive chunks to one text block and splits on role change', () => {
    let s = sessionReducer(EMPTY_STORE, { type: 'event', event: started() });
    s = sessionReducer(s, { type: 'event', event: chunk('s1', 'hel') });
    s = sessionReducer(s, { type: 'event', event: chunk('s1', 'lo') });
    s = sessionReducer(s, {
      type: 'event',
      event: {
        type: 'update',
        sessionId: 's1',
        update: { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'hmm' } },
      },
    });
    const blocks = s.sessions.s1.blocks;
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ kind: 'text', role: 'agent', text: 'hello' });
    expect(blocks[1]).toMatchObject({ kind: 'text', role: 'thought', text: 'hmm' });
  });

  it('tracks tool calls and merges updates by toolCallId', () => {
    let s = sessionReducer(EMPTY_STORE, { type: 'event', event: started() });
    s = sessionReducer(s, {
      type: 'event',
      event: {
        type: 'update',
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call',
          toolCallId: 't1',
          title: 'Read a',
          kind: 'read',
          status: 'pending',
        },
      },
    });
    s = sessionReducer(s, {
      type: 'event',
      event: {
        type: 'update',
        sessionId: 's1',
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId: 't1',
          status: 'completed',
          content: [{ type: 'diff', path: 'a.txt', newText: 'x' }],
        },
      },
    });
    const blocks = s.sessions.s1.blocks;
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: 'tool_call',
      toolCallId: 't1',
      title: 'Read a',
      tool: { kind: 'read', status: 'completed' },
    });
  });

  it('replaces the trailing plan block instead of stacking plans', () => {
    const plan = (n: number): AgentEvent => ({
      type: 'update',
      sessionId: 's1',
      update: {
        sessionUpdate: 'plan',
        entries: [{ content: `step ${n}`, priority: 'high', status: 'pending' }],
      },
    });
    let s = sessionReducer(EMPTY_STORE, { type: 'event', event: started() });
    s = sessionReducer(s, { type: 'event', event: plan(1) });
    s = sessionReducer(s, { type: 'event', event: plan(2) });
    expect(s.sessions.s1.blocks).toHaveLength(1);
    expect(s.sessions.s1.blocks[0]).toMatchObject({ kind: 'plan' });
  });

  it('records usage and mode updates', () => {
    let s = sessionReducer(EMPTY_STORE, { type: 'event', event: started() });
    s = sessionReducer(s, {
      type: 'event',
      event: {
        type: 'update',
        sessionId: 's1',
        update: { sessionUpdate: 'usage_update', used: 10, size: 100 },
      },
    });
    s = sessionReducer(s, {
      type: 'event',
      event: {
        type: 'update',
        sessionId: 's1',
        update: { sessionUpdate: 'current_mode_update', currentModeId: 'plan' },
      },
    });
    expect(s.sessions.s1.usage).toMatchObject({ used: 10, size: 100 });
    expect(s.sessions.s1.currentModeId).toBe('plan');
  });

  it('queues permission requests and clears them on resolve', () => {
    let s = sessionReducer(EMPTY_STORE, { type: 'event', event: started() });
    const req: AgentEvent = {
      type: 'permissionRequest',
      sessionId: 's1',
      requestId: 'p1',
      toolCall: { toolCallId: 't1', title: 'Bash', kind: 'execute' },
      options: [{ optionId: 'allow', name: 'Allow', kind: 'allow_once' }],
      reason: 'shell',
    };
    s = sessionReducer(s, { type: 'event', event: req });
    s = sessionReducer(s, { type: 'event', event: req });
    expect(s.sessions.s1.pendingPermissions).toHaveLength(1);
    s = sessionReducer(s, {
      type: 'event',
      event: {
        type: 'permissionResolved',
        sessionId: 's1',
        requestId: 'p1',
        toolCallId: 't1',
        outcome: 'allowed',
        decidedBy: 'user',
        reason: 'shell',
      },
    });
    expect(s.sessions.s1.pendingPermissions).toHaveLength(0);
    expect(s.sessions.s1.resolvedPermissions).toHaveLength(1);
  });

  it('marks busy/streaming between promptSent and promptDone', () => {
    let s = sessionReducer(EMPTY_STORE, { type: 'event', event: started() });
    s = sessionReducer(s, {
      type: 'event',
      event: { type: 'promptSent', sessionId: 's1', text: 'do it' },
    });
    expect(s.sessions.s1.status).toBe('busy');
    expect(s.sessions.s1.streaming).toBe(true);
    expect(s.sessions.s1.blocks.at(-1)).toMatchObject({ kind: 'text', role: 'user', text: 'do it' });
    s = sessionReducer(s, {
      type: 'event',
      event: { type: 'promptDone', sessionId: 's1', stopReason: 'end_turn' },
    });
    expect(s.sessions.s1.status).toBe('active');
    expect(s.sessions.s1.streaming).toBe(false);
    expect(s.sessions.s1.stopReason).toBe('end_turn');
  });

  it('adds a warning notice for denied fs access and keeps stderr tail', () => {
    let s = sessionReducer(EMPTY_STORE, { type: 'event', event: started() });
    s = sessionReducer(s, {
      type: 'event',
      event: { type: 'fsAccess', sessionId: 's1', op: 'read', path: 'C:/x', allowed: true, error: null },
    });
    expect(s.sessions.s1.blocks).toHaveLength(0);
    s = sessionReducer(s, {
      type: 'event',
      event: { type: 'fsAccess', sessionId: 's1', op: 'write', path: 'C:/x', allowed: false, error: 'outside' },
    });
    expect(s.sessions.s1.blocks.at(-1)).toMatchObject({ kind: 'notice', tone: 'warn' });
    s = sessionReducer(s, {
      type: 'event',
      event: { type: 'stderr', sessionId: 's1', line: 'warn!' },
    });
    expect(s.sessions.s1.logs).toEqual(['warn!']);
  });

  it('records errors and close', () => {
    let s = sessionReducer(EMPTY_STORE, { type: 'event', event: started() });
    s = sessionReducer(s, {
      type: 'event',
      event: { type: 'error', sessionId: 's1', message: 'boom' },
    });
    expect(s.sessions.s1.error).toBe('boom');
    s = sessionReducer(s, {
      type: 'event',
      event: { type: 'closed', sessionId: 's1', reason: 'user' },
    });
    expect(s.sessions.s1.status).toBe('closed');
    expect(s.sessions.s1.streaming).toBe(false);
  });

  it('drops unknown ACP update kinds without losing state', () => {
    let s = sessionReducer(EMPTY_STORE, { type: 'event', event: started() });
    s = sessionReducer(s, { type: 'event', event: chunk('s1', 'hi') });
    const before = s.sessions.s1;
    s = sessionReducer(s, {
      type: 'event',
      event: {
        type: 'update',
        sessionId: 's1',
        update: { sessionUpdate: 'future_kind', content: {} },
      },
    });
    expect(s.sessions.s1.blocks).toBe(before.blocks);
  });

  it('selects and removes sessions', () => {
    let s = sessionReducer(EMPTY_STORE, { type: 'event', event: started('s1') });
    s = sessionReducer(s, { type: 'event', event: started('s2') });
    expect(s.activeSessionId).toBe('s2');
    s = sessionReducer(s, { type: 'select', sessionId: 's1' });
    expect(s.activeSessionId).toBe('s1');
    s = sessionReducer(s, { type: 'select', sessionId: 'nope' });
    expect(s.activeSessionId).toBe('s1');
    s = sessionReducer(s, { type: 'remove', sessionId: 's1' });
    expect(s.activeSessionId).toBe('s2');
    expect(s.order).toEqual(['s2']);
  });

  it('extracts text from content blocks', () => {
    expect(contentText({ type: 'text', text: 'a' })).toBe('a');
    expect(contentText({ type: 'image', data: 'x', mimeType: 'image/png' })).toBe('');
  });
});
