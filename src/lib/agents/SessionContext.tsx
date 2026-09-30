import {
  useCallback,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { BUILTIN_AGENTS, type AgentEntry } from '@/lib/agents/registry';
import {
  cancelAgentPrompt,
  closeAgentSession,
  respondAgentPermission,
  sendAgentPrompt,
  startAgentSession,
} from '@/lib/agents/hostApi';
import {
  EMPTY_STORE,
  defaultAgent,
  getActiveSession,
  type AgentStoreState,
} from '@/lib/agents/session';
import { sessionReducer } from '@/lib/agents/sessionReducer';
import type { AgentEvent, StopReason } from '@/lib/agents/types';
import { SessionContext, type SessionContextValue } from '@/lib/agents/sessionContextValue';

export function SessionProvider({
  children,
  initialStore,
  initialAgents,
}: {
  children: ReactNode;
  /** Test hook: preload folded sessions without a backend. */
  initialStore?: AgentStoreState;
  initialAgents?: AgentEntry[];
}) {
  const [store, dispatch] = useReducer(
    sessionReducer,
    initialStore ?? EMPTY_STORE,
  );
  const [agents, setAgents] = useState<AgentEntry[]>(() => [
    ...(initialAgents ?? BUILTIN_AGENTS),
  ]);
  const [lastError, setLastError] = useState<string | null>(null);
  const workspace = useSafeWorkspace();

  const onEvent = useCallback((event: AgentEvent) => {
    dispatch({ type: 'event', event });
  }, []);

  const resolveTarget = useCallback(
    (sessionId: string | undefined): string => {
      if (sessionId) return sessionId;
      const active = store.activeSessionId;
      if (!active) throw new Error('no-session');
      return active;
    },
    [store.activeSessionId],
  );

  const startSession = useCallback(
    async (agentId?: string, opts?: { useGlobalSettings?: boolean }): Promise<string> => {
      const entry = agentId
        ? agents.find((a) => a.id === agentId)
        : defaultAgent(agents);
      if (!entry) throw new Error('no-agent');
      if (entry.mode !== 'acp') {
        const reason = 'terminal-mode';
        setLastError(reason);
        throw new Error(reason);
      }
      setLastError(null);
      try {
        return await startAgentSession(
          entry,
          {
            projectDir: workspace?.workspaceRoot ?? null,
            isTrusted: workspace?.isTrusted ?? false,
            useGlobalSettings: opts?.useGlobalSettings ?? false,
          },
          onEvent,
        );
      } catch (err) {
        setLastError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [agents, workspace, onEvent],
  );

  const sendPrompt = useCallback(
    async (text: string, sessionId?: string): Promise<StopReason> => {
      const target = resolveTarget(sessionId);
      setLastError(null);
      try {
        return await sendAgentPrompt(target, text);
      } catch (err) {
        setLastError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [resolveTarget],
  );

  const cancel = useCallback(
    async (sessionId?: string): Promise<void> => {
      await cancelAgentPrompt(resolveTarget(sessionId));
    },
    [resolveTarget],
  );

  const respondPermission = useCallback(
    async (sessionId: string, requestId: string, optionId: string | null): Promise<void> => {
      setLastError(null);
      try {
        await respondAgentPermission(sessionId, requestId, optionId);
      } catch (err) {
        setLastError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [],
  );

  const closeSession = useCallback(
    async (sessionId?: string): Promise<void> => {
      const target = resolveTarget(sessionId);
      try {
        await closeAgentSession(target);
      } finally {
        dispatch({ type: 'remove', sessionId: target });
      }
    },
    [resolveTarget],
  );

  const selectSession = useCallback((sessionId: string | null) => {
    dispatch({ type: 'select', sessionId });
  }, []);

  const removeSession = useCallback((sessionId: string) => {
    dispatch({ type: 'remove', sessionId });
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      store,
      agents,
      setAgents,
      active: getActiveSession(store),
      startSession,
      sendPrompt,
      cancel,
      respondPermission,
      closeSession,
      selectSession,
      removeSession,
      lastError,
      onEvent,
    }),
    [
      store,
      agents,
      startSession,
      sendPrompt,
      cancel,
      respondPermission,
      closeSession,
      selectSession,
      removeSession,
      lastError,
      onEvent,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
