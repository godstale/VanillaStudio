import type { SidePanelView } from '@/lib/types/workspaceTab';
import { CollectionListPanel } from '@/components/collections/CollectionListPanel';
import { ExtensionListPanel } from '@/components/extensions/ExtensionListPanel';
import { FileTree } from '@/components/explorer/FileTree';

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
    case 'collections':
      return <CollectionListPanel />;
    case 'extensions':
      return <ExtensionListPanel />;
    case 'explorer':
      return <FileTree />;
    default:
      return null;
  }
}

export default SidePanel;
