import { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { DesignTokens } from '@/components/design/DesignTokens';
import { checkDesign } from '@/components/design/designChecks';
import { Button } from '@/components/ui/button';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { projectPath } from '@/lib/pipeline/briefFiles';
import { DESIGN_PATH, readOptionalFile } from '@/lib/pipeline/planFiles';
import { cn } from '@/lib/utils';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

// A <textarea> reports newlines as LF. Write back with the file's own line endings so untouched lines stay byte-identical.
const usesCrlf = (text: string) => text.includes('\r\n');
const toLf = (text: string) => text.replace(/\r\n/g, '\n');
const toEol = (text: string, crlf: boolean) => (crlf ? text.replace(/\n/g, '\r\n') : text);

// Design tab: token visualization, raw DESIGN.md editing and check results (F-DSN-04).
export function DesignTab() {
  const { t } = useLanguage();
  const root = useSafeWorkspace()?.workspaceRoot ?? null;

  // `original` is the file as read (with its line endings); `draft` is the LF-normalized editor text.
  const [original, setOriginal] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(root !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    readOptionalFile(root, DESIGN_PATH)
      .then((text) => {
        if (cancelled) return;
        setOriginal(text);
        setDraft(text === null ? '' : toLf(text));
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(t('design.loadFailed', { error: errorMessage(e) }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Reloading on locale change would discard unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root]);

  const dirty = original !== null && draft !== toLf(original);
  const check = useMemo(() => checkDesign(draft), [draft]);

  const save = useCallback(async () => {
    if (!root || original === null) return;
    const contents = toEol(draft, usesCrlf(original));
    setSaving(true);
    try {
      await invoke('write_text_file', {
        path: projectPath(root, DESIGN_PATH),
        contents,
        workspaceRoot: root,
      });
      setOriginal(contents);
      setError(null);
    } catch (e) {
      setError(t('design.saveFailed', { error: errorMessage(e) }));
    } finally {
      setSaving(false);
    }
  }, [root, original, draft, t]);

  if (!root) {
    return (
      <p data-testid="design-no-project" className="p-6 text-sm text-muted-foreground">
        {t('design.noProject')}
      </p>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('design.loading')}
      </div>
    );
  }

  return (
    <div data-testid="design-tab" className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <h2 className="text-base font-semibold">{t('design.title')}</h2>

        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {original === null ? (
          <p data-testid="design-missing" className="text-sm text-muted-foreground">
            {t('design.missing')}
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <DesignTokens design={check.parsed} />
              <section className="space-y-2" data-testid="design-checks">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('design.checks')}
                </h4>
                {check.issues.length === 0 && check.contrastFailures === 0 ? (
                  <p className="flex items-center gap-1 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                    {t('design.checksOk')}
                  </p>
                ) : null}
                {check.issues.length > 0 && (
                  <ul className="space-y-1 text-xs text-destructive" data-testid="design-check-issues">
                    {check.issues.map((issue) => (
                      <li key={issue} className="flex gap-1">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
                {check.contrast.length > 0 && (
                  <table className="w-full text-left text-xs" data-testid="design-contrast">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1 font-medium">{t('design.contrast.pair')}</th>
                        <th className="py-1 font-medium">{t('design.contrast.ratio')}</th>
                        <th className="py-1 font-medium">{t('design.contrast.min')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {check.contrast.map((row) => (
                        <tr key={row.pair} data-testid={`contrast-${row.pair}`} data-ok={row.ok}>
                          <td className="py-1 font-mono">{row.pair}</td>
                          <td className={cn('py-1 font-mono', !row.ok && 'text-destructive')}>
                            {row.ratio}:1 {row.ok ? '' : t('design.contrast.fail')}
                          </td>
                          <td className="py-1 font-mono text-muted-foreground">{row.min}:1</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            </div>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('design.source')}
                </h4>
                <span data-testid="design-save-state" className="text-xs text-muted-foreground">
                  {dirty ? t('design.unsaved') : t('design.saved')}
                </span>
              </div>
              <textarea
                data-testid="design-source"
                aria-label={t('design.source')}
                spellCheck={false}
                rows={28}
                className="w-full rounded-md border border-input bg-transparent p-3 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
                  {saving ? t('design.saving') : t('design.save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!dirty || saving}
                  onClick={() => setDraft(toLf(original))}
                >
                  <RotateCcw />
                  {t('design.revert')}
                </Button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export default DesignTab;
