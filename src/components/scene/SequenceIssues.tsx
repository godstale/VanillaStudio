import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { SequenceIssue } from '@/lib/sequence/validate';

/** 시퀀스 검증 결과 목록(오류는 재생·내보내기를 막고, 경고는 안내만 한다). 문제가 없으면 아무것도 그리지 않는다. */
export function SequenceIssues({ issues, saveError }: { issues: readonly SequenceIssue[]; saveError?: string | null }) {
  const { t } = useLanguage();
  if (issues.length === 0 && !saveError) return null;
  const errors = issues.filter((i) => i.severity === 'error');
  return (
    <div data-testid="sequence-issues" className="max-w-sm rounded border border-border bg-card px-3 py-2 text-xs shadow">
      <p className={errors.length > 0 || saveError ? 'flex items-center gap-1 font-medium text-destructive' : 'flex items-center gap-1 font-medium text-warning'}>
        <AlertTriangle className="h-3.5 w-3.5" />
        {t('sequence.issues', { errors: errors.length, warnings: issues.length - errors.length })}
      </p>
      {saveError && (
        <p role="alert" className="mt-1 text-destructive">
          {t('sequence.saveFailed', { reason: saveError })}
        </p>
      )}
      <ul className="mt-1 space-y-1">
        {issues.slice(0, 6).map((i, n) => (
          <li key={n} className={i.severity === 'error' ? 'text-destructive' : 'text-warning'}>
            {i.message}
          </li>
        ))}
        {issues.length > 6 && <li className="text-muted-foreground">{t('sequence.moreIssues', { count: issues.length - 6 })}</li>}
      </ul>
    </div>
  );
}
