import { invoke } from '@tauri-apps/api/core';
import { ZodError } from 'zod';
import { disallowedChanges, changedFields } from '@/lib/guides/writeback';
import { fileExists, projectPath } from '@/lib/workspace/files';
import { sceneSchema, serializeScene, type Scene } from './schema';

// 에이전트 실행 뒤의 되쓰기 관리(Refactor-Spec-v2 §9, R-2): 실행 전 스냅샷 → 종료 후 scene.json 재검증·엔트리 확인 →
// 화이트리스트 밖 변경 경고 → 사용자가 승인하거나 그 필드만(또는 전부) 되돌린다. 스냅샷은 `.vanilla/history/`에 쌓인다.

export const HISTORY_DIR = (slug: string) => `scenes/${slug}/.vanilla/history`;

const stamp = (d: Date) => d.toISOString().replace(/[:.]/g, '-');

export interface SnapshotInfo {
  /** `.vanilla/history/<파일>` 이름. */
  name: string;
  label: string;
  at: string;
}

/** 현재 scene을 이력에 저장한다. 라벨은 `before-run`·`approved` 등. 돌려주는 값은 파일 이름. */
export async function saveSnapshot(root: string, slug: string, scene: Scene, label: string, now: Date = new Date()): Promise<string> {
  const name = `${stamp(now)}-${label}.json`;
  await invoke('write_text_file', { path: projectPath(root, `${HISTORY_DIR(slug)}/${name}`), contents: serializeScene(scene), workspaceRoot: root });
  return name;
}

interface DirEntry {
  name: string;
  is_dir: boolean;
}

/** 새 스냅샷부터. 이력 폴더가 없으면 빈 목록. */
export async function listSnapshots(root: string, slug: string): Promise<SnapshotInfo[]> {
  let entries: DirEntry[];
  try {
    entries = await invoke<DirEntry[]>('list_dir', { path: projectPath(root, HISTORY_DIR(slug)), workspaceRoot: root });
  } catch {
    return [];
  }
  return entries
    .filter((e) => !e.is_dir && e.name.endsWith('.json'))
    .map((e) => {
      const m = /^(.+Z)-(.+)\.json$/.exec(e.name);
      return { name: e.name, at: m?.[1] ?? '', label: m?.[2] ?? '' };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

export async function readSnapshot(root: string, slug: string, name: string): Promise<Scene> {
  const text = await invoke<string>('read_text_file', { path: projectPath(root, `${HISTORY_DIR(slug)}/${name}`), workspaceRoot: root });
  return sceneSchema.parse(JSON.parse(text));
}

export type FieldChange = { field: string; before: unknown; after: unknown; allowed: boolean };

export type RunReview =
  | {
      state: 'invalid';
      /** scene.json을 읽지 못했거나 스키마를 어긴 이유. */
      errors: string[];
    }
  | {
      state: 'ok';
      after: Scene;
      /** 바뀐 최상위 필드(화이트리스트 안·밖 모두). */
      changes: FieldChange[];
      /** 화이트리스트 밖에서 바뀐 필드 이름. 비어 있지 않으면 사용자 확인이 필요하다. */
      disallowed: string[];
      /** `runtime.entry` 파일이 있는가. */
      entryExists: boolean;
      /** 완료 판정: 유효하고 엔트리가 있으면 generated, 아니면 needs-revision. */
      status: 'generated' | 'needs-revision';
    };

function describeError(e: unknown): string[] {
  if (e instanceof ZodError) return e.issues.slice(0, 5).map((i) => `${i.path.join('.') || 'scene.json'}: ${i.message}`);
  return [e instanceof Error ? e.message : String(e)];
}

/**
 * 에이전트 종료(또는 사용자의 "완료")를 판정한다. `before`는 실행 직전의 scene.
 * scene.json을 zod로 다시 검증하고, 엔트리 존재를 확인하고, 화이트리스트 밖 변경을 모은다.
 */
export async function reviewRun(root: string, slug: string, before: Scene): Promise<RunReview> {
  let after: Scene;
  try {
    const text = await invoke<string>('read_text_file', { path: projectPath(root, `scenes/${slug}/scene.json`), workspaceRoot: root });
    after = sceneSchema.parse(JSON.parse(text));
  } catch (e) {
    return { state: 'invalid', errors: describeError(e) };
  }
  if (after.id !== before.id) return { state: 'invalid', errors: ['id: the scene id must not change'] };

  const disallowed = disallowedChanges(before, after);
  const names = changedFields(before, after);
  const b = before as unknown as Record<string, unknown>;
  const a = after as unknown as Record<string, unknown>;
  const allowedSet = new Set(names.filter((n) => !disallowed.includes(n)));
  const changes = names.map((field): FieldChange => ({ field, before: b[field], after: a[field], allowed: allowedSet.has(field) }));
  const entryExists = await fileExists(root, `scenes/${slug}/${after.runtime.entry}`);
  return { state: 'ok', after, changes, disallowed, entryExists, status: entryExists ? 'generated' : 'needs-revision' };
}

/** `fields`만 실행 전 값으로 되돌린 scene(검증 포함). 필드 목록이 비면 그대로. */
export function revertFields(after: Scene, before: Scene, fields: readonly string[]): Scene {
  const b = before as unknown as Record<string, unknown>;
  const next: Record<string, unknown> = { ...(after as unknown as Record<string, unknown>) };
  for (const f of fields) {
    if (f in b) next[f] = b[f];
    else delete next[f];
  }
  return sceneSchema.parse(next);
}

/** 사람이 읽을 한 줄 요약(값이 길면 줄인다). */
export function summarizeValue(v: unknown, max = 80): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  if (s === undefined) return '(none)';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
