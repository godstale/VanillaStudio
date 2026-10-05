import { invoke } from '@tauri-apps/api/core';

export const DESIGN_PATH = 'DESIGN.md';

interface DirEntryItem {
  name: string;
  is_dir: boolean;
}

/** 워크스페이스 루트 + 상대 경로. Rust가 워크스페이스 밖 경로를 다시 거부한다(AGENTS.md §7). */
export function projectPath(root: string, rel: string): string {
  return `${root.replace(/[/\\]+$/, '')}/${rel}`;
}

/** 존재하는 파일이면 내용, 없으면 null. 읽기 오류는 그대로 던진다(빈 값으로 오해해 덮어쓰지 않도록). */
export async function readOptionalFile(root: string, rel: string): Promise<string | null> {
  const slash = rel.lastIndexOf('/');
  const dir = slash === -1 ? '' : rel.slice(0, slash);
  const name = rel.slice(slash + 1);
  let entries: DirEntryItem[];
  try {
    entries = await invoke<DirEntryItem[]>('list_dir', {
      path: projectPath(root, dir),
      workspaceRoot: root,
    });
  } catch {
    return null; // parent folder does not exist yet
  }
  if (!entries.some((e) => !e.is_dir && e.name === name)) return null;
  return invoke<string>('read_text_file', { path: projectPath(root, rel), workspaceRoot: root });
}
