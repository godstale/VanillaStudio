import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { readComments } from '@/lib/scene/comments';
import { readWorkOrder, type WorkOrderFile } from '@/lib/workspace/workOrder';

/** 실행 이력 탭: 앱을 통한 수정 내역(WORK_ORDER.md) + 신 코멘트 처리 내역을 모니터링한다. 에이전트는 직접 실행하지 않는다. */
export function HistorySection({ root, slug, sceneId }: { root: string; slug: string; sceneId: string }) {
  const { t } = useLanguage();
  const [workOrder, setWorkOrder] = useState<WorkOrderFile | null>(null);
  const [history, setHistory] = useState<{ at: string; action: string }[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const wo = await readWorkOrder(root, '');
        const comments = await readComments(root, slug, sceneId).catch(() => null);
        if (cancelled) return;
        setWorkOrder(wo);
        setHistory(comments ? comments.comments.flatMap((c) => c.history.map((h) => ({ at: h.at, action: `${c.id.slice(0, 8)} · ${h.action}` }))) : []);
        setFailed(false);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [root, slug, sceneId]);

  const changes = (workOrder?.changes ?? []).filter((c) => c.targetId === sceneId || (c.targetName ?? '').includes(slug));

  return (
    <div className="flex flex-col gap-3 text-xs" data-testid="history-section">
      <section>
        <h3 className="mb-1 font-medium">{t('history.studioChanges')}</h3>
        {failed && <p className="text-muted-foreground">{t('history.loadFailed')}</p>}
        {!failed && changes.length === 0 && <p className="text-muted-foreground">{t('history.emptyChanges')}</p>}
        <ul className="space-y-1.5">
          {changes.map((c) => (
            <li key={c.id} className="rounded border border-border p-2">
              <p className="break-words">{c.summary}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {c.at} · {c.status}
                {(c.fields ?? []).length > 0 ? ` · ${(c.fields ?? []).join(', ')}` : ''}
              </p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="mb-1 font-medium">{t('history.commentHistory')}</h3>
        {history.length === 0 ? (
          <p className="text-muted-foreground">{t('history.emptyHistory')}</p>
        ) : (
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {history.slice(-20).map((h, i) => (
              <li key={i}>
                {h.at} · {h.action}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
