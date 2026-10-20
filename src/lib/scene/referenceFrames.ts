import { invoke } from '@tauri-apps/api/core';
import { readOptionalFile } from '@/lib/workspace/files';
import type { Reference } from './references';

// 영상 레퍼런스의 키프레임·메타 추출(T5.2, D-026). 실행은 Rust가 고정 argv로 한다. 분석 자체는 에이전트 태스크다.

export interface VideoMeta {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  videoCodec: string;
}

export interface ExtractReport {
  frames: string[];
  metaPath: string;
  meta: VideoMeta;
}

export const analysisDir = (slug: string, refId: string): string => `scenes/${slug}/references/analysis/${refId}`;

/** 영상 레퍼런스만 추출할 수 있다. count를 생략하면 Rust 기본값(8장). */
export async function extractReferenceFrames(root: string, slug: string, ref: Reference, count?: number): Promise<ExtractReport> {
  if (ref.kind !== 'video' || !ref.path) throw new Error('not-a-video');
  return invoke<ExtractReport>('extract_reference_frames', { workspaceRoot: root, slug, refId: ref.id, videoPath: ref.path, count });
}

export interface ExtractedInfo {
  frames: number;
  duration: number;
}

/** 이미 추출한 결과가 있으면 요약(없거나 깨졌으면 null). */
export async function readExtractedInfo(root: string, slug: string, refId: string): Promise<ExtractedInfo | null> {
  try {
    const text = await readOptionalFile(root, `${analysisDir(slug, refId)}/meta.json`);
    if (!text) return null;
    const v = JSON.parse(text) as { frames?: unknown; duration?: unknown };
    return typeof v.frames === 'number' && typeof v.duration === 'number' ? { frames: v.frames, duration: v.duration } : null;
  } catch {
    return null;
  }
}

/** Rust 오류 코드 → i18n 키. 모르는 오류는 null(원문을 보여 준다). */
export function extractErrorKey(message: string): string | null {
  if (message === 'ffmpeg-not-installed') return 'references.ffmpegMissing';
  if (message === 'no-video-stream') return 'references.noVideoStream';
  return null;
}
