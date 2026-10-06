import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnalysisDiff } from './AnalysisDiff';
import type { AnalysisReview } from '@/lib/scene/analysisReview';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { summarizeValue, type RunReview } from '@/lib/scene/writeback';
import { cn } from '@/lib/utils';

export interface DiffDialogProps {
  open: boolean;
  sceneName: string;
  review: RunReview | null;
  /** 레퍼런스 분석 실행이면 분석 파일·DESIGN.md 구간의 변경(T5.5). */
  analysis?: AnalysisReview | null;
  /** 변경을 그대로 둔다(완료 상태 저장). */
  onApprove: () => void;
  /** 화이트리스트 밖에서 바뀐 필드만 실행 전 값으로 되돌린다. */
  onRevertDisallowed: () => void;
  /** scene.json을 실행 전 상태로 되돌린다. */
  onRevertAll: () => void;
  /** 결정을 미루고 닫는다. */
  onClose: () => void;
}

/** 에이전트가 끝난 뒤 scene.json 변경을 보여 주고 승인·되돌림을 받는다(R-2). 허용 목록 밖 변경은 경고로 눈에 띄게 한다. */
export function DiffDialog({ open, sceneName, review, analysis, onApprove, onRevertDisallowed, onRevertAll, onClose }: DiffDialogProps) {
  const { t } = useLanguage();
  if (!review) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl" data-testid="diff-dialog">
        <DialogHeader>
          <DialogTitle>{t('diff.title', { name: sceneName })}</DialogTitle>
          <DialogDescription>{review.state === 'invalid' ? t('diff.invalidDesc') : t('diff.desc')}</DialogDescription>
        </DialogHeader>

        {review.state === 'invalid' ? (
          <ul role="alert" className="list-disc space-y-1 pl-5 text-xs text-destructive">
            {review.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        ) : (
          <div className="space-y-3 text-xs">
            {review.disallowed.length > 0 && (
              <p role="alert" className="flex items-start gap-1 rounded bg-warning/10 p-2 text-warning">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{t('diff.disallowed', { fields: review.disallowed.join(', ') })}</span>
              </p>
            )}
            {!review.entryExists && <p className="text-muted-foreground">{t('diff.noEntry')}</p>}
            {review.changes.length === 0 ? (
              <p className="text-muted-foreground">{t('diff.noChanges')}</p>
            ) : (
              <ul className="space-y-2" data-testid="diff-changes">
                {review.changes.map((c) => (
                  <li key={c.field} className={cn('rounded border p-2', c.allowed ? 'border-border' : 'border-warning')}>
                    <div className="flex items-center gap-2">
                      <code className="font-semibold">{c.field}</code>
                      {!c.allowed && <span className="rounded bg-warning/15 px-1.5 text-warning">{t('diff.notAllowed')}</span>}
                    </div>
                    <div className="mt-1 break-all text-muted-foreground">− {summarizeValue(c.before)}</div>
                    <div className="break-all">+ {summarizeValue(c.after)}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {analysis && <div className="text-xs"><AnalysisDiff analysis={analysis} /></div>}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('diff.later')}
          </Button>
          <Button variant="outline" onClick={onRevertAll}>
            {t('diff.revertAll')}
          </Button>
          {(review.state === 'ok' && review.disallowed.length > 0) || analysis?.disallowed ? (
            <Button variant="outline" onClick={onRevertDisallowed}>
              {t('diff.revertDisallowed')}
            </Button>
          ) : null}
          {review.state === 'ok' && <Button onClick={onApprove}>{t('diff.approve')}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
