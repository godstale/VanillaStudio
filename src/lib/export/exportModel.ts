// Pure helpers for the export queue (T5.2): DB row mapping and id factory.
import type { ExportJobRow } from './exportRepo';
import { newJobRecord, type ExportJobRecord, type ExportJobStatus, type ExportKind } from './types';

export function isExportKind(value: string): value is ExportKind {
  return value === 'web' || value === 'interactive' || value === 'image' || value === 'slides' || value === 'video';
}

const STATUSES: readonly string[] = ['queued', 'running', 'done', 'failed', 'cancelled'];

function isJobStatus(value: string): value is ExportJobStatus {
  return STATUSES.includes(value);
}

export function rowToRecord(row: ExportJobRow): ExportJobRecord | null {
  if (!isExportKind(row.format) || !isJobStatus(row.status)) return null;
  // A run that never finished (app quit mid-export) goes back to queued.
  const resumed = row.status === 'running' ? 'queued' : row.status;
  return {
    ...newJobRecord(row.id, row.format, row.format),
    status: resumed,
    percent: resumed === 'done' ? 100 : 0,
    files: [],
    outDir: row.outputPath,
    error: row.error,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
  };
}

export function toRow(job: ExportJobRecord): ExportJobRow {
  return {
    id: job.id,
    format: job.kind,
    status: job.status,
    outputPath: job.outDir,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    error: job.error,
  };
}

export function defaultId(): string {
  const uuid = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  return typeof uuid === 'function' ? uuid() : `job-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
