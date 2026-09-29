import type { SidePanelView } from '@/lib/types/workspaceTab';
import { FileTree } from '@/components/explorer/FileTree';
import { EmptyPanel } from '@/components/sidepanel/EmptyPanel';

export interface SidePanelProps {
  activeView: SidePanelView;
}

// Thin router: renders one panel per active view.
// To add a panel, add a SidePanelView variant, an ActivityBar item,
// and a case here.
export function SidePanel({ activeView }: SidePanelProps) {
  if (!activeView) {
    return null;
  }

  switch (activeView) {
    case 'explorer':
      return <FileTree />;
    case 'pipeline':
    case 'agent':
    case 'templates':
    case 'playground':
      return <EmptyPanel view={activeView} />;
    default:
      return null;
  }
}

export default SidePanel;
