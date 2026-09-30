// Tauri file access for playground items (T6.8).
// Every path stays inside a workspace scope (AGENTS.md §7): `scopeRoot` is the
// source project the export ran in. The invoke function is injectable for tests.
import { invoke as tauriInvoke } from '@tauri-apps/api/core';

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

interface DirEntry {
  name: string;
  is_dir: boolean;
}

export function joinPath(dir: string, name: string): string {
  return `${dir.replace(/[\\/]+$/, '')}/${name}`;
}

/** File names (flat, files only) inside an export output folder. */
export async function listPlaygroundFiles(
  dirPath: string,
  scopeRoot: string,
  invoke: InvokeFn = tauriInvoke,
): Promise<string[]> {
  const entries = (await invoke('list_dir', { path: dirPath, workspaceRoot: scopeRoot })) as DirEntry[];
  return entries.filter((e) => !e.is_dir).map((e) => e.name);
}

/** Open the folder in the OS file explorer. */
export async function revealPlaygroundPath(
  path: string,
  scopeRoot: string,
  invoke: InvokeFn = tauriInvoke,
): Promise<void> {
  await invoke('reveal_in_explorer', { path, workspaceRoot: scopeRoot });
}
