import type { GuideContext } from './agentsMd';
import { agentWritableFields } from './writeback';
import type { PromptName } from './template';

// 에이전트에게 줄 프롬프트(클립보드·prompts/*.md 공용). 규칙 본문은 복사하지 않고 AGENTS.md·GUIDE.md를 읽게 한다(Refactor-Spec-v2 §7).
// 영문 고정(번역 대상 아님), 출력 언어 지시만 scene.json.brief.language에서 삽입한다.

export interface PromptOptions {
  /** revise: 바뀐 최상위 필드 이름. */
  changedFields?: readonly string[];
}

const LANGUAGE = { ko: 'Korean', en: 'English' } as const;

export function assemblePrompt(kind: PromptName, ctx: GuideContext, opts: PromptOptions = {}): string {
  const { workspace, scene, template } = ctx;
  const lines = [`[workspace: ${workspace.name} / scene: ${scene.name}]`, '', template.prompts[kind].trim(), ''];

  if (kind === 'revise') {
    const changed = opts.changedFields ?? [];
    lines.push(`Changed fields: ${changed.length ? changed.map((f) => `\`${f}\``).join(', ') : '(none reported; diff `scene.json` yourself)'}`, '');
  }
  if (kind !== 'analyze-reference' && scene.userPrompt.trim()) {
    lines.push('User prompt:', scene.userPrompt.trim(), '');
  }
  if (kind === 'analyze-reference') {
    const refs = scene.references.map((r) => `${r.id} (${r.kind}): ${r.path ?? r.url ?? ''}${r.analysis ? ` -> ${r.analysis}` : ''}`);
    lines.push('References:', ...(refs.length ? refs.map((r) => `- ${r}`) : ['- (none)']), '');
  } else {
    lines.push(`Write all on-screen text and user-facing copy in ${LANGUAGE[scene.brief.language]}. Keep direction notes in English.`, '');
    lines.push(`You may change these scene.json fields: ${agentWritableFields(scene.type).join(', ')}.`, '');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export const PROMPT_FILES: Record<PromptName, string> = {
  generate: 'prompts/generate.md',
  'analyze-reference': 'prompts/analyze-reference.md',
  revise: 'prompts/revise.md',
};

/** 사용자 프롬프트 원문 파일. 인스펙터에서 편집한 내용이 그대로 저장되어 에이전트·사용자가 파일로도 읽을 수 있다. */
export const USER_PROMPT_FILE = 'prompts/user-prompt.md';

/** prompts/ 아래에 쓸 생성물 전체. */
export function renderPromptFiles(ctx: GuideContext): Record<string, string> {
  const text = ctx.scene.userPrompt.replace(/\r\n/g, '\n');
  return {
    ...Object.fromEntries((Object.keys(PROMPT_FILES) as PromptName[]).map((k) => [PROMPT_FILES[k], assemblePrompt(k, ctx)])),
    [USER_PROMPT_FILE]: text.trim() ? `${text.trimEnd()}\n` : '',
  };
}
