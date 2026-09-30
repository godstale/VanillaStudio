export type WorkspaceTabType =
  | 'editor'
  | 'image-viewer'
  | 'welcome'
  | 'brief'
  | 'plan'
  | 'prompts'
  | 'design'
  | 'review'
  | 'export'
  | 'palette'
  | 'playground-item'
  | 'terminal';

export type SidePanelView =
  | 'pipeline'
  | 'explorer'
  | 'agent'
  | 'templates'
  | 'playground'
  | null;

export interface WorkspaceTab {
  id: string;
  type: WorkspaceTabType;
  title: string;
  meta?: Record<string, unknown>;
  pane?: 'primary' | 'secondary';
}
