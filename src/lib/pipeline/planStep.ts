import { assemblePrompt, type AssembleInput } from './assemble';
import { parseDesign } from '@/lib/design/parse';
import { parsePlan, type Plan } from './schemas/plan';
import type { StopReason } from '@/lib/agents/types';
import type { Locale } from '@/lib/i18n/types';

/** Plan 생성 재요청 상한(TODO T3.6 완료 판정: 오류 자동 재요청 최대 2회). */
export const PLAN_MAX_RETRIES = 2;

export interface PlanArtifactSnapshot {
  /** null = plan/plan.json 없음 */
  planJson: string | null;
  /** null = DESIGN.md 없음 */
  designMd: string | null;
  /** null = plan/plan.md 없음 */
  planMd: string | null;
}

export interface PlanValidation {
  ok: boolean;
  plan: Plan | null;
  /** plan.json 오류(에이전트 재요청문에 그대로 붙일 수 있는 형태). */
  planErrors: string[];
  /** DESIGN.md 이슈(파서·토큰 오류). */
  designIssues: string[];
  /** plan.md 누락 등 나머지. */
  docErrors: string[];
  /** 위 셋을 합친 전체 목록. */
  errors: string[];
}

/**
 * plan.json·DESIGN.md·plan.md 검증(순수 함수).
 * 파일이 진실 공급원(AGENTS.md §4.1): 읽은 텍스트를 파싱만 하고 쓰지는 않는다.
 */
export function validatePlanArtifacts(snapshot: PlanArtifactSnapshot): PlanValidation {
  let plan: Plan | null = null;
  let planErrors: string[];
  if (snapshot.planJson === null) {
    planErrors = ['plan/plan.json: file not found'];
  } else {
    const parsed = parsePlan(snapshot.planJson);
    if (parsed.ok) {
      plan = parsed.plan;
      planErrors = [];
    } else {
      planErrors = parsed.errors.map((e) => `plan/plan.json: ${e}`);
    }
  }
  const designIssues: string[] =
    snapshot.designMd === null
      ? ['DESIGN.md: file not found']
      : parseDesign(snapshot.designMd).issues.map((i) => `DESIGN.md: ${i}`);
  const docErrors: string[] =
    snapshot.planMd === null || snapshot.planMd.trim() === '' ? ['plan/plan.md: file not found or empty'] : [];
  const errors = [...planErrors, ...designIssues, ...docErrors];
  return { ok: errors.length === 0, plan, planErrors, designIssues, docErrors, errors };
}

export interface PlanRequestInput {
  locale: Locale;
  project?: AssembleInput['project'];
  refs?: string[];
  userInput?: string;
}

/** 최초 Plan 생성 프롬프트(프리앰블 + 참조 경로 + 출력 언어). */
export function buildPlanRequest(input: PlanRequestInput): string {
  return assemblePrompt({ kind: 'plan', ...input });
}

/** 검증 실패 후 재요청 프롬프트. 오류 목록을 그대로 붙인다(최대 2회, 호출자가 횟수 관리). */
export function buildPlanRetry(input: PlanRequestInput & { errors: string[] }): string {
  return assemblePrompt({ kind: 'plan', ...input, errors: input.errors });
}

export interface PlanFlowDeps {
  /** 에이전트에 프롬프트 전송. useAgentSession().sendPrompt를 그대로 넘긴다. */
  send: (text: string) => Promise<StopReason>;
  /** 파일 감시 대신 폴링: 에이전트가 쓴 세 파일을 읽는다. */
  load: () => Promise<PlanArtifactSnapshot>;
}

export type PlanFlowStatus = 'ready' | 'invalid' | 'stopped' | 'send-failed';

export interface PlanFlowOutcome {
  status: PlanFlowStatus;
  /** send 호출 횟수(초기 1회 + 재요청). */
  attempts: number;
  errors: string[];
  validation: PlanValidation | null;
  stopReason: StopReason | null;
  sendError: string | null;
}

/**
 * Plan 생성 흐름: 요청 → 파일 읽기 → 검증 → 오류 자동 재요청(최대 2회).
 * `send`가 'cancelled'로 끝나면 즉시 중단한다. 그 외 stopReason은 파일 검증 결과로 판정한다.
 */
export async function runPlanFlow(
  deps: PlanFlowDeps,
  input: PlanRequestInput & { maxRetries?: number },
): Promise<PlanFlowOutcome> {
  const maxRetries = input.maxRetries ?? PLAN_MAX_RETRIES;
  const { locale, project, refs, userInput } = input;
  let attempts = 0;
  let stopReason: StopReason | null = null;

  const once = async (text: string): Promise<PlanFlowOutcome | null> => {
    attempts += 1;
    let reason: StopReason;
    try {
      reason = await deps.send(text);
    } catch (e) {
      const snapshot = await deps.load();
      const validation = validatePlanArtifacts(snapshot);
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
      const snapshot = await deps.load();
      return {
        status: 'stopped',
        attempts,
        errors: [],
        validation: validatePlanArtifacts(snapshot),
        stopReason,
        sendError: null,
      };
    }
    return null;
  };

  const stopped = await once(buildPlanRequest({ locale, project, refs, userInput }));
  if (stopped) return stopped;
  let snapshot = await deps.load();
  let validation = validatePlanArtifacts(snapshot);
  let retries = 0;
  while (!validation.ok && retries < maxRetries) {
    retries += 1;
    const retryStopped = await once(buildPlanRetry({ locale, project, refs, userInput, errors: validation.errors }));
    if (retryStopped) return retryStopped;
    snapshot = await deps.load();
    validation = validatePlanArtifacts(snapshot);
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
