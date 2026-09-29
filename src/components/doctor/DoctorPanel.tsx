import { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { DoctorCheck, DoctorReport } from './types';
import {
  downloadPercent,
  formatMB,
  severityOf,
  summarize,
} from './doctorModel';
import { FfmpegConsentDialog } from './FfmpegConsentDialog';
import type { FfmpegPhase } from './useFfmpegDownload';

interface Props {
  report: DoctorReport | null;
  loading: boolean;
  error: string | null;
  onRecheck: () => void;
  ffmpeg: FfmpegPhase;
  onFfmpegDownload: () => void;
  onFfmpegCancel: () => void;
}

const SEVERITY_STYLE = {
  ok: { Icon: CheckCircle2, cls: 'text-success' },
  warn: { Icon: AlertTriangle, cls: 'text-warning' },
  error: { Icon: XCircle, cls: 'text-destructive' },
} as const;

function FfmpegProgress({ phase }: { phase: FfmpegPhase }) {
  const { t } = useLanguage();
  if (phase.kind === 'idle') return null;
  if (phase.kind === 'error') {
    const key =
      phase.code === 'cancelled'
        ? 'doctor.ffmpeg.cancelled'
        : phase.code === 'already-running'
          ? 'doctor.ffmpeg.alreadyRunning'
          : null;
    return (
      <p className="text-xs text-destructive" data-testid="ffmpeg-error">
        {key ? t(key) : t('doctor.ffmpeg.failed', { error: phase.code })}
      </p>
    );
  }
  if (phase.kind === 'done') {
    return (
      <p className="text-xs text-success" data-testid="ffmpeg-done">
        {phase.result.check.status === 'ok'
          ? t('doctor.ffmpeg.done')
          : t('doctor.ffmpeg.doneNotOk')}
      </p>
    );
  }
  const e = phase.event;
  const percent = downloadPercent(e);
  let label = t('doctor.checking');
  if (e?.stage === 'selected')
    label = t('doctor.ffmpeg.stage.selected', {
      asset: e.asset,
      mb: formatMB(e.bytes),
    });
  else if (e?.stage === 'download')
    label = t('doctor.ffmpeg.stage.download', { percent: percent ?? 0 });
  else if (e?.stage === 'verified') label = t('doctor.ffmpeg.stage.verified');
  else if (e?.stage === 'extracted') label = t('doctor.ffmpeg.stage.extracted');
  return (
    <div className="space-y-1" data-testid="ffmpeg-progress">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
    </div>
  );
}

function CheckRow({
  check,
  ffmpeg,
  onFfmpegAsk,
  onFfmpegCancel,
}: {
  check: DoctorCheck;
  ffmpeg: FfmpegPhase;
  onFfmpegAsk: () => void;
  onFfmpegCancel: () => void;
}) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const { Icon, cls } = SEVERITY_STYLE[severityOf(check)];
  const running = check.id === 'ffmpeg' && ffmpeg.kind === 'running';
  const detailKey = check.detail ? `doctor.detail.${check.detail}` : null;
  const detailText =
    check.detail && detailKey
      ? t(detailKey) !== detailKey
        ? t(detailKey)
        : check.detail
      : null;

  const copy = async () => {
    if (!check.fix_command) return;
    try {
      await navigator.clipboard.writeText(check.fix_command);
      setCopied(true);
    } catch {
      // Clipboard may be unavailable; the command stays visible for manual copy.
    }
  };

  return (
    <li
      className="border border-border rounded-xl p-4 bg-card/40 space-y-2"
      data-testid={`doctor-check-${check.id}`}
      data-status={check.status}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', cls)} />
        <span className="text-sm font-semibold">
          {t(`doctor.check.${check.id}`)}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {check.required ? t('doctor.required') : t('doctor.optional')}
        </span>
        <span className={cn('ml-auto text-xs font-medium', cls)}>
          {t(`doctor.status.${check.status}`)}
        </span>
      </div>
      {(check.version || check.path || detailText) && (
        <p className="text-[11px] text-muted-foreground break-all">
          {check.version && (
            <span>
              {t('doctor.version')}: {check.version}{' '}
            </span>
          )}
          {check.path && (
            <span>
              {t('doctor.path')}: {check.path}{' '}
            </span>
          )}
          {detailText && <span>{detailText}</span>}
        </p>
      )}
      {check.status !== 'ok' && check.fix_key && (
        <div className="rounded-lg bg-muted/50 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground">
            {t('doctor.fixLabel')}
          </p>
          <p className="text-xs" data-testid={`doctor-fix-${check.id}`}>
            {t(`doctor.fix.${check.fix_key}`)}
          </p>
          {check.fix_command && (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background border border-border rounded px-2 py-1 break-all">
                {check.fix_command}
              </code>
              <Button variant="outline" size="sm" onClick={() => void copy()}>
                {copied ? t('doctor.copied') : t('doctor.copy')}
              </Button>
            </div>
          )}
          {check.id === 'ffmpeg' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button size="sm" disabled={running} onClick={onFfmpegAsk}>
                  {t('doctor.ffmpeg.download')}
                </Button>
                {running && (
                  <Button variant="outline" size="sm" onClick={onFfmpegCancel}>
                    {t('doctor.ffmpeg.cancel')}
                  </Button>
                )}
              </div>
              <FfmpegProgress phase={ffmpeg} />
            </div>
          )}
        </div>
      )}
      {check.status === 'ok' && check.id === 'ffmpeg' && (
        <FfmpegProgress phase={ffmpeg} />
      )}
    </li>
  );
}

export function DoctorPanel({
  report,
  loading,
  error,
  onRecheck,
  ffmpeg,
  onFfmpegDownload,
  onFfmpegCancel,
}: Props) {
  const { t } = useLanguage();
  const [consentOpen, setConsentOpen] = useState(false);
  const summary = report ? summarize(report) : null;

  return (
    <div className="space-y-5" data-testid="doctor-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">{t('doctor.title')}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('doctor.desc')}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={onRecheck}
          className="gap-1.5"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          {loading ? t('doctor.checking') : t('doctor.recheck')}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive" data-testid="doctor-error">
          {t('doctor.failed', { error })}
        </p>
      )}

      {report && summary && (
        <>
          <ul className="space-y-1 text-xs" data-testid="doctor-summary">
            {summary.level === 'ok' && (
              <li className="text-success">{t('doctor.summary.ok')}</li>
            )}
            {summary.blocking > 0 && (
              <li className="text-destructive">
                {t('doctor.summary.blocking', { n: summary.blocking })}
              </li>
            )}
            {summary.noAgent && (
              <li className="text-destructive">
                {t('doctor.summary.noAgent')}
              </li>
            )}
            {summary.warnings > 0 && (
              <li className="text-warning">
                {t('doctor.summary.warnings', { n: summary.warnings })}
              </li>
            )}
          </ul>
          <ul className="space-y-3">
            {report.checks.map((c) => (
              <CheckRow
                key={c.id}
                check={c}
                ffmpeg={ffmpeg}
                onFfmpegAsk={() => setConsentOpen(true)}
                onFfmpegCancel={onFfmpegCancel}
              />
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            {t('doctor.checkedIn', { ms: report.took_ms })}
          </p>
        </>
      )}

      <FfmpegConsentDialog
        open={consentOpen}
        onCancel={() => setConsentOpen(false)}
        onConfirm={() => {
          setConsentOpen(false);
          onFfmpegDownload();
        }}
      />
    </div>
  );
}
