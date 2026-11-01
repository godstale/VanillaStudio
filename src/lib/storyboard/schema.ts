import { z } from 'zod';
import { canonicalStringify } from '@/lib/json/canonical';

// 스토리보드 구조화 데이터(`storyboard/storyboard.json`) — Refactor Plan S1.1.
// 3대 문서(기획·설계·비주얼) + 핵심 재료 + 상향식 조립 계획의 진실 공급원.

export const STORYBOARD_STAGES = ['empty', 'briefing', 'docs-ready', 'materials-ready', 'assembling', 'completed'] as const;
export type StoryboardStage = (typeof STORYBOARD_STAGES)[number];

export const MEDIA_INTENTS = ['web', 'image', 'slide', 'motion'] as const;
export type StoryboardMediaIntent = (typeof MEDIA_INTENTS)[number];

export const ASSEMBLY_LAYERS = ['data', 'component', 'section', 'scene'] as const;
export type AssemblyLayer = (typeof ASSEMBLY_LAYERS)[number];

export const ASSEMBLY_STATUS = ['planned', 'draft', 'done'] as const;
export type AssemblyStatus = (typeof ASSEMBLY_STATUS)[number];

export const storyboardBriefSchema = z
  .object({
    title: z.string().default(''),
    oneLiner: z.string().min(1),
    mediaIntent: z.enum(MEDIA_INTENTS),
    purpose: z.string().default(''),
    inScope: z.array(z.string()).default([]),
    nonGoals: z.array(z.string()).default([]),
  })
  .strict();
export type StoryboardBrief = z.infer<typeof storyboardBriefSchema>;

export const storyboardDataSchemaRef = z
  .object({
    id: z.string().min(1),
    path: z.string().min(1),
    description: z.string().default(''),
    itemCount: z.number().int().nonnegative().default(0),
  })
  .strict();

export const assemblyPlanItemSchema = z
  .object({
    id: z.string().min(1),
    layer: z.enum(ASSEMBLY_LAYERS),
    name: z.string().min(1),
    dependsOn: z.array(z.string()).default([]),
    status: z.enum(ASSEMBLY_STATUS).default('planned'),
    targetPath: z.string().optional(),
    targetScene: z.string().optional(),
    taxonomy: z.array(z.string()).default([]),
  })
  .strict();
export type AssemblyPlanItem = z.infer<typeof assemblyPlanItemSchema>;

export const storyboardDesignFlowSchema = z
  .object({
    narrativeArc: z.string().default(''),
    dataSchemas: z.array(storyboardDataSchemaRef).default([]),
    assemblyPlan: z.array(assemblyPlanItemSchema).default([]),
  })
  .strict();

export const themeStageSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    dayWeight: z.number().min(0).max(1),
    nightWeight: z.number().min(0).max(1),
    canvasToken: z.string().min(1),
  })
  .strict();

export const storyboardVisualDirectionSchema = z
  .object({
    moodKeywords: z.array(z.string()).default([]),
    paletteId: z.string().optional(),
    themeStages: z.array(themeStageSchema).default([]),
    invariants: z.array(z.string()).default([]),
    variables: z.array(z.string()).default([]),
    selectedTemplate: z.string().optional(),
    selectedTaxonomy: z.array(z.string()).default([]),
    /** 프로젝트 전체 뼈대(D-046). 신별 가이드인 selectedTemplate과 별개다. */
    projectTemplate: z.string().optional(),
  })
  .strict();

export const storyboardSchema = z
  .object({
    version: z.literal(1),
    workspaceId: z.string().min(1),
    stage: z.enum(STORYBOARD_STAGES).default('empty'),
    brief: storyboardBriefSchema.optional(),
    designFlow: storyboardDesignFlowSchema.default({ narrativeArc: '', dataSchemas: [], assemblyPlan: [] }),
    visualDirection: storyboardVisualDirectionSchema.default({
      moodKeywords: [],
      themeStages: [],
      invariants: [],
      variables: [],
      selectedTaxonomy: [],
    }),
  })
  .strict()
  .superRefine((s, ctx) => {
    const ids = new Set<string>();
    for (const item of s.designFlow.assemblyPlan) {
      if (ids.has(item.id)) {
        ctx.addIssue({ code: 'custom', path: ['designFlow', 'assemblyPlan'], message: `duplicate assembly id ${item.id}` });
      }
      ids.add(item.id);
    }
    for (const item of s.designFlow.assemblyPlan) {
      for (const dep of item.dependsOn) {
        if (!ids.has(dep)) {
          ctx.addIssue({ code: 'custom', path: ['designFlow', 'assemblyPlan'], message: `unknown dependency ${dep} in ${item.id}` });
        }
      }
    }
  });
export type StoryboardFile = z.infer<typeof storyboardSchema>;

export function emptyStoryboard(workspaceId: string): StoryboardFile {
  return {
    version: 1,
    workspaceId,
    stage: 'empty',
    designFlow: { narrativeArc: '', dataSchemas: [], assemblyPlan: [] },
    visualDirection: { moodKeywords: [], themeStages: [], invariants: [], variables: [], selectedTaxonomy: [] },
  };
}

export function parseStoryboard(text: string): StoryboardFile {
  return storyboardSchema.parse(JSON.parse(text) as unknown);
}

export function serializeStoryboard(file: StoryboardFile): string {
  return canonicalStringify(storyboardSchema.parse(file));
}
