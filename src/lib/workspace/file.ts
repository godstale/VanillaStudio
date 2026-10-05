import { invoke } from '@tauri-apps/api/core';
import { canonicalStringify } from '@/lib/json/canonical';
import { projectPath } from './files';
import { workspaceSchema, type Workspace, type WorkspaceView } from './schema';

export const WORKSPACE_FILE = 'workspace.json';

/** 뷰포트는 소수 2자리로 줄여 저장해 팬/줌 때마다 파일이 바뀌지 않게 한다. */
export function roundView(v: WorkspaceView): WorkspaceView {
  const r = (n: number) => Math.round(n * 100) / 100;
  return { x: r(v.x), y: r(v.y), zoom: r(v.zoom) };
}

export function withView(ws: Workspace, view: WorkspaceView): Workspace {
  return { ...ws, view: roundView(view) };
}

export function parseWorkspaceFile(text: string): Workspace {
  return workspaceSchema.parse(JSON.parse(text));
}

export function serializeWorkspace(ws: Workspace): string {
  return canonicalStringify(workspaceSchema.parse(ws));
}

export async function readWorkspace(root: string): Promise<Workspace> {
  const text = await invoke<string>('read_text_file', {
    path: projectPath(root, WORKSPACE_FILE),
    workspaceRoot: root,
  });
  return parseWorkspaceFile(text);
}

/** 파일을 다시 읽어 view만 바꿔 쓴다(다른 필드를 덮어쓰지 않도록). 값이 같으면 쓰지 않는다. */
export async function saveWorkspaceView(root: string, view: WorkspaceView): Promise<void> {
  const current = await readWorkspace(root);
  const next = withView(current, view);
  if (serializeWorkspace(next) === serializeWorkspace(current)) return;
  await invoke('write_text_file', {
    path: projectPath(root, WORKSPACE_FILE),
    contents: serializeWorkspace(next),
    workspaceRoot: root,
  });
}
