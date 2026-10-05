import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { copyToClipboard } from '@/lib/agents/clipboard';
import { loadAgents, type AgentEntry } from '@/lib/agents/registry';
import * as settingsRepo from '@/lib/db/repositories/settingsRepo';
import { getGlobalDatabase } from '@/lib/db/client';
import { recordSessionEnd, recordSessionStart } from '@/lib/db/repositories/terminalSessionsRepo';
import { TerminalSessions, type SessionDeps } from '@/lib/terminal/sessions';
import { createXtermTerm } from '@/lib/terminal/xtermTerm';
import { classifyStartError, decodeBase64, ptyKill, ptyResize, ptyStart, ptyWrite } from './terminalApi';
import { pickAgent, TerminalContext, type RunAgentRequest, type TerminalContextValue, type TerminalNotice } from './terminalContextValue';

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
  /** 테스트용: 에이전트 준비 감지 시간 조정. */
  readiness?: { quietMs?: number; timeoutMs?: number; pollMs?: number };
}

/** 앱 전역 터미널 세션. 화면이 바뀌어도 세션과 출력 기록이 유지된다. */
export function TerminalProvider({ children, deps = realDeps, loadRegistry, readiness }: TerminalProviderProps) {
  const [manager] = useState(() => new TerminalSessions(deps));
  const sessions = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<TerminalNotice | null>(null);
  const clearNotice = useCallback(() => setNotice(null), []);

  const runAgent = useCallback(
    async (req: RunAgentRequest) => {
      const agents = await (loadRegistry ? loadRegistry() : getGlobalDatabase().then((db) => loadAgents(db)));
      const agent = pickAgent(agents, req.preferredAgentId);
      if (!agent) throw new Error('no-enabled-agent');
      // 프롬프트는 항상 클립보드에 먼저 넣는다: 자동 붙여넣기가 실패해도 사용자가 Ctrl+V로 넣을 수 있다.
      let copied = false;
      if (req.prompt) {
        copied = await copyToClipboard(req.prompt);
        if (!copied) setNotice({ kind: 'copy-failed' });
      }
      const session = manager.start({ agent, sceneSlug: req.sceneSlug, sceneName: req.sceneName, workspaceId: req.workspaceId, sceneId: req.sceneId });
      setActiveId(session.id);
      if (req.prompt && copied) {
        const autoPaste = await settingsRepo.getSettings().then((s) => s.terminalAutoPaste).catch(() => false);
        if (autoPaste && session.pasteMode !== 'clipboard') {
          setNotice({ kind: 'copied', agent: agent.label });
          void manager.whenReady(session.id, readiness).then((ready) => {
            const ok = ready && manager.paste(session.id, req.prompt!);
            setNotice({ kind: ok ? 'pasted' : 'paste-failed', agent: agent.label });
          });
        } else {
          setNotice({ kind: 'copied', agent: agent.label });
        }
      }
      return session;
    },
    [manager, loadRegistry, readiness],
  );

  const value = useMemo<TerminalContextValue>(() => ({ manager, sessions, activeId, setActiveId, notice, clearNotice, runAgent, pickAgent }), [manager, sessions, activeId, notice, clearNotice, runAgent]);
  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}
