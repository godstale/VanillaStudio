import { useWorkspace } from '@/lib/context/WorkspaceContext';

export type AgentAccess =
  | { allowed: true }
  | { allowed: false; reason: 'no-project' | 'untrusted' };

/** 신뢰 확인을 받지 않은 폴더에서는 에이전트 세션·skills 자동 로드를 시작하지 않는다(AGENTS.md §7). */
export function resolveAgentAccess(state: {
  workspaceRoot: string | null;
  isTrusted: boolean;
}): AgentAccess {
  if (!state.workspaceRoot) return { allowed: false, reason: 'no-project' };
  if (!state.isTrusted) return { allowed: false, reason: 'untrusted' };
  return { allowed: true };
}

export function useAgentAccess(): AgentAccess {
  const { workspaceRoot, isTrusted } = useWorkspace();
  return resolveAgentAccess({ workspaceRoot, isTrusted });
}
