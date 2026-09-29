import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { EMPTY_STORE } from '@/lib/agents/session';
import { SessionProvider } from '@/lib/agents/SessionContext';
import { sessionReducer } from '@/lib/agents/sessionReducer';
import { useAgentSession } from '@/lib/agents/sessionContextValue';
import type { AgentEvent } from '@/lib/agents/types';
import { AgentPanel } from '@/components/agents/AgentPanel';

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({
  Channel: class {
    onmessage: (m: unknown) => void = () => {};
  },
  invoke: tauri.invoke,
}));

const workspace = vi.hoisted(() => ({
  current: { workspaceRoot: 'C:/p' as string | null, isTrusted: true },
}));
vi.mock('@/lib/context/WorkspaceContext', () => ({
  useSafeWorkspace: () => workspace.current,
}));

const holder: { api: ReturnType<typeof useAgentSession> | null } = { api: null };
function Probe() {
  const ctx = useAgentSession();
  useEffect(() => {
    holder.api = ctx;
  });
  return null;
}
const getApi = () => holder.api as ReturnType<typeof useAgentSession>;

const EVENTS: AgentEvent[] = [
  {
    type: 'started',
    sessionId: 's1',
    agentId: 'claude-code',
    cwd: 'C:/p',
    agentName: 'Claude',
    agentVersion: '1',
    loadSession: false,
    modes: null,
  },
  {
    type: 'update',
    sessionId: 's1',
    update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'hello' } },
  },
  {
    type: 'update',
    sessionId: 's1',
    update: { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'hmm' } },
  },
  {
    type: 'update',
    sessionId: 's1',
    update: {
      sessionUpdate: 'tool_call',
      toolCallId: 't1',
      title: 'Edit a.txt',
      kind: 'edit',
      status: 'completed',
      content: [{ type: 'diff', path: 'a.txt', oldText: 'one', newText: 'two' }],
    },
  },
  {
    type: 'update',
    sessionId: 's1',
    update: {
      sessionUpdate: 'plan',
      entries: [{ content: 'step one', priority: 'high', status: 'pending' }],
    },
  },
  {
    type: 'update',
    sessionId: 's1',
    update: { sessionUpdate: 'usage_update', used: 10, size: 100 },
  },
];

const store = EVENTS.reduce(
  (state, event) => sessionReducer(state, { type: 'event', event }),
  EMPTY_STORE,
);

function renderPanel() {
  return renderWithProviders(
    <SessionProvider initialStore={store}>
      <Probe />
      <AgentPanel />
    </SessionProvider>,
  );
}

beforeEach(() => {
  tauri.invoke.mockReset();
  workspace.current = { workspaceRoot: 'C:/p', isTrusted: true };
});

describe('AgentPanel (T2.8)', () => {
  it('renders the folded transcript: messages, thought, tool card with diff, plan, usage', () => {
    renderPanel();
    const panel = screen.getByTestId('agent-panel');
    expect(panel.textContent).toContain('hello');
    expect(panel.textContent).toContain('hmm');
    expect(screen.getByTestId('tool-call-card').textContent).toContain('Edit a.txt');
    expect(screen.getByTestId('diff-view').textContent).toContain('two');
    expect(panel.textContent).toContain('step one');
    expect(panel.textContent).toContain('10');
  });

  it('sends a prompt, shows busy state, and stops on request', async () => {
    tauri.invoke.mockResolvedValue('end_turn');
    renderPanel();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'do it' } });
    fireEvent.submit(screen.getByTestId('agent-prompt-form'));
    await act(async () => {});
    expect(tauri.invoke).toHaveBeenCalledWith('send_agent_prompt', {
      sessionId: 's1',
      text: 'do it',
    });

    act(() => {
      getApi().onEvent({ type: 'promptSent', sessionId: 's1', text: 'do it' });
    });
    expect(screen.getByTestId('agent-session-status')).toBeTruthy();
    fireEvent.click(screen.getByTestId('agent-stop'));
    await act(async () => {});
    expect(tauri.invoke).toHaveBeenCalledWith('cancel_agent_prompt', { sessionId: 's1' });

    act(() => {
      getApi().onEvent({ type: 'promptDone', sessionId: 's1', stopReason: 'end_turn' });
    });
    expect(screen.queryByTestId('agent-stop')).toBeNull();
  });

  it('asks for trust before starting when the folder is untrusted', () => {
    workspace.current = { workspaceRoot: 'C:/p', isTrusted: false };
    renderPanel();
    expect(screen.getByTestId('agent-panel').textContent).toBeTruthy();
    expect(tauri.invoke).not.toHaveBeenCalled();
  });
});
