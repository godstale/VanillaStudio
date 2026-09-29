import { Channel, invoke } from '@tauri-apps/api/core';

// Mirrors src-tauri/src/commands/pty_commands.rs. The UI can only name an agent id; the backend
// resolves the executable, so no command string is ever sent (D-012).
export const TERMINAL_AGENT_IDS = [
  'claude-code',
  'codex',
  'opencode',
  'hermes',
  'agy',
] as const;
export type TerminalAgentId = (typeof TERMINAL_AGENT_IDS)[number];

export type PtyEvent =
  | { event: 'output'; data: string }
  | { event: 'exit'; code: number | null };

export function ptyStart(
  agentId: TerminalAgentId,
  cols: number,
  rows: number,
  onEvent: (e: PtyEvent) => void,
): Promise<number> {
  const channel = new Channel<PtyEvent>();
  channel.onmessage = onEvent;
  return invoke<number>('pty_start', { agentId, cols, rows, onEvent: channel });
}

export function ptyWrite(id: number, data: string): Promise<void> {
  return invoke('pty_write', { id, data });
}

export function ptyResize(id: number, cols: number, rows: number): Promise<void> {
  return invoke('pty_resize', { id, cols, rows });
}

export function ptyKill(id: number): Promise<void> {
  return invoke('pty_kill', { id });
}

export function decodeBase64(data: string): Uint8Array {
  const bin = atob(data);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}
