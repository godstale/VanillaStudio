import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { ColorSwatches } from '@/components/design/DesignSummary';
import { checkDesign } from '@/components/design/designChecks';
import { PaletteLibrary } from '@/components/design/PaletteLibrary';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useBridge } from '@/lib/review/bridgeContextValue';
import {
  applyPalette,
  currentDesignColors,
  loadDesignText,
  resolvePaletteColors,
  type PaletteOption,
} from '@/lib/review/designApply';
import { listProjectPalettes, type PaletteFile } from '@/lib/design/palettes';
import { projectPath } from '@/lib/pipeline/briefFiles';
import { DESIGN_PATH } from '@/lib/pipeline/planFiles';
import { cn } from '@/lib/utils';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

type ApplyState = 'idle' | 'applying' | 'applied' | 'error';

/**
 * Design panel (F-PAL-02, F-PAL-04): current palette swatches, palette switching with
 * instant preview-only reflection through Bridge `setDesign`, contrast warnings, and
 * apply (DESIGN.md `colors` rewrite + prose hex update + checkpoint).
 */
export function DesignPanel({ root, palettes }: { root: string; palettes: PaletteFile[] }) {
  const bridge = useBridge();
  const { t } = useLanguage();
  const [original, setOriginal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [projectPalettes, setProjectPalettes] = useState<PaletteFile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applyState, setApplyState] = useState<ApplyState>('idle');
  const [error, setError] = useState<string | null>(null);
  const bridgeRef = useRef(bridge);
  useEffect(() => {
    bridgeRef.current = bridge;
  }, [bridge]);

  useEffect(() => {
    let cancelled = false;
    loadDesignText(root)
      .then((text) => {
        if (cancelled) return;
        setOriginal(text);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(t('palette.loadFailed', { error: errorMessage(e) }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    listProjectPalettes(root).then((list) => {
      if (!cancelled) setProjectPalettes(list);
    });
    return () => {
      cancelled = true;
    };
    // Reloading on locale change would discard the preview selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, bridge.readyCount]);

  // Built-ins plus project-saved palettes; a project palette with the same id wins.
  const library = useMemo(() => {
    const byId = new Map(palettes.map((p) => [p.id, p]));
    for (const p of projectPalettes) byId.set(p.id, p);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [palettes, projectPalettes]);
  const selected = useMemo(() => library.find((p) => p.id === selectedId) ?? null, [library, selectedId]);
  const previewColors = useMemo(() => (selected ? resolvePaletteColors(selected.colors) : null), [selected]);
  const check = useMemo(() => checkDesign(original ?? ''), [original]);

  const select = useCallback(
    (p: PaletteOption | null) => {
      setSelectedId(p?.id ?? null);
      setApplyState('idle');
      bridgeRef.current.setDesign(p ? resolvePaletteColors(p.colors) : null);
    },
    [],
  );
  const apply = useCallback(async () => {
    if (!selected || applyState === 'applying') return;
    setApplyState('applying');
    setError(null);
    try {
      await applyPalette(root, selected);
      // The file change flows back through HMR; drop the preview-only override.
      bridgeRef.current.setDesign(null);
      setSelectedId(null);
      setApplyState('applied');
      const text = await invoke<string>('read_text_file', {
        path: projectPath(root, DESIGN_PATH),
        workspaceRoot: root,
      });
      setOriginal(text);
    } catch (e) {
      setApplyState('error');
      setError(t('palette.saveFailed', { error: errorMessage(e) }));
    }
  }, [root, selected, applyState, t]);

  if (loading) {
    return (
      <aside data-testid="design-panel" className="flex w-72 shrink-0 flex-col border-l border-border bg-background p-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('palette.loading')}
        </span>
      </aside>
    );
  }

  if (original === null) {
    return (
      <aside data-testid="design-panel" className="flex w-72 shrink-0 flex-col border-l border-border bg-background p-3 text-xs text-muted-foreground">
        {error ?? t('palette.missing')}
      </aside>
    );
  }

  const contrastRows = checkDesign(
    previewColors ? `---\ncolors:\n${Object.entries(previewColors).map(([k, v]) => `  ${k}: "${v}"`).join('\n')}\n---\n` : original,
  ).contrast;
  const failures = contrastRows.filter((r) => !r.ok);

  return (
    <aside data-testid="design-panel" className="flex w-72 shrink-0 flex-col border-l border-border bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-1.5">
        <h2 className="text-xs font-semibold text-foreground">{t('palette.panel.title')}</h2>
        {previewColors && (
          <span data-testid="design-preview-badge" className="rounded-full bg-tertiary/10 px-2 py-0.5 text-xs text-tertiary">
            {t('palette.previewing')}
          </span>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto h-6 w-6"
          aria-label={t('palette.revert')}
          title={t('palette.revert')}
          disabled={!selected}
          onClick={() => select(null)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3">
        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('palette.current')}</h3>
          <ColorSwatches colors={currentDesignColors(original)} />
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('palette.library')}</h3>
          {library.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('palette.empty')}</p>
          ) : (
            <PaletteLibrary
              palettes={library}
              selectedId={selectedId}
              onSelect={(p) => select(p.id === selectedId ? null : p)}
            />
          )}
          {!selected && <p className="text-xs text-muted-foreground">{t('palette.hint')}</p>}
        </section>

        <section className="space-y-2" data-testid="design-contrast">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('palette.contrast.title')}</h3>
          {failures.length > 0 && (
            <p role="alert" data-testid="design-contrast-warning" className="flex items-start gap-1 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('palette.contrast.warning', { pairs: failures.map((f) => f.pair).join(', ') })}
            </p>
          )}
          {contrastRows.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 font-medium">{t('palette.contrast.pair')}</th>
                  <th className="py-1 font-medium">{t('palette.contrast.ratio')}</th>
                </tr>
              </thead>
              <tbody>
                {contrastRows.map((row) => (
                  <tr key={row.pair} data-testid={`contrast-${row.pair}`} data-ok={row.ok}>
                    <td className="py-1 font-mono">{row.pair}</td>
                    <td className={cn('py-1 font-mono', !row.ok && 'text-warning')}>
                      {row.ratio}:1 {!row.ok && t('palette.contrast.fail')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            check.issues.length > 0 && <p className="text-xs text-muted-foreground">{t('palette.contrast.unavailable')}</p>
          )}
        </section>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-1.5">
        <Button type="button" size="sm" disabled={!selected || applyState === 'applying'} onClick={() => void apply()}>
          {applyState === 'applying' ? t('palette.applying') : t('palette.apply')}
        </Button>
        <span data-testid="design-apply-state" role="status" className="text-xs text-muted-foreground">
          {applyState === 'applied' && t('palette.applied')}
          {applyState === 'error' && t('palette.saveFailed', { error: '' }).replace(/:\s*$/, '')}
        </span>
      </div>
    </aside>
  );
}

export default DesignPanel;
