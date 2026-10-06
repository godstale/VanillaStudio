import { invoke } from '@tauri-apps/api/core';
import { projectPath } from '@/lib/workspace/files';
import { checkScene, renderSelfCheck, type Finding } from '../../../resources/workspace-template/scripts/check-scene-core.mjs';
import type { Scene } from './schema';

// 앱의 [검사] 버튼(T4.9). 신 폴더의 `pnpm check:scene`과 같은 규칙(check-scene-core.mjs)을 쓰고 같은 `.vanilla/self-check.md`를 쓴다.

export type { Finding };

interface DirEntryItem {
  name: string;
  is_dir: boolean;
}

const MAX_FILES = 200;

/** src/ 아래 파일을 읽는다. 폴더가 없으면 빈 객체. */
async function readSrc(root: string, slug: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const walk = async (rel: string): Promise<void> => {
    let entries: DirEntryItem[];
    try {
      entries = await invoke<DirEntryItem[]>('list_dir', { path: projectPath(root, `scenes/${slug}/${rel}`), workspaceRoot: root });
    } catch {
      return;
    }
    for (const e of entries) {
      if (Object.keys(files).length >= MAX_FILES) return;
      const child = `${rel}/${e.name}`;
      if (e.is_dir) await walk(child);
      else files[child] = await invoke<string>('read_text_file', { path: projectPath(root, `scenes/${slug}/${child}`), workspaceRoot: root }).catch(() => '');
    }
  };
  await walk('src');
  return files;
}

export interface CheckResult {
  findings: Finding[];
  markdown: string;
}

export async function runSceneCheck(root: string, slug: string, scene: Scene): Promise<CheckResult> {
  const files = await readSrc(root, slug);
  const findings = checkScene({ scene: scene as unknown as Record<string, unknown>, files });
  const markdown = renderSelfCheck(scene.name, findings);
  await invoke('write_text_file', { path: projectPath(root, `scenes/${slug}/.vanilla/self-check.md`), contents: markdown, workspaceRoot: root });
  return { findings, markdown };
}
