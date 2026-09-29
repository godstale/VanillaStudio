// Export job list (T5.2): progress, logs and cancel per job.
// `ExportJobList` is pure (tested); `ExportPanel` connects it to the queue.
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useExport } from '@/lib/export/exportContextValue';
import { isTerminalStatus, type ExportJobRecord } from '@/lib/export/types';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { cn } from '@/lib/utils';

const STATUS_TONE: Record<ExportJobRecord['status'], string> = {
  queued: 'text-muted-foreground',
  running: 'text-primary',
  done: 'text-foreground',
  failed: 'text-destructive',
  cancelled: 'text-muted-foreground',
};

function JobProgress({ job }: { job: ExportJobRecord }) {
  const { t } = useLanguage();
  if (job.status === 'queued') return null;
  return (
    <div className="mt-1.5">
      <div
        role="progressbar"
        aria-valuenow={Math.round(job.percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', job.status === 'failed' ? 'bg-destructive' : 'bg-primary')}
          style={{ width: `${Math.min(100, Math.max(0, job.percent))}%` }}
        />
      </div>
      {job.step && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t('export.job.progress', { percent: Math.round(job.percent), step: job.step })}
        </p>
      )}
    </div>
  );
}

export function ExportJobList({
  jobs,
  onCancel,
}: {
  jobs: ExportJobRecord[];
  onCancel: (id: string) => void;
}) {
  const { t } = useLanguage();
  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({});
  if (jobs.length === 0) {
    return <p className="p-6 text-center text-xs text-muted-foreground">{t('export.panel.empty')}</p>;
  }
  return (
    <ul className="flex flex-col gap-2 p-3">
      {jobs.map((job) => {
        const running = job.status === 'running' || job.status === 'queued';
        return (
          <li key={job.id} className="rounded-md border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              {job.status === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{job.label}</span>
              <span className={cn('shrink-0 text-[11px]', STATUS_TONE[job.status])}>
                {t(`export.status.${job.status}`)}
              </span>
              {running && (
                <Button size="sm" variant="ghost" onClick={() => onCancel(job.id)} aria-label={t('export.job.cancel')}>
                  <X className="h-3.5 w-3.5" />
                  {t('export.job.cancel')}
                </Button>
              )}
            </div>
            <JobProgress job={job} />
            {job.error && (
              <p role="alert" className="mt-1.5 break-all text-[11px] text-destructive">
                {t('export.job.error', { error: job.error })}
              </p>
            )}
            {job.files.length > 0 && (
              <div className="mt-1.5">
                <p className="text-[11px] font-medium text-muted-foreground">{t('export.job.files')}</p>
                <ul className="mt-0.5 flex flex-col gap-0.5">
                  {job.files.map((f) => (
                    <li key={f} className="truncate text-[11px] text-foreground" title={f}>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {job.logs.length > 0 && (
              <div className="mt-1.5">
                <button
                  type="button"
                  className="cursor-pointer text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => setOpenLogs((s) => ({ ...s, [job.id]: !s[job.id] }))}
                  aria-expanded={!!openLogs[job.id]}
                >
                  {t('export.job.logs')} ({job.logs.length})
                </button>
                {openLogs[job.id] && (
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                    {job.logs.map((l, i) => `${l.stream === 'stderr' ? '! ' : ''}${l.line}${i < job.logs.length - 1 ? '\n' : ''}`)}
                  </pre>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ExportPanel() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const { jobs, cancel, clearFinished } = useExport();
  if (!workspaceRoot) {
    return <p className="p-6 text-center text-xs text-muted-foreground">{t('export.panel.noProject')}</p>;
  }
  const hasFinished = jobs.some((j) => isTerminalStatus(j.status));
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-background">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="flex-1 text-xs font-semibold text-foreground">{t('export.panel.title')}</h2>
        {hasFinished && (
          <Button size="sm" variant="ghost" onClick={clearFinished}>
            {t('export.panel.clearFinished')}
          </Button>
        )}
      </div>
      <ExportJobList jobs={jobs} onCancel={cancel} />
    </div>
  );
}
