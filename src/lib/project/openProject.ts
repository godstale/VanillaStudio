import { invoke } from '@tauri-apps/api/core';
import { getProjectDatabase } from '@/lib/db/client';
import * as settingsRepo from '@/lib/db/repositories/settingsRepo';
import type { WorkspaceTab } from '@/lib/types/workspaceTab';

/**
 * 새 프로젝트가 처음 열릴 때 보일 탭을 그 프로젝트 자신의 DB에 저장해 둔다.
 * 탭 컨텍스트는 루트 전환 시 프로젝트 DB에서 복원하므로 다른 프로젝트 탭과 경합하지 않는다.
 */
export async function seedOpenTabs(
  projectRoot: string,
  tabs: WorkspaceTab[],
): Promise<void> {
  try {
    await settingsRepo.updateSettings(
      { openTabs: tabs, activeTabId: tabs[0]?.id ?? null },
      await getProjectDatabase(projectRoot),
    );
  } catch {
    // 저장 실패는 치명적이지 않다: 탭이 안 열릴 뿐 프로젝트는 열린다.
  }
}

/** 열기 전에 폴더가 아직 있는지 확인한다(최근 목록의 항목은 지워졌을 수 있다). */
export async function projectFolderExists(path: string): Promise<boolean> {
  try {
    await invoke('list_dir', { path, workspaceRoot: path });
    return true;
  } catch {
    return false;
  }
}
