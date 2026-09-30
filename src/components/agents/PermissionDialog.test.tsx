import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { EMPTY_STORE, firstPending, type AgentStoreState } from '@/lib/agents/session';
import { SessionProvider } from '@/lib/agents/SessionContext';
import { sessionReducer } from '@/lib/agents/sessionReducer';
import type { AgentEvent } from '@/lib/agents/types';
import {
  PermissionDialog,
  PermissionDialogView,
} from '@/components/agents/PermissionDialog';

const tauri = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({
  Channel: class {
    onmessage: (m: unknown) => void = () => {};
  },
  invoke: tauri.invoke,
}));

const SHELL_REQUEST: AgentEvent = {
  type: 'permissionRequest',
  sessionId: 's1',
  requestId: 'p1',
  toolCall: {
    toolCallId: 't1',
    title: 'Bash',
    name: 'Bash',
    kind: 'execute',
    rawInput: { command: 'git status --porcelain', timeout: 30 },
    locations: [{ path: 'C:/p' }],
  },
  options: [
    { optionId: 'allow', name: 'Allow', kind: 'allow_once' },
    { optionId: 'deny', name: 'Deny', kind: 'reject_once' },
  ],
  reason: 'shell',
};

const STARTED: AgentEvent = {
  type: 'started',
  sessionId: 's1',
  agentId: 'claude-code',
  cwd: 'C:/p',
  agentName: 'Claude',
  agentVersion: '1',
  loadSession: false,
  modes: null,
};

function fold(events: AgentEvent[]): AgentStoreState {
  return events.reduce(
    (state, event) => sessionReducer(state, { type: 'event', event }),
    EMPTY_STORE,
  );
}

beforeEach(() => {
  tauri.invoke.mockReset().mockResolvedValue(undefined);
});

describe('PermissionDialog (T2.9, S3 shell scenario)', () => {
  it('shows the full shell command, path and reason', () => {
    renderWithProviders(
      <SessionProvider initialStore={fold([STARTED, SHELL_REQUEST])}>
        <PermissionDialog />
      </SessionProvider>,
    );
    expect(screen.getByTestId('permission-command').textContent).toBe(
      'git status --porcelain',
    );
    const dialog = screen.getByTestId('permission-dialog');
    expect(dialog.textContent).toContain('C:/p');
    expect(dialog.textContent).toContain('shell');
  });

  it('answers allow-once and deny through the host', async () => {
    const { rerender } = renderWithProviders(
      <SessionProvider initialStore={fold([STARTED, SHELL_REQUEST])}>
        <PermissionDialog />
      </SessionProvider>,
    );
    fireEvent.click(screen.getByTestId('permission-allow'));
    await act(async () => {});
    expect(tauri.invoke).toHaveBeenCalledWith('respond_agent_permission', {
      sessionId: 's1',
      requestId: 'p1',
      optionId: 'allow',
    });
    tauri.invoke.mockClear();

    rerender(
      <SessionProvider initialStore={fold([STARTED, SHELL_REQUEST])}>
        <PermissionDialog />
      </SessionProvider>,
    );
    fireEvent.click(screen.getByTestId('permission-deny'));
    await act(async () => {});
    expect(tauri.invoke).toHaveBeenCalledWith('respond_agent_permission', {
      sessionId: 's1',
      requestId: 'p1',
      optionId: 'deny',
    });
    tauri.invoke.mockClear();

    rerender(
      <SessionProvider initialStore={fold([STARTED, SHELL_REQUEST])}>
        <PermissionDialog />
      </SessionProvider>,
    );
    fireEvent.click(screen.getByTestId('permission-dismiss'));
    await act(async () => {});
    expect(tauri.invoke).toHaveBeenCalledWith('respond_agent_permission', {
      sessionId: 's1',
      requestId: 'p1',
      optionId: null,
    });
  });

  it('never offers allow_always even when the backend sends it', () => {
    const store = fold([STARTED, SHELL_REQUEST]);
    const pending = firstPending(store);
    expect(pending).not.toBeNull();
    // Off-contract payload: the host must never offer allow_always (D-010).
    const hostile = {
      optionId: 'always',
      name: 'Always allow',
      kind: 'allow_always' as unknown as 'allow_once',
    };
    renderWithProviders(
      <PermissionDialogView
        sessionId="s1"
        request={{ ...pending!.request, options: [...pending!.request.options, hostile] }}
        busy={false}
        onAllow={() => {}}
        onDeny={() => {}}
        onDismiss={() => {}}
      />,
    );
    const dialog = screen.getByTestId('permission-dialog');
    expect(dialog.textContent).not.toContain('Always allow');
    expect(screen.getByTestId('permission-allow')).toBeTruthy();
    expect(screen.getByTestId('permission-deny')).toBeTruthy();
  });

  it('renders nothing without a pending request and prefers the active session', () => {
    const { container } = renderWithProviders(
      <SessionProvider initialStore={fold([STARTED])}>
        <PermissionDialog />
      </SessionProvider>,
    );
    expect(container.textContent).toBe('');

    const two = fold([
      STARTED,
      { ...STARTED, sessionId: 's2' },
      SHELL_REQUEST,
      { ...SHELL_REQUEST, sessionId: 's2', requestId: 'p2' },
    ]);
    // s2 started last so it is active; its request wins.
    expect(firstPending(two)?.sessionId).toBe('s2');
    const one = fold([STARTED, SHELL_REQUEST]);
    expect(firstPending(one)?.request.requestId).toBe('p1');
  });
});
