import { invoke } from '@tauri-apps/api/core';
import { renderAgentsMd, SCENE_CLAUDE_MD, type GuideContext } from '@/lib/guides/agentsMd';
import { renderGuideMd } from '@/lib/guides/guideMd';
import { renderPromptFiles } from '@/lib/guides/prompts';
import { defaultTemplateFor, getBuiltinTemplate, type GuideTemplate } from '@/lib/guides/template';
import { checkGuide } from '@/lib/guides/guideMd';
import { applyTemplateDefaults } from '@/lib/guides/merge';
import { fileExists, projectPath, readOptionalFile } from '@/lib/workspace/files';
import { evaluateStatus } from './status';
import { newScene, parseScene, serializeScene, type Scene, type SceneType } from './schema';

// 신 폴더 입출력: scene.json(정규화 직렬화)을 쓰고 생성물(GUIDE.md·AGENTS.md·CLAUDE.md·prompts/*)을 다시 렌더한다.
// 폴더·slug·sceneId 발급은 Rust(scene_commands.rs)가 한다.

export interface WorkspaceRef {
  id: string;
  name: string;
}

export interface SceneInfo {
  slug: string;
  sceneId: string;
  dir: string;
}

export interface SceneEntry {
  slug: string;
  scene?: Scene;
  /** scene.json이 없거나 검증에 실패한 이유. */
  error?: string;
}

const scenePath = (slug: string, rel: string) => `scenes/${slug}/${rel}`;

/** 신이 쓰는 템플릿을 찾는 함수. 못 찾거나 사용을 거부하면 null — 그러면 scene.json만 쓰고 생성물은 건드리지 않는다(D-031). */
export type TemplateResolver = (scene: Scene) => GuideTemplate | null;

export const builtinResolver: TemplateResolver = (scene) => getBuiltinTemplate(scene.template);

/** 순수: 신 상태 → 쓸 생성물 파일들. `existingAgents`가 있으면 AGENTS.md는 마커 구간만 갱신한다. */
export function renderSceneFiles(ctx: GuideContext, existing: { agents: string | null; claude: string | null }): Record<string, string> {
  const files: Record<string, string> = {
    'GUIDE.md': renderGuideMd(ctx.scene, ctx.workspace.name),
    'AGENTS.md': renderAgentsMd(existing.agents, ctx),
    ...renderPromptFiles(ctx),
  };
  if (existing.claude === null) files['CLAUDE.md'] = SCENE_CLAUDE_MD; // 사용자 소유가 될 수 있어 있으면 건드리지 않는다.
  return files;
}

async function write(root: string, rel: string, contents: string): Promise<void> {
  await invoke('write_text_file', { path: projectPath(root, rel), contents, workspaceRoot: root });
}

/** scene.json을 쓰고 생성물을 다시 렌더한다. */
export async function writeScene(root: string, slug: string, workspace: WorkspaceRef, scene: Scene, resolve: TemplateResolver = builtinResolver): Promise<void> {
  const template = resolve(scene);
  await write(root, scenePath(slug, 'scene.json'), serializeScene(scene));
  if (!template) return; // 템플릿을 쓸 수 없으면 생성물을 다시 만들지 않는다.
  const [agents, claude] = await Promise.all([
    readOptionalFile(root, scenePath(slug, 'AGENTS.md')),
    readOptionalFile(root, scenePath(slug, 'CLAUDE.md')),
  ]);
  const files = renderSceneFiles({ workspace, scene, template }, { agents, claude });
  for (const [rel, text] of Object.entries(files)) await write(root, scenePath(slug, rel), text);
}

export async function readScene(root: string, slug: string): Promise<Scene> {
  const text = await invoke<string>('read_text_file', { path: projectPath(root, scenePath(slug, 'scene.json')), workspaceRoot: root });
  return parseScene(text);
}

interface DirEntry {
  name: string;
  is_dir: boolean;
}

export async function listScenes(root: string): Promise<SceneEntry[]> {
  let entries: DirEntry[];
  try {
    entries = await invoke<DirEntry[]>('list_dir', { path: projectPath(root, 'scenes'), workspaceRoot: root });
  } catch {
    return []; // scenes/ 폴더가 아직 없다.
  }
  const slugs = entries.filter((e) => e.is_dir).map((e) => e.name).sort();
  return Promise.all(
    slugs.map(async (slug): Promise<SceneEntry> => {
      try {
        return { slug, scene: await readScene(root, slug) };
      } catch (e) {
        return { slug, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
}

export interface CreateSceneInput {
  name: string;
  type: SceneType;
  language?: 'ko' | 'en';
  /** 해석이 끝난 템플릿(사용자 템플릿 포함). 생략하면 그 타입의 기본 내장 템플릿. */
  template?: GuideTemplate;
}

export async function createScene(root: string, workspace: WorkspaceRef, input: CreateSceneInput): Promise<{ slug: string; scene: Scene }> {
  const template = input.template ?? defaultTemplateFor(input.type);
  if (template.meta.type !== input.type) throw new Error(`Template ${template.ref} is for ${template.meta.type}, not ${input.type}`);
  const info = await invoke<SceneInfo>('create_scene', { workspaceRoot: root, name: input.name });
  try {
    const scene = applyTemplateDefaults(newScene({ id: info.sceneId, name: input.name.trim(), type: input.type, template: template.ref, language: input.language }), template);
    await writeScene(root, info.slug, workspace, scene, () => template);
    return { slug: info.slug, scene };
  } catch (e) {
    // 반쯤 만들어진 폴더를 남기지 않는다(휴지통으로 이동).
    await invoke('delete_scene', { workspaceRoot: root, slug: info.slug }).catch(() => undefined);
    throw e;
  }
}

export async function renameScene(root: string, workspace: WorkspaceRef, slug: string, newName: string, resolve: TemplateResolver = builtinResolver): Promise<{ slug: string; scene: Scene }> {
  const current = await readScene(root, slug);
  const info = await invoke<SceneInfo>('rename_scene', { workspaceRoot: root, slug, newName });
  const scene = { ...current, name: newName.trim() } as Scene;
  await writeScene(root, info.slug, workspace, scene, resolve);
  return { slug: info.slug, scene };
}

export async function duplicateScene(root: string, workspace: WorkspaceRef, slug: string, newName: string, resolve: TemplateResolver = builtinResolver): Promise<{ slug: string; scene: Scene }> {
  const current = await readScene(root, slug);
  const info = await invoke<SceneInfo>('duplicate_scene', { workspaceRoot: root, slug, newName });
  // 복제본은 새 id를 가지며 실행 상태는 초안으로 되돌린다.
  const scene = { ...current, id: info.sceneId, name: newName.trim(), status: 'draft' } as Scene;
  await writeScene(root, info.slug, workspace, scene, resolve);
  return { slug: info.slug, scene };
}

/** 휴지통(.vanilla/trash)으로 옮긴다. 돌려주는 값은 옮긴 위치. */
export function deleteScene(root: string, slug: string): Promise<string> {
  return invoke<string>('delete_scene', { workspaceRoot: root, slug });
}

/**
 * 파일 상태(엔트리 유무·GUIDE.md 일치)에서 본 상태가 저장된 상태와 다른 신만 scene.json에 반영한다.
 * 바뀐 신이 있으면 true. 스스로의 쓰기가 만든 변경 알림에는 더 바뀔 것이 없어 멈춘다.
 */
export async function refreshStatuses(root: string, workspace: WorkspaceRef, entries: SceneEntry[], resolve: TemplateResolver = builtinResolver): Promise<boolean> {
  let changed = false;
  for (const { slug, scene } of entries) {
    if (!scene) continue;
    const [entryExists, guideText] = await Promise.all([
      fileExists(root, scenePath(slug, scene.runtime.entry)),
      readOptionalFile(root, scenePath(slug, 'GUIDE.md')),
    ]);
    const status = evaluateStatus({ scene, entryExists, guide: checkGuide(guideText, scene) });
    if (status === scene.status) continue;
    await writeScene(root, slug, workspace, { ...scene, status } as Scene, resolve);
    changed = true;
  }
  return changed;
}

/** 설정(캔버스·템플릿 위치)이 바뀌었을 때 모든 신의 생성물을 다시 렌더한다. 다시 쓴 신 수를 돌려준다. */
export async function rerenderAllScenes(root: string, workspace: WorkspaceRef, resolve: TemplateResolver = builtinResolver): Promise<number> {
  const entries = await listScenes(root);
  let n = 0;
  for (const { slug, scene } of entries) {
    if (!scene) continue;
    await writeScene(root, slug, workspace, scene, resolve);
    n += 1;
  }
  return n;
}
