// Frontend side of the app-owned export job (T5.2, D-012). The backend runs
// a fixed argv (`node vanilla-export.mjs <job.json>`); this module only
// passes the job id and the job JSON document.
import { Channel, invoke } from '@tauri-apps/api/core';

/** Backend `ExportEvent` (export_commands.rs), camelCase on the wire. */
export type BackendExportEvent =
  | { kind: 'started'; jobId: string; program: string; argv: string[] }
  | { kind: 'progress'; percent: number; step: string; message: string | null }
  | { kind: 'log'; stream: string; line: string }
  | { kind: 'done'; outDir: string; files: string[] };

export interface ExportReport {
  outDir: string;
  files: string[];
}

export interface ExportApi {
  start(
    projectDir: string,
    jobId: string,
    jobJson: string,
    onEvent: (e: BackendExportEvent) => void,
  ): Promise<ExportReport>;
  cancel(jobId: string): Promise<void>;
}

export const tauriExportApi: ExportApi = {
  start(projectDir, jobId, jobJson, onEvent) {
    const channel = new Channel<BackendExportEvent>();
    channel.onmessage = onEvent;
    return invoke<ExportReport>('start_export_job', {
      projectDir,
      jobId,
      jobJson,
      onEvent: channel,
    });
  },
  cancel: (jobId) => invoke<void>('cancel_export_job', { jobId }),
};
