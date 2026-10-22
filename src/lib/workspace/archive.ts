import { invoke } from '@tauri-apps/api/core';
import { packageErrorKey } from '@/lib/package/api';

// Rust `workspace_archive.rs` 래퍼. 명령 문자열은 없다: 경로만 넘기고 Rust가 검증한다.

export interface ArchiveReport {
  path: string;
  files: number;
  bytes: number;
}

export const ARCHIVE_EXTENSION = 'zip';

export function packWorkspaceZip(workspaceRoot: string, outPath: string): Promise<ArchiveReport> {
  return invoke<ArchiveReport>('pack_workspace_zip', { workspaceRoot, outPath });
}

/** zip 옆에 새 폴더를 만들어 푼다. 결과 `path`가 풀린 워크스페이스 폴더. */
export function unpackWorkspaceZip(zipPath: string): Promise<ArchiveReport> {
  return invoke<ArchiveReport>('unpack_workspace_zip', { zipPath });
}

/** Rust 거부 코드 → i18n 키. `.vsx`와 겹치는 코드는 그쪽 키를 재사용한다. 모르는 코드는 null(원문을 보여 준다). */
export function archiveErrorKey(message: string): string | null {
  const code = message.split(':')[0].trim();
  const own: Record<string, string> = {
    'not-a-workspace': 'archive.err.notWorkspace',
    'not-a-workspace-zip': 'archive.err.notWorkspaceZip',
    'output-must-be-zip': 'archive.err.mustBeZip',
  };
  return own[code] ?? packageErrorKey(message);
}
