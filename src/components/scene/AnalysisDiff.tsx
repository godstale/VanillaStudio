import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { AnalysisReview } from '@/lib/scene/analysisReview';
import { summarizeValue } from '@/lib/scene/writeback';
import { cn } from '@/lib/utils';

export interface AnalysisDiffProps {
  analysis: AnalysisReview;
}

const PREVIEW_CHARS = 400;

function Text({ children, tone }: { children: string | null; tone: 'before' | 'after' }) {
  const { t } = useLanguage();
  if (children === null) return <p className="text-muted-foreground">{t('analysisDiff.none')}</p>;
  const shown = children.length > PREVIEW_CHARS ? `${children.slice(0, PREVIEW_CHARS)}…` : children;
  return <pre className={cn('max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-muted p-2', tone === 'before' && 'text-muted-foreground')}>{shown}</pre>;
}

/** 레퍼런스 분석 결과의 변경(분석 파일·DESIGN.md 분석 구간)을 보여 준다. 마커 밖 DESIGN.md 변경은 허용되지 않는 변경으로 경고한다(D-016). */
export function AnalysisDiff({ analysis }: AnalysisDiffProps) {
  const { t } = useLanguage();
  const { files, design } = analysis;
  if (files.length === 0 && !design) return <p className="text-muted-foreground">{t('analysisDiff.noChanges')}</p>;

  return (
    <section data-testid="analysis-diff" className="space-y-2">
      <h3 className="font-semibold">{t('analysisDiff.title')}</h3>
      {files.map((f) => (
        <div key={f.path} className="space-y-1 rounded border border-border p-2">
          <div className="flex items-center gap-2">
            <code className="font-semibold">{f.path}</code>
            <span className="rounded bg-muted px-1.5 text-muted-foreground">{t(`analysisDiff.kind.${f.kind}`)}</span>
          </div>
          {f.kind === 'changed' && <Text tone="before">{f.before}</Text>}
          <Text tone="after">{f.after}</Text>
        </div>
      ))}
      {design && (
        <div className={cn('space-y-1 rounded border p-2', analysis.disallowed ? 'border-warning' : 'border-border')}>
          <code className="font-semibold">DESIGN.md</code>
          {design.broken && (
            <p role="alert" className="flex items-start gap-1 text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('analysisDiff.broken')}
            </p>
          )}
          {design.outsideChanged && !design.broken && (
            <p role="alert" className="flex items-start gap-1 text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('analysisDiff.outside')}
            </p>
          )}
          {!design.broken && design.section.after !== design.section.before && (
            <>
              <p className="text-muted-foreground">{t('analysisDiff.section')}</p>
              {design.section.before !== null && <p className="break-all text-muted-foreground">− {summarizeValue(design.section.before, 200)}</p>}
              <p className="break-all">+ {summarizeValue(design.section.after, 200)}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
