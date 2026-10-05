import { Channel, invoke } from '@tauri-apps/api/core';

// Mirrors src-tauri/src/commands/pty_commands.rs. The UI can only name an agent id and a scene folder; the backend
// resolves the executable, checks the workspace is trusted and keeps the working folder inside the workspace (D-012).
export const TERMINAL_AGENT_IDS = ['claude-code', 'codex', 'opencode', 'hermes', 'agy'] as const;
export type TerminalAgentId = (typeof TERMINAL_AGENT_IDS)[number];

export type PtyEvent = { event: 'output'; data: string } | { event: 'exit'; code: number | null };

export interface PtyStartOptions {
  agentId: TerminalAgentId;
  /** 신 폴더 이름. 생략하면 워크스페이스 루트. */
  sceneSlug?: string;
  /** 레지스트리의 추가 인자(argv[1..]). */
  args?: string[];
  cols: number;
  rows: number;
}

export function ptyStart(opts: PtyStartOptions, onEvent: (e: PtyEvent) => void): Promise<number> {
  const channel = new Channel<PtyEvent>();
  channel.onmessage = onEvent;
  return invoke<number>('pty_start', {
    agentId: opts.agentId,
    sceneSlug: opts.sceneSlug ?? null,
    args: opts.args ?? [],
    cols: opts.cols,
    rows: opts.rows,
    onEvent: channel,
  });
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

/** 워크스페이스 신뢰 결정을 백엔드에 알린다(신뢰되지 않은 폴더에서는 pty_start가 거부한다). */
export function setWorkspaceTrusted(path: string, trusted: boolean): Promise<void> {
  return invoke('set_workspace_trusted', { path, trusted });
}

export function decodeBase64(data: string): Uint8Array {
  const bin = atob(data);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/** 백엔드가 돌려주는 오류 문자열을 화면 문구 종류로 나눈다. */
export type StartFailure = 'untrusted' | 'not-installed' | 'other';
export function classifyStartError(message: string): StartFailure {
  if (message.includes('untrusted-workspace')) return 'untrusted';
  if (message.includes('agent executable not found')) return 'not-installed';
  return 'other';
}
