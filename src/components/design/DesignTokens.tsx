import type { ReactNode } from 'react';
import { ColorSwatches, TypographySamples } from '@/components/design/DesignSummary';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { ParsedDesign } from '@/lib/design/parse';

const CSS_LENGTH = /^\d+(?:\.\d+)?(?:px|rem|em)$/;
/** Sample boxes must stay small on screen even for huge tokens (e.g. 9999px pill radius). */
const MAX_BOX_PX = 160;

function px(value: string | number): string | undefined {
  const s = String(value);
  if (!CSS_LENGTH.test(s)) return undefined;
  const n = parseFloat(s);
  const asPx = s.endsWith('px') ? n : n * 16;
  return `${Math.min(asPx, MAX_BOX_PX)}px`;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

// Visual rendering of every DESIGN.md token group: colors, typography, spacing, rounded, components.
export function DesignTokens({ design }: { design: ParsedDesign }) {
  const { t } = useLanguage();
  const { tokens, colors } = design;
  const spacing = Object.entries(tokens.spacing);
  const rounded = Object.entries(tokens.rounded);
  const components = Object.entries(tokens.components);

  return (
    <div data-testid="design-tokens" className="space-y-6">
      {Object.keys(colors).length > 0 && (
        <Block title={t('design.colors')}>
          <ColorSwatches colors={colors} />
        </Block>
      )}
      {Object.keys(tokens.typography).length > 0 && (
        <Block title={t('design.typography')}>
          <TypographySamples typography={tokens.typography} />
        </Block>
      )}
      {spacing.length > 0 && (
        <Block title={t('design.spacing')}>
          <ul className="space-y-1" data-testid="design-spacing">
            {spacing.map(([name, value]) => (
              <li key={name} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 font-mono">{name}</span>
                {/* Bar length is the token value itself. */}
                <span className="h-3 rounded-sm bg-primary" style={{ width: px(value) ?? '0px' }} />
                <span className="font-mono text-muted-foreground">{String(value)}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}
      {rounded.length > 0 && (
        <Block title={t('design.rounded')}>
          <ul className="flex flex-wrap gap-3" data-testid="design-rounded">
            {rounded.map(([name, value]) => (
              <li key={name} className="space-y-1 text-center text-xs">
                <div className="h-14 w-14 border-2 border-primary bg-muted" style={{ borderRadius: px(value) }} />
                <div className="font-mono">{name}</div>
                <div className="font-mono text-muted-foreground">{value}</div>
              </li>
            ))}
          </ul>
        </Block>
      )}
      {components.length > 0 && (
        <Block title={t('design.components')}>
          <ul className="space-y-2" data-testid="design-components">
            {components.map(([name, props]) => (
              <li key={name} className="rounded-md border border-border p-2 text-xs">
                <div className="font-medium">{name}</div>
                <div className="font-mono text-muted-foreground">
                  {Object.entries(props)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ')}
                </div>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}
