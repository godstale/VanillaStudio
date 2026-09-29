// Playground side panel (T6.8, F-PLY-01·02): saved export results with
// search/tag/kind filters, delete, open-in-player, and "add from export".
// The provider mounts here so the panel works without global wiring.
import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { useWorkspaceTabs } from '@/lib/context/WorkspaceTabsContext';
import { loadExportJobs, type ExportJobRow } from '@/lib/export/exportRepo';
import { isExportKind } from '@/lib/export/exportModel';
import { PlaygroundProvider } from '@/lib/playground/PlaygroundContext';
import { usePlayground } from '@/lib/playground/playgroundContextValue';
import { collectTags, searchItems, titleFromDir, type PlaygroundFilter } from '@/lib/playground/store';
import { PLAYGROUND_KINDS, type PlaygroundKind } from '@/lib/playground/types';
import { cn } from '@/lib/utils';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

function KindBadge({ kind }: { kind: PlaygroundKind }) {
  const { t } = useLanguage();
  return (
    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {t(`playground.kind.${kind}`)}
    </span>
  );
}

function ItemList() {
  const { t } = useLanguage();
  const { openTab } = useWorkspaceTabs();
  const { items, isLoaded, error, refresh, removeItem } = usePlayground();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<PlaygroundKind | 'all'>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const filter: PlaygroundFilter = useMemo(() => ({ kind, tag }), [kind, tag]);
  const visible = useMemo(() => searchItems(items, query, filter), [items, query, filter]);
  const tags = useMemo(() => collectTags(items), [items]);

  if (!isLoaded) {
    return (
      <p className="flex items-center gap-2 p-6 text-center text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        {t('playground.panel.loading')}
      </p>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 p-6 text-center">
        <p role="alert" className="text-xs text-destructive">{t('playground.panel.loadFailed', { error })}</p>
        <Button size="sm" variant="outline" onClick={() => void refresh()}>{t('playground.panel.retry')}</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border p-2">
        <input
          type="search"
          aria-label={t('playground.search.placeholder')}
          placeholder={t('playground.search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground"
        />
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{t('playground.filter.kind')}</span>
          {(['all', ...PLAYGROUND_KINDS] as const).map((k) => (
            <Button
              key={k}
              size="sm"
              variant={kind === k ? 'secondary' : 'ghost'}
              className="h-6 px-2 text-[11px]"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
            >
              {k === 'all' ? t('playground.filter.all') : t(`playground.kind.${k}`)}
            </Button>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{t('playground.filter.tag')}</span>
            {tags.map((label) => (
              <Button
                key={label.toLowerCase()}
                size="sm"
                variant={tag === label ? 'secondary' : 'ghost'}
                className="h-6 px-2 text-[11px]"
                aria-pressed={tag === label}
                onClick={() => setTag((prev) => (prev === label ? null : label))}
              >
                #{label}
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {items.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">{t('playground.panel.empty')}</p>
        ) : visible.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">{t('playground.search.noResults')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {visible.map((item) => (
              <li key={item.id} className="rounded-md border border-border bg-card p-2">
                <div className="flex items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={item.title}>
                    {item.title}
                  </span>
                  <KindBadge kind={item.kind} />
                </div>
                {item.tags.length > 0 && (
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={item.tags.join(', ')}>
                    {item.tags.map((tg) => `#${tg}`).join(' ')}
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={() =>
                      openTab({ id: `playground-item:${item.id}`, type: 'playground-item', title: item.title, meta: { itemId: item.id } })
                    }
                  >
                    <Play className="h-3 w-3" aria-hidden />
                    {t('playground.item.open')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn('h-6 px-2 text-[11px]')}
                    aria-label={`${t('playground.item.delete')}: ${item.title}`}
                    onClick={() => {
                      setFailed(null);
                      removeItem(item.id).catch((e: unknown) => setFailed(t('playground.item.deleteFailed', { error: errorMessage(e) })));
                    }}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                    {t('playground.item.delete')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {failed && (
          <p role="alert" className="mt-2 text-[11px] text-destructive">{failed}</p>
        )}
      </div>
    </div>
  );
}

function AddFromExport() {
  const { t } = useLanguage();
  const root = useSafeWorkspace()?.workspaceRoot ?? null;
  const { addItem, refresh } = usePlayground();
  const [cached, setCached] = useState<{ root: string; jobs: ExportJobRow[] } | null>(null);
  const [tags, setTags] = useState('');
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    loadExportJobs(root).then(
      (rows) => {
        if (cancelled) return;
        setCached({ root, jobs: rows.filter((r) => r.status === 'done' && r.outputPath && isExportKind(r.format)) });
      },
      () => {
        if (cancelled) return;
        setCached({ root, jobs: [] });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [root]);

  if (!root) {
    return <p className="border-t border-border p-3 text-[11px] text-muted-foreground">{t('playground.add.noProject')}</p>;
  }

  // A stale cache from another folder renders as loading until its fetch lands.
  const jobs = cached && cached.root === root ? cached.jobs : null;

  const onAdd = (job: ExportJobRow) => {
    if (!job.outputPath || !isExportKind(job.format)) return;
    const title = (titles[job.id] ?? titleFromDir(job.outputPath)).trim() || titleFromDir(job.outputPath);
    setNotice(null);
    addItem({
      title,
      kind: job.format,
      dirPath: job.outputPath,
      sourceProject: root,
      tags: tags.split(','),
    }).then(
      () => {
        setNotice(t('playground.add.added'));
        void refresh();
      },
      (e: unknown) => setNotice(t('playground.add.addFailed', { error: errorMessage(e) })),
    );
  };

  return (
    <div className="shrink-0 border-t border-border p-2">
      <h3 className="px-1 text-[11px] font-semibold text-foreground">{t('playground.add.title')}</h3>
      <input
        aria-label={t('playground.add.tagsLabel')}
        placeholder={t('playground.add.tagsPlaceholder')}
        value={tags}
        onChange={(e) => setTags(e.target.value)}
        className="mt-1.5 h-7 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground"
      />
      <div className="mt-1.5">
        {jobs === null ? (
          <p className="flex items-center gap-2 px-1 py-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('playground.panel.loading')}
          </p>
        ) : jobs.length === 0 ? (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">{t('playground.add.empty')}</p>
        ) : (
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center gap-1 rounded border border-border p-1.5">
                <span className="min-w-0 flex-1 truncate text-[11px] text-foreground" title={job.outputPath ?? job.id}>
                  {titleFromDir(job.outputPath ?? job.id)}
                </span>
                {job.outputPath && (
                  <input
                    aria-label={`${t('playground.add.titleLabel')}: ${titleFromDir(job.outputPath)}`}
                    value={titles[job.id] ?? titleFromDir(job.outputPath)}
                    onChange={(e) => setTitles((s) => ({ ...s, [job.id]: e.target.value }))}
                    className="h-6 w-24 rounded border border-input bg-background px-1.5 text-[11px] text-foreground"
                  />
                )}
                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => onAdd(job)}>
                  <Plus className="h-3 w-3" aria-hidden />
                  {t('playground.add.submit')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {notice && <p role="status" className="mt-1 px-1 text-[11px] text-muted-foreground">{notice}</p>}
    </div>
  );
}

export function PlaygroundPanel() {
  const { t } = useLanguage();
  return (
    <PlaygroundProvider>
      <div data-testid="playground-panel" className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-2">
          <FlaskConical className="h-3.5 w-3.5 text-primary" aria-hidden />
          <h2 className="flex-1 text-xs font-semibold text-foreground">{t('playground.panel.title')}</h2>
        </div>
        <ItemList />
        <AddFromExport />
      </div>
    </PlaygroundProvider>
  );
}

export default PlaygroundPanel;
