import { invoke } from '@tauri-apps/api/core';
import { projectPath } from '@/lib/workspace/files';

// 신 썸네일(T4.8): 미리보기 Bridge의 `capture`가 돌려준 PNG를 `.vanilla/thumb.png`에 둔다. 앱 상태 파일이라 커밋·공유 제외.

const PNG_PREFIX = 'data:image/png;base64,';

export const thumbnailRel = (slug: string): string => `scenes/${slug}/.vanilla/thumb.png`;

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
