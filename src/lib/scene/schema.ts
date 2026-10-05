import { z } from 'zod';
import { canonicalStringify } from '@/lib/json/canonical';

// scene.json 계약(Refactor-Spec-v2 §5.1, Technical-Design §8.2). 키 순서 = 스키마 선언 순서 = canonical 직렬화 순서.
// 화면비·해상도·fps는 workspace.json.canvas에만 둔다(D-030). 계약을 바꾸면 설계서·가이드 템플릿·version을 함께 갱신한다.

/** canonical 직렬화에서 소수 3자리로 고정할 시간(초) 키. */
export const SCENE_TIME_KEYS: ReadonlySet<string> = new Set(['start', 'end', 'seconds', 'holdSeconds']);

export const SCENE_TYPES = ['static', 'motion', '3d'] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export const SCENE_STATUSES = ['draft', 'prompt-ready', 'generated', 'needs-revision'] as const;
export type SceneStatus = (typeof SCENE_STATUSES)[number];

export const MIN_END_CARD_HOLD_SECONDS = 0.7;
const TIME_EPSILON = 0.001;

const strings = z.array(z.string());
const text = z.string();

const sceneId = z.string().regex(/^scn_[A-Za-z0-9]+$/, 'id must look like scn_<alnum>');
const templateRef = z.string().regex(/^[a-z0-9][a-z0-9-]*@\d+$/, 'template must look like <id>@<version>');

// 신 폴더 안 상대 경로만. 절대 경로·상위 이동은 거부한다(AGENTS.md §7).
const relativePath = z
  .string()
  .min(1)
  .refine((p) => !/^([a-zA-Z]:)?[\\/]/.test(p) && !p.split(/[\\/]/).includes('..'), 'path must stay inside the scene folder');

const briefSchema = z
  .object({
    subject: text,
    goal: text,
    audience: text,
    message: text,
    language: z.enum(['ko', 'en']),
  })
  .strict();

const referenceSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['video', 'image', 'url']),
    path: relativePath.nullable(),
    url: z.string().url().nullable(),
    note: text,
    analysis: relativePath.nullable(),
  })
  .strict()
  .refine((r) => (r.kind === 'url' ? r.url !== null && r.path === null : r.path !== null && r.url === null), {
    message: 'url references need url only; video/image references need path only',
  });

const runtimeSchema = z.object({ contract: z.literal('scene-runtime@1'), entry: relativePath }).strict();

const visualStyleSchema = z
  .object({ medium: text, lighting: text, typography: text, density: text, cameraFeeling: text, mood: text })
  .strict();

const motionVocabularySchema = z
  .object({ typography: strings, object: strings, camera: strings, material: strings, transition: strings })
  .strict();

const beatSchema = z
  .object({
    id: z.string().min(1),
    start: z.number().min(0),
    end: z.number().min(0),
    role: text,
    copy: text,
    visual: text,
    motion: strings,
    camera: text,
    transitionOut: text,
    notes: text,
  })
  .strict()
  .refine((b) => b.end > b.start, { message: 'beat end must be after start' });

const endCardSchema = z
  .object({
    holdSeconds: z.number().min(MIN_END_CARD_HOLD_SECONDS, `endCard.holdSeconds must be >= ${MIN_END_CARD_HOLD_SECONDS}`),
    elements: strings,
  })
  .strict();

const copySchema = z.object({ textFidelity: z.enum(['exact', 'adapt']), items: strings }).strict();
const identitySchema = z.object({ product: text, character: text, mustKeep: strings }).strict();
const audioSchema = z
  .object({ voiceOver: text.nullable(), soundDesign: text.nullable(), music: text.nullable() })
  .strict();
const constraintsSchema = z.object({ avoid: strings, noUnspecifiedElements: z.boolean() }).strict();

// D-032: static 신의 진행은 사용자 입력(click·key·choice)뿐이다.
const advanceSchema = z.string().regex(/^(click|key:[A-Za-z0-9_+ -]+|choice:.+)$/, 'advance must be click, key:<Key> or choice:<label>');

const stepSchema = z
  .object({
    id: z.string().min(1),
    title: text,
    copy: text,
    layout: text,
    enter: text,
    advance: advanceSchema,
  })
  .strict();

const head = {
  version: z.literal(1),
  id: sceneId,
  name: z.string().min(1),
  template: templateRef,
  brief: briefSchema,
};

// 사용자 정의 템플릿이 추가하는 필드의 값(D-031). 키는 템플릿 schema.json의 fields[].id.
const customValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

const tail = {
  custom: z.record(z.string(), customValue).default({}),
  references: z.array(referenceSchema),
  userPrompt: text,
  runtime: runtimeSchema,
  status: z.enum(SCENE_STATUSES),
};

const timedShape = {
  duration: z.object({ seconds: z.number().positive() }).strict(),
  creativeMode: strings,
  structure: z.enum(['multi-shot', 'continuous', 'hybrid']),
  adStructure: text,
  brandVoice: strings,
  visualStyle: visualStyleSchema,
  motionVocabulary: motionVocabularySchema,
  beats: z.array(beatSchema),
  copy: copySchema,
  identity: identitySchema,
  endCard: endCardSchema,
  audio: audioSchema,
  constraints: constraintsSchema,
};

const staticSceneSchema = z
  .object({
    ...head,
    type: z.literal('static'),
    mode: z.enum(['scroll', 'steps']),
    steps: z.array(stepSchema),
    sections: strings,
    layout: text,
    breakpoints: strings,
    accessibility: strings,
    ...tail,
  })
  .strict();

const motionSceneSchema = z.object({ ...head, type: z.literal('motion'), ...timedShape, ...tail }).strict();

const scene3dSchema = z
  .object({
    ...head,
    type: z.literal('3d'),
    ...timedShape,
    composition: text,
    materials: strings,
    lighting: text,
    cameraPath: text,
    performanceBudget: text,
    ...tail,
  })
  .strict();

type Issue = { path: (string | number)[]; message: string };

function checkBeats(scene: { duration: { seconds: number }; beats: { id: string; start: number; end: number }[] }): Issue[] {
  const issues: Issue[] = [];
  const { beats } = scene;
  if (beats.length === 0) return issues; // 초안: 에이전트가 채울 때까지 비어 있을 수 있다.
  const ids = new Set<string>();
  beats.forEach((b, i) => {
    if (ids.has(b.id)) issues.push({ path: ['beats', i, 'id'], message: `duplicate beat id ${b.id}` });
    ids.add(b.id);
  });
  if (Math.abs(beats[0].start) > TIME_EPSILON) issues.push({ path: ['beats', 0, 'start'], message: 'first beat must start at 0' });
  for (let i = 1; i < beats.length; i++) {
    if (Math.abs(beats[i].start - beats[i - 1].end) > TIME_EPSILON) {
      issues.push({ path: ['beats', i, 'start'], message: 'beats must be contiguous (start equals previous end)' });
    }
  }
  const last = beats[beats.length - 1];
  if (Math.abs(last.end - scene.duration.seconds) > TIME_EPSILON) {
    issues.push({ path: ['beats', beats.length - 1, 'end'], message: 'beats must add up to duration.seconds' });
  }
  return issues;
}

export const sceneSchema = z
  .discriminatedUnion('type', [staticSceneSchema, motionSceneSchema, scene3dSchema])
  .superRefine((scene, ctx) => {
    if (scene.type === 'static') {
      if (scene.mode === 'scroll' && scene.steps.length > 0) {
        ctx.addIssue({ code: 'custom', path: ['steps'], message: 'scroll mode has no steps (the page counts as one step)' });
      }
      const ids = new Set<string>();
      scene.steps.forEach((s, i) => {
        if (ids.has(s.id)) ctx.addIssue({ code: 'custom', path: ['steps', i, 'id'], message: `duplicate step id ${s.id}` });
        ids.add(s.id);
      });
      return;
    }
    for (const issue of checkBeats(scene)) ctx.addIssue({ code: 'custom', ...issue });
  });

export type Scene = z.infer<typeof sceneSchema>;
export type StaticScene = Extract<Scene, { type: 'static' }>;
export type MotionScene = Extract<Scene, { type: 'motion' }>;
export type Scene3d = Extract<Scene, { type: '3d' }>;

export function parseScene(text: string): Scene {
  return sceneSchema.parse(JSON.parse(text));
}

/** 검증 후 정규화 직렬화. 앱이 scene.json을 쓰는 유일한 경로다(D-023). */
export function serializeScene(scene: Scene): string {
  return canonicalStringify(sceneSchema.parse(scene), { timeKeys: SCENE_TIME_KEYS });
}

export interface NewSceneInput {
  id: string;
  name: string;
  type: SceneType;
  template: string;
  language?: 'ko' | 'en';
}

/** 새 신의 초안. 빈 필드는 사용자가 채우거나 에이전트가 되쓴다. */
export function newScene({ id, name, type, template, language = 'ko' }: NewSceneInput): Scene {
  const base = {
    version: 1 as const,
    id,
    name,
    template,
    brief: { subject: '', goal: '', audience: '', message: '', language },
  };
  const rest = {
    custom: {},
    references: [],
    userPrompt: '',
    runtime: { contract: 'scene-runtime@1' as const, entry: 'src/index.html' },
    status: 'draft' as const,
  };
  if (type === 'static') {
    return sceneSchema.parse({ ...base, type, mode: 'scroll', steps: [], sections: [], layout: '', breakpoints: [], accessibility: [], ...rest });
  }
  const timed = {
    duration: { seconds: 10 },
    creativeMode: [],
    structure: 'multi-shot' as const,
    adStructure: '',
    brandVoice: [],
    visualStyle: { medium: '', lighting: '', typography: '', density: '', cameraFeeling: '', mood: '' },
    motionVocabulary: { typography: [], object: [], camera: [], material: [], transition: [] },
    beats: [],
    copy: { textFidelity: 'exact' as const, items: [] },
    identity: { product: '', character: '', mustKeep: [] },
    endCard: { holdSeconds: 0.85, elements: [] },
    audio: { voiceOver: null, soundDesign: null, music: null },
    constraints: { avoid: [], noUnspecifiedElements: true },
  };
  if (type === 'motion') return sceneSchema.parse({ ...base, type, ...timed, ...rest });
  return sceneSchema.parse({
    ...base,
    type,
    ...timed,
    composition: '',
    materials: [],
    lighting: '',
    cameraPath: '',
    performanceBudget: '',
    ...rest,
  });
}
