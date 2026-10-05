import { invoke } from '@tauri-apps/api/core';
import { projectPath } from '@/lib/workspace/files';
import { buildCatalog, type Catalog, type RawTemplateFolder } from './resolve';
import { listBuiltinTemplates } from './template';

/** 워크스페이스 안 사용자 템플릿 폴더(Technical-Design §3.4, 우선순위 최상위). */
export const WORKSPACE_TEMPLATES_DIR = 'guide-templates';

async function readFolders(dir: string): Promise<RawTemplateFolder[]> {
  try {
    return await invoke<RawTemplateFolder[]>('read_template_folders', { dir });
  } catch {
    return []; // 폴더를 읽지 못해도 내장 템플릿은 쓸 수 있다.
  }
}

/** 내장 + 설정 `templatesDir` + 워크스페이스 `guide-templates/`를 읽어 카탈로그를 만든다. */
export async function loadCatalog(root: string, templatesDir: string | null): Promise<Catalog> {
  const [workspace, global] = await Promise.all([
    readFolders(projectPath(root, WORKSPACE_TEMPLATES_DIR)),
    templatesDir ? readFolders(templatesDir) : Promise.resolve([]),
  ]);
  return buildCatalog(listBuiltinTemplates(), global, workspace);
}
