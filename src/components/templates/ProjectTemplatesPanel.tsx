import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { getStyle } from '@/lib/styles/library';
import { readStoryboard } from '@/lib/storyboard/files';
import { applyProjectTemplate, PROJECT_TEMPLATES, projectTemplateRef, type ProjectTemplate } from '@/lib/projectTemplates/catalog';

/** 프로젝트 전체 뼈대를 고르는 패널. 적용은 storyboard 문서만 쓰고, 신은 에이전트가 슬롯에서 만든다. */
export function ProjectTemplatesPanel({ workspaceRoot }: { workspaceRoot: string | null }) {
  const { t, locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'ko';
  const [current, setCurrent] = useState<string | null>(null);
  const [target, setTarget] = useState<ProjectTemplate | null>(null);

  useEffect(() => {
    if (!workspaceRoot) return;
    let cancelled = false;
    readStoryboard(workspaceRoot)
      .then(({ file }) => {
        if (!cancelled) setCurrent(file?.visualDirection.projectTemplate ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot]);

  return (
    <section aria-label={t('tpl.section.templates')}>
      <p className="mb-2 text-xs text-muted-foreground">{t('tpl.project.hint')}</p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROJECT_TEMPLATES.map((tpl) => (
          <li key={tpl.id} className="flex flex-col rounded-lg border border-border bg-card p-3 shadow-sm" data-testid="project-template-card">
            <div className="flex items-center gap-2">
              <b className="min-w-0 flex-1 truncate">{tpl.label[lang]}</b>
              {current === projectTemplateRef(tpl) && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{t('tpl.project.current')}</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{t(`tpl.intent.${tpl.mediaIntent}`)}</span>
              <span className="rounded bg-muted px-1.5 py-0.5">{t('tpl.project.slots', { count: tpl.slots.length })}</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">{tpl.summary[lang]}</p>
            <ol className="mt-2 flex-1 space-y-1 text-[11px]">
              {tpl.slots.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-1">
                  <span className="font-medium">{s.role}</span>
                  <span className="text-muted-foreground">{t(`scene.type.${s.sceneType}`)}</span>
                  {s.styles.map((x) => (
                    <span key={x.id} className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                      {getStyle(x.id)?.label[lang] ?? x.id}
                    </span>
                  ))}
                </li>
              ))}
            </ol>
            <Button size="sm" className="mt-3" onClick={() => setTarget(tpl)}>
              {t('tpl.apply')}
            </Button>
          </li>
        ))}
      </ul>
      {target && (
        <ApplyProjectDialog
          template={target}
          workspaceRoot={workspaceRoot}
          replaces={current && current !== projectTemplateRef(target) ? current : null}
          onApplied={() => setCurrent(projectTemplateRef(target))}
          onClose={() => setTarget(null)}
        />
      )}
    </section>
  );
}

function ApplyProjectDialog({
  template,
  workspaceRoot,
  replaces,
  onApplied,
  onClose,
}: {
  template: ProjectTemplate;
  workspaceRoot: string | null;
  replaces: string | null;
  onApplied: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useLanguage();
  const name = template.label[locale === 'en' ? 'en' : 'ko'];
  const [palette, setPalette] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const confirm = async () => {
    if (!workspaceRoot) return;
    setBusy(true);
    setStatus(null);
    try {
      await applyProjectTemplate(workspaceRoot, template, { palette });
      onApplied();
      setStatus({ kind: 'ok', text: t('tpl.project.done') });
    } catch (e) {
      setStatus({ kind: 'error', text: t('tpl.applyFailed', { error: e instanceof Error ? e.message : String(e) }) });
    } finally {
      setBusy(false);
    }
  };

  const title = t('tpl.project.applyTitle', { name });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        data-testid="project-template-dialog"
        className="w-96 max-w-[90vw] rounded-lg border border-border bg-card p-4 text-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">{title}</h2>
        {!workspaceRoot ? (
          <p className="mt-2 text-xs text-muted-foreground">{t('tpl.noWorkspace')}</p>
        ) : (
          <div className="mt-2 space-y-2 text-xs text-muted-foreground">
            <p>{t('tpl.project.applyHint')}</p>
            {replaces && <p className="text-warning">{t('tpl.project.replaces', { ref: replaces })}</p>}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={palette} onChange={(e) => setPalette(e.target.checked)} className="h-3.5 w-3.5" />
              {t('tpl.alsoApplyPalette', { palette: template.paletteId })}
            </label>
          </div>
        )}
        {status && (
          <p role={status.kind === 'error' ? 'alert' : 'status'} className={status.kind === 'error' ? 'mt-2 text-xs text-destructive' : 'mt-2 text-xs text-muted-foreground'}>
            {status.text}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            {t('templates.cancel')}
          </Button>
          {workspaceRoot && (
            <Button size="sm" disabled={busy} onClick={() => void confirm()}>
              {t('tpl.applyConfirm')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
