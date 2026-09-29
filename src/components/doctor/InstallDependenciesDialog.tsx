import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { INSTALL_DISPLAY_COMMAND, type LogLine } from './installModel';
import type { InstallPhase } from './useInstallDependencies';

interface Props {
  phase: InstallPhase;
  logs: LogLine[];
  onConfirm: () => void;
  onDecline: () => void;
  onCancel: () => void;
}

/** Consent + live log for `pnpm install`. Open whenever the phase is not idle. */
export function InstallDependenciesDialog({
  phase,
  logs,
  onConfirm,
  onDecline,
  onCancel,
}: Props) {
  const { t } = useLanguage();
  const open = phase.kind !== 'idle';
  const finished = phase.kind === 'done' || phase.kind === 'error';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !finished && onDecline()}>
      <DialogContent data-testid="install-dialog">
        <DialogHeader>
          <DialogTitle>{t('doctor.install.title')}</DialogTitle>
          <DialogDescription>
            {phase.kind === 'consent'
              ? phase.reason === 'ask-changed'
                ? t('doctor.install.descChanged')
                : t('doctor.install.desc')
              : t('doctor.install.running')}
          </DialogDescription>
        </DialogHeader>

        {phase.kind === 'consent' && (
          <>
            <code className="block text-xs bg-muted rounded px-2 py-1">
              {INSTALL_DISPLAY_COMMAND}
            </code>
            <p className="text-xs text-muted-foreground">
              {t('doctor.install.scriptsNote')}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={onDecline}>
                {t('doctor.install.decline')}
              </Button>
              <Button onClick={onConfirm}>{t('doctor.install.confirm')}</Button>
            </DialogFooter>
          </>
        )}

        {phase.kind !== 'consent' && (
          <>
            <pre
              className="max-h-64 overflow-auto rounded bg-muted p-2 text-[11px] leading-snug"
              data-testid="install-log"
            >
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={l.stream === 'stderr' ? 'text-warning' : undefined}
                >
                  {l.line}
                </div>
              ))}
            </pre>
            {phase.kind === 'done' && (
              <p
                className={
                  phase.exitCode === 0
                    ? 'text-xs text-success'
                    : 'text-xs text-destructive'
                }
                data-testid="install-result"
              >
                {phase.exitCode === 0
                  ? t('doctor.install.done')
                  : t('doctor.install.exitFailed', {
                      code: phase.exitCode ?? '?',
                    })}
              </p>
            )}
            {phase.kind === 'error' && (
              <p
                className="text-xs text-destructive"
                data-testid="install-result"
              >
                {phase.code === 'cancelled'
                  ? t('doctor.install.cancelled')
                  : t('doctor.install.failed', { error: phase.code })}
              </p>
            )}
            <DialogFooter>
              {phase.kind === 'running' ? (
                <Button variant="outline" onClick={onCancel}>
                  {t('doctor.install.cancel')}
                </Button>
              ) : (
                <Button onClick={onDecline}>{t('doctor.install.close')}</Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
