import { invoke } from '@tauri-apps/api/core';

/** D-013 체크포인트 백엔드: git이 있으면 git, 없으면 폴더 스냅샷. */
export type CheckpointBackend = 'git' | 'snapshot';

export interface CheckpointStatus {
  backend: CheckpointBackend;
  gitAvailable: boolean;
  isRepo: boolean;
  head: string | null;
}

export interface CheckpointCommit {
  id: string;
  backend: CheckpointBackend;
}

export interface CheckpointEntry {
  id: string;
  message: string;
  at: string;
}

/** 현재 프로젝트의 체크포인트 상태(git 저장소 여부·HEAD). */
export function checkpointStatus(projectPath: string): Promise<CheckpointStatus> {
  return invoke<CheckpointStatus>('checkpoint_status', { projectPath });
}

/** git init + 초기 커밋(또는 스냅샷 폴더 준비). 승인 흐름 진입 전에 1회. */
export function checkpointInit(projectPath: string): Promise<CheckpointStatus> {
  return invoke<CheckpointStatus>('checkpoint_init', { projectPath });
}

/** 승인·태스크 완료 시 자동 커밋. 변경이 없으면 현재 HEAD를 그대로 돌려준다. */
export function checkpointCommit(projectPath: string, message: string): Promise<CheckpointCommit> {
  return invoke<CheckpointCommit>('checkpoint_commit', { projectPath, message });
}

/** 최신순 체크포인트 목록. 기본 20개, 최대 100개. */
export function checkpointHistory(projectPath: string, limit?: number): Promise<CheckpointEntry[]> {
  return invoke<CheckpointEntry[]>('checkpoint_history', { projectPath, limit });
}

/** 히스토리 목록에 보여 줄 짧은 id. git 해치(40자 hex)만 12자로 줄이고 스냅샷 id는 그대로 둔다. */
export function shortCheckpointId(id: string): string {
  return /^[0-9a-f]{40}$/.test(id) ? id.slice(0, 12) : id;
}
