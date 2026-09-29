import { Check, Circle, Lock, RotateCcw } from 'lucide-react';
import { useWorkspaceTabs } from '@/lib/context/WorkspaceTabsContext';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { usePipeline } from '@/lib/pipeline/pipelineContextValue';
import { STAGES, STAGE_TAB, type StageId } from '@/lib/pipeline/stages';
import { STAGE_TAB_ITEMS } from '@/components/layout/shellRegistry';
import { cn } from '@/lib/utils';

const TAB_TITLE_KEY = Object.fromEntries(
  STAGE_TAB_ITEMS.map((i) => [i.type, i.titleKey]),
) as Record<string, string>;

// Side panel for the pipeline view: six stages, their status, and shortcuts to each stage tab.
export function PipelinePanel() {
  const { t } = useLanguage();
  const workspace = useSafeWorkspace();
  const { openTab } = useWorkspaceTabs();
  const { states, current, availability, transition } = usePipeline();

  const open = (stage: StageId) => {
    const type = STAGE_TAB[stage];
    openTab({ id: `${type}:main`, type, title: t(TAB_TITLE_KEY[type] ?? type) });
  };

  return (
    <div data-testid="pipeline-panel" className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t('pipeline.panel.title')}
      </div>
      {!workspace?.workspaceRoot ? (
        <p className="p-3 text-xs text-muted-foreground">{t('pipeline.panel.noProject')}</p>
      ) : (
        <ol className="flex-1 overflow-y-auto p-2 space-y-1">
          {STAGES.map((stage) => {
            const avail = availability(stage);
            const status = states[stage].status;
            const isCurrent = current === stage;
            return (
              <li key={stage} data-testid={`pipeline-stage-${stage}`} data-availability={avail}>
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5',
                    isCurrent ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
                    avail === 'locked' && 'text-muted-foreground',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => open(stage)}
                    className="flex flex-1 items-center gap-2 text-left text-sm min-w-0"
                  >
                    {avail === 'complete' ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    ) : avail === 'locked' ? (
                      <Lock className="h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    <span className="truncate">{t(`pipeline.stage.${stage}`)}</span>
                  </button>
                  <span
                    data-testid={`pipeline-status-${stage}`}
                    className="shrink-0 text-[11px] text-muted-foreground"
                  >
                    {avail === 'locked'
                      ? t('pipeline.status.locked')
                      : isCurrent
                        ? t('pipeline.status.current')
                        : t(`pipeline.status.${status}`)}
                  </span>
                  {avail === 'complete' && (
                    <button
                      type="button"
                      title={t('pipeline.panel.reopenHint')}
                      aria-label={`${t('pipeline.panel.reopen')}: ${t(`pipeline.stage.${stage}`)}`}
                      onClick={() => transition(stage, 'draft')}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default PipelinePanel;
