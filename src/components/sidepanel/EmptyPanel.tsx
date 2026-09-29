import type { SidePanelView } from '@/lib/types/workspaceTab';
import { ACTIVITY_ITEMS } from '@/components/layout/shellRegistry';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export interface EmptyPanelProps {
  view: Exclude<SidePanelView, null>;
}

// Placeholder body for side panels until their features are built.
export function EmptyPanel({ view }: EmptyPanelProps) {
  const { t } = useLanguage();
  const item = ACTIVITY_ITEMS.find((i) => i.view === view);
  return (
    <div
      data-testid={`empty-panel-${view}`}
      className="flex flex-col h-full min-h-0"
    >
      <div className="p-3 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {item ? t(item.labelKey) : view}
      </div>
      <p className="p-3 text-xs text-muted-foreground">
        {t('shell.emptyPanel.desc')}
      </p>
    </div>
  );
}

export default EmptyPanel;
