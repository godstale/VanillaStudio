import { invoke } from '@tauri-apps/api/core';
import { projectPath } from '@/lib/pipeline/briefFiles';
import { readOptionalFile } from '@/lib/pipeline/planFiles';
import { parseTasks, type TasksParseResult } from '@/lib/pipeline/schemas/tasks';

export const PROMPTS_DIR = 'prompts';
export const TASKS_PATH = 'prompts/tasks.json';
export const MASTER_PATH = 'prompts/00-master.md';
const PROMPT_SUBDIRS = ['assets', 'animations', 'scenes'] as const;

interface DirEntry {
  name: string;
  is_dir: boolean;
}

async function listMdFiles(root: string, rel: string): Promise<string[]> {
  let entries: DirEntry[];
  try {
    entries = await invoke<DirEntry[]>('list_dir', {
      path: projectPath(root, rel),
      workspaceRoot: root,
    });
  } catch {
    return []; // The folder does not exist yet (nothing generated).
  }
  return entries
    .filter((e) => !e.is_dir && e.name.endsWith('.md'))
    .map((e) => `${rel}/${e.name}`);
}

/** `prompts/` 트리: 마스터·태스크별 프롬프트 md 목록(정렬됨). */
export async function listPromptFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const dir of [PROMPTS_DIR, ...PROMPT_SUBDIRS.map((s) => `${PROMPTS_DIR}/${s}`)]) {
    out.push(...(await listMdFiles(root, dir)));
  }
  return [...new Set(out)].sort();
}

export function readPromptFile(root: string, rel: string): Promise<string> {
  return invoke<string>('read_text_file', { path: projectPath(root, rel), workspaceRoot: root });
}

export function savePromptFile(root: string, rel: string, contents: string): Promise<void> {
  return invoke('write_text_file', {
    path: projectPath(root, rel),
    contents,
    workspaceRoot: root,
  });
}

export interface TasksSnapshot {
  text: string | null;
  parsed: TasksParseResult | null;
}

/** 파일이 진실 공급원: `prompts/tasks.json`이 있으면 읽어 검증한다. */
export async function loadTasksFile(root: string): Promise<TasksSnapshot> {
  const text = await readOptionalFile(root, TASKS_PATH);
  return { text, parsed: text === null ? null : parseTasks(text) };
}

export interface PromptTreeGroup {
  /** Directory relative to the project root (`prompts`, `prompts/assets`, …). */
  dir: string;
  /** File paths in this group, sorted. */
  files: string[];
}

/** 파일 목록을 폴더별 그룹으로 묶는다(순수 함수). 루트 그룹이 먼저, 나머지는 이름순. */
export function buildPromptTree(files: string[]): PromptTreeGroup[] {
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const slash = file.lastIndexOf('/');
    const dir = slash === -1 ? '' : file.slice(0, slash);
    groups.set(dir, [...(groups.get(dir) ?? []), file]);
  }
  return [...groups.entries()]
    .map(([dir, groupFiles]) => ({ dir, files: [...groupFiles].sort() }))
    .sort((a, b) => {
      if (a.dir === PROMPTS_DIR) return -1;
      if (b.dir === PROMPTS_DIR) return 1;
      return a.dir.localeCompare(b.dir);
    });
}
