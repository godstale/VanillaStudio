import { invoke } from '@tauri-apps/api/core';
import { projectPath } from './briefFiles';
import { parsePlan, type PlanParseResult } from './schemas/plan';

export const PLAN_JSON_PATH = 'plan/plan.json';
export const PLAN_MD_PATH = 'plan/plan.md';
export const DESIGN_PATH = 'DESIGN.md';

interface DirEntryItem {
  name: string;
  is_dir: boolean;
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

export interface PlanFiles {
  /** null = plan/plan.json 없음 */
  plan: PlanParseResult | null;
  planMd: string | null;
  designMd: string | null;
}

export async function loadPlanFiles(root: string): Promise<PlanFiles> {
  const [json, planMd, designMd] = await Promise.all([
    readOptionalFile(root, PLAN_JSON_PATH),
    readOptionalFile(root, PLAN_MD_PATH),
    readOptionalFile(root, DESIGN_PATH),
  ]);
  return { plan: json === null ? null : parsePlan(json), planMd, designMd };
}
