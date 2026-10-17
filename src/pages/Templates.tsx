import { useEffect, useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { getBuiltinTemplate, listBuiltinTemplates } from '@/lib/guides/template';
import { categories, termsIn } from '@/lib/guides/glossary';
import { BUILT_IN_PALETTES } from '@/lib/design/palettes';
import { applyPalette, readDesign, writeDesign } from '@/lib/design/workspaceDesign';
import { listScenes, writeScene, type SceneEntry } from '@/lib/scene/files';
import { readWorkspace } from '@/lib/workspace/file';
import { cn } from '@/lib/utils';
import type { SceneType } from '@/lib/scene/schema';

const TYPES: SceneType[] = ['static', 'motion', '3d'];
const SWATCH_ROLES = ['canvas', 'ink', 'primary', 'accent'] as const;
const FAV_KEY = 'vs-template-favorites';

type Tab = 'guides' | 'palettes' | 'techniques';
type ApplyTarget = { kind: 'guide'; ref: string; name: string } | { kind: 'palette'; id: string; name: string };

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : []);
  } catch {
    return new Set();
  }
}

/** 템플릿 메뉴: 상단 탭(가이드·팔레트·기법) + 갤러리 카드 + 즐겨찾기 + 적용 다이얼로그. */
export function Templates() {
  const { t, locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'ko';
  const workspaceRoot = useSafeWorkspace()?.workspaceRoot ?? null;
  const guides = useMemo(() => listBuiltinTemplates(), []);
  const [tab, setTab] = useState<Tab>('guides');
  const [typeFilter, setTypeFilter] = useState<'all' | SceneType>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [apply, setApply] = useState<ApplyTarget | null>(null);

  const toggleFav = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...next]));
      } catch {
        // 즐겨찾기는 부가 기능이라 저장 실패를 무시한다.
      }
      return next;
    });
  };

  const favButton = (id: string) => {
    const on = favorites.has(id);
    return (
      <button
        type="button"
        aria-label={on ? t('tpl.unfavorite') : t('tpl.favorite')}
        aria-pressed={on}
        title={on ? t('tpl.unfavorite') : t('tpl.favorite')}
        onClick={() => toggleFav(id)}
        className={cn('rounded p-1 hover:bg-accent', on ? 'text-warning' : 'text-muted-foreground')}
      >
        <Star className={cn('h-4 w-4', on && 'fill-current')} />
      </button>
    );
  };

  const visibleGuides = guides.filter(
    (g) =>
      (typeFilter === 'all' || g.meta.type === typeFilter) &&
      (!favOnly || favorites.has(g.ref)),
  );
  const visiblePalettes = BUILT_IN_PALETTES.filter((p) => !favOnly || favorites.has(`palette:${p.id}`));
  const allTerms = useMemo(
    () =>
      guides.flatMap((g) =>
        categories(g.glossary).flatMap((c) =>
          termsIn(g.glossary, c).map((term) => ({ guide: g, category: c, term })),
        ),
      ),
    [guides],
  );
  const visibleTerms = allTerms.filter(
    (row) =>
      (typeFilter === 'all' || row.guide.meta.type === typeFilter) &&
      (!favOnly || favorites.has(`term:${row.guide.ref}/${row.term.id}`)),
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'guides', label: t('tpl.tabs.guides') },
    { id: 'palettes', label: t('tpl.tabs.palettes') },
    { id: 'techniques', label: t('tpl.tabs.techniques') },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6 text-sm" data-testid="templates-page">
      <div>
        <h1 className="text-base font-semibold">{t('tpl.title')}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t('tpl.desc')}</p>
      </div>

      <div role="tablist" aria-label={t('tpl.title')} className="flex gap-1 border-b border-border">
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-xs font-medium',
              tab === item.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </button>
        ))}
        <label className="ml-auto flex cursor-pointer items-center gap-1 self-center text-xs text-muted-foreground">
          <input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} className="h-3.5 w-3.5" />
          {t('tpl.favoritesOnly')}
        </label>
      </div>

      {tab !== 'palettes' && (
        <div className="flex gap-1" role="group" aria-label={t('tpl.typeAll')}>
          {(['all', ...TYPES] as const).map((type) => (
            <Button key={type} size="sm" variant={typeFilter === type ? 'default' : 'outline'} onClick={() => setTypeFilter(type)}>
              {type === 'all' ? t('tpl.typeAll') : t(`scene.type.${type}`)}
            </Button>
          ))}
        </div>
      )}

      {tab === 'guides' && (
        <section aria-label={t('tpl.tabs.guides')}>
          {visibleGuides.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('tpl.empty')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleGuides.map((g) => (
                <li key={g.ref} className="flex flex-col rounded-lg border border-border bg-card p-3 shadow-sm" data-testid="guide-card">
                  <div className="flex items-center gap-2">
                    <b className="min-w-0 flex-1 truncate">{g.meta.label[lang]}</b>
                    {favButton(g.ref)}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">{g.ref}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5">{t('tpl.terms', { count: g.glossary.terms.length })}</span>
                  </div>
                  <div className="mt-2 flex flex-1 flex-col gap-2 text-xs">
                    <details className="rounded border border-border p-2">
                      <summary className="cursor-pointer font-medium">{t('tpl.rules')}</summary>
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{g.rules}</pre>
                    </details>
                    <details className="rounded border border-border p-2">
                      <summary className="cursor-pointer font-medium">{t('tpl.checklist')}</summary>
                      <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{g.checklist}</pre>
                    </details>
                  </div>
                  <Button size="sm" className="mt-3" onClick={() => setApply({ kind: 'guide', ref: g.ref, name: g.meta.label[lang] })}>
                    {t('tpl.apply')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'palettes' && (
        <section aria-label={t('tpl.tabs.palettes')}>
          <p className="mb-2 text-xs text-muted-foreground">{t('tpl.paletteApplyHint')}</p>
          {visiblePalettes.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('tpl.empty')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BUILT_IN_PALETTES.filter((p) => !favOnly || favorites.has(`palette:${p.id}`)).map((p) => (
                <li key={p.id} className="flex flex-col rounded-lg border border-border bg-card p-3 shadow-sm" data-testid="palette-card">
                  <div className="flex items-center gap-2">
                    <b className="min-w-0 flex-1 truncate text-xs">{p.name}</b>
                    {favButton(`palette:${p.id}`)}
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{p.id}</span>
                  <div className="mt-2 flex gap-1" aria-hidden>
                    {SWATCH_ROLES.map((role) => (
                      <span
                        key={role}
                        title={`${role}: ${p.colors[role] ?? ''}`}
                        className="h-10 flex-1 rounded border border-border"
                        style={{ backgroundColor: p.colors[role] }}
                      />
                    ))}
                  </div>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setApply({ kind: 'palette', id: p.id, name: p.name })}>
                    {t('tpl.apply')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'techniques' && (
        <section aria-label={t('tpl.tabs.techniques')}>
          {visibleTerms.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('tpl.empty')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTerms.map(({ guide, category, term }) => {
                const favId = `term:${guide.ref}/${term.id}`;
                return (
                  <li key={favId} className="flex flex-col rounded-lg border border-border bg-card p-3 shadow-sm" data-testid="technique-card">
                    <div className="flex items-center gap-2">
                      <b className="min-w-0 flex-1 truncate text-xs">{term.label[lang]}</b>
                      {favButton(favId)}
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {category} · {guide.ref}
                    </p>
                    <p className="mt-1 flex-1 text-[11px] text-muted-foreground">{term.definition[lang]}</p>
                    {term.implementationHint && <p className="mt-1 text-[11px]">→ {term.implementationHint}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <p className="text-xs text-muted-foreground">{t('tpl.samplesLater')}</p>

      {apply && (
        <ApplyDialog
          target={apply}
          workspaceRoot={workspaceRoot}
          onClose={() => setApply(null)}
        />
      )}
    </div>
  );
}

function ApplyDialog({ target, workspaceRoot, onClose }: { target: ApplyTarget; workspaceRoot: string | null; onClose: () => void }) {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<SceneEntry[] | null>(null);
  const [chosen, setChosen] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workspaceRoot || target.kind !== 'guide') return;
    let cancelled = false;
    listScenes(workspaceRoot)
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        const first = rows.find((e) => e.scene)?.slug ?? '';
        setChosen(first);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, target]);

  const confirm = async () => {
    if (!workspaceRoot) return;
    setBusy(true);
    setStatus(null);
    try {
      if (target.kind === 'guide') {
        const entry = entries?.find((e) => e.slug === chosen);
        const scene = entry?.scene;
        if (!scene) throw new Error('no-scene');
        const template = getBuiltinTemplate(target.ref);
        if (!template) throw new Error('template-missing');
        if (template.meta.type !== scene.type) {
          throw new Error(t('tpl.typeMismatch', { type: t(`scene.type.${template.meta.type}`) }));
        }
        const ws = await readWorkspace(workspaceRoot);
        await writeScene(workspaceRoot, entry.slug, { id: ws.workspaceId, name: ws.name }, { ...scene, template: target.ref });
      } else {
        const palette = BUILT_IN_PALETTES.find((p) => p.id === target.id);
        if (!palette) throw new Error('palette-missing');
        const design = await readDesign(workspaceRoot);
        if (design === null) throw new Error('design-missing');
        const next = applyPalette(design, palette);
        await writeDesign(workspaceRoot, next.text);
      }
      setStatus({ kind: 'ok', text: t('tpl.applyDone') });
    } catch (e) {
      setStatus({ kind: 'error', text: t('tpl.applyFailed', { error: e instanceof Error ? e.message : String(e) }) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={target.kind === 'guide' ? t('tpl.applyGuideTitle', { name: target.name }) : t('tpl.applyPaletteTitle', { name: target.name })}
        data-testid="template-apply-dialog"
        className="w-96 max-w-[90vw] rounded-lg border border-border bg-card p-4 text-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">
          {target.kind === 'guide' ? t('tpl.applyGuideTitle', { name: target.name }) : t('tpl.applyPaletteTitle', { name: target.name })}
        </h2>
        {!workspaceRoot ? (
          <p className="mt-2 text-xs text-muted-foreground">{t('tpl.noWorkspace')}</p>
        ) : target.kind === 'guide' ? (
          <label className="mt-3 block text-xs">
            {t('tpl.applySceneLabel')}
            <select
              aria-label={t('tpl.applySceneLabel')}
              value={chosen}
              onChange={(e) => setChosen(e.target.value)}
              className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2"
            >
              {(entries ?? []).filter((e) => e.scene).map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.scene!.name} ({t(`scene.type.${e.scene!.type}`)})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{t('tpl.applySequenceLabel')}</p>
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
            <Button size="sm" disabled={busy || (target.kind === 'guide' && !chosen)} onClick={() => void confirm()}>
              {t('tpl.applyConfirm')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Templates;
