import { useMemo, useState } from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useTemplates } from '@/components/guides/templatesContextValue';
import { recommendForPrompt } from '@/lib/guides/recommend';
import { MEDIA_INTENTS, type GuideTemplate, type MediaIntent } from '@/lib/guides/template';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { SCENE_TYPES, type Scene, type SceneType } from '@/lib/scene/schema';
import { cn } from '@/lib/utils';

export interface NewSceneValues {
  name: string;
  type: SceneType;
  template: GuideTemplate;
  initialBrief?: Partial<Scene['brief']>;
  initialUserPrompt?: string;
}

export interface NewSceneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: NewSceneValues) => Promise<void>;
}

export function NewSceneDialog({ open, onOpenChange, onCreate }: NewSceneDialogProps) {
  const { t, locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'ko';
  const [name, setName] = useState('');
  const [type, setType] = useState<SceneType>('motion');
  const [mediaIntent, setMediaIntent] = useState<MediaIntent | null>(null);
  const [promptText, setPromptText] = useState('');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { catalog } = useTemplates();
  const allUsable = useMemo(
    () => catalog.usable().flatMap((e) => (e.template ? [e.template] : [])),
    [catalog],
  );
  const forType = useMemo(
    () => catalog.usable(type).flatMap((e) => (e.template ? [{ ...e.template, source: e.source }] : [])),
    [catalog, type],
  );

  const recommendation = useMemo(() => {
    if (!mediaIntent && !promptText.trim()) return null;
    return recommendForPrompt({
      mediaIntent: mediaIntent ?? undefined,
      promptText,
      sceneType: type,
      templates: forType,
      limit: 3,
    });
  }, [mediaIntent, promptText, type, forType]);

  const recommendedRef = recommendation?.templates[0]?.template.ref;
  const chosenTemplate =
    forType.find((x) => x.ref === chosen[type]) ??
    (recommendedRef ? forType.find((x) => x.ref === recommendedRef) : undefined) ??
    forType[0];
  const canCreate = name.trim().length > 0 && chosenTemplate !== undefined && !busy;

  const applyIntentAndRecommend = (nextIntent: MediaIntent | null, nextPrompt: string) => {
    setMediaIntent(nextIntent);
    setPromptText(nextPrompt);
    if (!nextIntent && !nextPrompt.trim()) return;
    const globalRec = recommendForPrompt({
      mediaIntent: nextIntent ?? undefined,
      promptText: nextPrompt,
      templates: allUsable,
      limit: 1,
    });
    const nextType = globalRec.recommendedSceneType;
    setType(nextType);
    const best = globalRec.templates[0]?.template;
    if (best) {
      setChosen((prev) => ({ ...prev, [nextType]: best.ref }));
    }
  };

  async function submit() {
    if (!canCreate || !chosenTemplate) return;
    setBusy(true);
    setError(null);
    try {
      const payload: NewSceneValues = { name: name.trim(), type, template: chosenTemplate };
      const trimmedPrompt = promptText.trim();
      if (mediaIntent || trimmedPrompt) {
        payload.initialBrief = {
          ...(mediaIntent ? { mediaIntent } : {}),
          ...(trimmedPrompt ? { subject: trimmedPrompt } : {}),
        };
      }
      if (trimmedPrompt) {
        payload.initialUserPrompt = trimmedPrompt;
      }
      await onCreate(payload);
      setName('');
      setPromptText('');
      setMediaIntent(null);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('scene.new.title')}</DialogTitle>
          <DialogDescription>{t('scene.new.desc')}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            {t('scene.new.name')}
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>

          <fieldset className="flex flex-col gap-1 text-xs">
            <legend className="mb-1 text-muted-foreground">{t('scene.new.intent')}</legend>
            <div className="grid grid-cols-4 gap-1.5" data-testid="new-scene-intent-group">
              {MEDIA_INTENTS.map((intent) => {
                const active = mediaIntent === intent;
                return (
                  <button
                    key={intent}
                    type="button"
                    aria-pressed={active}
                    onClick={() => applyIntentAndRecommend(active ? null : intent, promptText)}
                    className={cn(
                      'rounded-md border px-2 py-1.5 text-center text-[11px] font-medium transition-colors',
                      active ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent',
                    )}
                  >
                    {t(`tpl.intent.${intent}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1 text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              {t('scene.new.prompt')}
            </span>
            <input
              type="search"
              data-testid="new-scene-prompt-input"
              value={promptText}
              onChange={(e) => applyIntentAndRecommend(mediaIntent, e.target.value)}
              placeholder={t('scene.new.promptPlaceholder')}
              className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>

          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="mb-1">{t('scene.new.type')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {SCENE_TYPES.map((x) => (
                <label
                  key={x}
                  className={cn(
                    'cursor-pointer rounded-md border px-2 py-2 text-center text-xs',
                    type === x ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent',
                  )}
                >
                  <input type="radio" name="scene-type" value={x} checked={type === x} onChange={() => setType(x)} className="sr-only" />
                  {t(`scene.type.${x}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1 text-sm">
            <span className="flex items-center justify-between">
              <span>{t('scene.new.template')}</span>
              {recommendedRef && chosenTemplate?.ref === recommendedRef && (
                <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <Sparkles className="h-2.5 w-2.5" />
                  {t('scene.new.recommendedBadge')}
                </span>
              )}
            </span>
            <select
              value={chosenTemplate?.ref ?? ''}
              onChange={(e) => setChosen({ ...chosen, [type]: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {forType.map((x) => (
                <option key={x.ref} value={x.ref}>
                  {x.meta.label[lang]} ({x.ref}{x.source === 'builtin' ? '' : ` · ${x.source}`})
                </option>
              ))}
            </select>
          </label>

          {chosenTemplate && (chosenTemplate.meta.previewUrl || chosenTemplate.meta.description) && (
            <div className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-2 text-xs" data-testid="selected-template-preview">
              {chosenTemplate.meta.previewUrl && (
                <img
                  src={chosenTemplate.meta.previewUrl}
                  alt={t('tpl.previewAlt', { name: chosenTemplate.meta.label[lang] })}
                  className="h-14 w-24 shrink-0 rounded border border-border object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <b className="truncate">{chosenTemplate.meta.label[lang]}</b>
                  {chosenTemplate.meta.actionUrl && (
                    <a
                      href={chosenTemplate.meta.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t('tpl.liveDemo')}
                    </a>
                  )}
                </div>
                {chosenTemplate.meta.description && (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                    {chosenTemplate.meta.description[lang]}
                  </p>
                )}
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
              {t('scene.new.cancel')}
            </Button>
            <Button type="submit" disabled={!canCreate}>
              {t('scene.new.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
