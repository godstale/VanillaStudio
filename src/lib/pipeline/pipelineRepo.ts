import { getProjectDatabase, type SqlDatabase } from '@/lib/db/client';
import { initialStates } from './pipelineModel';
import { isStageId, isStageStatus, type PipelineStates, type StageState } from './stages';

interface PipelineStateRow {
  stage: string;
  status: string;
  approved_at: string | null;
  checkpoint: string | null;
  updated_at: string;
}

/** 프로젝트 DB(`pipeline_state`)에서 단계 상태를 읽는다. 없는 단계는 기본값. */
export async function loadPipelineStates(
  workspaceRoot: string,
  db?: SqlDatabase,
): Promise<PipelineStates> {
  const conn = db ?? (await getProjectDatabase(workspaceRoot));
  const rows = await conn.select<PipelineStateRow[]>(
    'SELECT stage, status, approved_at, checkpoint, updated_at FROM pipeline_state',
  );
  const states = initialStates();
  for (const row of rows) {
    if (!isStageId(row.stage) || !isStageStatus(row.status)) continue;
    states[row.stage] = {
      stage: row.stage,
      status: row.status,
      approvedAt: row.approved_at,
      checkpoint: row.checkpoint,
      updatedAt: row.updated_at,
    };
  }
  return states;
}

export async function savePipelineStates(
  workspaceRoot: string,
  changes: StageState[],
  db?: SqlDatabase,
): Promise<void> {
  if (changes.length === 0) return;
  const conn = db ?? (await getProjectDatabase(workspaceRoot));
  for (const s of changes) {
    await conn.execute(
      `INSERT INTO pipeline_state (stage, status, approved_at, checkpoint, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(stage) DO UPDATE SET
         status = excluded.status,
         approved_at = excluded.approved_at,
         checkpoint = excluded.checkpoint,
         updated_at = excluded.updated_at`,
      [s.stage, s.status, s.approvedAt, s.checkpoint, s.updatedAt ?? new Date().toISOString()],
    );
  }
}
