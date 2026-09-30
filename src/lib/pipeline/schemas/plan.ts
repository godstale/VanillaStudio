import { z } from 'zod';
import { OUTPUT_TYPES } from '@/lib/types/project';

/** plan.json 스키마 버전. 계약을 바꾸면 이 값과 설계서·vanilla-core 스킬을 함께 올린다. */
export const PLAN_VERSION = 1;

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'kebab-case id');
/** 파라미터 id는 코드 식별자처럼 camelCase를 허용한다(예: bgColor). */
const paramId = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]*$/, 'identifier');
const dimension = z.number().int().min(1).max(16384);
const seconds = z.number().min(0).max(3600);
/** 색 파라미터 기본값: hex 또는 DESIGN.md 토큰 참조 `{colors.<role>}`(권장). */
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_REF = /^\{colors\.[A-Za-z0-9_-]+\}$/;
const colorValue = z
  .string()
  .refine((v) => HEX.test(v) || COLOR_REF.test(v), 'hex color or {colors.<role>} token reference');

const implementation = z
  .object({
    approach: z.string().min(1).optional(),
    libraries: z.array(z.string().min(1)).optional(),
    reason: z.string().optional(),
  })
  .strict();

const formatSchema = z
  .object({
    width: dimension,
    height: dimension,
    fps: z.number().int().min(1).max(120).optional(),
    durationSec: z.number().positive().max(3600).optional(),
    slideCount: z.number().int().min(1).max(500).optional(),
    variants: z.array(z.object({ width: dimension, height: dimension }).strict()).optional(),
  })
  .strict();

const sceneSchema = z
  .object({
    id,
    title: z.string().min(1),
    purpose: z.string().default(''),
    /** slides·image·web은 시간 필드 생략 가능. */
    start: seconds.optional(),
    end: seconds.optional(),
    layout: z.string().default(''),
    assets: z.array(id).default([]),
    animations: z.array(id).default([]),
    implementation: implementation.optional(),
    params: z.array(paramId).default([]),
  })
  .strict();

export const ASSET_KINDS = ['svg', 'three', 'shader', 'text', 'user-image', 'ui'] as const;

const assetSchema = z
  .object({
    id,
    kind: z.enum(ASSET_KINDS),
    description: z.string().default(''),
    implementation: implementation.optional(),
    params: z.array(paramId).default([]),
  })
  .strict();

const animationSchema = z
  .object({
    id,
    /** asset id 또는 scene id */
    target: id,
    start: seconds,
    end: seconds,
    easing: z.string().optional(),
    description: z.string().default(''),
  })
  .strict();

const paramBase = { id: paramId, scope: id.or(z.literal('global')), label: z.string().min(1) };

export const PARAM_TYPES = ['color', 'number', 'text', 'select', 'boolean', 'vec2', 'vec3'] as const;

const paramSchema = z.discriminatedUnion('type', [
  z.object({ ...paramBase, type: z.literal('color'), default: colorValue }).strict(),
  z
    .object({
      ...paramBase,
      type: z.literal('number'),
      default: z.number(),
      min: z.number(),
      max: z.number(),
      step: z.number().positive().optional(),
    })
    .strict(),
  z.object({ ...paramBase, type: z.literal('text'), default: z.string() }).strict(),
  z
    .object({
      ...paramBase,
      type: z.literal('select'),
      default: z.string(),
      options: z.array(z.string()).min(1),
    })
    .strict(),
  z.object({ ...paramBase, type: z.literal('boolean'), default: z.boolean() }).strict(),
  z
    .object({ ...paramBase, type: z.literal('vec2'), default: z.tuple([z.number(), z.number()]) })
    .strict(),
  z
    .object({
      ...paramBase,
      type: z.literal('vec3'),
      default: z.tuple([z.number(), z.number(), z.number()]),
    })
    .strict(),
]);

export const planSchema = z
  .object({
    version: z.literal(PLAN_VERSION),
    outputType: z.enum(OUTPUT_TYPES),
    format: formatSchema,
    concept: z
      .object({
        title: z.string().min(1),
        goal: z.string().default(''),
        audience: z.string().default(''),
        tone: z.array(z.string()).default([]),
      })
      .strict(),
    /** 색·타이포 값은 DESIGN.md에만 둔다. 여기에는 파일과 팔레트 id만. */
    design: z
      .object({
        file: z.string().min(1).default('DESIGN.md'),
        palette: id.optional(),
      })
      .strict()
      .default({ file: 'DESIGN.md' }),
    scenes: z.array(sceneSchema).min(1),
    assets: z.array(assetSchema).default([]),
    animations: z.array(animationSchema).default([]),
    params: z.array(paramSchema).default([]),
    customizationNotes: z.string().default(''),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const add = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });

    for (const key of ['scenes', 'assets', 'animations', 'params'] as const) {
      const seen = new Set<string>();
      plan[key].forEach((item, i) => {
        if (seen.has(item.id)) add([key, i, 'id'], `duplicate id "${item.id}"`);
        seen.add(item.id);
      });
    }

    const sceneIds = new Set(plan.scenes.map((s) => s.id));
    const assetIds = new Set(plan.assets.map((a) => a.id));
    const animIds = new Set(plan.animations.map((a) => a.id));
    const paramIds = new Set(plan.params.map((p) => p.id));

    if (plan.outputType === 'video') {
      for (const key of ['fps', 'durationSec'] as const) {
        if (plan.format[key] === undefined) add(['format', key], 'required for video');
      }
    }
    const only: [keyof typeof plan.format, string][] = [
      ['fps', 'video'],
      ['durationSec', 'video'],
      ['slideCount', 'slides'],
      ['variants', 'image'],
    ];
    for (const [key, type] of only) {
      if (plan.format[key] !== undefined && plan.outputType !== type) {
        add(['format', key], `only for ${type}`);
      }
    }

    plan.scenes.forEach((s, i) => {
      if ((s.start === undefined) !== (s.end === undefined)) {
        add(['scenes', i], 'start and end must be given together');
      } else if (s.start !== undefined && s.end !== undefined) {
        if (s.end <= s.start) add(['scenes', i, 'end'], 'end must be greater than start');
        const dur = plan.format.durationSec;
        if (dur !== undefined && s.end > dur) {
          add(['scenes', i, 'end'], `exceeds format.durationSec (${dur})`);
        }
      } else if (plan.outputType === 'video') {
        add(['scenes', i], 'start and end required for video');
      }
      s.assets.forEach((a, j) => {
        if (!assetIds.has(a)) add(['scenes', i, 'assets', j], `unknown asset "${a}"`);
      });
      s.animations.forEach((a, j) => {
        if (!animIds.has(a)) add(['scenes', i, 'animations', j], `unknown animation "${a}"`);
      });
      s.params.forEach((p, j) => {
        if (!paramIds.has(p)) add(['scenes', i, 'params', j], `unknown param "${p}"`);
      });
    });

    plan.assets.forEach((a, i) => {
      a.params.forEach((p, j) => {
        if (!paramIds.has(p)) add(['assets', i, 'params', j], `unknown param "${p}"`);
      });
    });

    plan.animations.forEach((a, i) => {
      if (a.end <= a.start) add(['animations', i, 'end'], 'end must be greater than start');
      if (!assetIds.has(a.target) && !sceneIds.has(a.target)) {
        add(['animations', i, 'target'], `unknown target "${a.target}"`);
      }
    });

    plan.params.forEach((p, i) => {
      if (p.scope !== 'global' && !sceneIds.has(p.scope)) {
        add(['params', i, 'scope'], `unknown scene "${p.scope}"`);
      }
      if (p.type === 'number') {
        if (p.min > p.max) add(['params', i, 'min'], 'min must not exceed max');
        if (p.default < p.min || p.default > p.max) {
          add(['params', i, 'default'], 'default out of min..max');
        }
      }
      if (p.type === 'select' && !p.options.includes(p.default)) {
        add(['params', i, 'default'], 'default must be one of options');
      }
    });
  });

export type Plan = z.infer<typeof planSchema>;
export type PlanScene = Plan['scenes'][number];
export type PlanAsset = Plan['assets'][number];
export type PlanAnimation = Plan['animations'][number];
export type PlanParam = Plan['params'][number];

export type PlanParseResult = { ok: true; plan: Plan } | { ok: false; errors: string[] };

/** 에이전트에게 재요청할 때 그대로 붙일 수 있는 오류 목록을 돌려준다. */
export function parsePlan(text: string): PlanParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  const r = planSchema.safeParse(raw);
  if (r.success) return { ok: true, plan: r.data };
  return {
    ok: false,
    errors: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
  };
}
