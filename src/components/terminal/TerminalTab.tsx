import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { TerminalView } from './TerminalView';
import { TERMINAL_AGENT_IDS, type TerminalAgentId } from './terminalApi';

type Phase =
  | { kind: 'pick' }
  | { kind: 'running'; agentId: TerminalAgentId; run: number }
  | { kind: 'exited'; agentId: TerminalAgentId; code: number | null }
  | { kind: 'error'; message: string };

/**
 * Terminal fallback tab (F-AGT-04). Only the known agent executables can be launched; starting
 * one is an explicit click, and the CLI's own permission system governs what it may run.
 */
export function TerminalTab() {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>({ kind: 'pick' });
  const [run, setRun] = useState(0);

  const start = (agentId: TerminalAgentId) => {
    setRun((n) => n + 1);
    setPhase({ kind: 'running', agentId, run: run + 1 });
  };

  if (phase.kind === 'running') {
    return (
      <div className="flex flex-col h-full w-full bg-background">
        <TerminalView
          key={phase.run}
          agentId={phase.agentId}
          onExit={(code) => setPhase({ kind: 'exited', agentId: phase.agentId, code })}
          onError={(message) => setPhase({ kind: 'error', message })}
        />
      </div>
    );
  }

  return (
    <div
      data-testid="terminal-picker"
      className="flex flex-col items-center justify-center h-full w-full gap-3 p-6 text-center"
    >
      <h3 className="text-sm font-semibold text-foreground">{t('terminal.title')}</h3>
      {phase.kind === 'exited' && (
        <p role="status" className="text-xs text-muted-foreground">
          {phase.code === null
            ? t('terminal.exited')
            : t('terminal.exitedCode', { code: phase.code })}
        </p>
      )}
      {phase.kind === 'error' && (
        <p role="alert" className="text-xs text-destructive">
          {t('terminal.failed', { error: phase.message })}
        </p>
      )}
      <p className="text-xs text-muted-foreground max-w-md">{t('terminal.desc')}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {TERMINAL_AGENT_IDS.map((id) => (
          <Button key={id} size="sm" variant="outline" onClick={() => start(id)}>
            {t('terminal.start', { agent: t(`project.agent.${id}`) })}
          </Button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground max-w-md">{t('terminal.permissionNote')}</p>
    </div>
  );
}

export default TerminalTab;
