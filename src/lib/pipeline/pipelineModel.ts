import {
  APPROVAL_STAGES,
  STAGES,
  type PipelineStates,
  type StageAvailability,
  type StageId,
  type StageState,
  type StageStatus,
} from './stages';

export function initialStates(): PipelineStates {
  return Object.fromEntries(
    STAGES.map((stage) => [
      stage,
      { stage, status: 'draft', approvedAt: null, checkpoint: null, updatedAt: null } satisfies StageState,
    ]),
  ) as PipelineStates;
}

export function isComplete(status: StageStatus): boolean {
  return status === 'approved' || status === 'done';
}

/** 이전 단계가 모두 끝나야 열린다. 끝난 단계는 complete. */
export function stageAvailability(states: PipelineStates, stage: StageId): StageAvailability {
  if (isComplete(states[stage].status)) return 'complete';
  const index = STAGES.indexOf(stage);
  const blocked = STAGES.slice(0, index).some((s) => !isComplete(states[s].status));
  return blocked ? 'locked' : 'open';
}

/** 아직 끝나지 않은 첫 단계. 모두 끝났으면 null. */
export function currentStage(states: PipelineStates): StageId | null {
  return STAGES.find((s) => !isComplete(states[s].status)) ?? null;
}

export type TransitionResult =
  | { ok: true; states: PipelineStates }
  | { ok: false; reason: 'locked' | 'not-approvable' | 'not-completable' | 'no-change' };

export interface TransitionOptions {
  now?: string;
  checkpoint?: string | null;
}

/**
 * 단계 상태 전환(순수 함수).
 * - approved: 승인 단계(plan·prompts)만, 열린 단계에서만.
 * - done: 승인 단계가 아닌 단계만, 열린 단계에서만.
 * - draft: 다시 여는 것(수정 요청). 뒤 단계 중 끝난 것은 무효가 되어 draft로 돌아간다.
 */
export function transitionStage(
  states: PipelineStates,
  stage: StageId,
  next: StageStatus,
  opts: TransitionOptions = {},
): TransitionResult {
  const now = opts.now ?? new Date().toISOString();
  const current = states[stage];
  if (current.status === next) return { ok: false, reason: 'no-change' };

  const availability = stageAvailability(states, stage);
  const approval = APPROVAL_STAGES.includes(stage);

  if (next === 'approved' || next === 'done') {
    if (availability !== 'open') return { ok: false, reason: 'locked' };
    if (next === 'approved' && !approval) return { ok: false, reason: 'not-approvable' };
    if (next === 'done' && approval) return { ok: false, reason: 'not-completable' };
    return {
      ok: true,
      states: {
        ...states,
        [stage]: {
          stage,
          status: next,
          approvedAt: next === 'approved' ? now : current.approvedAt,
          checkpoint: opts.checkpoint ?? null,
          updatedAt: now,
        },
      },
    };
  }

  // Reopen: the stage must have been reachable, and finished later stages become stale.
  if (availability === 'locked') return { ok: false, reason: 'locked' };
  const index = STAGES.indexOf(stage);
  const reopened: PipelineStates = { ...states };
  for (const s of STAGES.slice(index)) {
    if (s === stage || isComplete(states[s].status)) {
      reopened[s] = { stage: s, status: 'draft', approvedAt: null, checkpoint: null, updatedAt: now };
    }
  }
  return { ok: true, states: reopened };
}

/** 전환 전후로 달라진 단계만 골라 저장 대상으로 쓴다. */
export function changedStages(before: PipelineStates, after: PipelineStates): StageState[] {
  return STAGES.filter((s) => before[s] !== after[s]).map((s) => after[s]);
}
