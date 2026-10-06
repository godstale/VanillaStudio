import { z } from 'zod';
import { projectPath, readOptionalFile } from '@/lib/workspace/files';
import { invoke } from '@tauri-apps/api/core';
import { clampDuration, customTransitionName, DEFAULT_EASING, safeEasing, type TransitionPlan, type TransitionSpec } from './index';

// 선언형 사용자 전환(T6.4, PoC R-1 결정). 에이전트가 `transitions/<name>.json`을 쓰고, 앱은 검증한 키프레임만 재생한다.
// 에이전트가 쓴 코드를 권한 있는 앱 origin(호스트)에서 실행하지 않는다(AGENTS.md §7: 외부 콘텐츠는 신뢰할 수 없는 데이터).

export const TRANSITIONS_DIR = 'transitions';
export const customTransitionPath = (name: string): string => `${TRANSITIONS_DIR}/${name}.json`;

/** 키프레임에 쓸 수 있는 CSS 속성. 합성만 바꾸는 속성으로 한정한다(레이아웃·로딩을 일으키는 속성 제외). */
export const ALLOWED_PROPERTIES = ['opacity', 'transform', 'clipPath', 'filter', 'offset'] as const;

const VALUE_MAX = 200;
// 값은 짧은 CSS 함수 표현식만. `url()`·`;`·`{}`·`\`·주석을 막아 다른 속성/규칙 주입과 외부 요청을 차단한다.
const safeValue = z
  .union([z.string(), z.number()])
  .refine((v) => typeof v === 'number' || (v.length <= VALUE_MAX && !/url\s*\(|[;{}\\]|\/\*|expression\s*\(|@import/i.test(v)), 'unsafe CSS value');

const keyframeSchema = z
  .object({
    opacity: safeValue.optional(),
    transform: safeValue.optional(),
    clipPath: safeValue.optional(),
    filter: safeValue.optional(),
    /** 0..1. 생략하면 균등 분포. */
    offset: z.number().min(0).max(1).optional(),
  })
  .strict()
  .refine((k) => Object.keys(k).some((p) => p !== 'offset'), 'a keyframe needs at least one property');

const keyframes = z.array(keyframeSchema).min(2).max(12);

export const customTransitionSchema = z
  .object({
    version: z.literal(1),
    name: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/),
    description: z.string().max(500).default(''),
    /** 나가는 신에 건다. */
    from: keyframes,
    /** 들어오는 신에 건다(선택). */
    to: keyframes.optional(),
    durationMs: z.number().int().min(1).max(5000).default(600),
    easing: z.string().default(DEFAULT_EASING),
  })
  .strict();

export type CustomTransition = z.infer<typeof customTransitionSchema>;

export function parseCustomTransition(text: string): CustomTransition {
  return customTransitionSchema.parse(JSON.parse(text));
}

/**
 * 엣지의 전환(`custom:<name>`)을 계획으로 바꾼다. 엣지의 `durationMs`·`easing`이 정의의 기본값보다 우선한다.
 * 이름이 맞지 않으면 null.
 */
export function planCustom(def: CustomTransition, spec: TransitionSpec): TransitionPlan | null {
  if (customTransitionName(spec.type) !== def.name) return null;
  return {
    durationMs: clampDuration(spec.durationMs > 0 ? spec.durationMs : def.durationMs),
    easing: safeEasing(spec.easing || def.easing),
    from: def.from as Keyframe[],
    to: (def.to as Keyframe[] | undefined) ?? null,
  };
}

export interface LoadedCustomTransitions {
  defs: Map<string, CustomTransition>;
  /** 읽거나 검증하지 못한 파일 → 이유. 있어도 나머지는 쓴다. */
  errors: Map<string, string>;
}

interface DirEntry {
  name: string;
  is_dir: boolean;
}

/** 워크스페이스 `transitions/*.json`을 읽어 검증한다. 폴더가 없으면 빈 결과. 파일 이름과 `name`이 다르면 거부한다. */
export async function loadCustomTransitions(root: string): Promise<LoadedCustomTransitions> {
  const out: LoadedCustomTransitions = { defs: new Map(), errors: new Map() };
  let entries: DirEntry[];
  try {
    entries = await invoke<DirEntry[]>('list_dir', { path: projectPath(root, TRANSITIONS_DIR), workspaceRoot: root });
  } catch {
    return out;
  }
  for (const e of entries.filter((x) => !x.is_dir && x.name.endsWith('.json')).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = e.name.slice(0, -'.json'.length);
    try {
      const text = await readOptionalFile(root, customTransitionPath(file));
      if (text === null) continue;
      const def = parseCustomTransition(text);
      if (def.name !== file) throw new Error(`name "${def.name}" must match the file name "${file}"`);
      out.defs.set(def.name, def);
    } catch (err) {
      out.errors.set(e.name, err instanceof z.ZodError ? err.issues.slice(0, 3).map((i) => `${i.path.join('.') || 'file'}: ${i.message}`).join('; ') : err instanceof Error ? err.message : String(err));
    }
  }
  return out;
}

/** 샘플: 가운데에서 닫히는 세로 와이프 + 약간의 블러. 에이전트가 같은 형식으로 쓰도록 문서·테스트에서 쓴다. */
export const SAMPLE_CUSTOM_TRANSITION: CustomTransition = {
  version: 1,
  name: 'iris-blur',
  description: 'Outgoing scene closes toward the center while blurring.',
  from: [{ clipPath: 'inset(0 0 0 0)', filter: 'blur(0px)' }, { clipPath: 'inset(50% 50% 50% 50%)', filter: 'blur(12px)' }],
  durationMs: 700,
  easing: 'ease-in-out',
};
