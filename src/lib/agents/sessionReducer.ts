import type {
  AgentEvent,
  ContentBlock,
  PlanEntry,
  SessionUpdate,
  ToolCallContent,
  ToolCallFields,
  ToolCallLocation,
  ToolCallStatus,
  ToolKind,
} from './types';
import {
  EMPTY_STORE,
  type AgentSessionView,
  type AgentStoreState,
  type MessageBlock,
} from './session';

export type SessionAction =
  | { type: 'event'; event: AgentEvent }
  | { type: 'select'; sessionId: string | null }
  | { type: 'remove'; sessionId: string };

/** Distributive "block without id" (Omit over a union would keep common keys only). */
type BlockInit =
  | { kind: 'text'; role: 'agent' | 'user' | 'thought'; text: string }
  | { kind: 'tool_call'; toolCallId: string; title: string; tool: ToolCallFields }
  | { kind: 'plan'; entries: PlanEntry[] }
  | { kind: 'notice'; tone: 'error' | 'warn' | 'info'; text: string };

const MAX_LOGS = 200;
const MAX_RESOLVED = 20;

const TOOL_KINDS: readonly string[] = [
  'read',
  'edit',
  'delete',
  'move',
  'search',
  'execute',
  'think',
  'fetch',
  'switch_mode',
  'other',
];

const TOOL_STATUSES: readonly string[] = ['pending', 'in_progress', 'completed', 'failed'];

// Channel payloads are untrusted data: extract fields defensively instead of
// trusting the narrowed ACP types (the UnknownUpdate fallback widens them).

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Renderable text of a content block (images have no text form). */
export function contentText(content: ContentBlock): string {
  if (typeof content !== 'object' || content === null) return '';
  const record = content as unknown as Record<string, unknown>;
  if (record.type === 'image') return '';
  return typeof record.text === 'string' ? record.text : '';
}

function pickToolFields(value: unknown): ToolCallFields {
  const raw = asRecord(value);
  const tool: ToolCallFields = {};
  if (typeof raw.title === 'string') tool.title = raw.title;
  if (typeof raw.name === 'string') tool.name = raw.name;
  if (typeof raw.kind === 'string' && TOOL_KINDS.includes(raw.kind)) {
    tool.kind = raw.kind as ToolKind;
  }
  if (typeof raw.status === 'string' && TOOL_STATUSES.includes(raw.status)) {
    tool.status = raw.status as ToolCallStatus;
  }
  if (Array.isArray(raw.content)) tool.content = raw.content as ToolCallContent[];
  if (Array.isArray(raw.locations)) tool.locations = raw.locations as ToolCallLocation[];
  if (raw.rawInput !== undefined) tool.rawInput = raw.rawInput;
  if (raw.rawOutput !== undefined) tool.rawOutput = raw.rawOutput;
  return tool;
}

function pickPlanEntries(value: unknown): PlanEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: PlanEntry[] = [];
  for (const item of value) {
    const raw = asRecord(item);
    if (typeof raw.content !== 'string') continue;
    const priority = raw.priority === 'high' || raw.priority === 'low' ? raw.priority : 'medium';
    const status =
      raw.status === 'in_progress' || raw.status === 'completed' ? raw.status : 'pending';
    entries.push({ content: raw.content, priority, status });
  }
  return entries;
}

function nextId(state: AgentStoreState): { state: AgentStoreState; id: string } {
  const seq = state.seq + 1;
  return { state: { ...state, seq }, id: `b${seq}` };
}

function appendChunk(
  state: AgentStoreState,
  session: AgentSessionView,
  role: 'agent' | 'user' | 'thought',
  text: string,
): AgentStoreState {
  if (!text) return state;
  const last = session.blocks[session.blocks.length - 1];
  if (last?.kind === 'text' && last.role === role) {
    const blocks: MessageBlock[] = [
      ...session.blocks.slice(0, -1),
      { ...last, text: last.text + text },
    ];
    return {
      ...state,
      sessions: { ...state.sessions, [session.sessionId]: { ...session, blocks } },
    };
  }
  const ided = nextId(state);
  const blocks: MessageBlock[] = [
    ...session.blocks,
    { id: ided.id, kind: 'text', role, text },
  ];
  return {
    ...ided.state,
    sessions: {
      ...ided.state.sessions,
      [session.sessionId]: { ...session, blocks },
    },
  };
}

function pushBlock(
  state: AgentStoreState,
  session: AgentSessionView,
  block: BlockInit,
): AgentStoreState {
  const ided = nextId(state);
  const blocks: MessageBlock[] = [...session.blocks, { ...block, id: ided.id }];
  return {
    ...ided.state,
    sessions: {
      ...ided.state.sessions,
      [session.sessionId]: { ...session, blocks },
    },
  };
}

function updateSession(
  state: AgentStoreState,
  sessionId: string,
  patch: Partial<AgentSessionView>,
): AgentStoreState {
  const session = state.sessions[sessionId];
  if (!session) return state;
  return {
    ...state,
    sessions: { ...state.sessions, [sessionId]: { ...session, ...patch } },
  };
}

/** Merge a tool_call_update into the matching card; only defined fields win. */
function mergeToolCall(old: ToolCallFields, patch: ToolCallFields): ToolCallFields {
  const merged: ToolCallFields = { ...old };
  if (patch.title !== undefined) merged.title = patch.title;
  if (patch.name !== undefined) merged.name = patch.name;
  if (patch.kind !== undefined) merged.kind = patch.kind;
  if (patch.status !== undefined) merged.status = patch.status;
  if (patch.content !== undefined) merged.content = patch.content;
  if (patch.locations !== undefined) merged.locations = patch.locations;
  if (patch.rawInput !== undefined) merged.rawInput = patch.rawInput;
  if (patch.rawOutput !== undefined) merged.rawOutput = patch.rawOutput;
  return merged;
}

function applyUpdate(
  state: AgentStoreState,
  session: AgentSessionView,
  update: SessionUpdate,
): AgentStoreState {
  const raw = asRecord(update);
  switch (update.sessionUpdate) {
    case 'agent_message_chunk':
      return appendChunk(state, session, 'agent', contentText(raw.content as ContentBlock));
    case 'user_message_chunk':
      return appendChunk(state, session, 'user', contentText(raw.content as ContentBlock));
    case 'agent_thought_chunk':
      return appendChunk(state, session, 'thought', contentText(raw.content as ContentBlock));
    case 'tool_call': {
      return pushBlock(state, session, {
        kind: 'tool_call',
        toolCallId: asString(raw.toolCallId),
        title: asString(raw.title),
        tool: pickToolFields(update),
      });
    }
    case 'tool_call_update': {
      const toolCallId = asString(raw.toolCallId);
      const title = asString(raw.title);
      const patch = pickToolFields(update);
      const blocks = session.blocks.map((b) => {
        if (b.kind !== 'tool_call' || b.toolCallId !== toolCallId) return b;
        return {
          ...b,
          title: title || b.title,
          tool: mergeToolCall(b.tool, patch),
        };
      });
      return updateSession(state, session.sessionId, { blocks });
    }
    case 'plan': {
      const entries = pickPlanEntries(raw.entries);
      const last = session.blocks[session.blocks.length - 1];
      if (last?.kind === 'plan') {
        const blocks: MessageBlock[] = [...session.blocks.slice(0, -1), { ...last, entries }];
        return updateSession(state, session.sessionId, { blocks });
      }
      return pushBlock(state, session, { kind: 'plan', entries });
    }
    case 'usage_update': {
      const cost = asRecord(raw.cost);
      return updateSession(state, session.sessionId, {
        usage: {
          used: typeof raw.used === 'number' ? raw.used : 0,
          size: typeof raw.size === 'number' ? raw.size : 0,
          costAmount: typeof cost.amount === 'number' ? cost.amount : undefined,
          costCurrency: typeof cost.currency === 'string' ? cost.currency : undefined,
        },
      });
    }
    case 'current_mode_update':
      return updateSession(state, session.sessionId, {
        currentModeId: typeof raw.currentModeId === 'string' ? raw.currentModeId : null,
      });
    default:
      // Forward-compatible: unknown ACP update kinds never break the panel.
      return state;
  }
}

function applyEvent(state: AgentStoreState, event: AgentEvent): AgentStoreState {
  switch (event.type) {
    case 'started': {
      const existing = state.sessions[event.sessionId];
      const session: AgentSessionView = existing
        ? { ...existing, agentId: event.agentId, cwd: event.cwd, status: 'active' as const }
        : {
            sessionId: event.sessionId,
            agentId: event.agentId,
            cwd: event.cwd,
            status: 'active',
            streaming: false,
            blocks: [],
            pendingPermissions: [],
            resolvedPermissions: [],
            usage: null,
            currentModeId: null,
            stopReason: null,
            error: null,
            logs: [],
          };
      if (!existing && event.modes && typeof event.modes.currentModeId === 'string') {
        session.currentModeId = event.modes.currentModeId;
      }
      const order = state.order.includes(event.sessionId)
        ? state.order
        : [...state.order, event.sessionId];
      return {
        ...state,
        sessions: { ...state.sessions, [event.sessionId]: session },
        order,
        activeSessionId: event.sessionId,
      };
    }
    case 'update': {
      const session = state.sessions[event.sessionId];
      if (!session) return state;
      return applyUpdate(state, session, event.update);
    }
    case 'permissionRequest': {
      const session = state.sessions[event.sessionId];
      if (!session) return state;
      if (session.pendingPermissions.some((p) => p.requestId === event.requestId)) {
        return state;
      }
      const toolRecord = asRecord(event.toolCall);
      return updateSession(state, event.sessionId, {
        pendingPermissions: [
          ...session.pendingPermissions,
          {
            requestId: event.requestId,
            toolCallId: asString(toolRecord.toolCallId),
            title: asString(toolRecord.title),
            tool: pickToolFields(event.toolCall),
            options: event.options,
            reason: event.reason,
          },
        ],
      });
    }
    case 'permissionResolved': {
      const session = state.sessions[event.sessionId];
      if (!session) return state;
      return updateSession(state, event.sessionId, {
        pendingPermissions: session.pendingPermissions.filter(
          (p) => p.requestId !== event.requestId,
        ),
        resolvedPermissions: [
          ...session.resolvedPermissions,
          {
            requestId: event.requestId,
            toolCallId: event.toolCallId,
            outcome: event.outcome,
            decidedBy: event.decidedBy,
            reason: event.reason,
          },
        ].slice(-MAX_RESOLVED),
      });
    }
    case 'promptSent': {
      const session = state.sessions[event.sessionId];
      if (!session) return state;
      const busy = updateSession(state, event.sessionId, {
        status: 'busy',
        streaming: true,
        stopReason: null,
        error: null,
      });
      const next = busy.sessions[event.sessionId];
      return appendChunk(busy, next, 'user', event.text);
    }
    case 'promptDone': {
      const session = state.sessions[event.sessionId];
      if (!session) return state;
      return updateSession(state, event.sessionId, {
        status: session.status === 'closed' ? 'closed' : 'active',
        streaming: false,
        stopReason: event.stopReason,
      });
    }
    case 'fsAccess': {
      const session = state.sessions[event.sessionId];
      if (!session) return state;
      if (event.allowed) return state;
      return pushBlock(state, session, {
        kind: 'notice',
        tone: 'warn',
        text: `fs:${event.op}:${event.path}:${event.error ?? 'denied'}`,
      });
    }
    case 'stderr': {
      const session = state.sessions[event.sessionId];
      if (!session) return state;
      return updateSession(state, event.sessionId, {
        logs: [...session.logs, event.line].slice(-MAX_LOGS),
      });
    }
    case 'error': {
      const session = state.sessions[event.sessionId];
      if (!session) return state;
      const flagged = updateSession(state, event.sessionId, { error: event.message });
      const next = flagged.sessions[event.sessionId];
      return pushBlock(flagged, next, {
        kind: 'notice',
        tone: 'error',
        text: event.message,
      });
    }
    case 'closed': {
      const session = state.sessions[event.sessionId];
      if (!session) return state;
      return updateSession(state, event.sessionId, {
        status: 'closed',
        streaming: false,
      });
    }
  }
}

export function sessionReducer(
  state: AgentStoreState = EMPTY_STORE,
  action: SessionAction,
): AgentStoreState {
  switch (action.type) {
    case 'event':
      return applyEvent(state, action.event);
    case 'select':
      if (action.sessionId !== null && !state.sessions[action.sessionId]) return state;
      return { ...state, activeSessionId: action.sessionId };
    case 'remove': {
      if (!state.sessions[action.sessionId]) return state;
      const sessions = { ...state.sessions };
      delete sessions[action.sessionId];
      const order = state.order.filter((id) => id !== action.sessionId);
      const activeSessionId =
        state.activeSessionId === action.sessionId
          ? (order[order.length - 1] ?? null)
          : state.activeSessionId;
      return { ...state, sessions, order, activeSessionId };
    }
  }
}
