import {
  Bot,
  ClipboardList,
  FileOutput,
  FileText,
  Files,
  FlaskConical,
  LayoutTemplate,
  ListChecks,
  Palette,
  SquareTerminal,
  ScanSearch,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { SidePanelView, WorkspaceTabType } from '@/lib/types/workspaceTab';

export interface ActivityItem {
  view: Exclude<SidePanelView, null>;
  icon: LucideIcon;
  labelKey: string;
}

export type StageTabType = Extract<
  WorkspaceTabType,
  'brief' | 'plan' | 'prompts' | 'design' | 'review' | 'export'
>;

export interface StageTabItem {
  type: StageTabType;
  icon: LucideIcon;
  titleKey: string;
}

// Add an entry here (plus a case in SidePanel.tsx) to add an activity view.
export const ACTIVITY_ITEMS: ActivityItem[] = [
  { view: 'pipeline', icon: Workflow, labelKey: 'shell.view.pipeline' },
  { view: 'explorer', icon: Files, labelKey: 'activityBar.explorer' },
  { view: 'agent', icon: Bot, labelKey: 'shell.view.agent' },
  { view: 'templates', icon: LayoutTemplate, labelKey: 'shell.view.templates' },
  { view: 'playground', icon: FlaskConical, labelKey: 'shell.view.playground' },
];

export const STAGE_TAB_ITEMS: StageTabItem[] = [
  { type: 'brief', icon: FileText, titleKey: 'shell.tab.brief' },
  { type: 'plan', icon: ListChecks, titleKey: 'shell.tab.plan' },
  { type: 'prompts', icon: ClipboardList, titleKey: 'shell.tab.prompts' },
  { type: 'design', icon: Palette, titleKey: 'shell.tab.design' },
  { type: 'review', icon: ScanSearch, titleKey: 'shell.tab.review' },
  { type: 'export', icon: FileOutput, titleKey: 'shell.tab.export' },
];

export const STAGE_TAB_ICONS = Object.fromEntries(
  STAGE_TAB_ITEMS.map(({ type, icon }) => [type, icon]),
) as Record<StageTabType, LucideIcon>;

export const TERMINAL_TAB_ITEM = {
  type: 'terminal',
  icon: SquareTerminal,
  titleKey: 'terminal.title',
} as const;
