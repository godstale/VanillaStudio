import { useMemo, useState, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { paletteDesignColors, searchPalettes, type PaletteFile, type PaletteScheme } from '@/lib/design/palettes';
import { cn } from '@/lib/utils';

const SCHEMES: ('all' | PaletteScheme)[] = ['all', 'light', 'dark'];

export interface PaletteLibraryProps {
  palettes: PaletteFile[];
  selectedId?: string | null;
  onSelect?: (palette: PaletteFile) => void;
  /** Extra per-row buttons, e.g. apply-to-project in the templates panel. */
  actions?: (palette: PaletteFile) => ReactNode;
}

// Reusable palette browser: search, scheme filter, and one row per palette with its
// core-role strip. Selection state and row actions are owned by the caller.
export function PaletteLibrary({ palettes, selectedId, onSelect, actions }: PaletteLibraryProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [scheme, setScheme] = useState<'all' | PaletteScheme>('all');
  const results = useMemo(() => searchPalettes(palettes, query, { scheme }), [palettes, query, scheme]);

  return (
    <div data-testid="palette-library" className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          data-testid="palette-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('palette.search.placeholder')}
          aria-label={t('palette.search.placeholder')}
          className="h-8 pl-7 text-xs"
        />
      </div>
      <div className="flex items-center gap-1" role="group" aria-label={t('palette.filter.scheme')}>
        {SCHEMES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={scheme === s ? 'secondary' : 'ghost'}
            className="h-6 px-2 text-xs"
            aria-pressed={scheme === s}
            data-testid={`palette-scheme-${s}`}
            onClick={() => setScheme(s)}
          >
            {t(`palette.scheme.${s}`)}
          </Button>
        ))}
      </div>
      {results.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('palette.search.noResults')}</p>
      ) : (
        <ul className="space-y-1.5" data-testid="design-palette-list">
          {results.map((p) => {
            const roles = paletteDesignColors(p);
            const active = p.id === selectedId;
            return (
              <li key={p.id} className="space-y-1">
                <button
                  type="button"
                  data-testid={`palette-option-${p.id}`}
                  aria-pressed={active}
                  onClick={() => onSelect?.(p)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border p-2 text-left text-xs',
                    active ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent/40',
                  )}
                >
                  <span className="flex shrink-0 overflow-hidden rounded-sm border border-border" aria-hidden>
                    {['canvas', 'ink', 'primary', 'accent'].map((role) => (
                      <span key={role} className="h-5 w-5" style={{ backgroundColor: roles[role] }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{p.name}</span>
                    <span className="block truncate font-mono text-muted-foreground">
                      {p.id} · {t(`palette.scheme.${p.scheme}`)}
                      {p.tags.length > 0 && ` · ${p.tags.join(', ')}`}
                    </span>
                  </span>
                </button>
                {actions?.(p)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default PaletteLibrary;
