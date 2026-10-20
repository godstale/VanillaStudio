import { useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Sequence } from '@/lib/sequence/schema';
import type { SequenceIssue } from '@/lib/sequence/validate';
import type { Scene } from '@/lib/scene/schema';
import type { WorkOrderChange, WorkOrderCommentEntry } from '@/lib/workspace/workOrder';

export interface SceneStatusRow {
  slug: string;
  scene?: Scene;
  error?: string;
  hasDesignOverride: boolean;
  hasGuide: boolean;
}

interface StatusCardsProps {
  workspaceName: string;
  canvas: { width: number; height: number; fps: number };
  sequence: Sequence | null;
  seqError: string | null;
  issues: SequenceIssue[];
  scenes: SceneStatusRow[];
  designText: string | null;
  changes: WorkOrderChange[];
  comments: WorkOrderCommentEntry[];
  loadErrors: string[];
}

function CardShell({ title, summary, onOpen, testId }: { title: string; summary: string; onOpen: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid={testId}
      className="space-y-1 rounded-lg border border-border p-4 text-left hover:bg-accent/40"
    >
      <h2 className="text-sm font-bold">{title}</h2>
      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{summary}</p>
    </button>
  );
}

/** 시퀀스 현재 설정 + 디자인 가이드 상태. 클릭하면 상세 팝업. */
function SequenceCard({ workspaceName, canvas, sequence, seqError, issues, designText }: Pick<StatusCardsProps, 'workspaceName' | 'canvas' | 'sequence' | 'seqError' | 'issues' | 'designText'>) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const summary = sequence
    ? `${workspaceName} · ${t(`sequence.mode.${sequence.mode}`)} · ${t('storyboard.seqNodes', { count: sequence.nodes.length })} · ${t('storyboard.seqEdges', { count: sequence.edges.length })}\n${t('sequence.issues', { errors, warnings })} · ${designText ? t('storyboard.designOk') : t('storyboard.designMissing')}`
    : (seqError ?? t('storyboard.empty'));
  return (
    <>
      <CardShell title={t('storyboard.seqCard')} summary={summary} onOpen={() => setOpen(true)} testId="storyboard-seq-card" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{t('storyboard.seqCard')}</DialogTitle>
            <DialogDescription>
              {workspaceName} · {canvas.width}x{canvas.height}@{canvas.fps}fps
            </DialogDescription>
          </DialogHeader>
          {sequence ? (
            <div className="space-y-3 text-xs">
              <p>
                {t(`sequence.mode.${sequence.mode}`)} · {t('storyboard.seqStart', { start: sequence.start ?? '-' })}
              </p>
              <div>
                <h3 className="font-semibold">{t('storyboard.seqEdgesTitle')}</h3>
                {sequence.edges.length === 0 ? (
                  <p className="text-muted-foreground">{t('storyboard.empty')}</p>
                ) : (
                  <ul className="list-disc space-y-0.5 pl-5">
                    {sequence.edges.map((e, i) => (
                      <li key={i}>
                        {e.from} → {e.to} · {e.trigger} · {e.transition.type} {e.transition.durationMs}ms
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="font-semibold">{t('sequence.issues', { errors, warnings })}</h3>
                {issues.length === 0 ? (
                  <p className="text-muted-foreground">{t('storyboard.noIssues')}</p>
                ) : (
                  <ul className="list-disc space-y-0.5 pl-5">
                    {issues.map((iss, i) => (
                      <li key={i} className={iss.severity === 'error' ? 'text-destructive' : ''}>
                        {iss.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="font-semibold">{t('storyboard.designTitle')}</h3>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-2">{designText ?? t('storyboard.designMissing')}</pre>
              </div>
            </div>
          ) : (
            <p role="alert" className="text-xs text-destructive">{seqError ?? t('storyboard.empty')}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** 신별 설정 + 디자인 가이드 상태. 행 클릭하면 상세 팝업. */
function ScenesCard({ scenes }: { scenes: SceneStatusRow[] }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<SceneStatusRow | null>(null);
  const summary =
    scenes.length === 0
      ? t('storyboard.empty')
      : scenes
          .map((s) =>
            s.scene
              ? `${s.scene.name} [${t(`scene.type.${s.scene.type}`)}/${t(`scene.status.${s.scene.status}`)}] ${s.hasDesignOverride ? t('storyboard.overrideOn') : t('storyboard.overrideOff')} ${s.hasGuide ? t('storyboard.guideOn') : t('storyboard.guideOff')}`
              : `${s.slug} (${t('scene.invalid')})`,
          )
          .join('\n');
  const detail = selected?.scene;
  const stepCount =
    detail && detail.type === 'static'
      ? detail.mode === 'steps'
        ? detail.steps.length
        : 1
      : detail && (detail.type === 'motion' || detail.type === '3d')
        ? detail.beats.length
        : null;
  return (
    <>
      <section className="space-y-2 rounded-lg border border-border p-4" aria-label={t('storyboard.scenesCard')}>
        <h2 className="text-sm font-bold">{t('storyboard.scenesCard')}</h2>
        {scenes.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('storyboard.empty')}</p>
        ) : (
          <ul className="space-y-1" data-testid="storyboard-scenes-card">
            {scenes.map((s) => (
              <li key={s.slug}>
                <button
                  type="button"
                  onClick={() => setSelected(s)}
                  className="w-full rounded border border-border px-2 py-1.5 text-left text-xs hover:bg-accent/40"
                >
                  <span className="block truncate font-medium">{s.scene?.name ?? s.slug}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {s.scene
                      ? `${t(`scene.type.${s.scene.type}`)} · ${t(`scene.status.${s.scene.status}`)} · ${s.scene.template} · ${s.hasDesignOverride ? t('storyboard.overrideOn') : t('storyboard.overrideOff')} · ${s.hasGuide ? t('storyboard.guideOn') : t('storyboard.guideOff')}`
                      : t('scene.invalid')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="sr-only">{summary}</p>
      </section>
      <Dialog open={selected !== null} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selected?.scene?.name ?? selected?.slug}</DialogTitle>
            <DialogDescription>{selected?.slug}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-xs">
              {selected.error && (
                <p role="alert" className="text-destructive">{selected.error}</p>
              )}
              {detail && (
                <>
                  <p>
                    {t(`scene.type.${detail.type}`)} · {t(`scene.status.${detail.status}`)} · {detail.template}
                  </p>
                  <p>
                    {t('storyboard.sceneSteps', { count: stepCount ?? 0 })} · {t('storyboard.sceneEntry', { entry: detail.runtime.entry })}
                  </p>
                  <p className="text-muted-foreground">
                    {selected.hasDesignOverride ? t('storyboard.overrideOn') : t('storyboard.overrideOff')} · {selected.hasGuide ? t('storyboard.guideOn') : t('storyboard.guideOff')}
                  </p>
                  <p className="whitespace-pre-wrap text-muted-foreground">
                    {detail.brief.subject} {detail.brief.goal} {detail.brief.message}
                  </p>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** 수정 이력. 클릭하면 전체 목록 팝업. */
function HistoryCard({ changes, comments }: { changes: WorkOrderChange[]; comments: WorkOrderCommentEntry[] }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const openChanges = changes.filter((c) => c.status === 'open');
  const openComments = comments.filter((c) => c.status === 'open');
  const summary = `${t('storyboard.historyOpen', { changes: openChanges.length, comments: openComments.length })}\n${[...openChanges].slice(-3).map((c) => `· ${c.summary}`).join('\n')}`;
  return (
    <>
      <CardShell title={t('storyboard.historyCard')} summary={summary.trim() || t('storyboard.empty')} onOpen={() => setOpen(true)} testId="storyboard-history-card" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{t('storyboard.historyCard')}</DialogTitle>
            <DialogDescription>{t('storyboard.historyOpen', { changes: openChanges.length, comments: openComments.length })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-xs">
            <div>
              <h3 className="font-semibold">{t('history.studioChanges')}</h3>
              {changes.length === 0 ? (
                <p className="text-muted-foreground">{t('history.emptyChanges')}</p>
              ) : (
                <ul className="list-disc space-y-0.5 pl-5">
                  {changes.slice(-20).reverse().map((c) => (
                    <li key={c.id}>
                      [{c.status}] [{c.scope}] {c.targetName ?? c.targetId} · {c.at} — {c.summary}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="font-semibold">{t('history.commentHistory')}</h3>
              {comments.length === 0 ? (
                <p className="text-muted-foreground">{t('history.emptyHistory')}</p>
              ) : (
                <ul className="list-disc space-y-0.5 pl-5">
                  {comments.slice(-20).reverse().map((c) => (
                    <li key={c.id}>
                      [{c.status}] {c.slug} · {c.createdAt} — {c.body}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** 워크스페이스 로딩·동작 중 오류. 클릭하면 전체 목록 팝업. */
function ErrorsCard({ loadErrors }: { loadErrors: string[] }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const summary = loadErrors.length === 0 ? t('storyboard.noErrors') : `${t('storyboard.errorCount', { count: loadErrors.length })}\n${loadErrors.slice(0, 3).join('\n')}`;
  return (
    <>
      <CardShell title={t('storyboard.errorsCard')} summary={summary} onOpen={() => setOpen(true)} testId="storyboard-errors-card" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{t('storyboard.errorsCard')}</DialogTitle>
            <DialogDescription>{t('storyboard.errorCount', { count: loadErrors.length })}</DialogDescription>
          </DialogHeader>
          {loadErrors.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('storyboard.noErrors')}</p>
          ) : (
            <ul role="alert" className="list-disc space-y-1 pl-5 text-xs text-destructive">
              {loadErrors.map((e, i) => (
                <li key={i} className="break-words">{e}</li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StatusCards(props: StatusCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SequenceCard workspaceName={props.workspaceName} canvas={props.canvas} sequence={props.sequence} seqError={props.seqError} issues={props.issues} designText={props.designText} />
      <ScenesCard scenes={props.scenes} />
      <HistoryCard changes={props.changes} comments={props.comments} />
      <ErrorsCard loadErrors={props.loadErrors} />
    </div>
  );
}
