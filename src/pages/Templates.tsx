import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Sparkles, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProjectTemplatesPanel } from '@/components/templates/ProjectTemplatesPanel';
import { StyleLibraryPanel } from '@/components/templates/StyleLibraryPanel';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  getBuiltinTemplate,
  listBuiltinTemplates,
  MEDIA_INTENTS,
  type MediaIntent,
} from '@/lib/guides/template';
import { applyTemplateDefaults } from '@/lib/guides/merge';
import {
  applyDecomposedPreset,
  applyOpusRecipeToScene,
  DECOMPOSED_CATEGORIES,
  listDecomposedPresets,
  listOpusRecipes,
  type DecomposedCategory,
  type DecomposedPreset,
  type OpusRecipe,
} from '@/lib/guides/opusCatalog';
import { categories, termsIn } from '@/lib/guides/glossary';
import { BUILT_IN_PALETTES } from '@/lib/design/palettes';
import { applyPalette, readDesign, writeDesign } from '@/lib/design/workspaceDesign';
import { listScenes, writeScene, type SceneEntry } from '@/lib/scene/files';
import { readWorkspace } from '@/lib/workspace/file';
import { recordStudioChange } from '@/lib/workspace/workOrder';
import { cn } from '@/lib/utils';
import type { Scene, SceneType } from '@/lib/scene/schema';

const TYPES: SceneType[] = ['static', 'motion', '3d'];
const SWATCH_ROLES = ['canvas', 'ink', 'primary', 'accent'] as const;
const FAV_KEY = 'vs-template-favorites';

type Section = 'templates' | 'styles';
type Tab = 'styles' | 'guides' | 'decomposed' | 'recipes' | 'palettes' | 'techniques';
type ApplyTarget =
  | { kind: 'guide'; ref: string; name: string }
  | { kind: 'palette'; id: string; name: string }
  | { kind: 'preset'; preset: DecomposedPreset; name: string }
  | { kind: 'recipe'; recipe: OpusRecipe; name: string };

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

function PreviewMedia({
  previewUrl,
  actionUrl,
  postUrl,
  name,
  liveDemoLabel,
  originalPostLabel,
  altText,
}: {
  previewUrl?: string;
  actionUrl?: string;
  postUrl?: string;
  name: string;
  liveDemoLabel: string;
  originalPostLabel?: string;
  altText: string;
}) {
  if (!previewUrl && !actionUrl) return null;
  return (
    <div className="mb-2 overflow-hidden rounded-md border border-border bg-muted/40">
      {previewUrl && (
        <div className="relative aspect-video w-full overflow-hidden bg-muted">
          <img
            src={previewUrl}
            alt={altText}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
          />
          {actionUrl && (
            <a
              href={actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${name} ${liveDemoLabel}`}
              data-testid="live-demo-link"
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md border border-border bg-card/90 px-2 py-1 text-[11px] font-medium text-foreground shadow backdrop-blur hover:bg-accent"
            >
              <ExternalLink className="h-3 w-3" />
              {liveDemoLabel}
            </a>
          )}
        </div>
      )}
      {!previewUrl && actionUrl && (
        <div className="flex items-center justify-end px-2 py-1.5">
          <a
            href={actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="live-demo-link"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {liveDemoLabel}
          </a>
        </div>
      )}
      {postUrl && postUrl !== actionUrl && originalPostLabel && (
        <div className="flex items-center justify-between border-t border-border px-2 py-1 text-[10px] text-muted-foreground">
          <a
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
          >
            <ExternalLink className="h-2.5 w-2.5" />
            {originalPostLabel}
          </a>
        </div>
      )}
    </div>
  );
}

/** 템플릿 메뉴(D-046): 템플릿(프로젝트 뼈대)과 스타일(스타일 사전·가이드·프리셋·레시피·팔레트·기법)로 나눈다. */
export function Templates() {
  const { t, locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'ko';
  const workspaceRoot = useSafeWorkspace()?.workspaceRoot ?? null;
  const guides = useMemo(() => listBuiltinTemplates(), []);
  const allPresets = useMemo(() => listDecomposedPresets(), []);
  const allRecipes = useMemo(() => listOpusRecipes(), []);
  const [section, setSection] = useState<Section>('templates');
  const [tab, setTab] = useState<Tab>('styles');
  const [typeFilter, setTypeFilter] = useState<'all' | SceneType>('all');
  const [intentFilter, setIntentFilter] = useState<'all' | MediaIntent>('all');
  const [decomposedFilter, setDecomposedFilter] = useState<'all' | DecomposedCategory>('all');
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
      (intentFilter === 'all' || (g.meta.mediaIntents ?? []).includes(intentFilter)) &&
      (!favOnly || favorites.has(g.ref)),
  );

  const visiblePresets = allPresets.filter(
    (p) =>
      (typeFilter === 'all' || p.targetTypes.includes(typeFilter)) &&
      (intentFilter === 'all' || p.mediaIntents.includes(intentFilter)) &&
      (decomposedFilter === 'all' || p.category === decomposedFilter) &&
      (!favOnly || favorites.has(`preset:${p.id}`)),
  );

  const visibleRecipes = allRecipes.filter(
    (r) =>
      (typeFilter === 'all' || r.sceneType === typeFilter) &&
      (intentFilter === 'all' || r.mediaIntent === intentFilter) &&
      (!favOnly || favorites.has(`recipe:${r.id}`)),
  );

  const visiblePalettes = BUILT_IN_PALETTES.filter((p) => !favOnly || favorites.has(`palette:${p.id}`));

  // 용어집은 부모를 상속한 템플릿에서 중복될 수 있으므로 base 템플릿(extends === null)을 우선 수집해 고유 용어만 노출한다.
  const allTerms = useMemo(() => {
    const seen = new Set<string>();
    const rows: { guide: (typeof guides)[number]; category: string; term: (typeof guides)[number]['glossary']['terms'][number] }[] = [];
    for (const g of guides) {
      for (const c of categories(g.glossary)) {
        for (const term of termsIn(g.glossary, c)) {
          const key = `${g.meta.type}:${c}/${term.id}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push({ guide: g, category: c, term });
        }
      }
    }
    return rows;
  }, [guides]);

  const visibleTerms = allTerms.filter(
    (row) =>
      (typeFilter === 'all' || row.guide.meta.type === typeFilter) &&
      (!favOnly || favorites.has(`term:${row.guide.ref}/${row.term.id}`)),
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'styles', label: t('tpl.tabs.styles') },
    { id: 'guides', label: t('tpl.tabs.guides') },
    { id: 'decomposed', label: t('tpl.tabs.decomposed') },
    { id: 'recipes', label: t('tpl.tabs.recipes') },
    { id: 'palettes', label: t('tpl.tabs.palettes') },
    { id: 'techniques', label: t('tpl.tabs.techniques') },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6 text-sm" data-testid="templates-page">
      <div>
        <h1 className="text-base font-semibold">{t('tpl.title')}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t('tpl.desc')}</p>
      </div>

      <div role="tablist" aria-label={t('tpl.sectionLabel')} className="flex gap-1">
        {(['templates', 'styles'] as const).map((id) => (
          <Button key={id} role="tab" aria-selected={section === id} size="sm" variant={section === id ? 'default' : 'outline'} onClick={() => setSection(id)}>
            {t(`tpl.section.${id}`)}
          </Button>
        ))}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t(`tpl.section.${section}.desc`)}</p>

      {section === 'templates' && <ProjectTemplatesPanel workspaceRoot={workspaceRoot} />}

      {section === 'styles' && (
      <>
      <div role="tablist" aria-label={t('tpl.title')} className="flex flex-wrap gap-1 border-b border-border">
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

      {tab === 'styles' && <StyleLibraryPanel workspaceRoot={workspaceRoot} favButton={favButton} favorites={favorites} favOnly={favOnly} />}

      {tab !== 'palettes' && tab !== 'styles' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label={t('tpl.intent.label')}>
            {(['all', ...MEDIA_INTENTS] as const).map((intent) => (
              <Button
                key={intent}
                size="sm"
                variant={intentFilter === intent ? 'default' : 'outline'}
                onClick={() => setIntentFilter(intent)}
              >
                {t(`tpl.intent.${intent}`)}
              </Button>
            ))}
          </div>
          <span className="text-muted-foreground">·</span>
          <div className="flex flex-wrap gap-1" role="group" aria-label={t('tpl.typeAll')}>
            {(['all', ...TYPES] as const).map((type) => (
              <Button key={type} size="sm" variant={typeFilter === type ? 'default' : 'outline'} onClick={() => setTypeFilter(type)}>
                {type === 'all' ? t('tpl.typeAll') : t(`scene.type.${type}`)}
              </Button>
            ))}
          </div>
        </div>
      )}

      {tab === 'decomposed' && (
        <div className="flex flex-wrap gap-1" role="group" aria-label={t('tpl.tabs.decomposed')}>
          {(['all', ...DECOMPOSED_CATEGORIES] as const).map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={decomposedFilter === cat ? 'secondary' : 'ghost'}
              onClick={() => setDecomposedFilter(cat)}
            >
              {t(`tpl.decomposed.${cat}`)}
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
                  <PreviewMedia
                    previewUrl={g.meta.previewUrl}
                    actionUrl={g.meta.actionUrl}
                    name={g.meta.label[lang]}
                    liveDemoLabel={t('tpl.liveDemo')}
                    altText={t('tpl.previewAlt', { name: g.meta.label[lang] })}
                  />
                  <div className="flex items-center gap-2">
                    <b className="min-w-0 flex-1 truncate">{g.meta.label[lang]}</b>
                    {favButton(g.ref)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-mono">{g.ref}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5">{t(`scene.type.${g.meta.type}`)}</span>
                    {(g.meta.mediaIntents ?? []).map((intent) => (
                      <span key={intent} className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                        {t(`tpl.intent.${intent}`)}
                      </span>
                    ))}
                    <span className="rounded bg-muted px-1.5 py-0.5">{t('tpl.terms', { count: g.glossary.terms.length })}</span>
                  </div>
                  {g.meta.description && (
                    <p className="mt-1.5 text-xs text-muted-foreground">{g.meta.description[lang]}</p>
                  )}
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

      {tab === 'decomposed' && (
        <section aria-label={t('tpl.tabs.decomposed')}>
          {visiblePresets.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('tpl.empty')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visiblePresets.map((preset) => {
                const favId = `preset:${preset.id}`;
                return (
                  <li key={preset.id} className="flex flex-col rounded-lg border border-border bg-card p-3 shadow-sm" data-testid="decomposed-card">
                    <PreviewMedia
                      previewUrl={preset.previewUrl}
                      actionUrl={preset.actionUrl}
                      name={preset.label[lang]}
                      liveDemoLabel={t('tpl.liveDemo')}
                      altText={t('tpl.previewAlt', { name: preset.label[lang] })}
                    />
                    <div className="flex items-center gap-2">
                      <b className="min-w-0 flex-1 truncate text-xs">{preset.label[lang]}</b>
                      {favButton(favId)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                        {t(`tpl.decomposed.${preset.category}`)}
                      </span>
                      {preset.targetTypes.map((st) => (
                        <span key={st} className="rounded bg-muted px-1.5 py-0.5">
                          {t(`scene.type.${st}`)}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1.5 flex-1 text-xs text-muted-foreground">{preset.description[lang]}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {preset.tags.map((tag) => (
                        <span key={tag} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => setApply({ kind: 'preset', preset, name: preset.label[lang] })}
                    >
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                      {t('tpl.apply')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === 'recipes' && (
        <section aria-label={t('tpl.tabs.recipes')}>
          {visibleRecipes.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('tpl.empty')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleRecipes.map((r) => {
                const favId = `recipe:${r.id}`;
                return (
                  <li key={r.id} className="flex flex-col rounded-lg border border-border bg-card p-3 shadow-sm" data-testid="recipe-card">
                    <PreviewMedia
                      previewUrl={r.previewUrl}
                      actionUrl={r.actionUrl}
                      postUrl={r.postUrl}
                      name={r.title[lang]}
                      liveDemoLabel={t('tpl.liveDemo')}
                      originalPostLabel={t('tpl.originalPost')}
                      altText={t('tpl.previewAlt', { name: r.title[lang] })}
                    />
                    <div className="flex items-center gap-2">
                      <b className="min-w-0 flex-1 truncate text-xs">{r.title[lang]}</b>
                      {favButton(favId)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                        {t(`tpl.intent.${r.mediaIntent}`)}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5">{t(`scene.type.${r.sceneType}`)}</span>
                      <span className="font-mono">{r.templateRef}</span>
                      <span>by @{r.author}</span>
                    </div>
                    <p className="mt-1.5 flex-1 text-xs text-muted-foreground">{r.summary[lang]}</p>
                    {r.promptExcerpt && (
                      <details className="mt-2 rounded border border-border p-2 text-xs">
                        <summary className="cursor-pointer font-medium">{t('tpl.promptExcerpt')}</summary>
                        <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground">
                          {r.promptExcerpt}
                        </pre>
                      </details>
                    )}
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => setApply({ kind: 'recipe', recipe: r, name: r.title[lang] })}
                    >
                      {t('tpl.apply')}
                    </Button>
                  </li>
                );
              })}
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
              {visiblePalettes.map((p) => (
                <li key={p.id} className="flex flex-col rounded-lg border border-border bg-card p-3 shadow-sm" data-testid="palette-card">
                  <PreviewMedia
                    previewUrl={p.previewUrl}
                    actionUrl={p.actionUrl}
                    name={p.name}
                    liveDemoLabel={t('tpl.liveDemo')}
                    altText={t('tpl.previewAlt', { name: p.name })}
                  />
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
                    <PreviewMedia
                      previewUrl={term.previewUrl}
                      actionUrl={term.actionUrl}
                      name={term.label[lang]}
                      liveDemoLabel={t('tpl.liveDemo')}
                      altText={t('tpl.previewAlt', { name: term.label[lang] })}
                    />
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

      </>
      )}

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
  const [alsoPalette, setAlsoPalette] = useState(true);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const needsSceneSelection = target.kind === 'guide' || target.kind === 'preset' || target.kind === 'recipe';

  useEffect(() => {
    if (!workspaceRoot || !needsSceneSelection) return;
    let cancelled = false;
    listScenes(workspaceRoot)
      .then((rows) => {
        if (cancelled) return;
        setEntries(rows);
        const compatible = rows.find((e) => {
          if (!e.scene) return false;
          if (target.kind === 'preset') return target.preset.targetTypes.includes(e.scene.type);
          if (target.kind === 'recipe') return e.scene.type === target.recipe.sceneType;
          const tpl = getBuiltinTemplate(target.ref);
          return tpl ? tpl.meta.type === e.scene.type : true;
        });
        setChosen(compatible?.slug ?? rows.find((e) => e.scene)?.slug ?? '');
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, target, needsSceneSelection]);

  const dialogTitle =
    target.kind === 'guide'
      ? t('tpl.applyGuideTitle', { name: target.name })
      : target.kind === 'palette'
        ? t('tpl.applyPaletteTitle', { name: target.name })
        : target.kind === 'preset'
          ? t('tpl.applyPresetTitle', { name: target.name })
          : t('tpl.applyRecipeTitle', { name: target.name });

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
        const nextScene = applyTemplateDefaults({ ...scene, template: target.ref } as Scene, template);
        await writeScene(workspaceRoot, entry.slug, { id: ws.workspaceId, name: ws.name }, nextScene, () => template);
        await recordStudioChange(workspaceRoot, {
          scope: 'scene',
          targetId: scene.id,
          targetName: `scenes/${entry.slug} (${scene.name})`,
          summary: `가이드 템플릿 적용: ${target.ref} (${target.name})`,
          fields: ['template', 'guide'],
        }).catch(() => {});
      } else if (target.kind === 'preset') {
        const entry = entries?.find((e) => e.slug === chosen);
        const scene = entry?.scene;
        if (!scene) throw new Error('no-scene');
        if (!target.preset.targetTypes.includes(scene.type)) {
          throw new Error(
            t('tpl.typeMismatch', {
              type: target.preset.targetTypes.map((st) => t(`scene.type.${st}`)).join(' / '),
            }),
          );
        }
        const ws = await readWorkspace(workspaceRoot);
        const nextScene = applyDecomposedPreset(scene, target.preset);
        await writeScene(workspaceRoot, entry.slug, { id: ws.workspaceId, name: ws.name }, nextScene);
        await recordStudioChange(workspaceRoot, {
          scope: 'scene',
          targetId: scene.id,
          targetName: `scenes/${entry.slug} (${scene.name})`,
          summary: `세부 프리셋 병합: ${target.preset.id} (${target.name})`,
          fields: ['guide', target.preset.category],
        }).catch(() => {});
      } else if (target.kind === 'recipe') {
        const entry = entries?.find((e) => e.slug === chosen);
        const scene = entry?.scene;
        if (!scene) throw new Error('no-scene');
        if (scene.type !== target.recipe.sceneType) {
          throw new Error(t('tpl.typeMismatch', { type: t(`scene.type.${target.recipe.sceneType}`) }));
        }
        const ws = await readWorkspace(workspaceRoot);
        const tpl = getBuiltinTemplate(target.recipe.templateRef);
        const nextScene = applyOpusRecipeToScene(scene, target.recipe, tpl);
        await writeScene(workspaceRoot, entry.slug, { id: ws.workspaceId, name: ws.name }, nextScene, () => tpl);
        if (alsoPalette && target.recipe.recommendedPaletteId) {
          const palette = BUILT_IN_PALETTES.find((p) => p.id === target.recipe.recommendedPaletteId);
          const design = await readDesign(workspaceRoot);
          if (palette && design !== null) {
            const nextDesign = applyPalette(design, palette);
            await writeDesign(workspaceRoot, nextDesign.text);
          }
        }
        await recordStudioChange(workspaceRoot, {
          scope: 'scene',
          targetId: scene.id,
          targetName: `scenes/${entry.slug} (${scene.name})`,
          summary: `Opus 레시피 적용: ${target.recipe.id} (${target.name})`,
          fields: ['template', 'guide', ...(alsoPalette && target.recipe.recommendedPaletteId ? ['DESIGN.md'] : [])],
        }).catch(() => {});
      } else {
        const palette = BUILT_IN_PALETTES.find((p) => p.id === target.id);
        if (!palette) throw new Error('palette-missing');
        const design = await readDesign(workspaceRoot);
        if (design === null) throw new Error('design-missing');
        const next = applyPalette(design, palette);
        await writeDesign(workspaceRoot, next.text);
        await recordStudioChange(workspaceRoot, {
          scope: 'design',
          targetId: 'DESIGN.md',
          targetName: 'DESIGN.md',
          summary: `디자인 팔레트 변경: ${palette.id} (${target.name})`,
          fields: ['colors'],
        }).catch(() => {});
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
        aria-label={dialogTitle}
        data-testid="template-apply-dialog"
        className="w-96 max-w-[90vw] rounded-lg border border-border bg-card p-4 text-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">{dialogTitle}</h2>
        {target.kind === 'preset' && (
          <p className="mt-1.5 text-xs text-muted-foreground">{t('tpl.applyPresetHint')}</p>
        )}
        {!workspaceRoot ? (
          <p className="mt-2 text-xs text-muted-foreground">{t('tpl.noWorkspace')}</p>
        ) : needsSceneSelection ? (
          <div className="mt-3 space-y-2">
            <label className="block text-xs">
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
            {target.kind === 'recipe' && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={alsoPalette}
                  onChange={(e) => setAlsoPalette(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                {t('tpl.alsoApplyPalette', { palette: target.recipe.recommendedPaletteId })}
              </label>
            )}
          </div>
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
            <Button size="sm" disabled={busy || (needsSceneSelection && !chosen)} onClick={() => void confirm()}>
              {t('tpl.applyConfirm')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default Templates;
