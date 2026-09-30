import { useEffect, useRef, useState } from 'react';
import { Bot, Plus, Send, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { resolveAgentAccess } from '@/lib/project/access';
import { defaultAgent, type MessageBlock } from '@/lib/agents/session';
import { useAgentSession } from '@/lib/agents/sessionContextValue';
import { describeSessionError } from '@/lib/agents/sessionErrors';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';
import { ToolCallCard } from '@/components/agents/ToolCallCard';

function BlockView({ block }: { block: MessageBlock }) {
  const { t } = useLanguage();
  switch (block.kind) {
    case 'text': {
      if (block.role === 'thought') {
        return (
          <details className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
            <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
              {t('agentPanel.thought')}
            </summary>
            <p className="whitespace-pre-wrap break-words pt-1 text-xs text-muted-foreground">
              {block.text}
            </p>
          </details>
        );
      }
      const isUser = block.role === 'user';
      return (
        <div
          className={cn(
            'whitespace-pre-wrap break-words rounded-md px-2.5 py-1.5 text-xs leading-5',
            isUser ? 'bg-primary/10' : 'bg-muted',
          )}
        >
          {block.text}
        </div>
      );
    }
    case 'tool_call':
      return <ToolCallCard block={block} />;
    case 'plan':
      return (
        <div className="rounded-md border border-border px-2.5 py-1.5">
          <div className="pb-1 text-[11px] font-medium text-muted-foreground">
            {t('agentPanel.plan')}
          </div>
          <ul className="space-y-0.5 text-xs">
            {block.entries.map((entry, i) => (
              <li key={i} className="flex gap-1.5">
                <span aria-hidden className="text-muted-foreground">·</span>
                <span className="min-w-0 flex-1 break-words">{entry.content}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case 'notice':
      return (
        <div
          className={cn(
            'rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs',
            block.tone === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {block.text}
        </div>
      );
  }
}

// Right-dock conversation panel: session picker + start, streaming message
// list with tool call cards and diffs, prompt input with stop, usage footer.
export function AgentPanel() {
  const { t } = useLanguage();
  const workspace = useSafeWorkspace();
  const access = resolveAgentAccess({
    workspaceRoot: workspace?.workspaceRoot ?? null,
    isTrusted: workspace?.isTrusted ?? false,
  });
  const {
    store,
    agents,
    active,
    startSession,
    sendPrompt,
    cancel,
    closeSession,
    selectSession,
    lastError,
  } = useAgentSession();
  const enabledAgents = agents.filter((a) => a.enabled);
  const [agentId, setAgentId] = useState<string>(() => defaultAgent(agents).id);
  const [draft, setDraft] = useState('');
  const [starting, setStarting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const blockCount = active?.blocks.length ?? 0;
  const activeId = active?.sessionId ?? null;
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [blockCount, activeId]);

  const selected = enabledAgents.find((a) => a.id === agentId) ?? defaultAgent(agents);
  const errorText = describeSessionError(t, lastError ?? active?.error ?? null);
  const busy = active?.status === 'busy';
  const closed = active?.status === 'closed';

  const handleStart = async () => {
    if (!access.allowed || starting || selected.mode !== 'acp') return;
    setStarting(true);
    try {
      await startSession(selected.id);
    } catch {
      // The failure is already in lastError; keep the panel usable.
    } finally {
      setStarting(false);
    }
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !active || busy || closed || !access.allowed) return;
    setDraft('');
    try {
      await sendPrompt(text, active.sessionId);
    } catch {
      setDraft(text);
    }
  };

  return (
    <div data-testid="agent-panel" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1.5 border-b border-border p-2">
        <Bot className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <select
          aria-label={t('agentPanel.sessions')}
          value={selected.id}
          onChange={(e) => setAgentId(e.target.value)}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5 text-xs"
        >
          {enabledAgents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          onClick={handleStart}
          disabled={!access.allowed || starting || selected.mode !== 'acp'}
          title={t('agentPanel.newSession')}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {starting ? t('agentPanel.starting') : t('agentPanel.start')}
        </Button>
      </div>

      {!access.allowed && (
        <p className="border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          {access.reason === 'no-project' ? t('agentPanel.noProject') : t('agentPanel.untrusted')}
        </p>
      )}
      {selected.mode !== 'acp' && access.allowed && (
        <p className="border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground">
          {t('agentPanel.terminalMode')}
        </p>
      )}

      {store.order.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-2 py-1">
          {store.order.map((id) => (
            <button
              key={id}
              type="button"
              data-testid={`agent-session-tab-${id}`}
              onClick={() => selectSession(id)}
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]',
                id === activeId
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {id.slice(0, 8)}
            </button>
          ))}
        </div>
      )}

      {errorText && (
        <p role="alert" className="border-b border-border px-3 py-1.5 text-[11px] text-destructive">
          {t('agentPanel.error')}: {errorText}
        </p>
      )}

      {!active ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 p-4 text-center">
          <Bot className="h-8 w-8 text-muted-foreground/40" aria-hidden />
          <p className="text-xs font-medium">{t('agentPanel.noSessionTitle')}</p>
          <p className="text-[11px] text-muted-foreground">{t('agentPanel.noSessionDesc')}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-1">
            <span
              data-testid="agent-session-status"
              className={cn(
                'text-[11px]',
                busy ? 'font-medium text-primary' : 'text-muted-foreground',
              )}
            >
              {t(`agentPanel.status.${active.status}`)}
            </span>
            {active.streaming && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" aria-hidden />
            )}
            <span className="min-w-0 flex-1" />
            <button
              type="button"
              onClick={() => void closeSession(active.sessionId)}
              aria-label={t('agentPanel.closeSession')}
              title={t('agentPanel.closeSession')}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-2">
            {active.blocks.map((block) => (
              <BlockView key={block.id} block={block} />
            ))}
          </div>
          <div className="border-t border-border p-2">
            {active.stopReason === 'cancelled' && !busy && (
              <p className="pb-1 text-[11px] text-muted-foreground">
                {t('agentPanel.cancelledNotice')}
              </p>
            )}
            {active.usage && (
              <p className="pb-1 text-[10px] text-muted-foreground">
                {t('agentPanel.usage', { used: active.usage.used, size: active.usage.size })}
              </p>
            )}
            {busy ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                data-testid="agent-stop"
                onClick={() => void cancel(active.sessionId)}
              >
                <Square className="h-3.5 w-3.5" aria-hidden />
                {t('agentPanel.stop')}
              </Button>
            ) : (
              <form
                data-testid="agent-prompt-form"
                className="flex gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSend();
                }}
              >
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('agentPanel.inputPlaceholder')}
                  disabled={closed || !access.allowed}
                  aria-label={t('agentPanel.inputPlaceholder')}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!draft.trim() || closed || !access.allowed}
                  aria-label={t('agentPanel.send')}
                >
                  <Send className="h-4 w-4" aria-hidden />
                </Button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AgentPanel;
