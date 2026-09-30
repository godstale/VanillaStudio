import type { SidePanelView } from '@/lib/types/workspaceTab';
import { FileTree } from '@/components/explorer/FileTree';
import { PipelinePanel } from '@/components/pipeline/PipelinePanel';
import { PlaygroundPanel } from '@/components/playground/PlaygroundPanel';
import { TemplatesPanel } from '@/components/templates/TemplatesPanel';
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
      return <PipelinePanel />;
    case 'templates':
      return <TemplatesPanel />;
    case 'agent':
      return <EmptyPanel view={activeView} />;
    case 'playground':
      return <PlaygroundPanel />;
    default:
      return null;
  }
}

export default SidePanel;
