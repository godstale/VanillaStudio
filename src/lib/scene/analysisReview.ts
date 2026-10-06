import { invoke } from '@tauri-apps/api/core';
import { readAnalysis, writeAnalysis } from '@/lib/design/analysis';
import { outsideMarkers } from '@/lib/guides/markers';
import { projectPath, readOptionalFile } from '@/lib/workspace/files';

// 레퍼런스 분석 결과 검토(T5.5, D-026). 분석 실행 전에 찍어 둔 상태와 실행 후를 비교해 변경을 보여 주고 승인·되돌림을 받는다.
// 대상: `references/analysis/*.md`(에이전트가 쓰는 분석 파일)와 신 `DESIGN.md`의 분석 마커 구간. scene.json 되쓰기는 기존 실행 검토(writeback.ts)가 본다.
// 마커 구간 밖 DESIGN.md 변경은 허용되지 않는다(D-016): "허용 밖"으로 표시하고 그 부분만 되돌릴 수 있게 한다.

const ANALYSIS_DIR = (slug: string) => `scenes/${slug}/references/analysis`;
const DESIGN = (slug: string) => `scenes/${slug}/DESIGN.md`;

export interface AnalysisSnapshot {
  /** 장면 폴더 기준 경로(`references/analysis/ref-1.md`) → 내용. */
  files: Record<string, string>;
  /** 신 DESIGN.md 전체. 없으면 null. */
  design: string | null;
}

export interface AnalysisFileChange {
  path: string;
  kind: 'added' | 'changed' | 'removed';
  before: string | null;
  after: string | null;
}

export interface DesignChange {
  /** 분석 구간 본문의 전후(구간이 없으면 null). */
  section: { before: string | null; after: string | null };
  /** 분석 마커 구간 밖이 바뀌었는가(허용되지 않는 변경). */
  outsideChanged: boolean;
  /** 마커가 깨져 구간을 읽을 수 없다. */
  broken: boolean;
}

export interface AnalysisReview {
  files: AnalysisFileChange[];
  design: DesignChange | null;
  /** 허용되지 않는 변경이 있는가(마커 밖 DESIGN.md 변경·깨진 마커). */
  disallowed: boolean;
}

interface DirEntry {
  name: string;
  is_dir: boolean;
}

async function readAnalysisFiles(root: string, slug: string): Promise<Record<string, string>> {
  let entries: DirEntry[];
  try {
    entries = await invoke<DirEntry[]>('list_dir', { path: projectPath(root, ANALYSIS_DIR(slug)), workspaceRoot: root });
  } catch {
    return {};
  }
  const out: Record<string, string> = {};
  for (const e of entries.filter((x) => !x.is_dir && x.name.endsWith('.md')).sort((a, b) => a.name.localeCompare(b.name))) {
    const text = await readOptionalFile(root, `${ANALYSIS_DIR(slug)}/${e.name}`);
    if (text !== null) out[`references/analysis/${e.name}`] = text;
  }
  return out;
}

export async function snapshotAnalysis(root: string, slug: string): Promise<AnalysisSnapshot> {
  const [files, design] = await Promise.all([readAnalysisFiles(root, slug), readOptionalFile(root, DESIGN(slug))]);
  return { files, design };
}

function sectionOf(text: string | null): { value: string | null; broken: boolean } {
  if (text === null) return { value: null, broken: false };
  try {
    return { value: readAnalysis(text), broken: false };
  } catch {
    return { value: null, broken: true };
  }
}

function designChange(before: string | null, after: string | null): DesignChange | null {
  if (before === after) return null;
  const b = sectionOf(before);
  const a = sectionOf(after);
  if (a.broken) return { section: { before: b.value, after: null }, outsideChanged: true, broken: true };
  const outside = (text: string | null) => (text === null ? '' : outsideMarkers(text).replace(/\s+$/, ''));
  return { section: { before: b.value, after: a.value }, outsideChanged: outside(before) !== outside(after), broken: false };
}

/** 실행 후 상태를 `before`와 비교한다. 바뀐 것이 없으면 빈 검토(files 없음, design null). */
export async function reviewAnalysis(root: string, slug: string, before: AnalysisSnapshot): Promise<AnalysisReview> {
  const after = await snapshotAnalysis(root, slug);
  const paths = [...new Set([...Object.keys(before.files), ...Object.keys(after.files)])].sort();
  const files: AnalysisFileChange[] = [];
  for (const path of paths) {
    const b = before.files[path] ?? null;
    const a = after.files[path] ?? null;
    if (b === a) continue;
    files.push({ path, kind: b === null ? 'added' : a === null ? 'removed' : 'changed', before: b, after: a });
  }
  const design = designChange(before.design, after.design);
  return { files, design, disallowed: design !== null && (design.outsideChanged || design.broken) };
}

async function write(root: string, rel: string, contents: string): Promise<void> {
  await invoke('write_text_file', { path: projectPath(root, rel), contents, workspaceRoot: root });
}

async function remove(root: string, rel: string): Promise<void> {
  await invoke('delete_path', { path: projectPath(root, rel), workspaceRoot: root });
}

/**
 * 되돌린다.
 * - `all`: 분석 파일과 DESIGN.md를 실행 전으로(에이전트가 새로 만든 파일은 지운다).
 * - `disallowed`: 허용되지 않은 DESIGN.md 변경만 되돌리고, 분석 구간의 새 내용은 유지한다.
 */
export async function revertAnalysis(root: string, slug: string, before: AnalysisSnapshot, review: AnalysisReview, scope: 'all' | 'disallowed'): Promise<void> {
  if (scope === 'all') {
    for (const f of review.files) {
      const rel = `scenes/${slug}/${f.path}`;
      if (f.before === null) await remove(root, rel);
      else await write(root, rel, f.before);
    }
    if (review.design) {
      if (before.design === null) await remove(root, DESIGN(slug));
      else await write(root, DESIGN(slug), before.design);
    }
    return;
  }
  if (!review.design?.outsideChanged && !review.design?.broken) return;
  if (before.design === null) {
    await remove(root, DESIGN(slug)); // 에이전트가 만든 파일 전체가 마커 밖이라면 구간만 남길 방법이 없다.
    return;
  }
  const kept = review.design.broken ? null : review.design.section.after;
  await write(root, DESIGN(slug), kept === null ? before.design : writeAnalysis(before.design, kept));
}
