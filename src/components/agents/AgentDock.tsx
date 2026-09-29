import { useState } from 'react';
import { Bot, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { AgentPanel } from '@/components/agents/AgentPanel';
import { cn } from '@/lib/utils';

// Right dock: collapsible agent conversation column. It owns its open state so
// the layout only has to render it (WorkspaceLayout change stays minimal).
export function AgentDock() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div
        data-testid="agent-dock-collapsed"
        className="flex h-full w-10 shrink-0 flex-col items-center border-l border-border bg-background py-2"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('agentPanel.dockExpand')}
          title={t('agentPanel.dockExpand')}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Bot className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <aside
      data-testid="agent-dock"
      aria-label={t('agentPanel.title')}
      className={cn('flex h-full w-80 shrink-0 flex-col border-l border-border bg-background')}
    >
      <div className="flex items-center gap-1 border-b border-border px-2 py-1">
        <Bot className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('agentPanel.title')}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('agentPanel.dockCollapse')}
          title={t('agentPanel.dockCollapse')}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <AgentPanel />
    </aside>
  );
}

export default AgentDock;
