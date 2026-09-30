import { useCallback, useEffect, useState } from 'react';
import { Camera, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBridge, useBridgeTime } from '@/lib/review/bridgeContextValue';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useSafeAgentSession } from '@/lib/agents/sessionContextValue';
import { checkpointCommit } from '@/lib/project/checkpoint';
import { cn } from '@/lib/utils';
import {
  createRevision,
  listRevisions,
  requestRevisionFix,
  type RevisionRequest,
} from '@/lib/review/revision';

/** Status dot color: open → pending, sent → working, applied/closed → done. */
function statusClass(status: RevisionRequest['status']): string {
  switch (status) {
    case 'open':
      return 'bg-warning';
    case 'sent':
      return 'bg-info';
    default:
      return 'bg-success';
  }
}

function RevisionRow({
  rev,
  busy,
  onSend,
}: {
  rev: RevisionRequest;
  busy: boolean;
  onSend: (rev: RevisionRequest) => void;
}) {
  const { t } = useLanguage();
  const canSend = rev.status === 'open' || rev.status === 'sent';
  return (
    <li className="rounded-md border border-border p-2" data-testid={`revision-${rev.id}`}>
      <div className="flex items-center gap-1.5 text-xs">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', statusClass(rev.status))} aria-hidden />
        <span className="font-medium text-foreground">{rev.id}</span>
        <span className="truncate text-muted-foreground">
          {rev.target}
          {rev.t !== null ? ` · ${rev.t.toFixed(2)}s` : ''}
        </span>
        <span className="ml-auto shrink-0 text-muted-foreground">{t(`review.revision.status.${rev.status}`)}</span>
      </div>
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-foreground">{rev.comment}</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        {rev.screenshot && <span className="text-[11px] text-muted-foreground">{t('review.revision.hasShot')}</span>}
        {canSend && (
          <Button size="sm" variant="outline" className="ml-auto h-6 px-2 text-[11px]" disabled={busy} onClick={() => onSend(rev)}>
            {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
            {t('review.revision.send')}
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Revision requests (T4.18, F-REV-04): pick a target scene + time + comment,
 * attach a Bridge `capture()` screenshot, save `reviews/R-NNN.md`, and send
 * the request to the active agent session (revision prompt → stopReason →
 * checkpoint, the T3.14 contract).
 */
export function RevisionPanel({ root }: { root: string }) {
  const { t, locale } = useLanguage();
  const bridge = useBridge();
  const time = useBridgeTime();
  const session = useSafeAgentSession();
  const scenes = bridge.ready?.scenes ?? [];
  const [target, setTarget] = useState('');
  const [at, setAt] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [withShot, setWithShot] = useState(true);
  const [revisions, setRevisions] = useState<RevisionRequest[]>([]);
  const [creating, setCreating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // New project: drop the draft (render-phase adjustment, not an effect).
  const [prevRoot, setPrevRoot] = useState(root);
  if (prevRoot !== root) {
    setPrevRoot(root);
    setTarget('');
    setAt(null);
    setComment('');
    setError(null);
  }

  const refresh = useCallback(async () => {
    try {
      setRevisions(await listRevisions(root));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [root]);

  useEffect(() => {
    let alive = true;
    listRevisions(root).then(
      (revs) => {
        if (alive) setRevisions(revs);
      },
      (e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      alive = false;
    };
  }, [root]);

  // Defaults, not state: first scene and the live playhead until typed over.
  const effectiveTarget = target || scenes[0]?.id || '';
  const shownAt = at ?? time.t.toFixed(2);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      let captureDataUrl: string | undefined;
      if (withShot && bridge.status === 'ready') {
        try {
          captureDataUrl = (await bridge.capture(1)).dataUrl;
        } catch {
          // A missed capture must not lose the comment: save without a shot.
          captureDataUrl = undefined;
        }
      }
      const parsed = shownAt.trim() === '' ? null : Number(shownAt);
      await createRevision(root, { target: effectiveTarget, t: parsed, comment, captureDataUrl });
      setComment('');
      setAt(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const send = async (rev: RevisionRequest) => {
    const sessionId = session?.active?.sessionId ?? null;
    if (!session || !sessionId) {
      setError(t('review.revision.noSession'));
      return;
    }
    setSendingId(rev.id);
    setError(null);
    try {
      const outcome = await requestRevisionFix(root, rev, {
        send: (prompt) => session.sendPrompt(prompt, sessionId),
        checkpoint: (message) => checkpointCommit(root, message).then((c) => c.id),
        locale,
      });
      if (!outcome.applied) setError(t('review.revision.sendFailed'));
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSendingId(null);
    }
  };

  const canCreate = effectiveTarget.trim() !== '' && comment.trim() !== '' && !creating;
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 p-2" data-testid="revision-panel">
      <h3 className="shrink-0 text-xs font-medium text-foreground">{t('review.revision.title')}</h3>
      <label className="grid shrink-0 gap-1 text-xs">
        <span className="text-muted-foreground">{t('review.revision.target')}</span>
        {scenes.length > 0 ? (
          <select
            value={effectiveTarget}
            onChange={(e) => setTarget(e.target.value)}
            className="h-7 rounded-md border border-border bg-background px-1.5 text-foreground"
          >
            {scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={effectiveTarget}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={t('review.revision.targetPlaceholder')}
            className="h-7 rounded-md border border-border bg-background px-1.5 text-foreground"
          />
        )}
      </label>
      <label className="grid shrink-0 gap-1 text-xs">
        <span className="text-muted-foreground">{t('review.revision.time')}</span>
        <input
          value={shownAt}
          onChange={(e) => setAt(e.target.value)}
          inputMode="decimal"
          placeholder="1.50"
          className="h-7 rounded-md border border-border bg-background px-1.5 text-foreground"
        />
      </label>
      <label className="grid shrink-0 gap-1 text-xs">
        <span className="text-muted-foreground">{t('review.revision.comment')}</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder={t('review.revision.commentPlaceholder')}
          className="rounded-md border border-border bg-background px-1.5 py-1 text-foreground"
        />
      </label>
      <div className="flex shrink-0 items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={withShot} onChange={(e) => setWithShot(e.target.checked)} className="h-3.5 w-3.5" />
          <Camera className="h-3.5 w-3.5" aria-hidden />
          {t('review.revision.withShot')}
        </label>
        <Button size="sm" className="ml-auto h-7 text-xs" disabled={!canCreate} onClick={create}>
          {creating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          {t('review.revision.create')}
        </Button>
      </div>
      {error && (
        <p role="alert" className="shrink-0 break-all text-[11px] text-destructive">
          {error}
        </p>
      )}
      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
        {revisions.length === 0 ? (
          <li className="text-[11px] text-muted-foreground">{t('review.revision.empty')}</li>
        ) : (
          revisions.map((rev) => (
            <RevisionRow key={rev.id} rev={rev} busy={sendingId === rev.id} onSend={send} />
          ))
        )}
      </ul>
    </div>
  );
}

export default RevisionPanel;
