import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { GuideContext } from '@/lib/guides/agentsMd';
import { assemblePrompt } from '@/lib/guides/prompts';
import { defaultTemplateFor, getBuiltinTemplate } from '@/lib/guides/template';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { Scene } from '@/lib/scene/schema';
import { cn } from '@/lib/utils';

const AUTOSAVE_MS = 600;
const TABS = ['overview', 'guide', 'design', 'references', 'prompt', 'history'] as const;
type Tab = (typeof TABS)[number];
const LATER: Tab[] = ['guide', 'design', 'references', 'history'];

export interface SceneInspectorProps {
  workspace: { id: string; name: string };
  scene: Scene;
  /** scene.json 저장 + 가이드 재렌더. 실패하면 던진다. */
  onSave: (scene: Scene) => Promise<void>;
  /** 이름 변경(폴더 이름도 바뀐다). */
  onRename: (name: string) => Promise<void>;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

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

  return { state, schedule, flush };
}

/** 노드를 고르면 우측에 열리는 신 편집 패널. 선택이 바뀌면 `key`로 새로 마운트해 쓴다. */
export function SceneInspector({ workspace, scene, onSave, onRename }: SceneInspectorProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('overview');
  const [draft, setDraft] = useState<Scene>(scene);
  const [name, setName] = useState(scene.name);
  const [copied, setCopied] = useState(false);
  const { state, schedule, flush } = useAutosave(onSave);

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

  const ctx: GuideContext = {
    workspace,
    scene: draft,
    template: getBuiltinTemplate(draft.template) ?? defaultTemplateFor(draft.type),
  };
  const prompt = tab === 'prompt' ? assemblePrompt('generate', ctx) : '';

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
          </>
        )}

        {tab === 'prompt' && (
          <>
            <Field label={t('inspector.userPrompt')}>
              <textarea className={cn(area, 'min-h-28')} value={draft.userPrompt} onChange={(e) => edit((s) => ({ ...s, userPrompt: e.target.value }) as Scene)} />
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('inspector.promptPreview')}</span>
              <Button size="sm" variant="outline" onClick={() => void copyPrompt()}>
                <Copy className="mr-1 h-3 w-3" />
                {copied ? t('inspector.copied') : t('inspector.copy')}
              </Button>
            </div>
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
      </div>
    </div>
  );
}
