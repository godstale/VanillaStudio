import type { AgentEntry } from './registry';
import type {
  AgentEvent,
  DecidedBy,
  PermissionOption,
  PermissionOutcome,
  PlanEntry,
  StopReason,
  ToolCallFields,
} from './types';

export type ChatRole = 'agent' | 'user' | 'thought';

export interface TextBlock {
  id: string;
  kind: 'text';
  role: ChatRole;
  text: string;
}

export interface ToolCallBlock {
  id: string;
  kind: 'tool_call';
  toolCallId: string;
  title: string;
  tool: ToolCallFields;
}

export interface PlanBlock {
  id: string;
  kind: 'plan';
  entries: PlanEntry[];
}

export type NoticeTone = 'error' | 'warn' | 'info';

export interface NoticeBlock {
  id: string;
  kind: 'notice';
  tone: NoticeTone;
  text: string;
}

export type MessageBlock = TextBlock | ToolCallBlock | PlanBlock | NoticeBlock;

export interface PendingPermission {
  requestId: string;
  toolCallId: string;
  title: string;
  tool: ToolCallFields;
  options: PermissionOption[];
  reason: string;
}

export interface ResolvedPermission {
  requestId: string;
  toolCallId: string;
  outcome: PermissionOutcome;
  decidedBy: DecidedBy;
  reason: string;
}

export interface UsageSummary {
  used: number;
  size: number;
  costAmount?: number;
  costCurrency?: string;
}

export type SessionStatus = 'starting' | 'active' | 'busy' | 'closed';

/** Frontend view of one ACP agent session, built by folding `AgentEvent`s. */
export interface AgentSessionView {
  sessionId: string;
  agentId: string;
  cwd: string;
  status: SessionStatus;
  /** True while a turn is streaming (between promptSent and promptDone). */
  streaming: boolean;
  blocks: MessageBlock[];
  pendingPermissions: PendingPermission[];
  resolvedPermissions: ResolvedPermission[];
  usage: UsageSummary | null;
  currentModeId: string | null;
  stopReason: StopReason | null;
  error: string | null;
  /** Tail of the agent process stderr (newest last, capped). */
  logs: string[];
}

export interface AgentStoreState {
  sessions: Record<string, AgentSessionView>;
  /** Session ids in creation order (oldest first). */
  order: string[];
  activeSessionId: string | null;
  /** Block id sequence; kept in state so the reducer stays deterministic. */
  seq: number;
}

export const EMPTY_STORE: AgentStoreState = {
  sessions: {},
  order: [],
  activeSessionId: null,
  seq: 0,
};

export function getActiveSession(state: AgentStoreState): AgentSessionView | null {
  const id = state.activeSessionId;
  return id ? (state.sessions[id] ?? null) : null;
}

/** First enabled default entry, falling back to the first entry. Never undefined for a non-empty list. */
export function defaultAgent(agents: AgentEntry[]): AgentEntry {
  return agents.find((a) => a.isDefault && a.enabled) ?? agents[0];
}

/** First pending request: the active session wins, otherwise creation order. */
export function firstPending(
  store: AgentStoreState,
): { sessionId: string; request: PendingPermission } | null {
  const active = store.activeSessionId ? store.sessions[store.activeSessionId] : undefined;
  const first = active?.pendingPermissions[0];
  if (active && first) return { sessionId: active.sessionId, request: first };
  for (const id of store.order) {
    const session = store.sessions[id];
    const next = session?.pendingPermissions[0];
    if (session && next) return { sessionId: session.sessionId, request: next };
  }
  return null;
}

/** Type guard for the event union, narrowed for reducer switches. */
export function isAgentEvent(value: unknown): value is AgentEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}
