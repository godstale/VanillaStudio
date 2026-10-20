import type { WorkspaceTab } from './workspaceTab';
import type { Locale } from '@/lib/i18n/types';
import type { ThemeMode } from '@/lib/context/ThemeContext';

export interface AppSettings {
  id: string;
  openTabs: WorkspaceTab[];
  activeTabId: string | null;
  theme: ThemeMode;
  language: Locale;
  trustedWorkspaces: string[];
  lastWorkspaceRoot: string | null;
  /** 사용자 가이드 템플릿 전역 폴더(D-031). null = 기본 위치. */
  templatesDir: string | null;
  /** 에이전트 실행 시 프롬프트를 터미널에 자동으로 붙여넣는다(실패하면 클립보드 안내). */
  terminalAutoPaste: boolean;
}
