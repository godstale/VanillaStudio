import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { TerminalSession } from '@/lib/terminal/sessions';
import { cn } from '@/lib/utils';
import { useTerminals } from './terminalContextValue';

/** 세션의 xterm을 이 호스트에 붙인다. 이미 열린 적이 있으면 DOM만 옮겨서 출력 기록을 그대로 보여 준다. */
function SessionView({ session }: { session: TerminalSession }) {
  const { manager } = useTerminals();
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;
    const term = session.term;
    if (term.element) el.appendChild(term.element);
    else term.open(el);
    term.fit();
    term.focus();
    const observer = new ResizeObserver(() => {
      term.fit();
      manager.resize(session.id, term.cols, term.rows);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [session, manager]);

  return <div ref={host} data-testid={`terminal-host-${session.id}`} className="h-full w-full" />;
}

/** 하단 도크의 터미널: 신별 탭, 세션 재연결, 종료 확인, 에이전트 미설치·미신뢰 안내. */
export function TerminalDock() {
  const { t } = useLanguage();
  const { manager, sessions, activeId, setActiveId, notice, clearNotice } = useTerminals();
  const [closing, setClosing] = useState<TerminalSession | null>(null);

  if (sessions.length === 0) return <p className="p-3 text-xs text-muted-foreground">{t('terminal.dock.empty')}</p>;
  const active = sessions.find((s) => s.id === activeId) ?? sessions[sessions.length - 1];

  async function close(s: TerminalSession, confirmed: boolean) {
    if (!confirmed && (s.status === 'running' || s.status === 'starting')) {
      setClosing(s);
      return;
    }
    setClosing(null);
    await manager.close(s.id);
  }

  return (
    <div className="flex h-full flex-col" data-testid="terminal-dock">
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border p-1">
        {sessions.map((s) => (
          <div key={s.id} className={cn('flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs', s.id === active.id ? 'bg-accent' : 'hover:bg-accent/50')}>
            <button type="button" role="tab" aria-selected={s.id === active.id} onClick={() => setActiveId(s.id)}>
              {s.sceneName} · {s.agentLabel}
              <span className="ml-1 text-muted-foreground">{t(`terminal.status.${s.status}`)}</span>
            </button>
            <button type="button" aria-label={t('terminal.close', { name: s.sceneName })} onClick={() => void close(s, false)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {active.status === 'error' ? (
          <div role="alert" className="space-y-2 p-3 text-xs">
            {active.failure === 'not-installed' && (
              <>
                <p>{t('terminal.notInstalled', { agent: active.agentLabel })}</p>
                <Link className="text-primary underline" to="/settings/doctor">
                  {t('terminal.openDoctor')}
                </Link>
              </>
            )}
            {active.failure === 'untrusted' && <p>{t('terminal.untrusted')}</p>}
            {active.failure !== 'not-installed' && active.failure !== 'untrusted' && <p className="text-destructive">{t('terminal.failed', { error: active.error ?? '' })}</p>}
          </div>
        ) : (
          <SessionView key={active.id} session={active} />
        )}
      </div>

      {notice && (
        <p role="status" data-testid="terminal-notice" className="flex items-center gap-2 border-t border-border bg-muted px-3 py-1 text-[11px]">
          <span className="flex-1">
            {notice.kind === 'copied' && t('terminal.notice.copied', { agent: notice.agent })}
            {notice.kind === 'pasted' && t('terminal.notice.pasted', { agent: notice.agent })}
            {notice.kind === 'paste-failed' && t('terminal.notice.pasteFailed', { agent: notice.agent })}
            {notice.kind === 'copy-failed' && t('terminal.notice.copyFailed')}
          </span>
          <button type="button" aria-label={t('terminal.notice.dismiss')} onClick={clearNotice}>
            <X className="h-3 w-3" />
          </button>
        </p>
      )}

      {active.status === 'exited' && (        <p role="status" className="border-t border-border px-3 py-1 text-[11px] text-muted-foreground">
          {active.exitCode === null ? t('terminal.exited') : t('terminal.exitedCode', { code: active.exitCode })}
        </p>
      )}

      <Dialog open={closing !== null} onOpenChange={(o) => !o && setClosing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('terminal.closeTitle')}</DialogTitle>
            <DialogDescription>{t('terminal.closeDesc', { name: closing?.sceneName ?? '', agent: closing?.agentLabel ?? '' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClosing(null)}>
              {t('terminal.keep')}
            </Button>
            <Button onClick={() => closing && void close(closing, true)}>{t('terminal.stopAndClose')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
