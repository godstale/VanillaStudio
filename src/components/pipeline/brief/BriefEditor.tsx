import { useCallback, useEffect, useMemo, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { CheckCircle2, FilePlus2, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  emptyBrief,
  listToLines,
  serializeBrief,
  validateBrief,
  type Brief,
} from '@/lib/pipeline/brief';
import { importMaterials, listMaterialFiles, loadBrief, saveBrief } from '@/lib/pipeline/briefFiles';
import { usePipeline } from '@/lib/pipeline/pipelineContextValue';
import { cn } from '@/lib/utils';

const fieldClass =
  'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 디스크에는 있는데 brief.md에 기록이 없는 자료 파일을 목록에 채운다(라이선스는 빈 값). */
function withDiskMaterials(brief: Brief, files: string[]): Brief {
  const known = new Set(brief.materials.map((m) => m.file));
  const missing = files.filter((f) => !known.has(f)).map((file) => ({ file, license: '', source: '' }));
  return missing.length > 0 ? { ...brief, materials: [...brief.materials, ...missing] } : brief;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

// Brief stage: structured form + free notes, saved to brief/brief.md, plus material uploads.
export function BriefEditor() {
  const { t } = useLanguage();
  const root = useSafeWorkspace()?.workspaceRoot ?? null;
  const pipeline = usePipeline();

  const [brief, setBrief] = useState<Brief>(emptyBrief);
  const [savedText, setSavedText] = useState(() => serializeBrief(emptyBrief()));
  const [loading, setLoading] = useState(root !== null);
  const [busy, setBusy] = useState<'save' | 'import' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ brief: loaded }, files] = await Promise.all([loadBrief(root), listMaterialFiles(root)]);
        if (cancelled) return;
        const merged = withDiskMaterials(loaded, files);
        setBrief(merged);
        // Disk-only materials count as unsaved so the user can persist their license notes.
        setSavedText(serializeBrief(loaded));
        setError(null);
      } catch (e) {
        if (!cancelled) setError(t('pipeline.brief.loadFailed', { error: errorMessage(e) }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `t` changes with the locale; reloading would discard edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);

  const patch = useCallback((p: Partial<Brief>) => setBrief((b) => ({ ...b, ...p })), []);
  const dirty = useMemo(() => serializeBrief(brief) !== savedText, [brief, savedText]);
  const issues = useMemo(() => validateBrief(brief), [brief]);
  const badColors = new Set(issues.filter((i) => i.field === 'brandColors').map((i) => i.value));
  const purposeMissing = issues.some((i) => i.field === 'purpose');
  const briefState = pipeline.states.brief.status;
  const canComplete = !purposeMissing && badColors.size === 0 && pipeline.availability('brief') === 'open';

  if (!root) {
    return (
      <p data-testid="brief-no-project" className="p-6 text-sm text-muted-foreground">
        {t('pipeline.brief.noProject')}
      </p>
    );
  }

  const save = async (): Promise<boolean> => {
    setBusy('save');
    try {
      await saveBrief(root, brief);
      setSavedText(serializeBrief(brief));
      setError(null);
      return true;
    } catch (e) {
      setError(t('pipeline.brief.saveFailed', { error: errorMessage(e) }));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const complete = async () => {
    if (await save()) pipeline.transition('brief', 'done');
  };

  const addMaterials = async () => {
    setBusy('import');
    try {
      const picked = await openDialog({ multiple: true, directory: false });
      const sources = Array.isArray(picked) ? picked : typeof picked === 'string' ? [picked] : [];
      if (sources.length === 0) return;
      const added = await importMaterials(root, sources);
      setBrief((b) => ({
        ...b,
        materials: [...b.materials, ...added.map((file) => ({ file, license: '', source: '' }))],
      }));
      setError(null);
    } catch (e) {
      setError(t('pipeline.brief.importFailed', { error: errorMessage(e) }));
    } finally {
      setBusy(null);
    }
  };

  const listField = (label: string, key: 'tone' | 'brandFonts' | 'mustInclude' | 'mustAvoid' | 'references') => (
    <Field label={label}>
      <textarea
        data-testid={`brief-${key}`}
        rows={3}
        className={fieldClass}
        value={listToLines(brief[key])}
        // Keep blank lines while typing; they are dropped when the list is saved.
        onChange={(e) => patch({ [key]: e.target.value.split('\n') })}
      />
    </Field>
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('pipeline.brief.loading')}
      </div>
    );
  }

  return (
    <div data-testid="brief-editor" className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-5 p-6">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">{t('pipeline.brief.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('pipeline.brief.desc')}</p>
        </header>

        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Field label={t('pipeline.brief.purpose')} hint={t('pipeline.brief.purposeHint')}>
          <textarea
            data-testid="brief-purpose"
            rows={3}
            className={fieldClass}
            value={brief.purpose}
            onChange={(e) => patch({ purpose: e.target.value })}
          />
        </Field>
        <Field label={t('pipeline.brief.audience')}>
          <Input
            data-testid="brief-audience"
            value={brief.audience}
            onChange={(e) => patch({ audience: e.target.value })}
          />
        </Field>
        <Field label={t('pipeline.brief.keyMessage')}>
          <textarea
            data-testid="brief-keyMessage"
            rows={2}
            className={fieldClass}
            value={brief.keyMessage}
            onChange={(e) => patch({ keyMessage: e.target.value })}
          />
        </Field>
        {listField(t('pipeline.brief.tone'), 'tone')}

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-muted-foreground">{t('pipeline.brief.brandColors')}</legend>
          {brief.brandColors.map((color, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="color"
                aria-label={t('pipeline.brief.brandColors')}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#000000'}
                onChange={(e) =>
                  patch({ brandColors: brief.brandColors.map((c, j) => (j === i ? e.target.value.toUpperCase() : c)) })
                }
              />
              <Input
                data-testid={`brief-color-${i}`}
                aria-invalid={badColors.has(color)}
                className={cn('max-w-40 font-mono', badColors.has(color) && 'border-destructive')}
                value={color}
                onChange={(e) =>
                  patch({ brandColors: brief.brandColors.map((c, j) => (j === i ? e.target.value.trim() : c)) })
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('pipeline.brief.removeColor')}
                onClick={() => patch({ brandColors: brief.brandColors.filter((_, j) => j !== i) })}
              >
                <Trash2 />
              </Button>
              {badColors.has(color) && (
                <span className="text-xs text-destructive">{t('pipeline.brief.colorInvalid')}</span>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => patch({ brandColors: [...brief.brandColors, '#000000'] })}
          >
            <Plus />
            {t('pipeline.brief.addColor')}
          </Button>
        </fieldset>

        {listField(t('pipeline.brief.brandFonts'), 'brandFonts')}
        {listField(t('pipeline.brief.mustInclude'), 'mustInclude')}
        {listField(t('pipeline.brief.mustAvoid'), 'mustAvoid')}
        {listField(t('pipeline.brief.references'), 'references')}

        <Field label={t('pipeline.brief.notes')}>
          <textarea
            data-testid="brief-notes"
            rows={6}
            className={fieldClass}
            value={brief.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </Field>

        <section className="space-y-2" aria-labelledby="brief-materials-title">
          <div className="flex items-center justify-between gap-2">
            <h3 id="brief-materials-title" className="text-sm font-semibold">
              {t('pipeline.brief.materials')}
            </h3>
            <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={addMaterials}>
              <FilePlus2 />
              {t('pipeline.brief.addMaterials')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('pipeline.brief.materialsDesc')}</p>
          {brief.materials.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('pipeline.brief.materialsEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {brief.materials.map((m, i) => (
                <li key={m.file} data-testid={`brief-material-${m.file}`} className="rounded-md border border-border p-2 space-y-2">
                  <div className="truncate font-mono text-xs">{m.file}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      aria-label={`${t('pipeline.brief.license')}: ${m.file}`}
                      placeholder={t('pipeline.brief.license')}
                      value={m.license}
                      onChange={(e) =>
                        patch({ materials: brief.materials.map((x, j) => (j === i ? { ...x, license: e.target.value } : x)) })
                      }
                    />
                    <Input
                      aria-label={`${t('pipeline.brief.source')}: ${m.file}`}
                      placeholder={t('pipeline.brief.source')}
                      value={m.source}
                      onChange={(e) =>
                        patch({ materials: brief.materials.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)) })
                      }
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-border bg-background py-3">
          <Button type="button" disabled={!dirty || busy !== null} onClick={() => void save()}>
            {busy === 'save' ? t('pipeline.brief.saving') : t('pipeline.brief.save')}
          </Button>
          <span data-testid="brief-save-state" className="text-xs text-muted-foreground">
            {dirty ? t('pipeline.brief.unsaved') : t('pipeline.brief.saved')}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {briefState !== 'draft' ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                {t('pipeline.brief.completed')}
              </span>
            ) : (
              <>
                {purposeMissing && (
                  <span className="text-xs text-muted-foreground">{t('pipeline.brief.purposeRequired')}</span>
                )}
                <Button type="button" variant="secondary" disabled={!canComplete || busy !== null} onClick={() => void complete()}>
                  {t('pipeline.brief.complete')}
                </Button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default BriefEditor;
