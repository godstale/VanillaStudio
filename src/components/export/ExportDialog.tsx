// Type-specific export options dialog (T5.9). Edits the saved per-type
// options and enqueues one job on confirm.
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useExport } from '@/lib/export/exportContextValue';
import {
  browserOptionsStorage,
  detailsFromOptions,
  labelForOptions,
  loadExportOptions,
  saveExportOptions,
  SIZE_PRESETS,
  type ExportOptions,
  type OptionsStorage,
} from '@/lib/export/exportOptions';
import type { ExportKind } from '@/lib/export/types';
import { cn } from '@/lib/utils';

const KINDS: ExportKind[] = ['web', 'interactive', 'image', 'slides', 'video'];

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-muted-foreground">
      {label}
      <Input
        type="number"
        className="h-8"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = e.target.valueAsNumber;
          if (Number.isFinite(v)) onChange(v);
        }}
      />
    </label>
  );
}

function ChoiceRow<T extends string | number>({
  options,
  value,
  onChange,
  renderLabel,
}: {
  options: ReadonlyArray<T>;
  value: T;
  onChange: (v: T) => void;
  renderLabel?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((o) => (
        <Button
          key={String(o)}
          type="button"
          size="sm"
          variant={o === value ? 'default' : 'outline'}
          onClick={() => onChange(o)}
          role="radio"
          aria-checked={o === value}
        >
          {renderLabel ? renderLabel(o) : String(o)}
        </Button>
      ))}
    </div>
  );
}

function SizeFields({
  width,
  height,
  onChange,
}: {
  width: number;
  height: number;
  onChange: (width: number, height: number) => void;
}) {
  const { t } = useLanguage();
  const matched = SIZE_PRESETS.find((p) => p.width === width && p.height === height)?.id ?? 'custom';
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium text-muted-foreground">{t('export.dialog.size')}</span>
      <select
        aria-label={t('export.dialog.size')}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
        value={matched}
        onChange={(e) => {
          const preset = SIZE_PRESETS.find((p) => p.id === e.target.value);
          if (preset) onChange(preset.width, preset.height);
        }}
      >
        {matched === 'custom' && <option value="custom">{t('export.dialog.custom')}</option>}
        {SIZE_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {t(`export.dialog.preset.${p.id}`)}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <NumberField label={t('export.dialog.width')} value={width} min={1} onChange={(v) => onChange(v, height)} />
        <NumberField label={t('export.dialog.height')} value={height} min={1} onChange={(v) => onChange(width, v)} />
      </div>
    </div>
  );
}

export function ExportDialog({
  open,
  onOpenChange,
  storage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storage?: OptionsStorage;
}) {
  const { t } = useLanguage();
  const { enqueue } = useExport();
  const store = storage ?? browserOptionsStorage();
  // The panel mounts the dialog fresh on every open, so the initializer
  // always reads the saved options.
  const [options, setOptions] = useState<ExportOptions>(() => loadExportOptions(store));
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<ExportOptions>) => setOptions((o) => ({ ...o, ...patch }));
  const kind = options.kind;

  const confirm = () => {
    const snapshot = options;
    saveExportOptions(snapshot, store);
    enqueue(snapshot.kind, labelForOptions(snapshot), detailsFromOptions(snapshot)).then(
      () => onOpenChange(false),
      (err: unknown) => setError(err instanceof Error ? err.message : String(err)),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="export-dialog" className="max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{t('export.dialog.title')}</DialogTitle>
          <DialogDescription>{t('export.dialog.desc')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">{t('export.dialog.kindLabel')}</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('export.dialog.kindLabel')}>
            {KINDS.map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                variant={k === kind ? 'default' : 'outline'}
                onClick={() => set({ kind: k })}
                role="radio"
                aria-checked={k === kind}
              >
                {t(`export.kind.${k}`)}
              </Button>
            ))}
          </div>
        </div>

        {(kind === 'image' || kind === 'slides' || kind === 'video') && (
          <SizeFields
            width={kind === 'image' ? options.image.width : kind === 'slides' ? options.slides.width : options.video.width}
            height={kind === 'image' ? options.image.height : kind === 'slides' ? options.slides.height : options.video.height}
            onChange={(width, height) => {
              const w = Math.max(1, Math.floor(width));
              const h = Math.max(1, Math.floor(height));
              if (kind === 'image') set({ image: { ...options.image, width: w, height: h } });
              else if (kind === 'slides') set({ slides: { ...options.slides, width: w, height: h } });
              else set({ video: { ...options.video, width: w, height: h } });
            }}
          />
        )}

        {kind === 'image' && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">{t('export.dialog.imageFormats')}</span>
              <div className="flex flex-wrap gap-3">
                {(['png', 'jpg', 'webp'] as const).map((f) => (
                  <label key={f} className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={options.image.formats.includes(f)}
                      onChange={(e) => {
                        const formats = e.target.checked
                          ? [...options.image.formats, f]
                          : options.image.formats.filter((x) => x !== f);
                        if (formats.length > 0) set({ image: { ...options.image, formats } });
                      }}
                    />
                    {f.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">{t('export.dialog.imageScales')}</span>
              <div className="flex flex-wrap gap-3">
                {([1, 2] as const).map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={options.image.scales.includes(s)}
                      onChange={(e) => {
                        const scales = e.target.checked
                          ? [...options.image.scales, s]
                          : options.image.scales.filter((x) => x !== s);
                        if (scales.length > 0) set({ image: { ...options.image, scales } });
                      }}
                    />
                    {`@${s}x`}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {kind === 'slides' && (
          <>
            <div className="flex gap-2">
              <NumberField
                label={t('export.dialog.scale')}
                value={options.slides.scale}
                min={1}
                max={4}
                step={1}
                onChange={(v) => set({ slides: { ...options.slides, scale: Math.min(4, Math.max(1, v)) } })}
              />
              <NumberField
                label={t('export.dialog.slideCount')}
                value={options.slides.count}
                min={1}
                max={100}
                step={1}
                onChange={(v) => set({ slides: { ...options.slides, count: Math.min(100, Math.max(1, Math.floor(v))) } })}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              {(['pptx', 'pdf'] as const).map((key) => (
                <label key={key} className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-primary"
                    checked={options.slides[key]}
                    onChange={(e) => {
                      const next = { ...options.slides, [key]: e.target.checked };
                      if (next.pptx || next.pdf) set({ slides: next });
                    }}
                  />
                  {t(`export.dialog.${key}`)}
                </label>
              ))}
            </div>
            <label className="flex cursor-pointer items-start gap-1.5 text-xs text-foreground">
              <input
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 accent-primary"
                checked={options.slides.editable}
                onChange={(e) => set({ slides: { ...options.slides, editable: e.target.checked } })}
              />
              <span>
                {t('export.dialog.editable')}
                <span className="block text-[11px] text-muted-foreground">{t('export.dialog.editableNote')}</span>
              </span>
            </label>
          </>
        )}

        {kind === 'video' && (
          <>
            <div className="flex gap-2">
              <NumberField
                label={t('export.dialog.fps')}
                value={options.video.fps}
                min={1}
                max={120}
                step={1}
                onChange={(v) => set({ video: { ...options.video, fps: Math.min(120, Math.max(1, Math.floor(v))) } })}
              />
              <NumberField
                label={t('export.dialog.duration')}
                value={options.video.duration}
                min={1}
                step={1}
                onChange={(v) => set({ video: { ...options.video, duration: Math.max(1, v) } })}
              />
            </div>
            <div className={cn('flex flex-col gap-1.5')}>
              <span className="text-[11px] font-medium text-muted-foreground">{t('export.dialog.videoFormat')}</span>
              <ChoiceRow
                options={['mp4', 'webm'] as const}
                value={options.video.format}
                onChange={(format) => set({ video: { ...options.video, format } })}
                renderLabel={(f) => f.toUpperCase()}
              />
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="break-all text-xs text-destructive">
            {t('export.dialog.startFailed', { error })}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('export.dialog.cancel')}
          </Button>
          <Button onClick={confirm}>{t('export.dialog.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
