import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaletteLibrary } from '@/components/design/PaletteLibrary';
import { NewProjectWizard } from '@/components/project/NewProjectWizard';
import { TemplateGallery } from './TemplateGallery';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { useWorkspaceTabs } from '@/lib/context/WorkspaceTabsContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { BUILT_IN_PALETTES, listProjectPalettes, type PaletteFile } from '@/lib/design/palettes';
import { applyPalette } from '@/lib/review/designApply';
import { cn } from '@/lib/utils';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

type ApplyState = 'idle' | 'applying' | 'applied' | 'error';

// Per-row apply for the sidepanel library: no preview here (that lives in the review
// DesignPanel), so applying writes DESIGN.md + vanilla.json and checkpoints at once.
function ApplyPaletteButton({ root, palette }: { root: string | null; palette: PaletteFile }) {
  const { t } = useLanguage();
  const [state, setState] = useState<ApplyState>('idle');
  const [error, setError] = useState<string | null>(null);
  if (!root) {
    return (
      <p className="text-xs text-muted-foreground" title={t('palette.applyNeedsProject')}>
        {t('palette.applyNeedsProject')}
      </p>
    );
  }
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-6 px-2 text-xs"
        data-testid={`palette-apply-${palette.id}`}
        disabled={state === 'applying' || state === 'applied'}
        onClick={() => {
          setState('applying');
          setError(null);
          applyPalette(root, palette).then(
            () => setState('applied'),
            (e: unknown) => {
              setState('error');
              setError(t('palette.saveFailed', { error: errorMessage(e) }));
            },
          );
        }}
      >
        {state === 'applying' ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : state === 'applied' ? <Check className="h-3 w-3" aria-hidden /> : null}
        {state === 'applied' ? t('palette.applied') : t('palette.apply')}
      </Button>
      {state === 'error' && error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </>
  );
}

// Templates side panel (Product-Spec §4.1): the built-in template gallery and
// the palette library as sub-tabs. Picking a gallery card opens the new-project
// wizard with that template preselected (W1 wiring).
export function TemplatesPanel() {
  const { t } = useLanguage();
  const root = useSafeWorkspace()?.workspaceRoot ?? null;
  const { openTab } = useWorkspaceTabs();
  const [tab, setTab] = useState<'templates' | 'palettes'>('templates');
  const [projectPalettes, setProjectPalettes] = useState<PaletteFile[]>([]);
  const [wizardTemplate, setWizardTemplate] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    listProjectPalettes(root).then((list) => {
      if (!cancelled) setProjectPalettes(list);
    });
    return () => {
      cancelled = true;
    };
  }, [root]);

  const library = root
    ? [...BUILT_IN_PALETTES, ...projectPalettes.filter((p) => !BUILT_IN_PALETTES.some((b) => b.id === p.id))]
    : BUILT_IN_PALETTES;

  return (
    <div data-testid="templates-panel" className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-border p-2" role="group" aria-label={t('shell.view.templates')}>
        <Button
          size="sm"
          variant={tab === 'templates' ? 'secondary' : 'ghost'}
          className={cn('h-6 flex-1 px-2 text-xs')}
          aria-pressed={tab === 'templates'}
          onClick={() => setTab('templates')}
        >
          {t('shell.view.templates')}
        </Button>
        <Button
          size="sm"
          variant={tab === 'palettes' ? 'secondary' : 'ghost'}
          className={cn('h-6 flex-1 px-2 text-xs')}
          aria-pressed={tab === 'palettes'}
          onClick={() => setTab('palettes')}
        >
          {t('palette.tabs.library')}
        </Button>
      </div>
      {tab === 'templates' ? (
        <div className="min-h-0 flex-1">
          <TemplateGallery
            onSelect={(id) => {
              setWizardTemplate(id);
              setWizardOpen(true);
            }}
          />
          {/* key remounts per template so the wizard picks up each selection. */}
          <NewProjectWizard
            key={wizardTemplate ?? 'none'}
            open={wizardOpen}
            onOpenChange={(open) => {
              setWizardOpen(open);
              if (!open) setWizardTemplate(null);
            }}
            initialTemplateId={wizardTemplate}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <PaletteLibrary
            palettes={library}
            actions={(p) => (
              <div className="flex items-center gap-2 px-2">
                <ApplyPaletteButton root={root} palette={p} />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  data-testid={`palette-edit-${p.id}`}
                  onClick={() => openTab({ id: `palette:${p.id}`, type: 'palette', title: p.name, meta: { paletteId: p.id } })}
                >
                  {t('palette.editor.edit')}
                </Button>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}

export default TemplatesPanel;
