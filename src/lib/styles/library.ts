import { z } from 'zod';
import data from '../../../resources/workspace-template/STYLE_LIBRARY.json';
import {
  matchesStyle,
  renderStylesGuide,
  renderStylesSection,
  STYLE_SCOPES,
  type SceneStyleRef,
  type StyleEntry,
  type StyleFamily,
  type StyleLibraryData,
  type StyleScope,
} from '../../../resources/workspace-template/scripts/style-core.mjs';
import type { Scene, SceneType } from '@/lib/scene/schema';

// 스타일 라이브러리(D-046): 신·이미지·모션에 붙이는 시각 어휘. 원본은 워크스페이스에 복사되는 STYLE_LIBRARY.json 하나다.

export { matchesStyle, renderStylesGuide, renderStylesSection, STYLE_SCOPES };
export type { SceneStyleRef, StyleEntry, StyleFamily, StyleScope };

export const STYLE_GROUPS = ['figure-craft', 'painting-animation', 'retro-digital', 'material-photo'] as const;
export type StyleGroup = (typeof STYLE_GROUPS)[number];

const localized = z.object({ ko: z.string().min(1), en: z.string().min(1) }).strict();

const libraryFileSchema = z
  .object({
    version: z.literal(1),
    source: z.object({ url: z.string().url(), retrieved: z.string(), note: z.string() }).strict(),
    families: z.record(z.string(), z.object({ sceneTypes: z.array(z.enum(['static', 'motion', '3d'])).min(1), technique: z.string().min(1) }).strict()),
    styles: z.array(
      z
        .object({
          id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
          sourceTag: z.string().min(1),
          group: z.enum(STYLE_GROUPS),
          family: z.string().min(1),
          label: localized,
          description: localized,
          keywords: z.array(z.string().min(1)).min(1),
          example: z.string().min(1),
          ipSensitive: z.boolean().optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const STYLE_LIBRARY: StyleLibraryData & { styles: (StyleEntry & { group: StyleGroup })[] } = libraryFileSchema.parse(data);

const BY_ID = new Map(STYLE_LIBRARY.styles.map((s) => [s.id, s]));

export const getStyle = (id: string) => BY_ID.get(id);
export const styleFamily = (style: StyleEntry): StyleFamily | undefined => STYLE_LIBRARY.families[style.family];

/** 이 스타일을 코드로 잘 구현할 수 있는 신 종류. */
export const styleSceneTypes = (style: StyleEntry): SceneType[] => (styleFamily(style)?.sceneTypes ?? []) as SceneType[];

/** 같은 id면 범위만 바꾼다(한 신에 같은 스타일이 두 번 들어가지 않게). */
export function addSceneStyle(scene: Scene, id: string, scope: StyleScope): Scene {
  const rest = (scene.styles ?? []).filter((s) => s.id !== id);
  return { ...scene, styles: [...rest, { id, scope }] } as Scene;
}

/** 빈 목록은 키를 지운다: 스타일을 쓰지 않는 신의 scene.json 바이트가 그대로여야 GUIDE.md가 stale이 되지 않는다. */
export function removeSceneStyle(scene: Scene, id: string): Scene {
  const { styles, ...rest } = scene;
  const next = (styles ?? []).filter((s) => s.id !== id);
  return (next.length > 0 ? { ...rest, styles: next } : rest) as Scene;
}

/** 에이전트 터미널에 붙여넣는 한 줄 지시. */
export function styleDirective(style: StyleEntry, scope: StyleScope): string {
  return `Use the \`${style.id}\` style from STYLE_LIBRARY.json for ${scope === 'scene' ? 'this scene' : `the ${scope} layer`}: ${style.keywords.join(', ')}. Example: ${style.example}`;
}
