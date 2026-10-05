import { z } from 'zod';
import type { SceneType } from '@/lib/scene/schema';

// 가이드 템플릿(D-028): 내장·사용자 정의가 같은 형식. 내장은 번들에서 읽는다(`resources/guides/<type>/<id>@<ver>/`).
// 사용자 템플릿 로딩(워크스페이스 `guide-templates/`·`templatesDir`)은 V3에서 이 형식 위에 얹는다.

export const templateMetaSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    version: z.number().int().positive(),
    type: z.enum(['static', 'motion', '3d']),
    label: z.object({ ko: z.string().min(1), en: z.string().min(1) }).strict(),
    extends: z.string().regex(/^[a-z0-9][a-z0-9-]*@\d+$/).nullable(),
  })
  .strict();
export type TemplateMeta = z.infer<typeof templateMetaSchema>;

// 사용자 템플릿은 내장 스키마를 확장만 할 수 있다(필드 숨김·기본값). 내용 규칙은 V3(T3.1)에서 채운다.
export const templateSchemaFileSchema = z
  .object({ version: z.literal(1), hide: z.array(z.string()), defaults: z.record(z.string(), z.unknown()) })
  .strict();

const localized = z.object({ ko: z.string().min(1), en: z.string().min(1) }).strict();

// 용어집(Refactor-Spec-v2 §6.3): 드롭다운 데이터. scene.json에는 `id`만 저장하고 표시는 label·definition을 쓴다.
export const termSchema = z
  .object({
    category: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    label: localized,
    definition: localized,
    /** 에이전트용 구현 힌트(영문 고정, 번역 대상 아님). */
    implementationHint: z.string(),
    tags: z.array(z.string()),
  })
  .strict();
export type Term = z.infer<typeof termSchema>;

export const glossarySchema = z
  .object({ version: z.literal(1), terms: z.array(termSchema) })
  .strict()
  .superRefine((g, ctx) => {
    const seen = new Set<string>();
    g.terms.forEach((t, i) => {
      const key = `${t.category}/${t.id}`;
      if (seen.has(key)) ctx.addIssue({ code: 'custom', path: ['terms', i, 'id'], message: `duplicate term ${key}` });
      seen.add(key);
    });
  });
export type Glossary = z.infer<typeof glossarySchema>;

export const PROMPT_NAMES = ['generate', 'analyze-reference', 'revise'] as const;
export type PromptName = (typeof PROMPT_NAMES)[number];

export interface GuideTemplate {
  /** `<id>@<version>` — scene.json.template에 기록된다. */
  ref: string;
  meta: TemplateMeta;
  schema: z.infer<typeof templateSchemaFileSchema>;
  glossary: z.infer<typeof glossarySchema>;
  rules: string;
  checklist: string;
  prompts: Record<PromptName, string>;
}

export const templateRef = (meta: Pick<TemplateMeta, 'id' | 'version'>) => `${meta.id}@${meta.version}`;

/** 경로(`<type>/<id>@<ver>/<file>`) → 파일 내용. 번들·디스크 어느 쪽에서 모아도 같은 형식이다. */
export type TemplateFiles = Record<string, string>;

export function buildTemplate(files: TemplateFiles, expectedType?: SceneType): GuideTemplate {
  const need = (name: string): string => {
    const v = files[name];
    if (v === undefined) throw new Error(`Template file missing: ${name}`);
    return v;
  };
  const json = (name: string): unknown => {
    try {
      return JSON.parse(need(name));
    } catch (e) {
      throw new Error(`Template file ${name} is not valid JSON`, { cause: e });
    }
  };
  const meta = templateMetaSchema.parse(json('template.json'));
  if (expectedType && meta.type !== expectedType) {
    throw new Error(`Template ${templateRef(meta)} is for ${meta.type}, not ${expectedType}`);
  }
  return {
    ref: templateRef(meta),
    meta,
    schema: templateSchemaFileSchema.parse(json('schema.json')),
    glossary: glossarySchema.parse(json('glossary.json')),
    rules: need('rules.md'),
    checklist: need('checklist.md'),
    prompts: Object.fromEntries(PROMPT_NAMES.map((n) => [n, need(`prompts/${n}.md`)])) as Record<PromptName, string>,
  };
}

// ---- 내장 템플릿 -------------------------------------------------------------------------------

const raw = import.meta.glob('../../../resources/guides/*/*@*/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const MARK = '/resources/guides/';

/** `<type>/<id>@<ver>` → 그 폴더 안 파일들(상대 경로). */
function groupBuiltin(): Map<string, TemplateFiles> {
  const groups = new Map<string, TemplateFiles>();
  for (const [path, content] of Object.entries(raw)) {
    const rel = path.slice(path.indexOf(MARK) + MARK.length); // motion/commercial@1/rules.md
    const [type, dir, ...rest] = rel.split('/');
    const key = `${type}/${dir}`;
    const files = groups.get(key) ?? {};
    files[rest.join('/')] = content.replace(/\r\n/g, '\n');
    groups.set(key, files);
  }
  return groups;
}

let cache: GuideTemplate[] | null = null;

export function listBuiltinTemplates(): GuideTemplate[] {
  cache ??= [...groupBuiltin().entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, files]) => buildTemplate(files, key.split('/')[0] as SceneType));
  return cache;
}

export function getBuiltinTemplate(ref: string): GuideTemplate | null {
  return listBuiltinTemplates().find((t) => t.ref === ref) ?? null;
}

/** 신 타입의 기본 내장 템플릿(새 신 생성 시 사용). */
export function defaultTemplateFor(type: SceneType): GuideTemplate {
  const t = listBuiltinTemplates().find((x) => x.meta.type === type);
  if (!t) throw new Error(`No built-in template for ${type}`);
  return t;
}
