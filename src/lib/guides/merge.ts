import { newScene, sceneSchema, type Scene, type SceneType } from '@/lib/scene/schema';
import type { CustomField, GuideTemplate } from './template';

// 사용자 정의 템플릿 병합(D-031): 내장 스키마를 **확장만** 한다 — 필드 추가·숨김·기본값.
// 타입을 바꾸거나, 내장 필드를 다시 정의하거나, 신 정체성 필드를 숨기는 템플릿은 거부한다(사용 불가).

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateError';
  }
}

/** 숨기거나 기본값을 줄 수 없는 필드(신 정체성·런타임 계약·상태·확장 값 저장소). */
const PROTECTED = new Set(['version', 'id', 'name', 'type', 'template', 'runtime', 'status', 'custom']);

const probe = (type: SceneType): Scene => newScene({ id: 'scn_PROBE', name: 'probe', type, template: 'probe@1' });

/** 그 타입의 신이 가진 최상위 필드 이름. */
export function sceneFieldNames(type: SceneType): string[] {
  return Object.keys(probe(type));
}

/** UI에서 숨기거나 기본값을 줄 수 있는 내장 필드. */
export function configurableFields(type: SceneType): string[] {
  return sceneFieldNames(type).filter((f) => !PROTECTED.has(f));
}

function validateCustomValue(field: CustomField, value: unknown): string | null {
  switch (field.type) {
    case 'text':
    case 'longtext':
      return typeof value === 'string' ? null : 'must be a string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? null : 'must be a number';
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be a boolean';
    case 'select': {
      const ids = (field.options ?? []).map((o) => o.id);
      return typeof value === 'string' && ids.includes(value) ? null : 'must be one of the options';
    }
    case 'multiselect': {
      const ids = (field.options ?? []).map((o) => o.id);
      return Array.isArray(value) && value.every((v) => typeof v === 'string' && ids.includes(v)) ? null : 'must be a list of options';
    }
  }
}

function checkFields(fields: CustomField[], taken: Set<string>, type: SceneType, who: string): void {
  const builtin = new Set(sceneFieldNames(type));
  for (const f of fields) {
    if (builtin.has(f.id)) throw new TemplateError(`${who}: field "${f.id}" redefines a built-in field`);
    if (taken.has(f.id)) throw new TemplateError(`${who}: duplicate field "${f.id}"`);
    taken.add(f.id);
    if ((f.type === 'select' || f.type === 'multiselect') && !(f.options && f.options.length > 0)) {
      throw new TemplateError(`${who}: field "${f.id}" needs options`);
    }
    if (f.default !== undefined) {
      const problem = validateCustomValue(f, f.default);
      if (problem) throw new TemplateError(`${who}: default of "${f.id}" ${problem}`);
    }
  }
}

/** 부모(내장 또는 이미 해석된 템플릿)에 자식을 병합한다. 확장 규칙을 어기면 TemplateError. */
export function mergeTemplate(child: GuideTemplate, parent: GuideTemplate): GuideTemplate {
  const who = child.ref;
  if (child.meta.extends !== parent.ref) throw new TemplateError(`${who}: extends ${child.meta.extends}, not ${parent.ref}`);
  if (child.meta.type !== parent.meta.type) throw new TemplateError(`${who}: type ${child.meta.type} differs from parent ${parent.meta.type}`);
  const type = child.meta.type;
  const configurable = new Set(configurableFields(type));

  for (const h of child.schema.hide) {
    if (!configurable.has(h)) throw new TemplateError(`${who}: cannot hide "${h}"`);
  }

  const taken = new Set(parent.schema.fields.map((f) => f.id));
  checkFields(child.schema.fields, taken, type, who);
  const allFields = [...parent.schema.fields, ...child.schema.fields];
  const customById = new Map(allFields.map((f) => [f.id, f]));

  // 기본값: 내장 필드는 실제 신 스키마로 검증하고, 사용자 필드는 필드 정의로 검증한다.
  const builtinDefaults: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(child.schema.defaults)) {
    const field = customById.get(key);
    if (field) {
      const problem = validateCustomValue(field, value);
      if (problem) throw new TemplateError(`${who}: default of "${key}" ${problem}`);
    } else if (configurable.has(key)) {
      builtinDefaults[key] = value;
    } else {
      throw new TemplateError(`${who}: unknown default "${key}"`);
    }
  }
  if (Object.keys(builtinDefaults).length > 0) {
    const trial = sceneSchema.safeParse({ ...probe(type), ...builtinDefaults });
    if (!trial.success) throw new TemplateError(`${who}: invalid defaults (${trial.error.issues[0]?.path.join('.') || 'scene'}: ${trial.error.issues[0]?.message})`);
  }

  const seen = new Set(parent.glossary.terms.map((t) => `${t.category}/${t.id}`));
  for (const t of child.glossary.terms) {
    if (seen.has(`${t.category}/${t.id}`)) throw new TemplateError(`${who}: term ${t.category}/${t.id} already exists in ${parent.ref}`);
  }

  const joined = (a: string, b: string, title: string) => (b.trim() ? `${a.trimEnd()}\n\n## ${title} (${who})\n\n${b.trim()}\n` : a);
  return {
    ref: child.ref,
    meta: child.meta,
    schema: {
      version: 1,
      hide: [...new Set([...parent.schema.hide, ...child.schema.hide])],
      defaults: { ...parent.schema.defaults, ...child.schema.defaults },
      fields: allFields,
    },
    glossary: { version: 1, terms: [...parent.glossary.terms, ...child.glossary.terms] },
    rules: joined(parent.rules, child.rules, 'Additional rules'),
    checklist: joined(parent.checklist, child.checklist, 'Additional checks'),
    prompts: {
      generate: child.prompts.generate.trim() ? child.prompts.generate : parent.prompts.generate,
      'analyze-reference': child.prompts['analyze-reference'].trim() ? child.prompts['analyze-reference'] : parent.prompts['analyze-reference'],
      revise: child.prompts.revise.trim() ? child.prompts.revise : parent.prompts.revise,
    },
  };
}

/** 새 신에 템플릿의 기본값(내장 필드 기본값 + 사용자 필드 기본값)을 적용한다. */
export function applyTemplateDefaults(scene: Scene, template: GuideTemplate): Scene {
  const configurable = new Set(configurableFields(scene.type));
  const custom: Record<string, string | number | boolean | string[]> = { ...scene.custom };
  const builtin: Record<string, unknown> = {};
  for (const f of template.schema.fields) if (f.default !== undefined && !(f.id in custom)) custom[f.id] = f.default;
  for (const [k, v] of Object.entries(template.schema.defaults)) {
    if (configurable.has(k)) builtin[k] = v;
    else if (template.schema.fields.some((f) => f.id === k)) custom[k] = v as string;
  }
  return sceneSchema.parse({ ...scene, ...builtin, custom });
}
