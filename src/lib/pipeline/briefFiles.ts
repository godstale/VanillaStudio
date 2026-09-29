import { invoke } from '@tauri-apps/api/core';
import {
  BRIEF_PATH,
  MATERIALS_DIR,
  emptyBrief,
  parseBrief,
  serializeBrief,
  uniqueFileName,
  type Brief,
} from './brief';

interface DirEntryItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

/** 프로젝트 루트 + 상대 경로. Rust가 워크스페이스 밖 경로를 다시 거부한다(AGENTS.md §7). */
export function projectPath(root: string, rel: string): string {
  return `${root.replace(/[\\/]+$/, '')}/${rel}`;
}

async function listDir(root: string, rel: string): Promise<DirEntryItem[] | null> {
  try {
    return await invoke<DirEntryItem[]>('list_dir', { path: projectPath(root, rel), workspaceRoot: root });
  } catch {
    // The folder does not exist yet (new project).
    return null;
  }
}

/** 파일이 진실 공급원: brief/brief.md가 있으면 읽고, 없으면 빈 브리프. 읽기 오류는 그대로 던진다. */
export async function loadBrief(root: string): Promise<{ brief: Brief; exists: boolean }> {
  const entries = await listDir(root, 'brief');
  if (!entries?.some((e) => !e.is_dir && e.name === 'brief.md')) {
    return { brief: emptyBrief(), exists: false };
  }
  const text = await invoke<string>('read_text_file', {
    path: projectPath(root, BRIEF_PATH),
    workspaceRoot: root,
  });
  return { brief: parseBrief(text), exists: true };
}

export async function saveBrief(root: string, brief: Brief): Promise<void> {
  await invoke('write_text_file', {
    path: projectPath(root, BRIEF_PATH),
    contents: serializeBrief(brief),
    workspaceRoot: root,
  });
}

export async function listMaterialFiles(root: string): Promise<string[]> {
  const entries = await listDir(root, MATERIALS_DIR);
  return (entries ?? []).filter((e) => !e.is_dir).map((e) => e.name);
}

export function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

/**
 * 사용자가 고른 외부 파일을 brief/materials/로 복사한다. 이름이 겹치면 번호를 붙인다.
 * 복사는 Rust `import_external_file`(원본은 워크스페이스 밖, 대상은 워크스페이스 안만 허용)이 맡는다.
 * 복사된 파일 이름 목록을 돌려준다.
 */
export async function importMaterials(root: string, sources: string[]): Promise<string[]> {
  const existing = await listMaterialFiles(root);
  const added: string[] = [];
  for (const source of sources) {
    const name = uniqueFileName(baseName(source), [...existing, ...added]);
    await invoke('import_external_file', {
      source,
      dest: projectPath(root, `${MATERIALS_DIR}/${name}`),
      workspaceRoot: root,
    });
    added.push(name);
  }
  return added;
}
