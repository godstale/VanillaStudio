import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Copy, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SceneForm } from '@/components/guides/SceneForm';
import { MarkdownEditor } from '@/components/guides/MarkdownEditor';
import { DesignSection } from './DesignSection';
import { HistorySection } from './HistorySection';
import { INSPECTOR_TABS, type InspectorTab } from './inspectorTabs';
import { PreviewPanel } from '@/components/scene/PreviewPanel';
import { CheckPanel } from '@/components/scene/CheckPanel';
import { References } from './References';
import { SaveAsTemplate } from './SaveAsTemplate';
import type { GuideContext } from '@/lib/guides/agentsMd';
import { promptForScene } from '@/lib/agents/clipboard';
import { applyTemplateDefaults } from '@/lib/guides/merge';
import { applyDecomposedPreset } from '@/lib/guides/opusCatalog';
import { recommendForPrompt } from '@/lib/guides/recommend';
import { changedSinceSettled } from '@/lib/scene/revision';
import type { GuideTemplate } from '@/lib/guides/template';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { sceneSchema, type Scene } from '@/lib/scene/schema';
import { cn } from '@/lib/utils';

const AUTOSAVE_MS = 600;
const TABS = INSPECTOR_TABS;
type Tab = InspectorTab;
const LATER: Tab[] = [];

export interface SceneInspectorProps {
  workspace: { id: string; name: string };
  /** 워크스페이스 폴더와 이 신의 폴더 이름(DESIGN 섹션이 파일을 읽고 쓴다). */
  root: string;
  slug: string;
  scene: Scene;
  /** 이 신이 쓰는 해석 끝난 템플릿. 사용을 거부했거나 못 찾으면 null(가이드 편집·프롬프트 미리보기는 막힌다). */
  template: GuideTemplate | null;
  /** template이 null일 때 사용자에게 보여 줄 이유. */
  templateError?: string;
  /** workspace.json.canvas. 미리보기에 주입한다. */
  canvas?: { width: number; height: number; fps: number };
  /** 탭을 바깥에서 제어한다(노드의 재생 버튼이 미리보기 탭을 연다). 생략하면 스스로 관리한다. */
  tab?: InspectorTab;
  onTabChange?: (tab: InspectorTab) => void;
  /** scene.json 저장 + 가이드 재렌더. 실패하면 던진다. */
  onSave: (scene: Scene) => Promise<void>;
  /** 이름 변경(폴더 이름도 바뀐다). */
  onRename: (name: string) => Promise<void>;
  /** 미리보기가 새 썸네일을 저장했을 때(노드 갱신용). */
  onThumbnail?: (slug: string, dataUrl: string) => void;
  /** 이 신이 시퀀스의 시작 신인가, 그리고 시작 신으로 지정하는 동작. */
  isStart?: boolean;
  onSetStart?: () => void;
  /** 이 신의 구조를 신 템플릿으로 저장한다. 없으면(템플릿을 쓸 수 없는 신 등) 섹션을 숨긴다. */
  onSaveAsTemplate?: (name: string) => Promise<{ ref: string }>;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'invalid';

const area = 'min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** 값이 바뀌면 잠시 뒤 저장한다. 언마운트·선택 전환 전에 남은 변경은 즉시 저장한다. */
function useAutosave(onSave: (s: Scene) => Promise<void>) {
  const [state, setState] = useState<SaveState>('idle');
  const [invalid, setInvalid] = useState('');
  const pending = useRef<Scene | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  }, [onSave]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    setState('saving');
    try {
      await saveRef.current(next);
      setState('saved');
    } catch {
      setState('error');
    }
  }, []);

  const schedule = useCallback(
    (next: Scene) => {
      // 스키마에 맞지 않는 중간 상태(예: 키 이름이 빈 스텝)는 저장하지 않고 이유만 보여 준다. 고치면 다시 저장된다.
      const check = sceneSchema.safeParse(next);
      if (!check.success) {
        pending.current = null;
        if (timer.current) clearTimeout(timer.current);
        const issue = check.error.issues[0];
        setInvalid(`${issue.path.join('.')} ${issue.message}`.trim());
        setState('invalid');
        return;
      }
      pending.current = next;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (pending.current) void saveRef.current(pending.current).catch(() => undefined);
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { state, invalid, schedule, flush };
}

/** 노드를 고르면 우측에 열리는 신 편집 패널. 선택이 바뀌면 `key`로 새로 마운트해 쓴다. */
export function SceneInspector({ workspace, root, slug, scene, template, templateError, canvas, tab: tabProp, onTabChange, onSave, onRename, onThumbnail, isStart, onSetStart, onSaveAsTemplate }: SceneInspectorProps) {
  const { t, locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'ko';
  const [ownTab, setOwnTab] = useState<Tab>('overview');
  const tab = tabProp ?? ownTab;
  const setTab = (next: Tab) => {
    setOwnTab(next);
    onTabChange?.(next);
  };
  const [draft, setDraft] = useState<Scene>(scene);
  const [name, setName] = useState(scene.name);
  const [copied, setCopied] = useState(false);
  const { state, invalid, schedule, flush } = useAutosave(onSave);

  const edit = (patch: (s: Scene) => Scene) => {
    const next = patch(draft);
    setDraft(next);
    schedule(next);
  };

  async function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === scene.name) {
      setName(scene.name);
      return;
    }
    await flush();
    await onRename(trimmed).catch(() => setName(scene.name));
  }

  // 클립보드로 나가는 프롬프트와 같아야 하므로 revise일 때 바뀐 필드도 같은 방식으로 넣는다.
  const [changed, setChanged] = useState<string[]>([]);
  useEffect(() => {
    if (tab !== 'prompt' || draft.status !== 'needs-revision') return;
    let cancelled = false;
    changedSinceSettled(root, slug, draft)
      .then((f) => !cancelled && setChanged(f))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tab, draft, root, slug]);
  const prompt = tab === 'prompt' && template ? promptForScene({ workspace, scene: draft, template } satisfies GuideContext, changed).text : '';
  const unusable = template === null ? (
    <p role="alert" className="rounded bg-destructive/10 p-2 text-xs text-destructive">
      {t('inspector.templateUnusable', { ref: draft.template, reason: templateError ?? t('inspector.templateMissing') })}
    </p>
  ) : null;

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const brief = draft.brief;
  const setBrief = (k: keyof Scene['brief'], v: string) => edit((s) => ({ ...s, brief: { ...s.brief, [k]: v } }) as Scene);

  const opusRec = useMemo(
    () =>
      recommendForPrompt({
        mediaIntent: draft.brief.mediaIntent,
        promptText: [draft.name, draft.brief.subject, draft.brief.goal, draft.brief.message, draft.userPrompt].join(' '),
        sceneType: draft.type,
        limit: 2,
      }),
    [draft.name, draft.brief.mediaIntent, draft.brief.subject, draft.brief.goal, draft.brief.message, draft.userPrompt, draft.type],
  );

  const recommendationBox = (
    <details className="rounded-md border border-border bg-muted/20 p-2.5 text-xs" data-testid="inspector-opus-recommendations">
      <summary className="flex cursor-pointer items-center gap-1.5 font-medium">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span>{t('inspector.recommend.title')}</span>
      </summary>
      <p className="mt-1 text-[11px] text-muted-foreground">{t('inspector.recommend.desc')}</p>
      <div className="mt-2 space-y-2">
        {opusRec.templates.map(({ template: recTpl }) => (
          <div key={recTpl.ref} className="flex items-center gap-2 rounded border border-border bg-card p-2">
            {recTpl.meta.previewUrl && (
              <img
                src={recTpl.meta.previewUrl}
                alt={t('tpl.previewAlt', { name: recTpl.meta.label[lang] })}
                className="h-10 w-16 shrink-0 rounded border border-border object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <b className="truncate text-[11px]">{recTpl.meta.label[lang]}</b>
                {recTpl.meta.actionUrl && (
                  <a
                    href={recTpl.meta.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                    {t('tpl.liveDemo')}
                  </a>
                )}
              </div>
              {recTpl.meta.description && (
                <p className=" truncate text-[10px] text-muted-foreground">{recTpl.meta.description[lang]}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={draft.template === recTpl.ref}
              onClick={() => edit((s) => applyTemplateDefaults({ ...s, template: recTpl.ref } as Scene, recTpl))}
            >
              {t('inspector.recommend.switchTemplate')}
            </Button>
          </div>
        ))}

        {opusRec.decomposedPresets.slice(0, 3).map((preset) => (
          <div key={preset.id} className="flex items-center gap-2 rounded border border-border bg-card p-2">
            <img
              src={preset.previewUrl}
              alt={t('tpl.previewAlt', { name: preset.label[lang] })}
              className="h-10 w-16 shrink-0 rounded border border-border object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-medium text-primary">
                  {t(`tpl.decomposed.${preset.category}`)}
                </span>
                <b className="truncate text-[11px]">{preset.label[lang]}</b>
                <a
                  href={preset.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  {t('tpl.liveDemo')}
                </a>
              </div>
              <p className="truncate text-[10px] text-muted-foreground">{preset.description[lang]}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => edit((s) => applyDecomposedPreset(s, preset))}
            >
              {t('inspector.recommend.applyPreset')}
            </Button>
          </div>
        ))}
      </div>
    </details>
  );

  return (
    <div className="flex h-full flex-col text-sm" data-testid="scene-inspector">
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-border p-2">
        {TABS.map((x) => (
          <button
            key={x}
            role="tab"
            type="button"
            aria-selected={tab === x}
            onClick={() => setTab(x)}
            className={cn('rounded px-2 py-1 text-xs', tab === x ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
          >
            {t(`inspector.tab.${x}`)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3" role="tabpanel">
        {tab === 'overview' && (
          <>
            <Field label={t('inspector.name')}>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => void commitName()}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
            </Field>
            {onSetStart && (
              <div className="flex items-center gap-2 text-xs">
                <Button size="sm" variant="outline" disabled={isStart} onClick={onSetStart}>
                  {isStart ? t('sequence.isStart') : t('sequence.setStart')}
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Field label={t('inspector.type')}>
                <span className="rounded border border-border bg-muted px-2 py-1.5">{t(`scene.type.${draft.type}`)}</span>
              </Field>
              <Field label={t('inspector.template')}>
                <span className="rounded border border-border bg-muted px-2 py-1.5">{draft.template}</span>
              </Field>
            </div>
            <Field label={t('inspector.brief.subject')}>
              <textarea className={area} value={brief.subject} onChange={(e) => setBrief('subject', e.target.value)} />
            </Field>
            <Field label={t('inspector.brief.goal')}>
              <textarea className={area} value={brief.goal} onChange={(e) => setBrief('goal', e.target.value)} />
            </Field>
            <Field label={t('inspector.brief.audience')}>
              <Input value={brief.audience} onChange={(e) => setBrief('audience', e.target.value)} />
            </Field>
            <Field label={t('inspector.brief.message')}>
              <textarea className={area} value={brief.message} onChange={(e) => setBrief('message', e.target.value)} />
            </Field>
            <Field label={t('inspector.brief.language')}>
              <select
                value={brief.language}
                onChange={(e) => setBrief('language', e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </select>
            </Field>
            {recommendationBox}
            {onSaveAsTemplate && template && <SaveAsTemplate onSave={onSaveAsTemplate} />}
          </>
        )}

        {tab === 'guide' && (
          <>
            {unusable ?? (
              <>
                <p className="text-[11px] text-muted-foreground">{t('inspector.tab.guide.hint')}</p>
                {recommendationBox}
                <SceneForm scene={draft} template={template!} onChange={(next) => edit(() => next)} />
              </>
            )}
          </>
        )}

        {tab === 'design' && <DesignSection root={root} slug={slug} />}

        {tab === 'references' && <References root={root} slug={slug} scene={draft} onChange={(next) => edit(() => next)} />}

        {tab === 'preview' &&
          (canvas ? (
            <PreviewPanel root={root} slug={slug} sceneType={draft.type} canvas={canvas} entry={draft.runtime.entry} onThumbnail={onThumbnail} />
          ) : (
            <p className="text-xs text-muted-foreground">{t('inspector.later')}</p>
          ))}

        {tab === 'preview' && <CheckPanel root={root} slug={slug} scene={draft} />}

        {tab === 'history' && <HistorySection root={root} slug={slug} sceneId={draft.id} />}

        {tab === 'prompt' && (
          <>
            <div className="flex flex-col gap-1 text-xs">
              <span className="text-muted-foreground">{t('inspector.userPrompt')}</span>
              <MarkdownEditor label={t('inspector.userPrompt')} value={draft.userPrompt} onChange={(v) => edit((s) => ({ ...s, userPrompt: v }) as Scene)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('inspector.promptPreview')}</span>
              <Button size="sm" variant="outline" disabled={!template} onClick={() => void copyPrompt()}>
                <Copy className="mr-1 h-3 w-3" />
                {copied ? t('inspector.copied') : t('inspector.copy')}
              </Button>
            </div>
            {unusable}
            <pre data-testid="prompt-preview" className="whitespace-pre-wrap rounded-md border border-border bg-muted p-2 text-xs">
              {prompt}
            </pre>
          </>
        )}

        {LATER.includes(tab) && <p className="text-xs text-muted-foreground">{t('inspector.later')}</p>}
      </div>

      <div className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground" role="status">
        {state === 'saving' && t('inspector.saving')}
        {state === 'saved' && t('inspector.saved')}
        {state === 'error' && <span className="text-destructive">{t('inspector.saveFailed')}</span>}
        {state === 'invalid' && <span className="text-warning">{t('inspector.invalid', { message: invalid })}</span>}
      </div>
    </div>
  );
}
