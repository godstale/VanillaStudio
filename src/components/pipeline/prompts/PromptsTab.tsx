import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useSafeAgentSession } from '@/lib/agents/sessionContextValue';
import { usePipeline } from '@/lib/pipeline/pipelineContextValue';
import { assemblePrompt } from '@/lib/pipeline/assemble';
import { checkpointCommit, checkpointInit } from '@/lib/project/checkpoint';
import { cn } from '@/lib/utils';
import { PromptEditor } from './PromptEditor';
import { TaskGraph } from './TaskGraph';
import {
  buildPromptTree,
  listPromptFiles,
  loadTasksFile,
  readPromptFile,
  savePromptFile,
  type TasksSnapshot,
} from './promptsFiles';
import { runPromptsFlow, type PromptsFlowOutcome } from './promptsFlow';

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

type GenState = 'idle' | 'working' | 'done';

/**
 * Prompts stage (F-PIP-04): generation request, file-tree editor (CodeMirror),
 * tasks.json validation + graph, and approval.
 */
export function PromptsTab() {
  const { t, locale } = useLanguage();
  const root = useSafeWorkspace()?.workspaceRoot ?? null;
  const session = useSafeAgentSession();
  const { availability, transition } = usePipeline();

  const [files, setFiles] = useState<string[]>([]);
  const [tasks, setTasks] = useState<TasksSnapshot>({ text: null, parsed: null });
  const [loading, setLoading] = useState(root !== null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<string | null>(null);
  const [original, setOriginal] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const [gen, setGen] = useState<GenState>('idle');
  const [outcome, setOutcome] = useState<PromptsFlowOutcome | null>(null);
  const [approving, setApproving] = useState(false);
  const [revision, setRevision] = useState('');
  const [revising, setRevising] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    void Promise.all([listPromptFiles(root), loadTasksFile(root)])
      .then(([listed, loaded]) => {
        if (cancelled) return;
        setFiles(listed);
        setTasks(loaded);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(t('pipeline.prompts.loadFailed', { error: errorMessage(e) }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Reloading on locale change would discard unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, reloadKey]);

  const openFile = useCallback(
    async (rel: string) => {
      if (!root) return;
      setSelected(rel);
      try {
        const text = await readPromptFile(root, rel);
        setOriginal(text);
        setDraft(text);
        setError(null);
      } catch (e) {
        setOriginal(null);
        setError(t('pipeline.prompts.loadFailed', { error: errorMessage(e) }));
      }
    },
    [root, t],
  );

  const dirty = original !== null && draft !== original;

  const save = useCallback(async () => {
    if (!root || !selected || original === null) return;
    setSaving(true);
    try {
      await savePromptFile(root, selected, draft);
      setOriginal(draft);
      setError(null);
    } catch (e) {
      setError(t('pipeline.prompts.saveFailed', { error: errorMessage(e) }));
    } finally {
      setSaving(false);
    }
  }, [root, selected, original, draft, t]);

  const generate = useCallback(async () => {
    if (!root || !session) return;
    setGen('working');
    setOutcome(null);
    setError(null);
    try {
      const result = await runPromptsFlow(
        {
          send: (text) => session.sendPrompt(text),
          load: async () => ({ tasksJson: (await loadTasksFile(root)).text }),
        },
        { locale },
      );
      setOutcome(result);
      setGen('done');
      refresh();
    } catch (e) {
      setError(t('pipeline.prompts.generateFailed', { error: errorMessage(e) }));
      setGen('idle');
    }
  }, [root, session, locale, refresh, t]);

  const approve = useCallback(async () => {
    if (!root) return;
    setApproving(true);
    setError(null);
    try {
      await checkpointInit(root);
      const commit = await checkpointCommit(root, 'prompts approved');
      const r = transition('prompts', 'approved', { checkpoint: commit.id });
      if (!r.ok) setError(t('pipeline.prompts.approveFailed', { error: r.reason }));
    } catch (e) {
      setError(t('pipeline.prompts.approveFailed', { error: errorMessage(e) }));
    } finally {
      setApproving(false);
    }
  }, [root, transition, t]);

  const requestChanges = useCallback(async () => {
    if (!root || !session || revision.trim() === '') return;
    setRevising(true);
    setError(null);
    try {
      await session.sendPrompt(assemblePrompt({ kind: 'prompts', locale, userInput: revision.trim() }));
      transition('prompts', 'draft');
      setRevision('');
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(t('pipeline.prompts.revisionFailed', { error: errorMessage(e) }));
    } finally {
      setRevising(false);
    }
  }, [root, session, revision, locale, transition, t]);

  const tree = useMemo(() => buildPromptTree(files), [files]);
  const validTasks = tasks.parsed?.ok ? tasks.parsed : null;
  const taskErrors = tasks.parsed && !tasks.parsed.ok ? tasks.parsed.errors : [];
  const promptsAvailability = availability('prompts');

  if (!root) {
    return (
      <p data-testid="prompts-no-project" className="p-6 text-sm text-muted-foreground">
        {t('pipeline.prompts.noProject')}
      </p>
    );
  }

  return (
    <div data-testid="prompts-tab" className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t('pipeline.prompts.title')}</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {t('pipeline.prompts.refresh')}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={gen === 'working' || !session}
              title={!session ? t('pipeline.prompts.noSession') : undefined}
              onClick={() => void generate()}
              data-testid="prompts-generate"
            >
              {gen === 'working' && <Loader2 className="animate-spin" />}
              {t('pipeline.prompts.generate')}
            </Button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {gen === 'working' && (
          <p data-testid="prompts-generating" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('pipeline.prompts.generating')}
          </p>
        )}
        {outcome && outcome.status === 'ready' && (
          <p data-testid="prompts-ready" className="text-sm text-primary">
            {t('pipeline.prompts.ready')}
          </p>
        )}

        {files.length === 0 && !loading ? (
          <p data-testid="prompts-empty" className="text-sm text-muted-foreground">
            {t('pipeline.prompts.empty')}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[240px_1fr]">
            <nav aria-label={t('pipeline.prompts.tree')} className="space-y-3" data-testid="prompts-tree">
              {tree.map((group) => (
                <div key={group.dir || '.'} className="space-y-1">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {group.dir}
                  </p>
                  <ul className="space-y-0.5">
                    {group.files.map((f) => (
                      <li key={f}>
                        <button
                          type="button"
                          onClick={() => void openFile(f)}
                          data-testid={`prompt-file-${f}`}
                          className={cn(
                            'w-full truncate rounded-md px-2 py-1 text-left font-mono text-xs hover:bg-accent/60',
                            selected === f ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {f.split('/').pop()}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="min-h-64">
              {selected === null ? (
                <p className="text-sm text-muted-foreground">{t('pipeline.prompts.selectFile')}</p>
              ) : original === null ? (
                <p className="text-sm text-muted-foreground">{t('pipeline.prompts.generating')}</p>
              ) : (
                <div className="flex h-96 flex-col gap-2">
                  <div className="min-h-0 flex-1">
                    <PromptEditor file={selected} value={draft} onChange={setDraft} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
                      {saving ? t('pipeline.prompts.saving') : t('pipeline.prompts.save')}
                    </Button>
                    <span data-testid="prompt-save-state" className="text-xs text-muted-foreground">
                      {dirty ? t('pipeline.prompts.unsaved') : t('pipeline.prompts.saved')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {taskErrors.length > 0 && (
          <div role="alert" data-testid="prompts-tasks-invalid" className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">{t('pipeline.prompts.tasksInvalid')}</p>
            <ul className="list-disc space-y-1 pl-5 font-mono text-xs text-destructive">
              {taskErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {validTasks && <TaskGraph tasks={validTasks.tasks} />}

        {validTasks && promptsAvailability !== 'locked' && (
          <section aria-label={t('pipeline.prompts.approval')} className="space-y-2 rounded-md border border-border p-4">
            {promptsAvailability === 'complete' ? (
              <p data-testid="prompts-approved" className="text-sm text-primary">
                {t('pipeline.prompts.approved')}
              </p>
            ) : (
              <>
                <Button
                  type="button"
                  disabled={approving}
                  onClick={() => void approve()}
                  data-testid="prompts-approve"
                >
                  {approving && <Loader2 className="animate-spin" />}
                  {t('pipeline.prompts.approve')}
                </Button>
                <div className="flex gap-2">
                  <input
                    data-testid="prompts-revision"
                    aria-label={t('pipeline.prompts.revisionPlaceholder')}
                    placeholder={t('pipeline.prompts.revisionPlaceholder')}
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={revision.trim() === '' || revising || !session}
                    onClick={() => void requestChanges()}
                    data-testid="prompts-request-changes"
                  >
                    {t('pipeline.prompts.requestChanges')}
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

export default PromptsTab;
