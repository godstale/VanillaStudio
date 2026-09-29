import { createContext, useContext } from 'react';
import type { AgentEntry } from '@/lib/agents/registry';
import type { AgentSessionView, AgentStoreState } from '@/lib/agents/session';
import type { AgentEvent, StopReason } from '@/lib/agents/types';

export interface SessionContextValue {
  store: AgentStoreState;
  /** Registry entries the panel can start (defaults to built-ins; inject DB rows via setAgents). */
  agents: AgentEntry[];
  setAgents: (agents: AgentEntry[]) => void;
  active: AgentSessionView | null;
  /** Start a session for `agentId` (or the default agent). Resolves with the session id. */
  startSession: (agentId?: string, opts?: { useGlobalSettings?: boolean }) => Promise<string>;
  sendPrompt: (text: string, sessionId?: string) => Promise<StopReason>;
  cancel: (sessionId?: string) => Promise<void>;
  respondPermission: (
    sessionId: string,
    requestId: string,
    optionId: string | null,
  ) => Promise<void>;
  closeSession: (sessionId?: string) => Promise<void>;
  selectSession: (sessionId: string | null) => void;
  removeSession: (sessionId: string) => void;
  /** Last host error message (raw); the panel maps it to an i18n key. */
  lastError: string | null;
  /** Fold one host event (used by tests and future multi-source wiring). */
  onEvent: (event: AgentEvent) => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useAgentSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useAgentSession must be used within a SessionProvider');
  return ctx;
}

export function useSafeAgentSession(): SessionContextValue | null {
  return useContext(SessionContext);
}
