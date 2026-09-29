// Export tab root (T5.2): the queue provider scoped to the tab.
import { ExportProvider } from '@/lib/export/ExportContext';
import { ExportPanel } from './ExportPanel';

export function ExportTab() {
  return (
    <ExportProvider>
      <ExportPanel />
    </ExportProvider>
  );
}
