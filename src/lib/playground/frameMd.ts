// frame.md support (T6.10, F-DSN-06, S): motion/pacing notes for `video`
// projects in the HyperFrames FRAME.MD shape. Tokens always come from
// DESIGN.md — frame.md carries motion guidance only (Product-Spec §8.1).
import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { projectPath } from '@/lib/workspace/files';

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

export const FRAME_MD_FILENAME = 'frame.md';

export interface FrameValidation {
  ok: boolean;
  warnings: string[];
}

const MIN_USEFUL_LENGTH = 50;

/** Empty is an error; heading-less or tiny notes are warnings, not blocks. */
export function validateFrameMd(text: string): FrameValidation {
  if (!text.trim()) return { ok: false, warnings: ['empty'] };
  const warnings: string[] = [];
  if (!/^#{1,6}\s+\S/m.test(text)) warnings.push('no-heading');
  if (text.trim().length < MIN_USEFUL_LENGTH) warnings.push('too-short');
  return { ok: true, warnings };
}

export function starterFrameMd(projectName: string): string {
  return `# Frame guide — ${projectName}\n\nMotion and pacing notes for the video render. Tokens (colors, type, spacing) come from DESIGN.md.\n\n## Pacing\n\n- Shot length: 2–4s. Hold key frames at least 1s.\n- Ease in/out on every entrance; no linear moves.\n\n## Motion\n\n- One idea per shot. Move the camera, not the subject.\n- Keep text on screen long enough to read aloud twice.\n\n## Transitions\n\n- Cut on beat; dissolve only between chapters.\n`;
}

export async function loadFrameMd(root: string, invoke: InvokeFn = tauriInvoke): Promise<{ text: string; exists: boolean }> {
  try {
    const text = (await invoke('read_text_file', {
      path: projectPath(root, FRAME_MD_FILENAME),
      workspaceRoot: root,
    })) as string;
    return { text, exists: true };
  } catch {
    return { text: '', exists: false };
  }
}

export async function saveFrameMd(root: string, text: string, invoke: InvokeFn = tauriInvoke): Promise<void> {
  const checked = validateFrameMd(text);
  if (!checked.ok) throw new Error('empty-frame');
  await invoke('write_text_file', {
    path: projectPath(root, FRAME_MD_FILENAME),
    contents: text,
    workspaceRoot: root,
  });
}
