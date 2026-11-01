import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExampleThumb } from '@/components/templates/ExampleThumb';
import { getExample } from '@/lib/examples';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { copyToClipboard } from '@/lib/agents/clipboard';
import { listScenes, writeScene, type SceneEntry } from '@/lib/scene/files';
import type { SceneType } from '@/lib/scene/schema';
import {
  addSceneStyle,
  matchesStyle,
  removeSceneStyle,
  STYLE_GROUPS,
  STYLE_LIBRARY,
  STYLE_SCOPES,
  styleDirective,
  styleFamily,
  styleSceneTypes,
  type StyleEntry,
  type StyleGroup,
  type StyleScope,
} from '@/lib/styles/library';
import { readWorkspace } from '@/lib/workspace/file';
import { recordStudioChange } from '@/lib/workspace/workOrder';

const TYPES: SceneType[] = ['static', 'motion', '3d'];

/** 200종 스타일 사전. 검색·분류 후 신에 붙이거나 에이전트 지시로 복사한다. */
export function StyleLibraryPanel({
  workspaceRoot,
  favButton,
  favorites,
  favOnly,
}: {
  workspaceRoot: string | null;
  favButton: (id: string) => ReactNode;
  favorites: ReadonlySet<string>;
  favOnly: boolean;
}) {
  const { t, locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'ko';
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<'all' | StyleGroup>('all');
  const [type, setType] = useState<'all' | SceneType>('all');
  const [target, setTarget] = useState<StyleEntry | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      STYLE_LIBRARY.styles.filter(
        (s) =>
          matchesStyle(s, query) &&
          (group === 'all' || s.group === group) &&
          (type === 'all' || styleSceneTypes(s).includes(type)) &&
          (!favOnly || favorites.has(`style:${s.id}`)),
      ),
    [query, group, type, favOnly, favorites],
  );

  const copy = async (style: StyleEntry) => {
    if (await copyToClipboard(styleDirective(style, 'scene'))) setCopied(style.id);
  };

  return (
    <section aria-label={t('tpl.tabs.styles')}>
      <p className="mb-2 text-xs text-muted-foreground">{t('tpl.style.hint')}</p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('tpl.style.search')}
          aria-label={t('tpl.style.search')}
          className="h-8 w-56 rounded-md border border-input bg-background px-2 text-xs"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label={t('tpl.style.groupLabel')}>
          {(['all', ...STYLE_GROUPS] as const).map((g) => (
            <Button key={g} size="sm" variant={group === g ? 'secondary' : 'ghost'} onClick={() => setGroup(g)}>
              {t(`tpl.style.group.${g}`)}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label={t('tpl.typeAll')}>
          {(['all', ...TYPES] as const).map((x) => (
            <Button key={x} size="sm" variant={type === x ? 'default' : 'outline'} onClick={() => setType(x)}>
              {x === 'all' ? t('tpl.typeAll') : t(`scene.type.${x}`)}
            </Button>
          ))}
        </div>
        <span className="ml-auto text-xs text-muted-foreground" data-testid="style-count">
          {t('tpl.style.count', { count: visible.length })}
        </span>
      </div>
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('tpl.empty')}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((s) => {
            const example = getExample('style', s.id);
            return (
              <li key={s.id} className="flex flex-col rounded-lg border border-border bg-card p-3 shadow-sm" data-testid="style-card">
                {example && (
                  <div className="mb-2 overflow-hidden rounded-md border border-border">
                    <ExampleThumb example={example} name={s.label[lang]} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <b className="min-w-0 flex-1 truncate text-xs">{s.label[lang]}</b>
                  {favButton(`style:${s.id}`)}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="font-mono">{s.id}</span>
                  {styleSceneTypes(s).map((st) => (
                    <span key={st} className="rounded bg-muted px-1.5 py-0.5">
                      {t(`scene.type.${st}`)}
                    </span>
                  ))}
                </div>
                <p className="mt-1.5 flex-1 text-xs text-muted-foreground">{s.description[lang]}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.keywords.map((k) => (
                    <span key={k} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {k}
                    </span>
                  ))}
                </div>
                <details className="mt-2 rounded border border-border p-2 text-xs">
                  <summary className="cursor-pointer font-medium">{t('tpl.style.details')}</summary>
                  <p className="mt-1 text-[11px] text-muted-foreground">{s.example}</p>
                  <p className="mt-1 text-[11px]">→ {styleFamily(s)?.technique}</p>
                  {s.ipSensitive && <p className="mt-1 text-[11px] text-warning">{t('tpl.style.ip')}</p>}
                </details>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setTarget(s)}>
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    {t('tpl.apply')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void copy(s)}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    {copied === s.id ? t('inspector.copied') : t('tpl.style.copy')}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {target && <ApplyStyleDialog style={target} workspaceRoot={workspaceRoot} onClose={() => setTarget(null)} />}
    </section>
  );
}

function ApplyStyleDialog({ style, workspaceRoot, onClose }: { style: StyleEntry; workspaceRoot: string | null; onClose: () => void }) {
  const { t, locale } = useLanguage();
  const name = style.label[locale === 'en' ? 'en' : 'ko'];
  const [entries, setEntries] = useState<SceneEntry[]>([]);
  const [chosen, setChosen] = useState('');
  const [scope, setScope] = useState<StyleScope>('scene');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!workspaceRoot) return;
    let cancelled = false;
    listScenes(workspaceRoot)
      .then((rows) => {
        if (cancelled) return;
        const usable = rows.filter((e) => e.scene);
        setEntries(usable);
        setChosen(usable[0]?.slug ?? '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot]);

  const entry = entries.find((e) => e.slug === chosen);
  const attached = entry?.scene?.styles?.some((s) => s.id === style.id) ?? false;

  const run = async (remove: boolean) => {
    const scene = entry?.scene;
    if (!workspaceRoot || !entry || !scene) return;
    setBusy(true);
    setStatus(null);
    try {
      const ws = await readWorkspace(workspaceRoot);
      const next = remove ? removeSceneStyle(scene, style.id) : addSceneStyle(scene, style.id, scope);
      await writeScene(workspaceRoot, entry.slug, { id: ws.workspaceId, name: ws.name }, next);
      setEntries((rows) => rows.map((e) => (e.slug === entry.slug ? { ...e, scene: next } : e)));
      await recordStudioChange(workspaceRoot, {
        scope: 'scene',
        targetId: scene.id,
        targetName: `scenes/${entry.slug} (${scene.name})`,
        summary: `스타일 ${remove ? '해제' : '적용'}: ${style.id} (${name})`,
        fields: ['styles'],
        layer: 'visual-direction',
      }).catch(() => {});
      setStatus({ kind: 'ok', text: t('tpl.applyDone') });
    } catch (e) {
      setStatus({ kind: 'error', text: t('tpl.applyFailed', { error: e instanceof Error ? e.message : String(e) }) });
    } finally {
      setBusy(false);
    }
  };

  const title = t('tpl.style.applyTitle', { name });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        data-testid="style-apply-dialog"
        className="w-96 max-w-[90vw] rounded-lg border border-border bg-card p-4 text-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold">{title}</h2>
        {!workspaceRoot ? (
          <p className="mt-2 text-xs text-muted-foreground">{t('tpl.noWorkspace')}</p>
        ) : (
          <div className="mt-3 space-y-2">
            <label className="block text-xs">
              {t('tpl.applySceneLabel')}
              <select
                aria-label={t('tpl.applySceneLabel')}
                value={chosen}
                onChange={(e) => setChosen(e.target.value)}
                className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2"
              >
                {entries.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.scene!.name} ({t(`scene.type.${e.scene!.type}`)})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              {t('tpl.style.scopeLabel')}
              <select
                aria-label={t('tpl.style.scopeLabel')}
                value={scope}
                onChange={(e) => setScope(e.target.value as StyleScope)}
                className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2"
              >
                {STYLE_SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {t(`tpl.style.scope.${s}`)}
                  </option>
                ))}
              </select>
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
          {attached && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(true)}>
              {t('tpl.style.remove')}
            </Button>
          )}
          {workspaceRoot && (
            <Button size="sm" disabled={busy || !chosen} onClick={() => void run(false)}>
              {t('tpl.applyConfirm')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
