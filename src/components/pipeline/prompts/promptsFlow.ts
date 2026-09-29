import { assemblePrompt, type AssembleInput } from '@/lib/pipeline/assemble';
import { parseTasks, type Task } from '@/lib/pipeline/schemas/tasks';
import type { StopReason } from '@/lib/agents/types';
import type { Locale } from '@/lib/i18n/types';

/** Prompts 생성 재요청 상한(T3.6 Plan 흐름과 동일: 최대 2회). */
export const PROMPTS_MAX_RETRIES = 2;

export interface PromptsSnapshot {
  /** null = prompts/tasks.json 없음 */
  tasksJson: string | null;
}

export interface PromptsValidation {
  ok: boolean;
  tasks: Task[] | null;
  /** 실행 순서(id 목록, 위상 정렬). R2·runner와 공유하는 순서다. */
  order: string[];
  errors: string[];
}

/** `prompts/tasks.json` 검증(순수 함수). md 존재 여부는 트리에서 보여주고 여기서 막지 않는다. */
export function validatePromptsArtifacts(snapshot: PromptsSnapshot): PromptsValidation {
  if (snapshot.tasksJson === null) {
    return { ok: false, tasks: null, order: [], errors: ['prompts/tasks.json: file not found'] };
  }
  const parsed = parseTasks(snapshot.tasksJson);
  if (!parsed.ok) {
    return {
      ok: false,
      tasks: null,
      order: [],
      errors: parsed.errors.map((e) => `prompts/tasks.json: ${e}`),
    };
  }
  return { ok: true, tasks: parsed.tasks, order: parsed.order, errors: [] };
}

export interface PromptsRequestInput {
  locale: Locale;
  project?: AssembleInput['project'];
  refs?: string[];
  userInput?: string;
}

/** 최초 Prompts 생성 프롬프트(프리앰블 + 참조 경로 + 출력 언어). */
export function buildPromptsRequest(input: PromptsRequestInput): string {
  return assemblePrompt({ kind: 'prompts', ...input });
}

/** 검증 실패 후 재요청 프롬프트. 오류 목록을 그대로 붙인다. */
export function buildPromptsRetry(input: PromptsRequestInput & { errors: string[] }): string {
  return assemblePrompt({ kind: 'prompts', ...input, errors: input.errors });
}

export interface PromptsFlowDeps {
  /** 에이전트에 프롬프트 전송. useAgentSession().sendPrompt를 그대로 넘긴다. */
  send: (text: string) => Promise<StopReason>;
  load: () => Promise<PromptsSnapshot>;
}

export type PromptsFlowStatus = 'ready' | 'invalid' | 'stopped' | 'send-failed';

export interface PromptsFlowOutcome {
  status: PromptsFlowStatus;
  /** send 호출 횟수(초기 1회 + 재요청). */
  attempts: number;
  errors: string[];
  validation: PromptsValidation | null;
  stopReason: StopReason | null;
  sendError: string | null;
}

/**
 * Prompts 생성 흐름: 요청 → 파일 읽기 → 검증 → 오류 자동 재요청(최대 2회).
 * `send`가 'cancelled'로 끝나면 즉시 중단한다.
 */
export async function runPromptsFlow(
  deps: PromptsFlowDeps,
  input: PromptsRequestInput & { maxRetries?: number },
): Promise<PromptsFlowOutcome> {
  const maxRetries = input.maxRetries ?? PROMPTS_MAX_RETRIES;
  const { locale, project, refs, userInput } = input;
  let attempts = 0;
  let stopReason: StopReason | null = null;

  const once = async (text: string): Promise<PromptsFlowOutcome | null> => {
    attempts += 1;
    let reason: StopReason;
    try {
      reason = await deps.send(text);
    } catch (e) {
      const validation = validatePromptsArtifacts(await deps.load());
      return {
        status: 'send-failed',
        attempts,
        errors: validation.errors,
        validation,
        stopReason: null,
        sendError: e instanceof Error ? e.message : String(e),
      };
    }
    stopReason = reason;
    if (reason === 'cancelled') {
      return {
        status: 'stopped',
        attempts,
        errors: [],
        validation: validatePromptsArtifacts(await deps.load()),
        stopReason,
        sendError: null,
      };
    }
    return null;
  };

  const stopped = await once(buildPromptsRequest({ locale, project, refs, userInput }));
  if (stopped) return stopped;
  let validation = validatePromptsArtifacts(await deps.load());
  let retries = 0;
  while (!validation.ok && retries < maxRetries) {
    retries += 1;
    const retryStopped = await once(
      buildPromptsRetry({ locale, project, refs, userInput, errors: validation.errors }),
    );
    if (retryStopped) return retryStopped;
    validation = validatePromptsArtifacts(await deps.load());
  }
  return {
    status: validation.ok ? 'ready' : 'invalid',
    attempts,
    errors: validation.errors,
    validation,
    stopReason,
    sendError: null,
  };
}
