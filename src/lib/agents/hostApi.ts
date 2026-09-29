import { Channel, invoke } from '@tauri-apps/api/core';
import { resolveAgentAccess } from '@/lib/project/access';
import type { InstallEvent } from '@/components/doctor/installModel';
import type { AgentEntry } from '@/lib/agents/registry';
import {
  parseAgentEvent,
  type AgentEvent,
  type McpHttpSpec,
  type StartAgentParams,
  type StopReason,
} from '@/lib/agents/types';

/** Trust inputs, as read from the workspace context. */
export interface AgentStartContext {
  projectDir: string | null;
  isTrusted: boolean;
  useGlobalSettings?: boolean;
  mcpServers?: McpHttpSpec[];
}

/** Build the `start_agent_session` argument from a registry entry. Throws for terminal-mode agents. */
export function buildStartParams(entry: AgentEntry, ctx: AgentStartContext & { projectDir: string }): StartAgentParams {
  if (entry.mode !== 'acp') throw new Error(`agent ${entry.id} is not an ACP agent`);
  return {
    agentId: entry.id,
    launch: { command: entry.command, args: entry.args, env: entry.env },
    projectDir: ctx.projectDir,
    trusted: ctx.isTrusted,
    sessionOptions: entry.sessionOptions,
    useGlobalSettings: ctx.useGlobalSettings ?? false,
    mcpServers: ctx.mcpServers ?? [],
  };
}

/**
 * Start an ACP session. Refuses before calling the backend when the folder is not open or not
 * trusted (AGENTS.md section 7; the host checks again). Resolves with the session id; events
 * (including `started`) arrive through `onEvent`.
 */
export function startAgentSession(
  entry: AgentEntry,
  ctx: AgentStartContext,
  onEvent: (e: AgentEvent) => void,
): Promise<string> {
  const access = resolveAgentAccess({ workspaceRoot: ctx.projectDir, isTrusted: ctx.isTrusted });
  if (!access.allowed || ctx.projectDir === null) {
    return Promise.reject(new Error(access.allowed ? 'no-project' : access.reason));
  }
  const params = buildStartParams(entry, { ...ctx, projectDir: ctx.projectDir });
  const channel = new Channel<unknown>();
  channel.onmessage = (raw) => {
    const event = parseAgentEvent(raw);
    if (event) onEvent(event);
  };
  return invoke<string>('start_agent_session', { params, onEvent: channel });
}

/** Resolves with the ACP stop reason when the turn ends. */
export function sendAgentPrompt(sessionId: string, text: string): Promise<StopReason> {
  return invoke<StopReason>('send_agent_prompt', { sessionId, text });
}

export function cancelAgentPrompt(sessionId: string): Promise<void> {
  return invoke('cancel_agent_prompt', { sessionId });
}

/** `optionId: null` dismisses the request (the agent sees `cancelled`). */
export function respondAgentPermission(
  sessionId: string,
  requestId: string,
  optionId: string | null,
): Promise<void> {
  return invoke('respond_agent_permission', { sessionId, requestId, optionId });
}

export function closeAgentSession(sessionId: string): Promise<void> {
  return invoke('close_agent_session', { sessionId });
}

/** Result of the pinned adapter check/install (Rust `AdapterStatus`). */
export interface AdapterStatus {
  installed: boolean;
  version: string | null;
  /** The installed version equals the pinned one. */
  pinned: boolean;
  entry: string | null;
}

export function claudeAdapterStatus(): Promise<AdapterStatus> {
  return invoke<AdapterStatus>('claude_adapter_status');
}

/** Installs the pinned Claude Code adapter (fixed argv, D-012). Call only after user consent. */
export function installClaudeAdapter(onEvent: (e: InstallEvent) => void): Promise<AdapterStatus> {
  const channel = new Channel<InstallEvent>();
  channel.onmessage = onEvent;
  return invoke<AdapterStatus>('install_claude_adapter', { onEvent: channel });
}

export function installClaudeAdapterCancel(): Promise<void> {
  return invoke('install_claude_adapter_cancel');
}
