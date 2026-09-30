// Project DB persistence for export jobs (T5.2, Technical-Design §8.2).
// Only terminal states and the last progress are stored; live logs stay in memory.
import { getProjectDatabase, type SqlDatabase } from '@/lib/db/client';

export interface ExportJobRow {
  id: string;
  format: string;
  status: string;
  outputPath: string | null;
  startedAt: string | null;
  endedAt: string | null;
  error: string | null;
}

interface ExportJobDbRow {
  id: string;
  format: string;
  status: string;
  output_path: string | null;
  started_at: string | null;
  ended_at: string | null;
  error: string | null;
}

function toRow(r: ExportJobDbRow): ExportJobRow {
  return {
    id: r.id,
    format: r.format,
    status: r.status,
    outputPath: r.output_path,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    error: r.error,
  };
}

/** Read the export history, newest first. */
export async function loadExportJobs(
  workspaceRoot: string,
  db?: SqlDatabase,
): Promise<ExportJobRow[]> {
  const conn = db ?? (await getProjectDatabase(workspaceRoot));
  const rows = await conn.select<ExportJobDbRow[]>(
    'SELECT id, format, status, output_path, started_at, ended_at, error FROM export_jobs ORDER BY started_at DESC',
  );
  return rows.map(toRow);
}

/** Insert or replace one job row (the queue writes every transition). */
export async function saveExportJob(
  workspaceRoot: string,
  row: ExportJobRow,
  db?: SqlDatabase,
): Promise<void> {
  const conn = db ?? (await getProjectDatabase(workspaceRoot));
  await conn.execute(
    `INSERT INTO export_jobs (id, format, status, output_path, started_at, ended_at, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       format = excluded.format,
       status = excluded.status,
       output_path = excluded.output_path,
       started_at = excluded.started_at,
       ended_at = excluded.ended_at,
       error = excluded.error`,
    [row.id, row.format, row.status, row.outputPath, row.startedAt, row.endedAt, row.error],
  );
}
