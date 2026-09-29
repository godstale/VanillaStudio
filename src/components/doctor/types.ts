// Mirrors src-tauri/src/commands/doctor_commands.rs. The report is snake_case (serde default),
// the ffmpeg install events and result are camelCase.

export type CheckStatus =
  'ok' | 'missing' | 'outdated' | 'unsupported' | 'not-logged-in' | 'info';

export interface DoctorCheck {
  id: string;
  required: boolean;
  status: CheckStatus;
  version: string | null;
  path: string | null;
  detail: string | null;
  fix_key: string | null;
  fix_command: string | null;
}

export interface DoctorReport {
  checks: DoctorCheck[];
  any_agent_ok: boolean;
  ready: boolean;
  took_ms: number;
}

export type FfmpegEvent =
  | { stage: 'selected'; asset: string; bytes: number }
  | { stage: 'download'; done: number; total: number }
  | { stage: 'verified'; sha256: string }
  | { stage: 'extracted'; files: string[] };

export interface FfmpegInstallResult {
  record: {
    asset: string;
    sha256: string;
    major: number;
    installedAtUnix: number;
  };
  check: DoctorCheck;
}
