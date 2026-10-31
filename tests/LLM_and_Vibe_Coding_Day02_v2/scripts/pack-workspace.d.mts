export interface WorkspaceFileEntry {
  abs: string;
  rel: string;
  mtimeMs?: number;
}
export interface ZipEntryInput extends WorkspaceFileEntry {
  mtimeMs: number;
}
export interface ZipReport {
  files: number;
  bytes: number;
}
export function ensureReleaseAgePolicy(root?: string): boolean;
export function collectWorkspaceFiles(root?: string, outAbs?: string | null): WorkspaceFileEntry[];
export function resolveProjectName(root?: string): string;
export function writeZip(entries: ZipEntryInput[], outAbs: string): ZipReport;
