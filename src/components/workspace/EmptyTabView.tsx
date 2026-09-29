import type { WorkspaceTab } from '@/lib/types/workspaceTab';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export interface EmptyTabViewProps {
  tab: WorkspaceTab;
}

// Placeholder body for pipeline-stage tabs until their views are built.
export function EmptyTabView({ tab }: EmptyTabViewProps) {
  const { t } = useLanguage();
  return (
    <div
      data-testid={`empty-tab-${tab.type}`}
      className="flex flex-col items-center justify-center h-full w-full p-6 text-center text-muted-foreground select-none"
    >
      <h3 className="text-sm font-semibold text-foreground">{tab.title}</h3>
      <p className="text-xs mt-1">{t('shell.emptyView.desc')}</p>
    </div>
  );
}

export default EmptyTabView;
