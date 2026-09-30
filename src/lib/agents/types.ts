/**
 * Event contract between the Rust agent host and the frontend session Context (T2.6 -> T2.7).
 * Mirrors `src-tauri/src/agent_host/events.rs`; change both together.
 *
 * Every event is JSON with a `type` tag and camelCase fields. `update.update` is the ACP
 * `session/update` payload verbatim (tagged by `sessionUpdate`).
 */

/** Launch spec from the agent registry. `{appData}` in values is expanded by the host. */
export interface LaunchSpec {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** HTTP MCP server handed to the agent (the app's own `vanilla-tools`). */
export interface McpHttpSpec {
  name: string;
  url: string;
  bearerToken: string;
}

/** Argument of the `start_agent_session` command. */
export interface StartAgentParams {
  agentId: string;
  launch: LaunchSpec;
  projectDir: string;
  /** Result of the folder trust check. The host refuses to start when false. */
  trusted: boolean;
  sessionOptions: Record<string, unknown>;
  /** D-018 "use global settings" toggle. The shell ask rule stays on regardless. */
  useGlobalSettings: boolean;
  mcpServers: McpHttpSpec[];
}

// --- ACP session/update payloads (subset the UI renders; unknown kinds fall into UnknownUpdate) ---

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: string; [key: string]: unknown };

export type ToolKind =
  | 'read'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'execute'
  | 'think'
  | 'fetch'
  | 'switch_mode'
  | 'other';

export type ToolCallStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export type ToolCallContent =
  | { type: 'content'; content: ContentBlock }
  | { type: 'diff'; path: string; oldText?: string | null; newText: string }
  | { type: 'terminal'; terminalId: string };

export interface ToolCallLocation {
  path: string;
  line?: number;
}

export interface ToolCallFields {
  title?: string;
  /** Adapter tool name (Claude Code: `Write`, `Bash`, `mcp__vanilla__...`). */
  name?: string;
  kind?: ToolKind;
  status?: ToolCallStatus;
  content?: ToolCallContent[];
  locations?: ToolCallLocation[];
  rawInput?: unknown;
  rawOutput?: unknown;
}

export interface PlanEntry {
  content: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
}

export type SessionUpdate =
  | { sessionUpdate: 'agent_message_chunk'; content: ContentBlock }
  | { sessionUpdate: 'agent_thought_chunk'; content: ContentBlock }
  | { sessionUpdate: 'user_message_chunk'; content: ContentBlock }
  | ({ sessionUpdate: 'tool_call'; toolCallId: string; title: string } & ToolCallFields)
  | ({ sessionUpdate: 'tool_call_update'; toolCallId: string } & ToolCallFields)
  | { sessionUpdate: 'plan'; entries: PlanEntry[] }
  | {
      sessionUpdate: 'usage_update';
      used: number;
      size: number;
      cost?: { amount: number; currency: string } | null;
      /** Claude adapter: `_claude/rateLimit` etc. */
      _meta?: Record<string, unknown> | null;
    }
  | { sessionUpdate: 'current_mode_update'; currentModeId: string }
  | UnknownUpdate;

export interface UnknownUpdate {
  sessionUpdate: string;
  [key: string]: unknown;
}

// --- Host events ---

/** Only `allow_once` / `reject_once` are ever offered (D-010: no allow_always). */
export interface PermissionOption {
  optionId: string;
  name: string;
  kind: 'allow_once' | 'reject_once';
}

export type PermissionOutcome = 'allowed' | 'rejected' | 'cancelled';
export type DecidedBy = 'policy' | 'user';

/** ACP `toolCall` of a permission request (a `ToolCallFields` plus its id). */
export type PermissionToolCall = { toolCallId: string } & ToolCallFields;

export type AgentEvent =
  | {
      type: 'started';
      sessionId: string;
      agentId: string;
      cwd: string;
      agentName: string | null;
      agentVersion: string | null;
      loadSession: boolean;
      /** ACP `modes` from session/new (`currentModeId`, `availableModes`) or null. */
      modes: { currentModeId: string; availableModes: { id: string; name: string; description?: string }[] } | null;
    }
  | { type: 'update'; sessionId: string; update: SessionUpdate }
  | {
      type: 'permissionRequest';
      sessionId: string;
      requestId: string;
      toolCall: PermissionToolCall;
      options: PermissionOption[];
      /** Why the policy asked: shell, network, mcp, unclassified, no-location, protected-path, mode-switch, ... */
      reason: string;
    }
  | {
      type: 'permissionResolved';
      sessionId: string;
      requestId: string;
      toolCallId: string;
      outcome: PermissionOutcome;
      decidedBy: DecidedBy;
      reason: string;
    }
  | { type: 'promptSent'; sessionId: string; text: string }
  | { type: 'promptDone'; sessionId: string; stopReason: StopReason }
  | { type: 'fsAccess'; sessionId: string; op: 'read' | 'write'; path: string; allowed: boolean; error: string | null }
  | { type: 'stderr'; sessionId: string; line: string }
  | { type: 'error'; sessionId: string; message: string }
  | { type: 'closed'; sessionId: string; reason: 'user' | 'process-exit' | 'error' };

export type StopReason = 'end_turn' | 'max_tokens' | 'max_turn_requests' | 'refusal' | 'cancelled';

export type AgentEventType = AgentEvent['type'];

const EVENT_TYPES: readonly AgentEventType[] = [
  'started',
  'update',
  'permissionRequest',
  'permissionResolved',
  'promptSent',
  'promptDone',
  'fsAccess',
  'stderr',
  'error',
  'closed',
];

/** Narrow an untrusted channel payload. Returns null for anything that is not a known event. */
export function parseAgentEvent(value: unknown): AgentEvent | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== 'string' || !(EVENT_TYPES as readonly string[]).includes(v.type)) return null;
  if (typeof v.sessionId !== 'string') return null;
  if (v.type === 'update') {
    const u = v.update as Record<string, unknown> | null;
    if (typeof u !== 'object' || u === null || typeof u.sessionUpdate !== 'string') return null;
  }
  if (v.type === 'permissionRequest' && (typeof v.requestId !== 'string' || !Array.isArray(v.options))) return null;
  return value as AgentEvent;
}

/** Error codes returned by the agent commands (`HostError` Display in Rust), before any `:detail`. */
export type AgentErrorCode =
  | 'not-trusted'
  | 'outside-workspace'
  | 'invalid-spec'
  | 'adapter-not-found'
  | 'spawn'
  | 'initialize'
  | 'session'
  | 'busy'
  | 'no-session'
  | 'closed'
  | 'protocol'
  | 'too-many-sessions'
  | 'empty-prompt'
  | 'prompt-too-large';

/** Split a host error string ("adapter-not-found:node") into its code and detail. */
export function parseAgentError(error: unknown): { code: AgentErrorCode | 'unknown'; detail: string } {
  const text = typeof error === 'string' ? error : error instanceof Error ? error.message : String(error);
  const [head, ...rest] = text.split(':');
  const known: readonly string[] = [
    'not-trusted',
    'outside-workspace',
    'invalid-spec',
    'adapter-not-found',
    'spawn',
    'initialize',
    'session',
    'busy',
    'no-session',
    'closed',
    'protocol',
    'too-many-sessions',
    'empty-prompt',
    'prompt-too-large',
  ];
  return known.includes(head)
    ? { code: head as AgentErrorCode, detail: rest.join(':') }
    : { code: 'unknown', detail: text };
}

/** i18n key for an error code (`agent.error.*`). */
export function agentErrorKey(code: AgentErrorCode | 'unknown'): string {
  return `agent.error.${code}`;
}
