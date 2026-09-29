import { Channel, invoke } from '@tauri-apps/api/core';
import type { InstallEvent } from './installModel';

/** Runs the fixed `pnpm install` job. The UI never supplies a command string (D-012). */
export function installProjectDeps(
  projectDir: string,
  onEvent: (e: InstallEvent) => void,
): Promise<number | null> {
  const channel = new Channel<InstallEvent>();
  channel.onmessage = onEvent;
  return invoke<number | null>('install_project_deps', {
    projectDir,
    onEvent: channel,
  });
}

export function installProjectDepsCancel(): Promise<void> {
  return invoke('install_project_deps_cancel');
}

export async function readPackageJson(projectDir: string): Promise<string> {
  const sep = projectDir.includes('\\') ? '\\' : '/';
  return invoke<string>('read_text_file', {
    path: `${projectDir}${sep}package.json`,
  });
}
