import { invoke } from '@tauri-apps/api/core';
import { DESIGN_PATH, fileExists, projectPath, readOptionalFile } from '@/lib/workspace/files';
import { replaceColors } from './rewrite';
import { paletteDesignColors, type PaletteFile } from './palettes';

// 워크스페이스·신 DESIGN.md 입출력. 색 교체는 front matter `colors`만 바꾸고 본문은 옛 색 값이 적힌 곳만 갱신한다(replaceColors).

export const sceneDesignPath = (slug: string) => `scenes/${slug}/DESIGN.md`;

/** 신 DESIGN.md가 워크스페이스 것을 상속한다는 선언(Refactor-Spec-v2 §5.3). 해석(extends 병합)은 V5. */
export const SCENE_OVERRIDE_TEMPLATE = '---\nextends: ../../DESIGN.md\ncolors: {}\n---\n\n# Scene design overrides\n\nOverride only the tokens this scene needs; everything else comes from the workspace DESIGN.md.\n';

/** 팔레트를 적용한 새 DESIGN.md 텍스트. `colors` 외의 바이트는 그대로다. */
export function applyPalette(designText: string, palette: PaletteFile): { text: string; bodyReplacements: number } {
  return replaceColors(designText, paletteDesignColors(palette), { updateProse: true });
}

export function readDesign(root: string, rel: string = DESIGN_PATH): Promise<string | null> {
  return readOptionalFile(root, rel);
}

export async function writeDesign(root: string, text: string, rel: string = DESIGN_PATH): Promise<void> {
  await invoke('write_text_file', { path: projectPath(root, rel), contents: text, workspaceRoot: root });
}

export const hasSceneOverride = (root: string, slug: string): Promise<boolean> => fileExists(root, sceneDesignPath(slug));

/** 신 오버라이드 파일을 만든다(이미 있으면 건드리지 않는다). */
export async function createSceneOverride(root: string, slug: string): Promise<boolean> {
  if (await hasSceneOverride(root, slug)) return false;
  await writeDesign(root, SCENE_OVERRIDE_TEMPLATE, sceneDesignPath(slug));
  return true;
}
