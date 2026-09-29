import { createContext, useContext } from 'react';
import type { TransitionOptions, TransitionResult } from './pipelineModel';
import type { PipelineStates, StageAvailability, StageId, StageStatus } from './stages';

export interface PipelineContextValue {
  states: PipelineStates;
  isLoaded: boolean;
  /** 아직 끝나지 않은 첫 단계(모두 끝났으면 null). */
  current: StageId | null;
  availability: (stage: StageId) => StageAvailability;
  transition: (
    stage: StageId,
    next: StageStatus,
    opts?: Pick<TransitionOptions, 'checkpoint'>,
  ) => TransitionResult;
}

export const PipelineContext = createContext<PipelineContextValue | null>(null);

export function usePipeline(): PipelineContextValue {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error('usePipeline must be used within PipelineProvider');
  return ctx;
}
