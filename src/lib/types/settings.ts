import type { WorkspaceTab } from './workspaceTab';
import type { Locale } from '@/lib/i18n/types';
import type { ThemeMode } from '@/lib/context/ThemeContext';

export interface AppSettings {
  id: string;
  openTabs: WorkspaceTab[];
  activeTabId: string | null;
  theme: ThemeMode;
  language: Locale;
  enabledExtensions: string[];
  trustedWorkspaces: string[];
  lastWorkspaceRoot: string | null;
}
