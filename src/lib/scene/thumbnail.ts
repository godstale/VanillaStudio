import { invoke } from '@tauri-apps/api/core';
import { projectPath } from '@/lib/workspace/files';

// 신 썸네일(T4.8): 미리보기 Bridge의 `capture`가 돌려준 PNG를 `.vanilla/thumb.png`에 둔다. 앱 상태 파일이라 커밋·공유 제외.
// `poster.svg`: 에이전트가 코드로 그리는 공유 썸네일(커밋 대상, D-039). thumb.png이 없을 때 대신 표시한다.

const PNG_PREFIX = 'data:image/png;base64,';

export const thumbnailRel = (slug: string): string => `scenes/${slug}/.vanilla/thumb.png`;

/** 에이전트 생성 공유 썸네일. SVG만 허용한다(생성형 이미지 금지, D-006). */
export const posterRel = (slug: string): string => `scenes/${slug}/poster.svg`;

/** PNG data URL → base64 본문. PNG가 아니면 null. */
export function dataUrlToBase64(dataUrl: string): string | null {
  return dataUrl.startsWith(PNG_PREFIX) && dataUrl.length > PNG_PREFIX.length ? dataUrl.slice(PNG_PREFIX.length) : null;
}

export async function saveThumbnail(root: string, slug: string, dataUrl: string): Promise<boolean> {
  const data = dataUrlToBase64(dataUrl);
  if (!data) return false;
  await invoke('write_binary_base64', { path: projectPath(root, thumbnailRel(slug)), data, workspaceRoot: root });
  return true;
}

/** 저장된 썸네일의 data URL. 없으면 null. */
export async function loadThumbnail(root: string, slug: string): Promise<string | null> {
  const data = await invoke<string | null>('read_binary_base64', { path: projectPath(root, thumbnailRel(slug)), workspaceRoot: root });
  return data ? PNG_PREFIX + data : null;
}

/** 공유 포스터(`poster.svg`)의 data URL. 없거나 SVG가 아니면 null. */
export async function loadPoster(root: string, slug: string): Promise<string | null> {
  try {
    const svg = await invoke<string>('read_text_file', { path: projectPath(root, posterRel(slug)), workspaceRoot: root });
    if (!svg.includes('<svg')) return null;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return null;
  }
}

/** 카드·시퀀스에 보여줄 썸네일: 자동 캡처(`thumb.png`) 우선, 없으면 공유 포스터(`poster.svg`). */
export async function loadSceneThumbnail(root: string, slug: string): Promise<string | null> {
  try {
    const captured = await loadThumbnail(root, slug);
    if (captured) return captured;
  } catch {
    // 아래 포스터로 폴백한다.
  }
  return loadPoster(root, slug);
}
