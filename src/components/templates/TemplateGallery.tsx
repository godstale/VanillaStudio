import { useMemo, useState, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { OUTPUT_TYPES, type OutputType } from '@/lib/types/project';
import type { PaletteFile } from '@/lib/design/palettes';
import {
  BUILT_IN_TEMPLATES,
  searchTemplates,
  templatePreviewColors,
  templateTags,
  type BuiltInTemplate,
} from '@/lib/templates/builtin';
import { cn } from '@/lib/utils';

// Template gallery (T6.7, F-TPL-02): built-in template cards with preview,
// tags and output types. Each card re-tints its preview SVG with the chosen
// palette (the SVGs use CSS `var(--color-*)` fills), files untouched.
export interface TemplateGalleryProps {
  templates?: BuiltInTemplate[];
  onSelect?: (templateId: string) => void;
}

function Preview({ svg, palette, label }: { svg: string; palette: PaletteFile; label: string }) {
  const vars = useMemo(() => {
    const colors = templatePreviewColors(palette);
    return Object.fromEntries(Object.entries(colors).map(([role, value]) => [`--color-${role}`, value]));
  }, [palette]);
  return (
    <div
      data-testid={`template-preview-${label}`}
      role="img"
      aria-label={label}
      className="aspect-video w-full overflow-hidden rounded-md border border-border"
      style={vars as CSSProperties}
      // Bundled template asset (not user input).
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function TemplateCard({
  template,
  palette,
  onPalette,
  selected,
  onSelect,
}: {
  template: BuiltInTemplate;
  palette: PaletteFile;
  onPalette: (id: string) => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useLanguage();
  const m = template.manifest;
  return (
    <article data-testid={`template-card-${m.id}`} className={cn('rounded-lg border bg-card p-3', selected && 'border-primary')}>
      <Preview svg={template.previewSvg} palette={palette} label={m.id} />
      <div className="mt-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold leading-tight">{m.name}</h3>
        {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-label={t('templates.gallery.selected')} />}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{m.description}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {m.outputTypes.map((type) => (
          <span key={type} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
            {t(`project.type.${type}`)}
          </span>
        ))}
        {m.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-info/10 px-2 py-0.5 font-mono text-[11px] text-info">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label htmlFor={`template-palette-${m.id}`} className="shrink-0 text-xs text-muted-foreground">
          {t('templates.gallery.palette')}
        </label>
        <select
          id={`template-palette-${m.id}`}
          data-testid={`template-palette-${m.id}`}
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-muted px-1 text-xs"
          value={palette.id}
          onChange={(e) => onPalette(e.target.value)}
        >
          {template.recommended.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        size="sm"
        variant={selected ? 'secondary' : 'outline'}
        className="mt-2 h-7 w-full text-xs"
        data-testid={`template-select-${m.id}`}
        aria-pressed={selected}
        onClick={onSelect}
      >
        {selected ? t('templates.gallery.selected') : t('templates.gallery.select')}
      </Button>
    </article>
  );
}

export function TemplateGallery({ templates = BUILT_IN_TEMPLATES, onSelect }: TemplateGalleryProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<OutputType | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | 'all'>('all');
  const [paletteById, setPaletteById] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const tags = useMemo(() => templateTags(templates), [templates]);
  const types = useMemo(
    () => OUTPUT_TYPES.filter((type) => templates.some((tpl) => tpl.manifest.outputTypes.includes(type))),
    [templates],
  );
  const visible = useMemo(
    () => searchTemplates(templates, query, { outputType: typeFilter, tag: tagFilter }),
    [templates, query, typeFilter, tagFilter],
  );

  const paletteFor = (tpl: BuiltInTemplate): PaletteFile => {
    const chosen = paletteById[tpl.manifest.id];
    return tpl.recommended.find((p) => p.id === chosen) ?? tpl.palette;
  };

  return (
    <div data-testid="template-gallery" className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border p-2">
        <input
          data-testid="template-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('templates.gallery.search')}
          aria-label={t('templates.gallery.search')}
          className="h-7 w-full rounded-md border border-input bg-muted px-2 text-xs"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label={t('templates.gallery.typeAll')}>
          <Button
            size="sm"
            variant={typeFilter === 'all' ? 'secondary' : 'ghost'}
            className="h-6 px-2 text-xs"
            data-testid="template-type-all"
            aria-pressed={typeFilter === 'all'}
            onClick={() => setTypeFilter('all')}
          >
            {t('templates.gallery.typeAll')}
          </Button>
          {types.map((type) => (
            <Button
              key={type}
              size="sm"
              variant={typeFilter === type ? 'secondary' : 'ghost'}
              className="h-6 px-2 text-xs"
              data-testid={`template-type-${type}`}
              aria-pressed={typeFilter === type}
              onClick={() => setTypeFilter(type)}
            >
              {t(`project.type.${type}`)}
            </Button>
          ))}
          <select
            data-testid="template-tag"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            aria-label={t('templates.gallery.tagAll')}
            className="h-6 rounded-md border border-input bg-muted px-1 text-xs"
          >
            <option value="all">{t('templates.gallery.tagAll')}</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <p data-testid="template-empty" className="px-1 py-4 text-center text-xs text-muted-foreground">
            {t('templates.gallery.empty')}
          </p>
        ) : (
          <div className="space-y-2">
            {visible.map((tpl) => (
              <TemplateCard
                key={tpl.manifest.id}
                template={tpl}
                palette={paletteFor(tpl)}
                onPalette={(id) => setPaletteById((prev) => ({ ...prev, [tpl.manifest.id]: id }))}
                selected={selectedId === tpl.manifest.id}
                onSelect={() => {
                  setSelectedId(tpl.manifest.id);
                  onSelect?.(tpl.manifest.id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TemplateGallery;
