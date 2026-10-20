import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { listScenes } from '@/lib/scene/files';
import { readSequence } from '@/lib/sequence/file';
import { readWorkspace } from '@/lib/workspace/file';
import { projectPath, readOptionalFile } from '@/lib/workspace/files';
import {
  CONTENT_JSON_PLACEHOLDER,
  DESIGN_FLOW_PLACEHOLDER,
  ITEMS_JSON_PLACEHOLDER,
  VISUAL_PLACEHOLDER,
  isAgentStarted,
  readStoryboard,
  renderBriefMd,
  renderWorkOrderBriefMd,
} from '@/lib/storyboard/files';
import { serializeStoryboard, type StoryboardFile, type StoryboardMediaIntent } from '@/lib/storyboard/schema';

const INTENTS: StoryboardMediaIntent[] = ['web', 'image', 'slide', 'motion'];

/** 에이전트 시작 감시 주기. 저장은 끝났지만 에이전트가 파일을 만들기 전에는 이 화면을 유지한다. */
const POLL_MS = 3000;

interface Props {
  root: string;
  /** 저장된 작업 지시서. 있으면 값을 채워 재편집 모드로 보여준다. */
  initial: StoryboardFile | null;
  /** 에이전트가 파일 생성을 시작하면 스토리보드 화면으로 넘어간다. */
  onAgentStarted: () => void;
}

function splitLines(s: string): string[] {
  return s.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** 에이전트가 3대 문서·재료·시퀀스·신 중 하나라도 만들기 시작했는가. 빈 스캐폴딩은 시작이 아니다. */
async function checkAgentStarted(root: string, workspaceId: string): Promise<boolean> {
  try {
    const { file, raw } = await readStoryboard(root);
    if (file && isAgentStarted(file, raw)) return true;
    const seq = await readSequence(root, workspaceId).catch(() => null);
    if (seq && seq.nodes.length > 0) return true;
    const scenes = await listScenes(root).catch(() => []);
    return scenes.some((e) => e.scene != null);
  } catch {
    return false;
  }
}

/**
 * 문서 미작성 상태: 간단 작업 지시서 작성 + 에이전트 시작 안내.
 * 저장 후에도 이 화면을 유지하고, 에이전트가 파일 생성을 시작했을 때만
 * `onAgentStarted`로 스토리보드 화면에 넘긴다. 시작 전에는 다시 저장할 수 있다.
 */
export function StoryboardOnboarding({ root, initial, onAgentStarted }: Props) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(initial?.brief?.title ?? '');
  const [intent, setIntent] = useState<StoryboardMediaIntent>(initial?.brief?.mediaIntent ?? 'web');
  const [oneLiner, setOneLiner] = useState(initial?.brief?.oneLiner ?? '');
  const [purpose, setPurpose] = useState(initial?.brief?.purpose ?? '');
  const [inScope, setInScope] = useState((initial?.brief?.inScope ?? []).join('\n'));
  const [nonGoals, setNonGoals] = useState((initial?.brief?.nonGoals ?? []).join('\n'));
  const [advancedOpen, setAdvancedOpen] = useState(
    () => (initial?.brief?.purpose ?? '') !== '' || (initial?.brief?.inScope ?? []).length > 0 || (initial?.brief?.nonGoals ?? []).length > 0,
  );
  const [errors, setErrors] = useState<{ title: string | null; oneLiner: string | null }>({ title: null, oneLiner: null });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(initial !== null);
  const [failed, setFailed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    readWorkspace(root)
      .then((ws) => {
        if (live) setWorkspaceId(ws.workspaceId);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [root]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      if (await checkAgentStarted(root, workspaceId)) {
        cancelled = true;
        onAgentStarted();
      }
    };
    const id = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [root, workspaceId, onAgentStarted]);

  async function save() {
    const nextErrors = {
      title: title.trim() ? null : t('storyboard.required'),
      oneLiner: oneLiner.trim() ? null : t('storyboard.required'),
    };
    setErrors(nextErrors);
    if (nextErrors.title || nextErrors.oneLiner) return;
    setSaving(true);
    setFailed(null);
    try {
      const ws = await readWorkspace(root);
      // 에이전트나 외부 편집이 그 사이 건드렸을 수 있어 설계·비주얼은 병합 보존한다.
      const prev = await readStoryboard(root)
        .then((r) => r.file)
        .catch(() => null);
      const brief = {
        title: title.trim(),
        oneLiner: oneLiner.trim(),
        mediaIntent: intent,
        purpose: purpose.trim(),
        inScope: splitLines(inScope),
        nonGoals: splitLines(nonGoals),
      };
      const sb: StoryboardFile = {
        version: 1,
        workspaceId: ws.workspaceId,
        stage: 'briefing',
        brief,
        designFlow: prev?.designFlow ?? { narrativeArc: '', dataSchemas: [], assemblyPlan: [] },
        visualDirection: prev?.visualDirection ?? { moodKeywords: [], themeStages: [], invariants: [], variables: [], selectedTaxonomy: [] },
      };
      const writes: Record<string, string> = {
        'storyboard/storyboard.json': serializeStoryboard(sb),
        'storyboard/01-brief.md': renderBriefMd(brief.title, brief.oneLiner, brief.purpose, brief.inScope, brief.nonGoals),
        'WORK_ORDER.md': renderWorkOrderBriefMd(ws.name, brief.title, intent, brief.oneLiner),
      };
      // 자리 표시자 문서는 없을 때만 만든다. 이미 있으면(에이전트 산출물일 수 있음) 덮어쓰지 않는다.
      const placeholders: Record<string, string> = {
        'storyboard/02-design-flow.md': DESIGN_FLOW_PLACEHOLDER,
        'storyboard/03-visual-direction.md': VISUAL_PLACEHOLDER,
        'storyboard/data/content.json': CONTENT_JSON_PLACEHOLDER,
        'storyboard/data/items.json': ITEMS_JSON_PLACEHOLDER,
      };
      for (const [rel, contents] of Object.entries(placeholders)) {
        if ((await readOptionalFile(root, rel)) === null) writes[rel] = contents;
      }
      for (const [rel, contents] of Object.entries(writes)) {
        await invoke('write_text_file', { path: projectPath(root, rel), contents, workspaceRoot: root });
      }
      setSaved(true);
      setWorkspaceId(ws.workspaceId);
      if (await checkAgentStarted(root, ws.workspaceId)) onAgentStarted();
    } catch (e) {
      setFailed(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(t('storyboard.agentPrompt'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard failure
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">{t('storyboard.onboardingTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('storyboard.onboardingDesc')}</p>
      </header>
      <section className="space-y-2 rounded-lg border border-border p-4" aria-label={t('storyboard.onboardingTitle')}>
        <label className="block text-xs font-medium">
          {t('storyboard.intent')}
          <span aria-hidden="true" className="text-destructive"> *</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {INTENTS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIntent(i)}
                aria-pressed={intent === i}
                className={`rounded border px-2 py-1 text-xs ${intent === i ? 'bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}
              >
                {t(`storyboard.intent.${i}`)}
              </button>
            ))}
          </div>
        </label>
        <label className="block text-xs font-medium">
          {t('storyboard.briefTitle')}
          <span aria-hidden="true" className="text-destructive"> *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('storyboard.briefTitleHint')}
            aria-invalid={errors.title !== null}
            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
          />
        </label>
        {errors.title && (
          <p role="alert" className="text-xs text-destructive">
            {errors.title}
          </p>
        )}
        <label className="block text-xs font-medium">
          {t('storyboard.oneLiner')}
          <span aria-hidden="true" className="text-destructive"> *</span>
          <input
            value={oneLiner}
            onChange={(e) => setOneLiner(e.target.value)}
            placeholder={t('storyboard.oneLinerHint')}
            aria-invalid={errors.oneLiner !== null}
            className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
          />
        </label>
        {errors.oneLiner && (
          <p role="alert" className="text-xs text-destructive">
            {errors.oneLiner}
          </p>
        )}
        <div className="rounded-md border border-border">
          <button
            type="button"
            aria-expanded={advancedOpen}
            aria-controls="brief-advanced"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between px-2 py-1.5 text-xs font-medium"
          >
            {t('storyboard.advanced')}
            <span aria-hidden="true">{advancedOpen ? '▾' : '▸'}</span>
          </button>
          {advancedOpen && (
            <div id="brief-advanced" className="space-y-2 px-2 pb-2">
              <label className="block text-xs font-medium">
                {t('storyboard.purpose')}
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-medium">
                {t('storyboard.inScope')}
                <textarea value={inScope} onChange={(e) => setInScope(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-normal" />
              </label>
              <label className="block text-xs font-medium">
                {t('storyboard.nonGoals')}
                <textarea value={nonGoals} onChange={(e) => setNonGoals(e.target.value)} rows={2} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-normal" />
              </label>
            </div>
          )}
        </div>
        {failed && (
          <p role="alert" className="text-xs text-destructive">
            {t('storyboard.saveFailed', { reason: failed })}
          </p>
        )}
        {saved && !failed && (
          <p role="status" className="text-xs text-muted-foreground">
            {t('storyboard.savedWaiting')}
          </p>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? t('storyboard.saving') : t('storyboard.save')}
        </button>
      </section>
      <section className="space-y-2 rounded-lg border border-border p-4" aria-label={t('storyboard.agentTitle')}>
        <h2 className="text-sm font-bold">{t('storyboard.agentTitle')}</h2>
        <p className="text-xs text-muted-foreground">{t('storyboard.agentDesc')}</p>
        <p className="text-xs text-muted-foreground">{t('storyboard.agentPrompt')}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => void copyPrompt()} className="rounded border border-border px-2 py-1 text-xs hover:bg-accent">
            {copied ? t('storyboard.copied') : t('storyboard.copyPrompt')}
          </button>
        </div>
      </section>
    </div>
  );
}
