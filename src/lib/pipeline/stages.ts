import type { WorkspaceTabType } from '@/lib/types/workspaceTab';

export const STAGES = ['brief', 'plan', 'prompts', 'build', 'review', 'export'] as const;
export type StageId = (typeof STAGES)[number];

/** draft = 진행 중(기본), approved = 사용자 승인(plan·prompts), done = 완료(그 외 단계). */
export const STAGE_STATUSES = ['draft', 'approved', 'done'] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

/** 사용자 승인 게이트가 있는 단계(상세 기획서 §3.2, §3.3). */
export const APPROVAL_STAGES: readonly StageId[] = ['plan', 'prompts'];

export interface StageState {
  stage: StageId;
  status: StageStatus;
  approvedAt: string | null;
  /** 승인·완료 시 만든 체크포인트(커밋 해시 등). 체크포인트 기능(T3.10) 전에는 null. */
  checkpoint: string | null;
  updatedAt: string | null;
}

export type PipelineStates = Record<StageId, StageState>;

export type StageAvailability = 'locked' | 'open' | 'complete';

/** 단계 → 센터 탭 종류. Build는 별도 탭이 없어 Prompts 탭(태스크 그래프)에서 다룬다. */
export const STAGE_TAB: Record<StageId, WorkspaceTabType> = {
  brief: 'brief',
  plan: 'plan',
  prompts: 'prompts',
  build: 'prompts',
  review: 'review',
  export: 'export',
};

export function isStageId(value: unknown): value is StageId {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value);
}

export function isStageStatus(value: unknown): value is StageStatus {
  return typeof value === 'string' && (STAGE_STATUSES as readonly string[]).includes(value);
}
