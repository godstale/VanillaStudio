// What the review screen needs from the project files: output type, frame size and fps (vanilla.json).
import { useEffect, useState } from 'react';
import { parseProjectManifest } from '@/lib/project/schema';
import { readOptionalFile } from '@/lib/pipeline/planFiles';
import type { OutputType } from '@/lib/types/project';

export interface ReviewProject {
  outputType: OutputType;
  format: { width: number; height: number };
  fps: number;
}

export const DEFAULT_REVIEW_PROJECT: ReviewProject = { outputType: 'web', format: { width: 1920, height: 1080 }, fps: 30 };

/** Timeline types animate as a pure function of the clock; web and interactive run free (D-011). */
export type TimeKind = 'clock' | 'free';
export const timeKindOf = (t: OutputType): TimeKind => (t === 'web' || t === 'interactive' ? 'free' : 'clock');

export async function loadReviewProject(root: string): Promise<ReviewProject> {
  const text = await readOptionalFile(root, 'vanilla.json');
  if (text === null) return DEFAULT_REVIEW_PROJECT;
  const parsed = parseProjectManifest(text);
  if (!parsed.ok) return DEFAULT_REVIEW_PROJECT;
  const m = parsed.manifest;
  return {
    outputType: m.outputType,
    format: { width: m.format.width, height: m.format.height },
    fps: m.format.fps ?? DEFAULT_REVIEW_PROJECT.fps,
  };
}

export function useReviewProject(root: string | null): ReviewProject {
  const [project, setProject] = useState<ReviewProject>(DEFAULT_REVIEW_PROJECT);
  useEffect(() => {
    if (!root) return;
    let alive = true;
    loadReviewProject(root).then(
      (p) => alive && setProject(p),
      () => alive && setProject(DEFAULT_REVIEW_PROJECT),
    );
    return () => {
      alive = false;
    };
  }, [root]);
  return project;
}
