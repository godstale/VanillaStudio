import { useLanguage } from '@/lib/i18n/LanguageContext';
import { buildTimeline, formatSeconds } from '@/lib/pipeline/planView';
import type { Plan } from '@/lib/pipeline/schemas/plan';
import { cn } from '@/lib/utils';

export function TimelineChart({ plan }: { plan: Plan }) {
  const { t } = useLanguage();
  const timeline = buildTimeline(plan);
  if (!timeline) {
    return <p className="text-sm text-muted-foreground">{t('pipeline.plan.noTimeline')}</p>;
  }
  return (
    <div data-testid="plan-timeline" className="space-y-1">
      <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
        <span>0s</span>
        <span>{formatSeconds(timeline.duration)}</span>
      </div>
      {timeline.rows.map((row) => (
        <div key={`${row.kind}:${row.id}`} className="flex items-center gap-2" data-testid={`timeline-row-${row.id}`}>
          <span className="w-32 shrink-0 truncate text-xs" title={row.label}>
            {row.label}
          </span>
          <div className="relative h-5 flex-1 rounded bg-muted">
            {/* Bar geometry is data-driven (percent of total duration). */}
            <div
              className={cn(
                'absolute top-0 h-5 rounded',
                row.kind === 'scene' ? 'bg-primary' : 'bg-accent-foreground/50',
              )}
              style={{ left: `${row.left}%`, width: `${Math.max(row.width, 0.5)}%` }}
              title={`${formatSeconds(row.start)} – ${formatSeconds(row.end)}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
