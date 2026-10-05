import type { Scene, SceneType } from '@/lib/scene/schema';
import type { CustomField, TemplateSchemaFile } from './template';

// 인스펙터 "가이드" 탭의 폼 정의. 원문 29개 섹션이 scene.json의 어느 필드로 가는지(Refactor-Spec-v2 §6.2)도 여기서 드러난다.
// 용어 필드의 `category`는 템플릿 용어집의 카테고리다. 사용자 템플릿은 hide·fields로만 이 정의를 바꾼다(D-031).

export type Widget =
  | 'text' // 한 줄
  | 'longtext' // 여러 줄
  | 'number'
  | 'bool'
  | 'enum' // 고정 선택지(options)
  | 'term-single' // 용어집에서 하나(자유 입력 허용)
  | 'term-multi' // 용어집에서 여러 개(자유 입력 허용)
  | 'string-list' // 자유 문자열 목록(카피 원문 등)
  | 'beats' // 시간 구조 편집기
  | 'steps'; // static 장면 편집기

export interface FormField {
  /** scene.json 안의 점 경로 (예: `visualStyle.mood`). */
  path: string;
  widget: Widget;
  /** term-* 위젯의 용어집 카테고리. */
  category?: string;
  /** enum 위젯의 선택지. */
  options?: readonly string[];
  /** number 위젯의 하한. */
  min?: number;
  /** 값이 null이 될 수 있는 필드(audio.*). */
  nullable?: boolean;
}

export interface FormSection {
  id: string;
  fields: FormField[];
}

const f = (path: string, widget: Widget, extra: Partial<FormField> = {}): FormField => ({ path, widget, ...extra });

const timedSections: FormSection[] = [
  {
    id: 'structure',
    fields: [
      f('duration.seconds', 'number', { min: 0.1 }),
      f('structure', 'enum', { options: ['multi-shot', 'continuous', 'hybrid'] }),
      f('creativeMode', 'term-multi', { category: 'creativeMode' }),
      f('adStructure', 'term-single', { category: 'adStructure' }),
    ],
  },
  { id: 'voice', fields: [f('brandVoice', 'term-multi', { category: 'brandVoice' })] },
  {
    id: 'style',
    fields: ['medium', 'lighting', 'typography', 'density', 'cameraFeeling', 'mood'].map((k) => f(`visualStyle.${k}`, 'text')),
  },
  {
    id: 'vocabulary',
    fields: ['typography', 'object', 'camera', 'material', 'transition'].map((k) => f(`motionVocabulary.${k}`, 'term-multi', { category: k })),
  },
  { id: 'beats', fields: [f('beats', 'beats')] },
  { id: 'copy', fields: [f('copy.textFidelity', 'enum', { options: ['exact', 'adapt'] }), f('copy.items', 'string-list')] },
  {
    id: 'identity',
    fields: [f('identity.product', 'text'), f('identity.character', 'text'), f('identity.mustKeep', 'string-list')],
  },
  { id: 'endCard', fields: [f('endCard.holdSeconds', 'number', { min: 0.7 }), f('endCard.elements', 'string-list')] },
  {
    id: 'audio',
    fields: [f('audio.voiceOver', 'longtext', { nullable: true }), f('audio.soundDesign', 'longtext', { nullable: true }), f('audio.music', 'longtext', { nullable: true })],
  },
  { id: 'constraints', fields: [f('constraints.avoid', 'string-list'), f('constraints.noUnspecifiedElements', 'bool')] },
];

const FORMS: Record<SceneType, FormSection[]> = {
  motion: timedSections,
  '3d': [
    ...timedSections,
    {
      id: 'scene3d',
      fields: [
        f('composition', 'term-single', { category: 'composition' }),
        f('materials', 'term-multi', { category: 'materials' }),
        f('lighting', 'term-single', { category: 'lighting' }),
        f('cameraPath', 'term-single', { category: 'cameraPath' }),
        f('performanceBudget', 'term-single', { category: 'performanceBudget' }),
      ],
    },
  ],
  static: [
    {
      id: 'page',
      fields: [
        f('mode', 'enum', { options: ['scroll', 'steps'] }),
        f('layout', 'term-single', { category: 'layout' }),
        f('sections', 'term-multi', { category: 'sections' }),
        f('breakpoints', 'term-multi', { category: 'breakpoints' }),
        f('accessibility', 'term-multi', { category: 'accessibility' }),
      ],
    },
    { id: 'steps', fields: [f('steps', 'steps')] },
  ],
};

/** 그 타입의 폼 섹션. `schema.hide`에 든 필드는 빠지고, 빈 섹션은 사라진다. */
export function formFor(type: SceneType, schema?: Pick<TemplateSchemaFile, 'hide'>): FormSection[] {
  const hidden = new Set(schema?.hide ?? []);
  return FORMS[type]
    .map((s) => ({ ...s, fields: s.fields.filter((x) => !hidden.has(x.path.split('.')[0])) }))
    .filter((s) => s.fields.length > 0);
}

/** static `mode=scroll`이면 steps 섹션은 의미가 없어 숨긴다(스키마도 steps를 거부한다). */
export function visibleSections(scene: Scene, schema?: Pick<TemplateSchemaFile, 'hide'>): FormSection[] {
  return formFor(scene.type, schema).filter((s) => !(s.id === 'steps' && scene.type === 'static' && scene.mode === 'scroll'));
}

export function getAt(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

/** 점 경로의 값을 바꾼 새 객체(불변). */
export function setAt<T>(obj: T, path: string, value: unknown): T {
  const [head, ...rest] = path.split('.');
  const o = obj as Record<string, unknown>;
  return { ...o, [head]: rest.length ? setAt(o[head] ?? {}, rest.join('.'), value) : value } as T;
}

/** 사용자 템플릿이 더한 필드(`custom[id]`)를 폼 필드로 바꾼다. */
export function customFormFields(fields: readonly CustomField[]): FormField[] {
  return fields.map((c) => {
    const base = { path: `custom.${c.id}` };
    switch (c.type) {
      case 'text':
        return { ...base, widget: 'text' as const };
      case 'longtext':
        return { ...base, widget: 'longtext' as const };
      case 'number':
        return { ...base, widget: 'number' as const };
      case 'boolean':
        return { ...base, widget: 'bool' as const };
      case 'select':
        return { ...base, widget: 'enum' as const, options: (c.options ?? []).map((o) => o.id) };
      case 'multiselect':
        return { ...base, widget: 'string-list' as const, options: (c.options ?? []).map((o) => o.id) };
    }
  });
}

/** 원문 29개 섹션 → 폼 섹션/필드 (Refactor-Spec-v2 §6.2). 매핑이 깨지면 테스트가 잡는다. */
export const SOURCE_SECTION_MAP: Record<number, string[]> = {
  1: ['duration.seconds'],
  2: ['creativeMode'],
  3: ['structure'],
  4: ['adStructure'],
  5: ['brandVoice'],
  6: ['copy.items', 'beats'],
  7: ['copy.items'],
  8: ['constraints.avoid'],
  9: ['visualStyle.medium', 'visualStyle.lighting', 'visualStyle.typography', 'visualStyle.density', 'visualStyle.cameraFeeling', 'visualStyle.mood'],
  10: ['motionVocabulary.typography', 'motionVocabulary.object', 'motionVocabulary.camera', 'motionVocabulary.material', 'motionVocabulary.transition'],
  11: ['beats'],
  12: ['beats'],
  13: ['beats'],
  14: ['motionVocabulary.typography'],
  15: ['copy.textFidelity', 'copy.items'],
  16: ['identity.mustKeep'],
  17: ['identity.product'],
  18: ['identity.character'],
  19: ['visualStyle.medium', 'motionVocabulary.material'],
  20: ['visualStyle.cameraFeeling', 'motionVocabulary.camera'],
  21: ['constraints.avoid', 'constraints.noUnspecifiedElements'],
  22: ['beats', 'duration.seconds'],
  23: ['endCard.holdSeconds', 'endCard.elements'],
  24: ['audio.voiceOver'],
  25: ['audio.soundDesign', 'audio.music'],
  26: [],
  27: [],
  28: [],
  29: [],
};
