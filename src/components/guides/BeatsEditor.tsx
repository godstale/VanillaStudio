import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { checkBeats } from '@/lib/scene/schema';
import { distribute, newBeat, round, type Beat } from '@/lib/guides/beats';
import type { Glossary } from '@/lib/guides/template';
import { StringList } from './StringList';
import { TermCombobox } from './TermCombobox';

export interface BeatsEditorProps {
  beats: Beat[];
  duration: number;
  glossary: Glossary;
  onChange: (beats: Beat[]) => void;
}

const area = 'min-h-12 w-full rounded-md border border-input bg-background px-2 py-1 text-xs';

/** 시간 구조 편집기. 시작·끝·역할·문구·모션·카메라·전환을 편집하고 합계가 길이와 맞는지 보여 준다. */
export function BeatsEditor({ beats, duration, glossary, onChange }: BeatsEditorProps) {
  const { t } = useLanguage();
  const set = (i: number, patch: Partial<Beat>) => onChange(beats.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= beats.length) return;
    const next = [...beats];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const problems = checkBeats({ duration: { seconds: duration }, beats });
  const total = beats.length ? beats[beats.length - 1].end : 0;
  const num = (v: string) => (v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));

  return (
    <div className="flex flex-col gap-3" data-testid="beats-editor">
      {beats.length === 0 && <p className="text-xs text-muted-foreground">{t('beats.empty')}</p>}
      {beats.map((b, i) => (
        <fieldset key={b.id} className="flex flex-col gap-2 rounded-md border border-border p-2">
          <legend className="px-1 text-xs font-semibold">{b.id}</legend>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t('beats.start')}
              <Input type="number" step="0.1" min={0} value={b.start} onChange={(e) => set(i, { start: num(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t('beats.end')}
              <Input type="number" step="0.1" min={0} value={b.end} onChange={(e) => set(i, { end: num(e.target.value) })} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t('beats.role')}
              <Input value={b.role} onChange={(e) => set(i, { role: e.target.value })} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {t('beats.copy')}
            <textarea className={area} value={b.copy} onChange={(e) => set(i, { copy: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {t('beats.visual')}
            <textarea className={area} value={b.visual} onChange={(e) => set(i, { visual: e.target.value })} />
          </label>
          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {t('beats.motion')}
            <StringList label={`${b.id} ${t('beats.motion')}`} value={b.motion} onChange={(motion) => set(i, { motion })} />
          </div>
          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {t('beats.camera')}
            <TermCombobox glossary={glossary} category="camera" multiple={false} label={`${b.id} ${t('beats.camera')}`} value={b.camera ? [b.camera] : []} onChange={(v) => set(i, { camera: v[0] ?? '' })} />
          </div>
          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {t('beats.transitionOut')}
            <TermCombobox glossary={glossary} category="transition" multiple={false} label={`${b.id} ${t('beats.transitionOut')}`} value={b.transitionOut ? [b.transitionOut] : []} onChange={(v) => set(i, { transitionOut: v[0] ?? '' })} />
          </div>
          <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {t('beats.notes')}
            <textarea className={area} value={b.notes} onChange={(e) => set(i, { notes: e.target.value })} />
          </label>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="ghost" aria-label={t('beats.up')} disabled={i === 0} onClick={() => move(i, -1)}>
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button type="button" size="sm" variant="ghost" aria-label={t('beats.down')} disabled={i === beats.length - 1} onClick={() => move(i, 1)}>
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button type="button" size="sm" variant="ghost" aria-label={`${t('beats.remove')} ${b.id}`} onClick={() => onChange(beats.filter((_, j) => j !== i))}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...beats, newBeat(beats, duration)])}>
          <Plus className="mr-1 h-3 w-3" />
          {t('beats.add')}
        </Button>
        {beats.length > 0 && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(distribute(beats, duration))}>
            {t('beats.distribute')}
          </Button>
        )}
      </div>
      {beats.length > 0 && (
        <div role="status" className={problems.length ? 'text-xs text-warning' : 'text-xs text-muted-foreground'}>
          <div>{t('beats.total', { total: round(total), duration })}</div>
          {problems.length === 0 ? <div>{t('beats.ok')}</div> : problems.map((p, i) => <div key={i}>{p.message}</div>)}
        </div>
      )}
    </div>
  );
}
