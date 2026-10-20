import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import { canonicalStringify } from '@/lib/json/canonical';
import { projectPath } from '@/lib/workspace/files';
import type { Scene } from './schema';

// 레퍼런스(F-REF-01, D-026). 앱은 등록·복사만 한다: URL은 내려받지 않고 기록만 하며, 레퍼런스는 스타일 분석용이라 산출물에 복제·삽입하지 않는다.
// 진실 공급원은 scene.json.references이고, 에이전트가 읽기 쉽게 `references/references.json`에 같은 내용을 거울로 쓴다.

export type Reference = Scene['references'][number];
export type ReferenceKind = Reference['kind'];

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp'];
const VIDEO_EXT = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'];
export const REFERENCE_FILE_EXTENSIONS = { image: IMAGE_EXT, video: VIDEO_EXT } as const;

export const referencesFileSchema = z
  .object({
    version: z.literal(1),
    references: z.array(
      z
        .object({
          id: z.string().min(1),
          kind: z.enum(['video', 'image', 'url']),
          path: z.string().nullable(),
          url: z.string().url().nullable(),
          note: z.string(),
          analysis: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export const referencesFilePath = (slug: string): string => `scenes/${slug}/references/references.json`;

export function serializeReferences(references: readonly Reference[]): string {
  return canonicalStringify(referencesFileSchema.parse({ version: 1, references }));
}

const extOf = (name: string): string => (/\.([A-Za-z0-9]+)$/.exec(name)?.[1] ?? '').toLowerCase();
const baseName = (p: string): string => p.split(/[\\/]/).pop() ?? p;

/** 확장자로 종류를 판단한다. 지원하지 않는 형식이면 null. */
export function kindOfFile(name: string): 'image' | 'video' | null {
  const ext = extOf(name);
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'video';
  return null;
}

/** 파일 이름을 폴더 안에서 안전한 이름으로(공백·특수문자 → `-`, 확장자 유지). */
export function safeFileName(name: string): string {
  const ext = extOf(name);
  const stem =
    baseName(name)
      .replace(/\.[^.]*$/, '')
      .normalize('NFC')
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'reference';
  return ext ? `${stem}.${ext}` : stem;
}

/** `ref-<n>` 중 아직 쓰이지 않은 가장 작은 번호. */
export function nextReferenceId(references: readonly Reference[]): string {
  const used = new Set(references.map((r) => r.id));
  for (let n = 1; ; n++) if (!used.has(`ref-${n}`)) return `ref-${n}`;
}

/** http(s) URL만 받는다(다른 스킴·자격 증명 포함 URL 거부). 정규화된 문자열을 돌려준다. */
export function normalizeReferenceUrl(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function addUrlReference(scene: Scene, url: string, note = ''): Scene {
  const normalized = normalizeReferenceUrl(url);
  if (!normalized) throw new Error('invalid-url');
  const ref: Reference = { id: nextReferenceId(scene.references), kind: 'url', path: null, url: normalized, note, analysis: null };
  return { ...scene, references: [...scene.references, ref] } as Scene;
}

/** 외부 파일을 `references/<id>-<이름>`으로 복사하고 등록한다(링크가 아니라 복사: 에이전트 작업 범위는 cwd 아래로 한정, D-029). */
export async function addFileReference(root: string, slug: string, scene: Scene, sourcePath: string, note = ''): Promise<Scene> {
  const kind = kindOfFile(sourcePath);
  if (!kind) throw new Error('unsupported-file');
  const id = nextReferenceId(scene.references);
  const rel = `references/${id}-${safeFileName(sourcePath)}`;
  await invoke('import_external_file', { source: sourcePath, dest: projectPath(root, `scenes/${slug}/${rel}`), workspaceRoot: root });
  const ref: Reference = { id, kind, path: rel, url: null, note, analysis: null };
  return { ...scene, references: [...scene.references, ref] } as Scene;
}

/** 목록에서 뺀다. 복사해 둔 파일은 지우지 않는다(사용자 소유물). */
export function removeReference(scene: Scene, id: string): Scene {
  return { ...scene, references: scene.references.filter((r) => r.id !== id) } as Scene;
}

export function updateReferenceNote(scene: Scene, id: string, note: string): Scene {
  return { ...scene, references: scene.references.map((r) => (r.id === id ? { ...r, note } : r)) } as Scene;
}

/** 에이전트용 거울 파일을 쓴다. */
export async function writeReferencesMirror(root: string, slug: string, references: readonly Reference[]): Promise<void> {
  await invoke('write_text_file', { path: projectPath(root, referencesFilePath(slug)), contents: serializeReferences(references), workspaceRoot: root });
}
