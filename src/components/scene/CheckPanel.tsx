import { useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { runSceneCheck, type Finding } from '@/lib/scene/check';
import type { Scene } from '@/lib/scene/schema';

export interface CheckPanelProps {
  root: string;
  slug: string;
  scene: Scene;
}

/** 계약 검사([검사] 버튼): 금지 시간 API·하드코딩 색·defineScene·Text Fidelity·beats/endCard. 결과는 `.vanilla/self-check.md`에도 쓴다. */
export function CheckPanel({ root, slug, scene }: CheckPanelProps) {
  const { t } = useLanguage();
  const [state, setState] = useState<{ phase: 'idle' | 'running' | 'done' | 'failed'; findings: Finding[]; error?: string }>({ phase: 'idle', findings: [] });
  const run = () => {
    setState({ phase: 'running', findings: [] });
    runSceneCheck(root, slug, scene)
      .then((r) => setState({ phase: 'done', findings: r.findings }))
      .catch((e: unknown) => setState({ phase: 'failed', findings: [], error: e instanceof Error ? e.message : String(e) }));
  };
  const errors = state.findings.filter((f) => f.severity === 'error').length;
  return (
    <section data-testid="check-panel" className="flex flex-col gap-2 border-t border-border pt-3 text-xs">
      <div className="flex items-center gap-2">
        <b className="flex-1">{t('check.title')}</b>
        <Button size="sm" variant="outline" onClick={run} disabled={state.phase === 'running'}>
          {state.phase === 'running' ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
          {t('check.run')}
        </Button>
      </div>
      {state.phase === 'failed' && <p role="alert" className="text-destructive">{t('check.failed', { error: state.error ?? '' })}</p>}
      {state.phase === 'done' && (
        <>
          <p role="status" className={errors === 0 ? 'flex items-center gap-1 text-success' : 'flex items-center gap-1 text-destructive'}>
            {errors === 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {errors === 0 ? t('check.pass', { warnings: state.findings.length }) : t('check.fail', { errors, warnings: state.findings.length - errors })}
          </p>
          <ul className="flex flex-col gap-1">
            {state.findings.map((f, i) => (
              <li key={i} className={f.severity === 'error' ? 'text-destructive' : 'text-warning'}>
                <code>{f.rule}</code> {f.message}
                {f.file && <span className="text-muted-foreground"> ({f.file}{f.line ? `:${f.line}` : ''})</span>}
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground">{t('check.saved')}</p>
        </>
      )}
    </section>
  );
}
