import { invoke } from '@tauri-apps/api/core';
import { parseScene, type Scene } from '@/lib/scene/schema';
import { writeScene, type SceneInfo, type TemplateResolver, type WorkspaceRef } from '@/lib/scene/files';
import { parseSequence, addNode, type Sequence } from '@/lib/sequence/schema';
import { readSequence, writeSequence } from '@/lib/sequence/file';
import { importScene } from './api';
import type { PackageInfo } from './manifest';

// `.vsx` 가져오기(T7.2, D-029·D-031): 패키지의 신을 현재 워크스페이스의 새 신 폴더로 복사한다(참조 링크 없음).
// 검사(zip-slip·심링크·해시)는 Rust가 이미 했다. 여기서는 신 id·workspaceId를 이 워크스페이스 것으로 바꾸고 가이드 생성물을 다시 렌더한다.
// 패키지가 동봉한 에이전트 지시 파일(AGENTS.md·prompts·템플릿)은 신뢰할 수 없는 외부 콘텐츠이므로 사용자가 목록을 확인한 뒤에만 이 함수를 부른다.

/** 패키지 안의 신 폴더 이름들(정렬). */
export function scenesInPackage(info: Pick<PackageInfo, 'manifest'>): string[] {
  const slugs = new Set<string>();
  for (const f of info.manifest.files) {
    const m = /^scenes\/([^/]+)\/scene\.json$/.exec(f.path);
    if (m) slugs.add(m[1]);
  }
  return [...slugs].sort();
}

export interface ImportedScene {
  sourceSlug: string;
  slug: string;
  sceneId: string;
  scene: Scene;
  /** 이 신의 템플릿을 이 워크스페이스에서 쓸 수 없어 가이드 생성물을 만들지 못했다. */
  templateUnavailable: boolean;
}

export interface ImportFailure {
  sourceSlug: string;
  error: string;
}

export interface ImportResult {
  imported: ImportedScene[];
  failed: ImportFailure[];
  /** 패키지의 엣지 중 가져온 신끼리 이어진 것의 수. */
  edgesAdded: number;
  /** 동봉 템플릿 중 새로 푼 것·이미 있어 건드리지 않은 것. */
  templates: { imported: string[]; skipped: string[] };
}

export interface ImportDeps {
  /** 동봉 템플릿을 워크스페이스로 푼다(이미 있는 것은 건드리지 않는다). */
  importTemplates(root: string, pkgPath: string): Promise<{ imported: string[]; skipped: string[] }>;
  /** 템플릿을 푼 뒤의 신 해석기(카탈로그를 다시 읽어 얻는다). */
  resolverAfterTemplates(): Promise<TemplateResolver>;
  /** 패키지 안 텍스트 파일(검사 통과 후). */
  readText(pkgPath: string, entry: string): Promise<string>;
}

const tauriDeps = (resolve: () => Promise<TemplateResolver>): ImportDeps => ({
  importTemplates: (root, pkgPath) => invoke('extract_vsx_templates', { workspaceRoot: root, path: pkgPath }),
  resolverAfterTemplates: resolve,
  readText: (pkgPath, entry) => invoke<string>('read_vsx_text', { path: pkgPath, entry }),
});

export function createImportDeps(resolverAfterTemplates: () => Promise<TemplateResolver>): ImportDeps {
  return tauriDeps(resolverAfterTemplates);
}

/** 패키지 시퀀스의 엣지를 가져온 신끼리만 남기고 신 id를 새 id로 바꾼다. */
export function remapEdges(pkgSeq: Sequence, idMap: ReadonlyMap<string, string>): Sequence['edges'] {
  return pkgSeq.edges.flatMap((e) => {
    const from = idMap.get(e.from);
    const to = idMap.get(e.to);
    return from && to ? [{ ...e, from, to }] : [];
  });
}

/**
 * 고른 신들을 현재 워크스페이스로 가져온다. 하나가 실패해도 나머지는 계속하고, 실패한 신의 폴더는 정리(휴지통)한다.
 * `slugs`가 패키지의 모든 신이고 패키지에 시퀀스가 있으면 엣지도 함께 가져온다.
 */
export async function importScenes(root: string, workspace: WorkspaceRef, pkgPath: string, info: PackageInfo, slugs: readonly string[], deps: ImportDeps): Promise<ImportResult> {
  const result: ImportResult = { imported: [], failed: [], edgesAdded: 0, templates: { imported: [], skipped: [] } };
  const available = new Set(scenesInPackage(info));
  const wanted = slugs.filter((s) => available.has(s));

  // 템플릿이 먼저다: 신의 가이드 생성물이 그 템플릿으로 렌더되기 때문이다.
  if (info.manifest.templates.length > 0) result.templates = await deps.importTemplates(root, pkgPath);
  const resolve = await deps.resolverAfterTemplates();

  let seq = await readSequence(root, workspace.id);
  const idMap = new Map<string, string>();
  const oldIds = new Map<string, string>(); // sourceSlug → 패키지 안의 원래 신 id
  for (const slug of wanted) {
    let created: SceneInfo | null = null;
    try {
      created = await invoke<SceneInfo>('create_scene', { workspaceRoot: root, name: slug });
      await importScene(root, pkgPath, slug, created.slug);
      const text = await invoke<string>('read_text_file', { path: `${root.replace(/[/\\]+$/, '')}/scenes/${created.slug}/scene.json`, workspaceRoot: root });
      const original = parseScene(text);
      oldIds.set(slug, original.id);
      // 새 신 id(이 워크스페이스에서 유일)를 쓰고, 가이드 생성물은 이 워크스페이스의 workspaceId로 다시 만든다(D-029).
      const scene = { ...original, id: created.sceneId } as Scene;
      const template = resolve(scene);
      await writeScene(root, created.slug, workspace, scene, resolve);
      idMap.set(original.id, created.sceneId);
      seq = addNode(seq, created.sceneId, { x: (seq.nodes.length % 4) * 300, y: Math.floor(seq.nodes.length / 4) * 300 });
      result.imported.push({ sourceSlug: slug, slug: created.slug, sceneId: created.sceneId, scene, templateUnavailable: template === null });
    } catch (e) {
      if (created) await invoke('delete_scene', { workspaceRoot: root, slug: created.slug }).catch(() => undefined);
      result.failed.push({ sourceSlug: slug, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // 시퀀스 엣지: 모든 신을 가져온 시퀀스 패키지에서만, 가져온 신끼리 이어진 엣지를 옮긴다.
  if (info.manifest.kind === 'sequence' && result.imported.length > 0 && result.imported.length === available.size && info.manifest.files.some((f) => f.path === 'sequence.json')) {
    try {
      const pkgSeq = parseSequence(await deps.readText(pkgPath, 'sequence.json'));
      const edges = remapEdges(pkgSeq, idMap);
      seq = { ...seq, edges: [...seq.edges, ...edges] };
      result.edgesAdded = edges.length;
      const mappedStart = pkgSeq.start ? idMap.get(pkgSeq.start) : undefined;
      if (seq.start === null && mappedStart) seq = { ...seq, start: mappedStart };
    } catch {
      // 시퀀스를 읽지 못해도 신은 가져왔다. 엣지는 사용자가 다시 잇는다.
    }
  }
  if (result.imported.length > 0) await writeSequence(root, seq);
  return result;
}
