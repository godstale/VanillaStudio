import { invoke } from '@tauri-apps/api/core';
import { builtinResolver, writeScene, type SceneInfo } from '@/lib/scene/files';
import { writeSequence } from '@/lib/sequence/file';
import { addNode, newSequence } from '@/lib/sequence/schema';
import type { WorkspaceApi } from '@/lib/workspace/api';
import type { MigrationPlan } from './v1';

// v1 → v2 변환 실행(T7.5, D-033). 원본 v1 폴더는 읽기만 하고, 새(빈) 폴더에 워크스페이스를 만든 뒤 변환 계획의 파일을 쓴다.

export interface ApplyResult {
  workspaceId: string;
  root: string;
  slug: string;
  sceneId: string;
  filesWritten: number;
  copied: number;
}

/** 원본 경로 + 상대 경로. Windows 확장 경로(`\\?\C:\…`)는 `/`를 허용하지 않으므로 원본의 구분자를 따른다. */
export function joinNative(root: string, rel: string): string {
  const sep = root.includes('\\') ? '\\' : '/';
  return `${root.replace(/[\\/]+$/, '')}${sep}${rel.split('/').join(sep)}`;
}

const write = (root: string, rel: string, contents: string) => invoke('write_text_file', { path: `${root.replace(/[\\/]+$/, '')}/${rel}`, contents, workspaceRoot: root });

/**
 * `destDir`(비어 있는 새 폴더)에 워크스페이스를 만들고 계획을 적용한다. 신뢰 확인·의존성 설치는 호출한 쪽이 이어서 한다.
 * 실패하면 던진다. 이미 만든 폴더는 되돌리지 않는다(사용자의 새 폴더이므로 사용자가 지울 수 있다).
 */
export async function applyV1Migration(destDir: string, plan: MigrationPlan, v1Root: string, api: Pick<WorkspaceApi, 'createWorkspace' | 'openWorkspace'>): Promise<ApplyResult> {
  const workspaceId = await api.createWorkspace(destDir, plan.workspaceName, plan.canvas);
  await api.openWorkspace(destDir); // 파일 명령의 스코프를 새 워크스페이스로
  const workspace = { id: workspaceId, name: plan.workspaceName };

  const info = await invoke<SceneInfo>('create_scene', { workspaceRoot: destDir, name: plan.sceneName });
  let filesWritten = 0;
  for (const [rel, text] of Object.entries(plan.workspaceFiles)) {
    await write(destDir, rel, text);
    filesWritten += 1;
  }
  for (const [rel, text] of Object.entries(plan.sceneFiles)) {
    await write(destDir, `scenes/${info.slug}/${rel}`, text);
    filesWritten += 1;
  }
  let copied = 0;
  for (const c of plan.copies) {
    const to = c.scope === 'scene' ? `scenes/${info.slug}/${c.to}` : c.to;
    await invoke('import_external_file', { source: joinNative(v1Root, c.from), dest: `${destDir.replace(/[\\/]+$/, '')}/${to}`, workspaceRoot: destDir });
    copied += 1;
  }

  // scene.json과 가이드 생성물(GUIDE.md·AGENTS.md·prompts)은 이 워크스페이스의 id로 렌더한다(D-029).
  await writeScene(destDir, info.slug, workspace, plan.scene(info.sceneId), builtinResolver);
  await writeSequence(destDir, addNode(newSequence(workspaceId), info.sceneId, { x: 0, y: 0 }));
  return { workspaceId, root: destDir, slug: info.slug, sceneId: info.sceneId, filesWritten, copied };
}
