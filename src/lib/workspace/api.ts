import { Channel, invoke } from '@tauri-apps/api/core';
import type { Canvas } from './schema';

export type FolderKind =
  | { kind: 'empty' }
  | { kind: 'workspace'; workspaceId: string; name: string }
  | { kind: 'other' };

interface InstallEvent {
  kind: 'started' | 'log' | 'done';
  line?: string;
  exitCode?: number | null;
}

/** Rust 워크스페이스 명령 래퍼(`workspace_commands.rs`). 테스트에서는 이 인터페이스를 대체한다. */
export interface WorkspaceApi {
  pickFolder(): Promise<string | null>;
  inspectFolder(path: string): Promise<FolderKind>;
  createWorkspace(path: string, name: string, canvas: Canvas): Promise<string>;
  openWorkspace(path: string): Promise<FolderKind>;
  /** pnpm install. 종료 코드를 돌려주고, 로그 줄은 onLine으로 전달한다. */
  installDeps(path: string, onLine: (line: string) => void): Promise<number | null>;
}

export const tauriWorkspaceApi: WorkspaceApi = {
  pickFolder: () => invoke<string | null>('pick_project_folder'),
  inspectFolder: (path) => invoke<FolderKind>('inspect_workspace_folder', { path }),
  createWorkspace: (path, name, canvas) => invoke<string>('create_workspace', { path, name, canvas }),
  openWorkspace: (path) => invoke<FolderKind>('open_workspace', { path }),
  installDeps(path, onLine) {
    const channel = new Channel<InstallEvent>();
    channel.onmessage = (e) => {
      if (e.kind === 'log' && e.line) onLine(e.line);
    };
    return invoke<number | null>('install_project_deps', { projectDir: path, onEvent: channel });
  },
};
