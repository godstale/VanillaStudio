import type { DoctorCheck, DoctorReport, FfmpegEvent } from './types';

export type Severity = 'ok' | 'warn' | 'error';

/** Checks that need the user to act: anything not ok, except purely informational ones. */
export function needsFix(check: DoctorCheck): boolean {
  return check.status !== 'ok' && check.fix_key !== null;
}

export function severityOf(check: DoctorCheck): Severity {
  if (check.status === 'ok') return 'ok';
  if (check.status === 'info' && check.fix_key === null) return 'ok';
  return check.required ? 'error' : 'warn';
}

export interface DoctorSummary {
  /** Required checks that are not ok. */
  blocking: number;
  /** Optional checks that are not ok. */
  warnings: number;
  /** D-005: at least one agent CLI must work. */
  noAgent: boolean;
  level: Severity;
}

export function summarize(report: DoctorReport): DoctorSummary {
  let blocking = 0;
  let warnings = 0;
  for (const c of report.checks) {
    const s = severityOf(c);
    if (s === 'error') blocking += 1;
    else if (s === 'warn') warnings += 1;
  }
  const noAgent = !report.any_agent_ok;
  const level: Severity =
    blocking > 0 || noAgent ? 'error' : warnings > 0 ? 'warn' : 'ok';
  return { blocking, warnings, noAgent, level };
}

/** 0-100 for the download bar, or null while the size is unknown. */
export function downloadPercent(e: FfmpegEvent | null): number | null {
  if (!e) return null;
  if (e.stage === 'download') {
    return e.total > 0
      ? Math.min(100, Math.floor((e.done / e.total) * 100))
      : null;
  }
  return e.stage === 'selected' ? 0 : 100;
}

export function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}
