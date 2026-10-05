import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { listBuiltinTemplates } from '@/lib/guides/template';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { SCENE_TYPES, type SceneType } from '@/lib/scene/schema';
import { cn } from '@/lib/utils';

export interface NewSceneValues {
  name: string;
  type: SceneType;
  template: string;
}

export interface NewSceneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (values: NewSceneValues) => Promise<void>;
}

export function NewSceneDialog({ open, onOpenChange, onCreate }: NewSceneDialogProps) {
  const { t, locale } = useLanguage();
  const [name, setName] = useState('');
  const [type, setType] = useState<SceneType>('motion');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templates = useMemo(() => listBuiltinTemplates(), []);
  const forType = templates.filter((x) => x.meta.type === type);
  const template = forType.find((x) => x.ref === chosen[type])?.ref ?? forType[0]?.ref ?? '';
  const canCreate = name.trim().length > 0 && template !== '' && !busy;

  async function submit() {
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), type, template });
      setName('');
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
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
            {t('scene.new.template')}
            <select
              value={template}
              onChange={(e) => setChosen({ ...chosen, [type]: e.target.value })}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {forType.map((x) => (
                <option key={x.ref} value={x.ref}>
                  {x.meta.label[locale === 'en' ? 'en' : 'ko']} ({x.ref})
                </option>
              ))}
            </select>
          </label>
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
