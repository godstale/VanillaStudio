import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DesignSummary } from '@/components/design/DesignSummary';
import { AssetList } from '@/components/pipeline/plan/AssetList';
import { ParamsTable } from '@/components/pipeline/plan/ParamsTable';
import { StoryboardCards } from '@/components/pipeline/plan/StoryboardCards';
import { TimelineChart } from '@/components/pipeline/plan/TimelineChart';
import { Button } from '@/components/ui/button';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { loadPlanFiles, type PlanFiles } from '@/lib/pipeline/planFiles';
import type { Plan } from '@/lib/pipeline/schemas/plan';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`plan-${id}`} className="space-y-3">
      <h3 id={`plan-${id}`} className="text-sm font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

const MD_CLASSES =
  'space-y-3 text-sm break-words [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_a]:text-primary [&_a]:underline [&_table]:w-full [&_th]:border [&_td]:border [&_th]:px-2 [&_td]:px-2 [&_th]:border-border [&_td]:border-border';

function PlanBody({ plan, files }: { plan: Plan; files: PlanFiles }) {
  const { t } = useLanguage();
  const { concept } = plan;
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h2 data-testid="plan-title" className="text-lg font-semibold">
          {concept.title}
        </h2>
        {concept.goal && <p className="text-sm">{concept.goal}</p>}
        <p className="text-xs text-muted-foreground">
          {[plan.outputType, `${plan.format.width}×${plan.format.height}`, concept.audience, ...concept.tone]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </header>

      <Section id="storyboard" title={t('pipeline.plan.storyboard')}>
        <StoryboardCards plan={plan} />
      </Section>
      <Section id="timeline" title={t('pipeline.plan.timeline')}>
        <TimelineChart plan={plan} />
      </Section>
      <Section id="assets" title={t('pipeline.plan.assets')}>
        <AssetList plan={plan} />
      </Section>
      <Section id="params" title={t('pipeline.plan.params')}>
        <ParamsTable plan={plan} />
        {plan.customizationNotes && (
          <p className="text-xs text-muted-foreground">{plan.customizationNotes}</p>
        )}
      </Section>
      <Section id="design" title={t('pipeline.plan.design')}>
        {files.designMd === null ? (
          <p className="text-sm text-muted-foreground">{t('pipeline.plan.noDesign')}</p>
        ) : (
          <DesignSummary text={files.designMd} />
        )}
      </Section>
      <Section id="document" title={t('pipeline.plan.document')}>
        {files.planMd === null ? (
          <p className="text-sm text-muted-foreground">{t('pipeline.plan.noDocument')}</p>
        ) : (
          <div data-testid="plan-markdown" className={MD_CLASSES}>
            {/* react-markdown does not render raw HTML, so plan.md from the agent stays inert. */}
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{files.planMd}</ReactMarkdown>
          </div>
        )}
      </Section>
    </div>
  );
}

// Plan stage: read-only viewer of plan/plan.json (+ plan.md, DESIGN.md). Approval controls come with T3.11.
export function PlanViewer() {
  const { t } = useLanguage();
  const root = useSafeWorkspace()?.workspaceRoot ?? null;
  const [files, setFiles] = useState<PlanFiles | null>(null);
  const [loading, setLoading] = useState(root !== null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by the refresh button; the effect below re-reads the files.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    loadPlanFiles(root)
      .then((loaded) => {
        if (cancelled) return;
        setFiles(loaded);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [root, reloadKey]);

  const refresh = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  if (!root) {
    return (
      <p data-testid="plan-no-project" className="p-6 text-sm text-muted-foreground">
        {t('pipeline.plan.noProject')}
      </p>
    );
  }

  return (
    <div data-testid="plan-viewer" className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t('pipeline.plan.title')}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {t('pipeline.plan.refresh')}
          </Button>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
            {t('pipeline.plan.loadFailed', { error })}
          </p>
        )}

        {files && files.plan === null && (
          <p data-testid="plan-empty" className="text-sm text-muted-foreground">
            {t('pipeline.plan.empty')}
          </p>
        )}

        {files?.plan && !files.plan.ok && (
          <div role="alert" data-testid="plan-invalid" className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">{t('pipeline.plan.invalid')}</p>
            <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-destructive">
              {files.plan.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {files?.plan?.ok && <PlanBody plan={files.plan.plan} files={files} />}
      </div>
    </div>
  );
}

export default PlanViewer;
