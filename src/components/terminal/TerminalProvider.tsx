import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { loadAgents, type AgentEntry } from '@/lib/agents/registry';
import { getGlobalDatabase } from '@/lib/db/client';
import { recordSessionEnd, recordSessionStart } from '@/lib/db/repositories/terminalSessionsRepo';
import { TerminalSessions, type SessionDeps } from '@/lib/terminal/sessions';
import { createXtermTerm } from '@/lib/terminal/xtermTerm';
import { classifyStartError, decodeBase64, ptyKill, ptyResize, ptyStart, ptyWrite } from './terminalApi';
import { pickAgent, TerminalContext, type RunAgentRequest, type TerminalContextValue } from './terminalContextValue';

const realDeps: SessionDeps = {
  api: {
    start: (opts, onEvent) => ptyStart(opts, onEvent),
    write: ptyWrite,
    resize: ptyResize,
    kill: ptyKill,
    decode: decodeBase64,
  },
  createTerm: createXtermTerm,
  classify: classifyStartError,
  onStarted: (s) => (s.workspaceId ? recordSessionStart({ id: s.id, agentId: s.agentId, workspaceId: s.workspaceId, sceneId: s.sceneId ?? null }) : undefined),
  onEnded: (s) => (s.workspaceId ? recordSessionEnd(s.id) : undefined),
};

export interface TerminalProviderProps {
  children: ReactNode;
  /** 테스트용: 세션 관리자·에이전트 목록을 바꿔 끼운다. */
  deps?: SessionDeps;
  loadRegistry?: () => Promise<AgentEntry[]>;
}

/** 앱 전역 터미널 세션. 화면이 바뀌어도 세션과 출력 기록이 유지된다. */
export function TerminalProvider({ children, deps = realDeps, loadRegistry }: TerminalProviderProps) {
  const [manager] = useState(() => new TerminalSessions(deps));
  const sessions = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  const [activeId, setActiveId] = useState<string | null>(null);

  const runAgent = useCallback(
    async (req: RunAgentRequest) => {
      const agents = await (loadRegistry ? loadRegistry() : getGlobalDatabase().then((db) => loadAgents(db)));
      const agent = pickAgent(agents, req.preferredAgentId);
      if (!agent) throw new Error('no-enabled-agent');
      const session = manager.start({ agent, sceneSlug: req.sceneSlug, sceneName: req.sceneName, workspaceId: req.workspaceId, sceneId: req.sceneId });
      setActiveId(session.id);
      return session;
    },
    [manager, loadRegistry],
  );

  const value = useMemo<TerminalContextValue>(() => ({ manager, sessions, activeId, setActiveId, runAgent, pickAgent }), [manager, sessions, activeId, runAgent]);
  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}
