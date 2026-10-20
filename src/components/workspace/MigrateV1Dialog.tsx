import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { applyV1Migration } from '@/lib/migrate/applyV1';
import { planV1Migration, type MigrationPlan, type V1Bundle } from '@/lib/migrate/v1';
import type { WorkspaceApi } from '@/lib/workspace/api';

export interface MigrateV1DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api: WorkspaceApi;
  /** 변환이 끝난 새 워크스페이스를 연다(신뢰 확인·최근 목록은 호출한 쪽이 처리). */
  onMigrated: (destDir: string) => Promise<void> | void;
}

const messageOf = (e: unknown): string => (typeof e === 'string' ? e : e instanceof Error ? e.message : String(e));

const KIND_TEXT = { archived: 'migrate.kind.archived', partial: 'migrate.kind.partial', dropped: 'migrate.kind.dropped' } as const;

/** v1 프로젝트 → v2 워크스페이스(D-033). 원본은 읽기만 하고 새 빈 폴더에 변환 결과를 만든다. */
export function MigrateV1Dialog({ open: isOpen, onOpenChange, api, onMigrated }: MigrateV1DialogProps) {
  const { t } = useLanguage();
  const [source, setSource] = useState<{ path: string; bundle: V1Bundle } | null>(null);
  const [interactiveAs, setInteractiveAs] = useState<'static' | 'motion'>('static');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planResult = source ? planV1Migration(source.bundle, { interactiveAs }) : null;
  const plan: MigrationPlan | null = planResult?.ok ? planResult.plan : null;
  const isInteractive = source ? /"outputType"\s*:\s*"interactive"/.test(source.bundle.texts['vanilla.json'] ?? '') : false;

  function reset() {
    setSource(null);
    setError(null);
    setInteractiveAs('static');
  }

  async function chooseSource() {
    setError(null);
    const path = await open({ directory: true, multiple: false });
    if (typeof path !== 'string') return;
    setBusy(true);
    try {
      // 읽기 전용 검사: 원본에는 아무것도 쓰지 않는다.
      setSource({ path, bundle: await invoke<V1Bundle>('read_v1_project', { path }) });
    } catch (e) {
      setSource(null);
      setError(messageOf(e) === 'not-a-v1-project' ? t('migrate.err.notV1') : t('migrate.err.other', { error: messageOf(e) }));
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!source || !plan) return;
    setError(null);
    const dest = await open({ directory: true, multiple: false });
    if (typeof dest !== 'string') return;
    setBusy(true);
    try {
      const kind = await api.inspectFolder(dest);
      if (kind.kind !== 'empty') throw new Error(t('migrate.err.destNotEmpty'));
      await applyV1Migration(dest, plan, source.bundle.root, api);
      await onMigrated(dest);
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(t('migrate.err.other', { error: messageOf(e) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg" data-testid="migrate-dialog">
        <DialogHeader>
          <DialogTitle>{t('migrate.title')}</DialogTitle>
          <DialogDescription>{t('migrate.desc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void chooseSource()}>
            {busy && !source && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {t('migrate.choose')}
          </Button>

          {source && planResult && !planResult.ok && (
            <p role="alert" className="text-destructive">
              {t('migrate.err.invalid', { error: planResult.error })}
            </p>
          )}

          {source && plan && (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1" data-testid="migrate-summary">
                <dt className="text-muted-foreground">{t('migrate.name')}</dt>
                <dd>{plan.workspaceName}</dd>
                <dt className="text-muted-foreground">{t('migrate.sceneType')}</dt>
                <dd>{t(`scene.type.${plan.sceneType}`)}</dd>
                <dt className="text-muted-foreground">{t('migrate.canvas')}</dt>
                <dd>
                  {plan.canvas.width}×{plan.canvas.height} @ {plan.canvas.fps}fps
                </dd>
                <dt className="text-muted-foreground">{t('migrate.files')}</dt>
                <dd>{t('migrate.filesValue', { count: Object.keys(plan.sceneFiles).length + Object.keys(plan.workspaceFiles).length + plan.copies.length })}</dd>
              </dl>

              {isInteractive && (
                <fieldset className="space-y-1">
                  <legend className="font-medium">{t('migrate.interactiveAs')}</legend>
                  {(['static', 'motion'] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="radio" name="interactiveAs" checked={interactiveAs === k} onChange={() => setInteractiveAs(k)} />
                      {t(`scene.type.${k}`)}
                    </label>
                  ))}
                </fieldset>
              )}

              {plan.warnings.length > 0 && (
                <ul role="alert" className="list-disc space-y-0.5 pl-5 text-warning">
                  {plan.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}

              <section data-testid="migrate-unconverted" className="space-y-1">
                <p className="flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  {t('migrate.unconverted')}
                </p>
                <ul className="max-h-32 space-y-0.5 overflow-auto pl-1">
                  {plan.unconverted.map((u) => (
                    <li key={u.item}>
                      <b className="break-all">{u.item}</b> <span className="text-muted-foreground">[{t(KIND_TEXT[u.kind])}]</span> {u.detail}
                    </li>
                  ))}
                </ul>
              </section>
              <p className="text-muted-foreground">{t('migrate.nonDestructive')}</p>
            </>
          )}

          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('package.close')}
          </Button>
          <Button disabled={!plan || busy} onClick={() => void run()}>
            {busy && plan && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            {t('migrate.run')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
