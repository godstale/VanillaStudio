import { createContext, useContext } from 'react';
import type { AgentEntry } from '@/lib/agents/registry';
import type { TerminalSession, TerminalSessions } from '@/lib/terminal/sessions';

export interface RunAgentRequest {
  workspaceId: string;
  sceneId: string;
  sceneSlug: string;
  sceneName: string;
  /** workspace.json의 기본 에이전트(없으면 레지스트리 기본값). */
  preferredAgentId?: string;
  /** 에이전트에 줄 프롬프트. 있으면 클립보드에 복사하고, 설정이 켜져 있으면 터미널에 자동으로 붙여넣는다. */
  prompt?: string;
}

/** 프롬프트 전달 결과 안내(도크 하단에 표시). */
export type TerminalNotice =
  | { kind: 'copied'; agent: string } // 복사됨 → 터미널에 붙여넣기(Ctrl+V)
  | { kind: 'pasted'; agent: string } // 자동으로 붙여넣음
  | { kind: 'paste-failed'; agent: string } // 준비를 감지하지 못함 → 직접 붙여넣기
  | { kind: 'copy-failed' }; // 클립보드를 쓰지 못함

export interface TerminalContextValue {
  manager: TerminalSessions;
  sessions: readonly TerminalSession[];
  /** 도크에서 보이는 탭(세션 id). */
  activeId: string | null;
  setActiveId: (id: string | null) => void;
  notice: TerminalNotice | null;
  clearNotice: () => void;
  /** 신에서 에이전트를 실행하고 도크 탭을 연다. 이미 실행 중이면 그 탭으로 돌아간다. */
  runAgent: (req: RunAgentRequest) => Promise<TerminalSession>;
  /** 사용 가능한 에이전트 중 선택한 것(없으면 null). */
  pickAgent: (agents: readonly AgentEntry[], preferredId?: string) => AgentEntry | null;
}

export const TerminalContext = createContext<TerminalContextValue | null>(null);

export function useTerminals(): TerminalContextValue {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error('useTerminals must be used within a TerminalProvider');
  return ctx;
}

export function useSafeTerminals(): TerminalContextValue | null {
  return useContext(TerminalContext);
}

/** 사용 가능한 에이전트 중 선호하는 것, 없으면 기본, 없으면 첫 번째. 모두 꺼져 있으면 null. */
export function pickAgent(agents: readonly AgentEntry[], preferredId?: string): AgentEntry | null {
  const usable = agents.filter((a) => a.enabled);
  return usable.find((a) => a.id === preferredId) ?? usable.find((a) => a.isDefault) ?? usable[0] ?? null;
}
