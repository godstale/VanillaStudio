import { z } from 'zod';
import { sceneSchema, type Scene, type SceneType } from '@/lib/scene/schema';
import { applyTemplateDefaults } from './merge';
import { getBuiltinTemplate, MEDIA_INTENTS, type GuideTemplate, type MediaIntent } from './template';
import rawCatalogJson from '../../../resources/opus/opus-catalog.json?raw';

const localized = z.object({ ko: z.string().min(1), en: z.string().min(1) }).strict();

export const DECOMPOSED_CATEGORIES = ['scene-beats', 'typography-style', 'motion-effects', '3d-stage'] as const;
export type DecomposedCategory = (typeof DECOMPOSED_CATEGORIES)[number];

export const opusRecipeSchema = z
  .object({
    id: z.string().min(1),
    title: localized,
    summary: localized,
    author: z.string().min(1),
    mediaIntent: z.enum(MEDIA_INTENTS),
    sceneType: z.enum(['static', 'motion', '3d']),
    templateRef: z.string().regex(/^[a-z0-9][a-z0-9-]*@\d+$/),
    recommendedPaletteId: z.string().min(1),
    previewUrl: z.string().url(),
    actionUrl: z.string().url(),
    postUrl: z.string().url(),
    sourceRef: z.string().min(1),
    tags: z.array(z.string()),
    promptExcerpt: z.string(),
  })
  .strict();
export type OpusRecipe = z.infer<typeof opusRecipeSchema>;

export const decomposedPresetSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum(DECOMPOSED_CATEGORIES),
    targetTypes: z.array(z.enum(['static', 'motion', '3d'])).min(1),
    mediaIntents: z.array(z.enum(MEDIA_INTENTS)).min(1),
    label: localized,
    description: localized,
    previewUrl: z.string().url(),
    actionUrl: z.string().url(),
    sourceRef: z.string().min(1),
    tags: z.array(z.string()),
    patch: z.record(z.string(), z.unknown()),
  })
  .strict();
export type DecomposedPreset = z.infer<typeof decomposedPresetSchema>;

export const opusCatalogSchema = z
  .object({
    version: z.literal(1),
    sourceRepo: z.string().url(),
    license: z.string().min(1),
    recipes: z.array(opusRecipeSchema),
    decomposedPresets: z.array(decomposedPresetSchema),
  })
  .strict();
export type OpusCatalog = z.infer<typeof opusCatalogSchema>;

let cachedCatalog: OpusCatalog | null = null;

export function getOpusCatalog(): OpusCatalog {
  if (cachedCatalog) return cachedCatalog;
  cachedCatalog = opusCatalogSchema.parse(JSON.parse(rawCatalogJson));
  return cachedCatalog;
}

export function listOpusRecipes(filter?: { mediaIntent?: MediaIntent; sceneType?: SceneType }): OpusRecipe[] {
  const { recipes } = getOpusCatalog();
  return recipes.filter(
    (r) =>
      (!filter?.mediaIntent || r.mediaIntent === filter.mediaIntent) &&
      (!filter?.sceneType || r.sceneType === filter.sceneType),
  );
}

export function listDecomposedPresets(filter?: {
  category?: DecomposedCategory;
  targetType?: SceneType;
  mediaIntent?: MediaIntent;
}): DecomposedPreset[] {
  const { decomposedPresets } = getOpusCatalog();
  return decomposedPresets.filter(
    (p) =>
      (!filter?.category || p.category === filter.category) &&
      (!filter?.targetType || p.targetTypes.includes(filter.targetType)) &&
      (!filter?.mediaIntent || p.mediaIntents.includes(filter.mediaIntent)),
  );
}

/**
 * 분해된 세부 프리셋(신/비트 구조, 타이포그래피/비주얼 스타일, 모션 효과, 3D 구도·재질)을
 * 기존 신의 템플릿 ID나 다른 필드를 해치지 않고 해당 세부 항목만 병합 적용한다.
 */
export function applyDecomposedPreset(scene: Scene, preset: DecomposedPreset): Scene {
  if (!preset.targetTypes.includes(scene.type)) {
    throw new Error(`Preset ${preset.id} is for ${preset.targetTypes.join('/')}, not ${scene.type}`);
  }
  const merged: Record<string, unknown> = { ...scene };
  for (const [key, val] of Object.entries(preset.patch)) {
    if (key === 'visualStyle' && typeof val === 'object' && val !== null && 'visualStyle' in scene) {
      merged.visualStyle = { ...scene.visualStyle, ...(val as Record<string, unknown>) };
    } else if (key === 'motionVocabulary' && typeof val === 'object' && val !== null && 'motionVocabulary' in scene) {
      merged.motionVocabulary = { ...scene.motionVocabulary, ...(val as Record<string, unknown>) };
    } else {
      merged[key] = val;
    }
  }
  return sceneSchema.parse(merged);
}

/**
 * 큐레이션된 Opus 레시피를 신에 적용한다:
 * 1) 레시피의 권장 템플릿(및 기본값)을 적용하고,
 * 2) brief.mediaIntent를 기록한다.
 */
export function applyOpusRecipeToScene(scene: Scene, recipe: OpusRecipe, resolvedTemplate?: GuideTemplate | null): Scene {
  if (scene.type !== recipe.sceneType) {
    throw new Error(`Recipe ${recipe.id} requires a ${recipe.sceneType} scene (got ${scene.type})`);
  }
  const tpl = resolvedTemplate ?? getBuiltinTemplate(recipe.templateRef);
  const withTemplate = tpl
    ? applyTemplateDefaults({ ...scene, template: tpl.ref } as Scene, tpl)
    : ({ ...scene, template: recipe.templateRef } as Scene);
  return sceneSchema.parse({
    ...withTemplate,
    brief: {
      ...withTemplate.brief,
      mediaIntent: recipe.mediaIntent,
    },
  });
}
