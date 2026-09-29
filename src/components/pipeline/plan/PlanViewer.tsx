import { useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
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
import { useSafeAgentSession } from '@/lib/agents/sessionContextValue';
import { PipelineContext } from '@/lib/pipeline/pipelineContextValue';
import { checkpointCommit, checkpointInit } from '@/lib/project/checkpoint';
import {
  DESIGN_PATH,
  loadPlanFiles,
  PLAN_JSON_PATH,
  PLAN_MD_PATH,
  readOptionalFile,
  type PlanFiles,
} from '@/lib/pipeline/planFiles';
import {
  approvePlan,
  requestPlanRevision,
  runPlanFlow,
  type PlanFlowOutcome,
} from '@/lib/pipeline/planStep';
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

// Plan stage viewer: plan/plan.json (+ plan.md, DESIGN.md) with generation (T3.6)
// and approval / revision-request controls (T3.11).
export function PlanViewer() {
  const { t, locale } = useLanguage();
  const root = useSafeWorkspace()?.workspaceRoot ?? null;
  const session = useSafeAgentSession();
  // Null in unit tests (no PipelineProvider); the approval section hides then.
  const pipeline = useContext(PipelineContext);
  const [files, setFiles] = useState<PlanFiles | null>(null);
  const [loading, setLoading] = useState(root !== null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by the refresh button; the effect below re-reads the files.
  const [reloadKey, setReloadKey] = useState(0);

  const [generating, setGenerating] = useState(false);
  const [outcome, setOutcome] = useState<PlanFlowOutcome | null>(null);
  const [approving, setApproving] = useState(false);
  const [revision, setRevision] = useState('');
  const [revising, setRevising] = useState(false);

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

  const generate = useCallback(async () => {
    if (!root || !session) return;
    setGenerating(true);
    setOutcome(null);
    setError(null);
    try {
      const result = await runPlanFlow(
        {
          send: (text) => session.sendPrompt(text),
          load: async () => {
            const [planJson, designMd, planMd] = await Promise.all([
              readOptionalFile(root, PLAN_JSON_PATH),
              readOptionalFile(root, DESIGN_PATH),
              readOptionalFile(root, PLAN_MD_PATH),
            ]);
            return { planJson, designMd, planMd };
          },
        },
        { locale },
      );
      setOutcome(result);
      refresh();
    } catch (e: unknown) {
      setError(t('pipeline.plan.generateFailed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setGenerating(false);
    }
  }, [root, session, locale, refresh, t]);

  const approve = useCallback(async () => {
    if (!root || !pipeline) return;
    setApproving(true);
    setError(null);
    try {
      const result = await approvePlan({
        ensureInit: () => checkpointInit(root).then(() => undefined),
        commit: (message) => checkpointCommit(root, message).then((c) => c.id),
        markApproved: (checkpoint) => {
          const r = pipeline.transition('plan', 'approved', { checkpoint });
          return r.ok ? { ok: true } : { ok: false, reason: r.reason };
        },
      });
      if (!result.ok) {
        setError(t('pipeline.plan.approveFailed', { error: `${result.stage}: ${result.error}` }));
      }
    } catch (e: unknown) {
      setError(t('pipeline.plan.approveFailed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setApproving(false);
    }
  }, [root, pipeline, t]);

  const sendRevision = useCallback(async () => {
    if (!root || !session) return;
    setRevising(true);
    setError(null);
    try {
      const result = await requestPlanRevision(
        {
          send: (text) => session.sendPrompt(text),
          reopen: () => {
            if (!pipeline) return { ok: true };
            const r = pipeline.transition('plan', 'draft');
            return r.ok ? { ok: true } : { ok: false, reason: r.reason };
          },
        },
        { locale, userInput: revision.trim() },
      );
      if (!result.ok) {
        setError(t('pipeline.plan.revisionFailed', { error: result.error }));
      } else {
        setRevision('');
        refresh();
      }
    } catch (e: unknown) {
      setError(t('pipeline.plan.revisionFailed', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setRevising(false);
    }
  }, [root, session, pipeline, revision, locale, refresh, t]);

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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t('pipeline.plan.title')}</h2>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={refresh} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {t('pipeline.plan.refresh')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={generating || !session}
              title={!session ? t('pipeline.plan.noSession') : undefined}
              onClick={() => void generate()}
              data-testid="plan-generate"
            >
              {generating && <Loader2 className="animate-spin" />}
              {t('pipeline.plan.generate')}
            </Button>
          </div>
        </div>

        {generating && (
          <p data-testid="plan-generating" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('pipeline.plan.generating')}
          </p>
        )}
        {outcome && outcome.status !== 'ready' && outcome.status !== 'stopped' && outcome.errors.length > 0 && (
          <div role="alert" data-testid="plan-generation-errors" className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">
              {outcome.status === 'send-failed'
                ? t('pipeline.plan.generateFailed', { error: outcome.sendError ?? '' })
                : t('pipeline.plan.invalid')}
            </p>
            <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-destructive">
              {outcome.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

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

        {files?.plan?.ok && pipeline && pipeline.availability('plan') !== 'locked' && (
          <section aria-label={t('pipeline.plan.approval')} className="space-y-2 rounded-md border border-border p-4">
            {pipeline.availability('plan') === 'complete' ? (
              <p data-testid="plan-approved" className="text-sm text-primary">
                {t('pipeline.plan.approved')}
              </p>
            ) : (
              <>
                <Button
                  type="button"
                  disabled={approving}
                  onClick={() => void approve()}
                  data-testid="plan-approve"
                >
                  {approving && <Loader2 className="animate-spin" />}
                  {t('pipeline.plan.approve')}
                </Button>
                <div className="flex gap-2">
                  <input
                    data-testid="plan-revision"
                    aria-label={t('pipeline.plan.revisionPlaceholder')}
                    placeholder={t('pipeline.plan.revisionPlaceholder')}
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={revision.trim() === '' || revising || !session}
                    onClick={() => void sendRevision()}
                    data-testid="plan-request-changes"
                  >
                    {t('pipeline.plan.requestChanges')}
                  </Button>
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

export default PlanViewer;
