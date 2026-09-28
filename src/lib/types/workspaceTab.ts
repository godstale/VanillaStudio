export type WorkspaceTabType =
  | 'editor'
  | 'image-viewer'
  | 'collection-editor'
  | 'extension-viewer'
  | 'welcome';

export type SidePanelView = 'explorer' | 'collections' | 'extensions' | null;

export interface WorkspaceTab {
  id: string;
  type: WorkspaceTabType;
  title: string;
  meta?: Record<string, unknown>;
  pane?: 'primary' | 'secondary';
}
