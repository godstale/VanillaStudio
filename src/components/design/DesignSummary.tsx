import { useMemo } from 'react';
import { contrast } from '@/lib/design/color';
import type { ParsedDesign } from '@/lib/design/parse';
import { safeParseDesign } from '@/components/design/safeParseDesign';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/** 스와치 위 글자색: 배경과 대비가 큰 쪽. 스와치는 사용자 데이터라 토큰 클래스를 쓸 수 없다. */
function labelColor(bg: string): string {
  try {
    return contrast('#000000', bg) >= contrast('#FFFFFF', bg) ? '#000000' : '#FFFFFF';
  } catch {
    return '#000000';
  }
}

const MAX_SAMPLE_PX = 40;

function samplePx(size: string | number | undefined): number {
  const n = typeof size === 'number' ? size : parseFloat(size ?? '');
  return Number.isFinite(n) ? Math.min(Math.max(n, 12), MAX_SAMPLE_PX) : 16;
}

export function ColorSwatches({ colors }: { colors: Record<string, string> }) {
  const entries = Object.entries(colors);
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="design-swatches">
      {entries.map(([role, value]) => (
        <li
          key={role}
          data-testid={`swatch-${role}`}
          className="flex h-16 flex-col justify-end rounded-md border border-border p-2 text-xs"
          style={{ backgroundColor: value, color: labelColor(value) }}
        >
          <span className="font-medium">{role}</span>
          <span className="font-mono opacity-80">{value}</span>
        </li>
      ))}
    </ul>
  );
}

export function TypographySamples({ typography }: { typography: ParsedDesign['tokens']['typography'] }) {
  const { t } = useLanguage();
  return (
    <ul className="space-y-3" data-testid="design-typography">
      {Object.entries(typography).map(([name, spec]) => (
        <li key={name} className="space-y-1">
          <div
            className="truncate"
            style={{
              fontFamily: String(spec.fontFamily ?? 'inherit'),
              fontSize: samplePx(spec.fontSize),
              fontWeight: spec.fontWeight ?? 400,
              lineHeight: spec.lineHeight ?? 1.3,
            }}
          >
            {t('design.sample')}
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            {name} · {Object.entries(spec).map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </div>
        </li>
      ))}
    </ul>
  );
}

// Compact design-system view: palette swatches and type samples (used by the Plan viewer).
export function DesignSummary({ text }: { text: string }) {
  const { t } = useLanguage();
  const parsed = useMemo(() => safeParseDesign(text), [text]);
  const hasColors = Object.keys(parsed.colors).length > 0;
  const hasType = Object.keys(parsed.tokens.typography).length > 0;

  return (
    <div data-testid="design-summary" className="space-y-4">
      {parsed.tokens.name && <p className="text-sm font-medium">{parsed.tokens.name}</p>}
      {hasColors ? (
        <ColorSwatches colors={parsed.colors} />
      ) : (
        <p className="text-sm text-muted-foreground">{t('design.noColors')}</p>
      )}
      {hasType && <TypographySamples typography={parsed.tokens.typography} />}
      {parsed.issues.length > 0 && (
        <ul className="space-y-1 text-xs text-destructive" data-testid="design-issues">
          {parsed.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default DesignSummary;
