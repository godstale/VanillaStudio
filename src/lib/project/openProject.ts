import { invoke } from '@tauri-apps/api/core';
import * as settingsRepo from '@/lib/db/repositories/settingsRepo';
import type { WorkspaceTab } from '@/lib/types/workspaceTab';

/**
 * 프로젝트 루트를 바꾸면 탭 컨텍스트가 저장된 탭을 다시 불러온다.
 * 새 프로젝트에서 열고 싶은 탭을 루트 전환 전에 저장해 두면 경합 없이 그 탭이 열린다.
 */
export async function seedOpenTabs(tabs: WorkspaceTab[]): Promise<void> {
  try {
    await settingsRepo.updateSettings({
      openTabs: tabs,
      activeTabId: tabs[0]?.id ?? null,
    });
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
