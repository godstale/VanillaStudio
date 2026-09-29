import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

export interface DiffViewProps {
  path: string;
  oldText?: string | null;
  newText: string;
}

// Minimal line diff view for tool call cards: removed lines first, then added
// lines. Paths are backend data shown verbatim; only chrome strings use i18n.
export function DiffView({ path, oldText, newText }: DiffViewProps) {
  const { t } = useLanguage();
  const removed = oldText == null ? [] : oldText.split('\n');
  const added = newText.split('\n');
  return (
    <div data-testid="diff-view" className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-2 py-1">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
          {path}
        </span>
        {oldText == null && (
          <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            {t('agentPanel.diff.newFile')}
          </span>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto font-mono text-[11px] leading-5">
        {removed.length > 0 && (
          <div className="border-b border-border px-2 py-1 text-muted-foreground">
            {t('agentPanel.diff.before')}
          </div>
        )}
        {removed.map((line, i) => (
          <div key={`del-${i}`} className="flex gap-2 bg-destructive/10 px-2 text-destructive">
            <span aria-hidden className="select-none opacity-60">−</span>
            <span className="whitespace-pre-wrap break-all">{line || ' '}</span>
          </div>
        ))}
        {added.length > 0 && removed.length > 0 && (
          <div className="border-y border-border px-2 py-1 text-muted-foreground">
            {t('agentPanel.diff.after')}
          </div>
        )}
        {added.map((line, i) => (
          <div
            key={`add-${i}`}
            className={cn(
              'flex gap-2 px-2',
              oldText == null ? '' : 'bg-primary/10 text-primary',
            )}
          >
            <span aria-hidden className="select-none opacity-60">+</span>
            <span className="whitespace-pre-wrap break-all">{line || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DiffView;
