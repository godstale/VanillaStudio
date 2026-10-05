import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatArgs, parseArgs } from '@/lib/agents/args';
import { loadAgents, saveAgent, setDefaultAgent, type AgentEntry } from '@/lib/agents/registry';
import { getGlobalDatabase } from '@/lib/db/client';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface Pending {
  entry: AgentEntry;
}

/**
 * 설정 › 에이전트(D-012·D-022): 에이전트는 터미널에서 고정 실행 파일로 실행되고, 여기서는 추가 인자·사용 여부·기본값만 고친다.
 * 인자를 바꾸는 저장은 확인 다이얼로그를 거친다. 에이전트 안의 셸·네트워크 권한은 각 CLI가 관리한다는 점을 화면에 밝힌다(AGENTS.md §7).
 */
export function SettingsAgents() {
  const { t } = useLanguage();
  const [agents, setAgents] = useState<AgentEntry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function reload() {
    const list = await loadAgents(await getGlobalDatabase());
    setAgents(list);
    setDrafts(Object.fromEntries(list.map((a) => [a.id, formatArgs(a.argv.slice(1))])));
  }

  useEffect(() => {
    let cancelled = false;
    getGlobalDatabase()
      .then((db) => loadAgents(db))
      .then((list) => {
        if (cancelled) return;
        setAgents(list);
        setDrafts(Object.fromEntries(list.map((a) => [a.id, formatArgs(a.argv.slice(1))])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const parsed = (a: AgentEntry) => parseArgs(drafts[a.id] ?? '');
  const changed = (a: AgentEntry) => {
    const p = parsed(a);
    return p.ok && JSON.stringify(p.args) !== JSON.stringify(a.argv.slice(1));
  };

  async function run(fn: () => Promise<void>) {
    try {
      await fn();
      await reload();
      setMessage({ kind: 'ok', text: t('settingsAgents.saved') });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function confirmSave() {
    if (!pending) return;
    const { entry } = pending;
    setPending(null);
    await run(async () => saveAgent(await getGlobalDatabase(), entry));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">{t('settingsAgents.title')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('settingsAgents.desc')}</p>
        <p className="mt-2 rounded-md border border-border bg-muted p-2 text-xs">{t('settingsAgents.permissions')}</p>
      </div>

      <ul className="space-y-3" data-testid="agent-list">
        {agents.map((a) => {
          const p = parsed(a);
          return (
            <li key={a.id} className="space-y-2 rounded-md border border-border p-3 text-xs">
              <div className="flex items-center gap-3">
                <b className="text-sm">{a.label}</b>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={a.enabled}
                    onChange={(e) => {
                      // await 뒤에는 제어 컴포넌트가 이미 되돌아가 있으므로 값을 먼저 읽는다.
                      const enabled = e.target.checked;
                      void run(async () => saveAgent(await getGlobalDatabase(), { ...a, enabled, isDefault: enabled ? a.isDefault : false }));
                    }}
                  />
                  {t('settingsAgents.enabled')}
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="default-agent"
                    aria-label={`${a.label} ${t('settingsAgents.default')}`}
                    checked={a.isDefault}
                    disabled={!a.enabled}
                    onChange={() => void run(async () => setDefaultAgent(await getGlobalDatabase(), a.id))}
                  />
                  {t('settingsAgents.default')}
                </label>
                <span className="ml-auto text-muted-foreground">{t('settingsAgents.instruction', { file: a.instructionFile })}</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="rounded bg-muted px-2 py-1.5">{a.argv[0]}</code>
                <Input
                  aria-label={`${a.label} ${t('settingsAgents.args')}`}
                  placeholder={t('settingsAgents.args')}
                  value={drafts[a.id] ?? ''}
                  onChange={(e) => setDrafts({ ...drafts, [a.id]: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!p.ok || !changed(a)}
                  onClick={() => p.ok && setPending({ entry: { ...a, argv: [a.argv[0], ...p.args] } })}
                >
                  {t('settingsAgents.save')}
                </Button>
              </div>
              {!p.ok && (
                <p role="alert" className="text-destructive">
                  {t('settingsAgents.badArgs')}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {message && (
        <p role="status" className={message.kind === 'error' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {message.text}
        </p>
      )}

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settingsAgents.confirmTitle')}</DialogTitle>
            <DialogDescription>{t('settingsAgents.confirmDesc')}</DialogDescription>
          </DialogHeader>
          <code className="block break-all rounded bg-muted p-2 text-xs" data-testid="confirm-command">
            {pending && [pending.entry.argv[0], ...pending.entry.argv.slice(1)].join(' ')}
          </code>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              {t('settingsAgents.cancel')}
            </Button>
            <Button onClick={() => void confirmSave()}>{t('settingsAgents.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SettingsAgents;
