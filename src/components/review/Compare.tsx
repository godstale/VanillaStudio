import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { checkpointHistory, shortCheckpointId, type CheckpointEntry } from '@/lib/project/checkpoint';
import {
  listRevisions,
  loadRevisionScreenshot,
  type RevisionRequest,
} from '@/lib/review/revision';
import { cn } from '@/lib/utils';

export interface CompareShot {
  /** Image to show (`<img src>`); null renders the empty slot. */
  src: string | null;
  label: string;
  caption: string | null;
}

/** Two screenshots side by side (T4.19, F-REV-05). Pure: no data loading. */
export function Compare({ before, after }: { before: CompareShot; after: CompareShot }) {
  const { t } = useLanguage();
  const shots: Array<{ shot: CompareShot; testid: string }> = [
    { shot: before, testid: 'compare-before' },
    { shot: after, testid: 'compare-after' },
  ];
  return (
    <div className="grid h-full min-h-0 grid-cols-2 gap-2" data-testid="compare">
      {shots.map(({ shot, testid }) => (
        <figure key={testid} data-testid={testid} className="flex min-h-0 min-w-0 flex-col gap-1">
          <figcaption className="flex shrink-0 items-baseline gap-1.5 truncate text-[11px]">
            <span className="font-medium text-foreground">{shot.label}</span>
            {shot.caption && <span className="truncate text-muted-foreground">{shot.caption}</span>}
          </figcaption>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
            {shot.src ? (
              // Screenshots are app-generated PNGs, not user copy: alt stays generic.
              <img src={shot.src} alt={t('review.compare.shotAlt')} className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="p-2 text-center text-[11px] text-muted-foreground">{t('review.compare.noShot')}</span>
            )}
          </div>
        </figure>
      ))}
    </div>
  );
}

/** Screenshot nearest to (at or before) a checkpoint: revisions are timestamped. */
function shotForCheckpoint(history: RevisionRequest[], at: string): RevisionRequest | null {
  const mark = Date.parse(at);
  if (Number.isNaN(mark)) return null;
  let best: RevisionRequest | null = null;
  for (const rev of history) {
    if (!rev.screenshot) continue;
    const created = Date.parse(rev.createdAt);
    if (Number.isNaN(created) || created > mark) continue;
    if (!best || Date.parse(best.createdAt) <= created) best = rev;
  }
  return best;
}

interface SideState {
  checkpoint: string;
  rev: RevisionRequest | null;
  src: string | null;
}

/**
 * Checkpoint before/after comparison: pick two checkpoints, each side shows
 * the nearest earlier revision screenshot (or the empty slot when nobody
 * captured one). Screenshots come from `reviews/` (T4.18) via the asset-safe
 * data-URL loader — no file URLs, no extra Tauri commands.
 */
export function CheckpointCompare({ root }: { root: string }) {
  const { t } = useLanguage();
  const [history, setHistory] = useState<CheckpointEntry[]>([]);
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [shots, setShots] = useState<Record<string, string>>({});
  const [selA, setSelA] = useState('');
  const [selB, setSelB] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // New project: drop the selection (render-phase adjustment, not an effect).
  const [prevRoot, setPrevRoot] = useState(root);
  if (prevRoot !== root) {
    setPrevRoot(root);
    setSelA('');
    setSelB('');
  }

  const loadAll = useCallback(async () => {
    const [h, r] = await Promise.all([checkpointHistory(root, 20), listRevisions(root)]);
    const cache: Record<string, string> = {};
    for (const rev of r) {
      if (!rev.screenshot) continue;
      const src = await loadRevisionScreenshot(root, rev);
      if (src) cache[rev.id] = src;
    }
    return { history: h, revisions: r, shots: cache };
  }, [root]);

  const applyLoaded = useCallback((data: Awaited<ReturnType<typeof loadAll>>) => {
    setHistory(data.history);
    setRevisions(data.revisions);
    setShots(data.shots);
    setSelA((prev) => prev || data.history[1]?.id || data.history[0]?.id || '');
    setSelB((prev) => prev || data.history[0]?.id || '');
    setLoading(false);
  }, []);
  const applyFailed = useCallback((e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    loadAll().then(
      (data) => {
        if (alive) applyLoaded(data);
      },
      (e: unknown) => {
        if (alive) applyFailed(e);
      },
    );
    return () => {
      alive = false;
    };
  }, [loadAll, applyLoaded, applyFailed]);

  const onRefresh = () => {
    setLoading(true);
    setError(null);
    loadAll().then(applyLoaded, applyFailed);
  };

  const side = (id: string): SideState => {
    const entry = history.find((h) => h.id === id) ?? null;
    const rev = entry ? shotForCheckpoint(revisions, entry.at) : null;
    return { checkpoint: id, rev, src: rev ? (shots[rev.id] ?? null) : null };
  };
  const a = side(selA);
  const b = side(selB);

  const shotOf = (s: SideState): CompareShot => ({
    src: s.src,
    label: s.checkpoint ? shortCheckpointId(s.checkpoint) : t('review.compare.pick'),
    caption: s.rev ? `${s.rev.id} · ${s.rev.target}` : null,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2" data-testid="checkpoint-compare">
      <div className="flex shrink-0 items-center gap-1.5">
        <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <h3 className="text-xs font-medium text-foreground">{t('review.compare.title')}</h3>
        <Button size="sm" variant="ghost" className="ml-auto h-6 px-2 text-[11px]" onClick={onRefresh}>
          {t('review.compare.refresh')}
        </Button>
      </div>
      {loading ? (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('review.compare.loading')}
        </p>
      ) : history.length < 1 ? (
        <p className="text-[11px] text-muted-foreground">{t('review.compare.empty')}</p>
      ) : (
        <>
          <div className="grid shrink-0 grid-cols-2 gap-2">
            {[
              { value: selA, set: setSelA, testid: 'compare-select-a' },
              { value: selB, set: setSelB, testid: 'compare-select-b' },
            ].map(({ value, set, testid }) => (
              <select
                key={testid}
                data-testid={testid}
                value={value}
                onChange={(e) => set(e.target.value)}
                className={cn('h-7 min-w-0 rounded-md border border-border bg-background px-1.5 text-xs text-foreground')}
              >
                {history.map((h) => (
                  <option key={h.id} value={h.id}>
                    {shortCheckpointId(h.id)} · {h.message}
                  </option>
                ))}
              </select>
            ))}
          </div>
          {error && (
            <p role="alert" className="shrink-0 break-all text-[11px] text-destructive">
              {error}
            </p>
          )}
          <div className="min-h-0 flex-1">
            <Compare before={shotOf(a)} after={shotOf(b)} />
          </div>
        </>
      )}
    </div>
  );
}

export default Compare;
