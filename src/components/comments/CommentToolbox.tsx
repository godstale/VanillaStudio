import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import {
  addComment,
  readComments,
  removeComment,
  setCommentStatus,
  writeComments,
  type CommentsFile,
  type RootCauseLayer,
} from '@/lib/scene/comments';
import { syncWorkOrderFiles } from '@/lib/workspace/workOrder';
import { cn } from '@/lib/utils';

export interface CommentScene {
  slug: string;
  sceneId: string;
  name: string;
}

interface Props {
  root: string;
  /** 보여줄 신 목록(시퀀스 화면에서는 전체, 신 화면에서는 선택한 하나). */
  scenes: CommentScene[];
  /** 새로 남길 때 미리 고를 신. */
  defaultSlug?: string;
}

/** 코멘트 목록 + 작성 폼. `scenes/<slug>/comments.json`에 시간·처리 내역과 함께 저장해 에이전트가 인식한다. */
export function CommentToolbox({ root, scenes, defaultSlug }: Props) {
  const { t } = useLanguage();
  const [files, setFiles] = useState<Record<string, CommentsFile>>({});
  const [failed, setFailed] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [layer, setLayer] = useState<RootCauseLayer>('auto');
  const [taxonomy, setTaxonomy] = useState('');
  // 선택한 신이 목록에 없으면 기본값으로 되돌아간다(effect 없이 렌더 중에 결정).
  const target = chosen && scenes.some((s) => s.slug === chosen) ? chosen : (defaultSlug ?? scenes[0]?.slug ?? '');

  useEffect(() => {
    let cancelled = false;
    Promise.all(scenes.map((s) => readComments(root, s.slug, s.sceneId).then((f) => [s.slug, f] as const)))
      .then((rows) => {
        if (!cancelled) {
          setFiles(Object.fromEntries(rows));
          setFailed(false);
        }
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [root, scenes]);

  const mutate = useCallback(
    async (slug: string, next: CommentsFile) => {
      const scene = scenes.find((s) => s.slug === slug);
      if (!scene) return;
      try {
        await writeComments(root, slug, next);
        setFiles((m) => ({ ...m, [slug]: next }));
        void syncWorkOrderFiles(root);
      } catch {
        setFailed(true);
      }
    },
    [root, scenes],
  );

  async function submit() {
    const scene = scenes.find((s) => s.slug === target);
    if (!scene || !draft.trim()) return;
    const base = files[target] ?? { version: 1 as const, sceneId: scene.sceneId, comments: [] };
    const tags = taxonomy.split(',').map((s) => s.trim()).filter(Boolean);
    await mutate(target, addComment(base, draft, new Date().toISOString(), undefined, { layer, taxonomyTags: tags }));
    setDraft('');
  }

  const totalOpen = Object.values(files).flatMap((f) => f.comments).filter((c) => c.status === 'open').length;

  return (
    <div className="flex max-h-full flex-col gap-2 text-xs" data-testid="comment-toolbox">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        <b>{t('comments.title')}</b>
        <span className="text-muted-foreground">{t('comments.openCount', { count: totalOpen })}</span>
      </div>
      {failed && (
        <p role="alert" className="rounded bg-destructive/10 p-2 text-destructive">
          {t('comments.loadFailed')}
        </p>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-auto">
        {scenes.map((s) => {
          const file = files[s.slug];
          if (!file || file.comments.length === 0) return null;
          return (
            <section key={s.slug} aria-label={s.name}>
              <p className="mb-1 font-medium">{s.name}</p>
              <ul className="space-y-1.5">
                {file.comments.map((c) => (
                  <li key={c.id} className={cn('rounded border border-border p-2', c.status === 'done' && 'opacity-60')}>
                    <p className="whitespace-pre-wrap break-words">{c.body}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {c.createdAt} · {t(`comments.status.${c.status}`)} · {t(`comments.layer.${c.layer ?? 'auto'}`)}
                      {(c.taxonomyTags ?? []).length > 0 && ` · ${(c.taxonomyTags ?? []).join(', ')}`}
                    </p>
                    {c.history.length > 1 && (
                      <details className="mt-1 text-[10px] text-muted-foreground">
                        <summary className="cursor-pointer">{t('comments.history')}</summary>
                        <ul className="mt-0.5 list-disc pl-4">
                          {c.history.map((h, i) => (
                            <li key={i}>
                              {h.at} · {t(`comments.action.${h.action}`)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <div className="mt-1 flex gap-1">
                      <button
                        type="button"
                        className="rounded border border-border px-1.5 py-0.5 hover:bg-accent"
                        onClick={() => void mutate(s.slug, setCommentStatus(file, c.id, c.status === 'open' ? 'done' : 'open', new Date().toISOString()))}
                      >
                        {c.status === 'open' ? t('comments.markDone') : t('comments.reopen')}
                      </button>
                      <button
                        type="button"
                        aria-label={t('comments.delete')}
                        title={t('comments.delete')}
                        className="rounded border border-border px-1.5 py-0.5 hover:bg-accent hover:text-destructive"
                        onClick={() => void mutate(s.slug, removeComment(file, c.id))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {Object.keys(files).length > 0 && totalOpen === 0 && Object.values(files).every((f) => f.comments.length === 0) && (
          <p className="text-muted-foreground">{t('comments.empty')}</p>
        )}
      </div>
      <div className="flex flex-col gap-1 border-t border-border pt-2">
        <div className="flex gap-1">
          <select
            aria-label={t('comments.layer')}
            value={layer}
            onChange={(e) => setLayer(e.target.value as RootCauseLayer)}
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-1.5"
          >
            {(['auto', 'brief', 'design-flow', 'visual-direction', 'materials', 'scene-polish'] as const).map((l) => (
              <option key={l} value={l}>
                {t(`comments.layer.${l}`)}
              </option>
            ))}
          </select>
          <input
            value={taxonomy}
            onChange={(e) => setTaxonomy(e.target.value)}
            placeholder={t('comments.taxonomy')}
            aria-label={t('comments.taxonomy')}
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2"
          />
        </div>
        {scenes.length > 1 && (
          <select
            aria-label={t('scenes.list')}
            value={target}
            onChange={(e) => setChosen(e.target.value)}
            className="h-7 rounded-md border border-input bg-background px-1.5"
          >
            {scenes.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder={t('comments.placeholder')}
            aria-label={t('comments.placeholder')}
            className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!draft.trim() || !target}
            className="flex shrink-0 items-center gap-1 rounded border border-border px-2 py-1 hover:bg-accent disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            {t('comments.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
