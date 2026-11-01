import { useState, type CSSProperties } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { Example } from '@/lib/examples';

function filmstripStyle(example: Example): CSSProperties {
  const resting = example.frames > 1 ? (3 / (example.frames - 1)) * 100 : 0;
  return {
    backgroundImage: `url(${example.previewUrl})`,
    backgroundSize: `${example.frames * 100}% 100%`,
    backgroundPosition: `${resting}% 0`,
  };
}

/** 카드 미리보기. 움직이는 예제는 필름스트립이라 호버하면 재생되고, 누르면 크게 본다. */
export function ExampleThumb({ example, name }: { example: Example; name: string }) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const motion = example.frames > 1;
  const label = t('tpl.previewAlt', { name });

  const loadSource = () => {
    if (source === null) void example.loadSource().then(setSource);
  };

  return (
    <>
      <button
        type="button"
        aria-label={t('tpl.example.open', { name })}
        data-testid="example-thumb"
        onClick={() => setOpen(true)}
        className={`block aspect-video w-full bg-muted bg-no-repeat ${motion ? 'vs-filmstrip' : ''}`}
        style={filmstripStyle(example)}
      />
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label={label}
            data-testid="example-dialog"
            className="max-h-[90vh] w-[720px] max-w-[90vw] overflow-auto rounded-lg border border-border bg-card p-4 text-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold">{name}</h2>
            <div
              role="img"
              aria-label={label}
              className={`mt-2 aspect-video w-full rounded-md bg-muted bg-no-repeat ${motion ? 'vs-filmstrip-playing' : ''}`}
              style={filmstripStyle(example)}
            />
            <p className="mt-2 text-xs text-muted-foreground">{example.note[locale === 'en' ? 'en' : 'ko']}</p>
            <details className="mt-2 rounded border border-border p-2 text-xs" onToggle={loadSource}>
              <summary className="cursor-pointer font-medium">{t('tpl.example.source')}</summary>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{source}</pre>
            </details>
          </div>
        </div>
      )}
    </>
  );
}
