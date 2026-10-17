import { useMemo } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { listBuiltinTemplates } from '@/lib/guides/template';
import { categories, termsIn } from '@/lib/guides/glossary';
import { BUILT_IN_PALETTES } from '@/lib/design/palettes';
import type { SceneType } from '@/lib/scene/schema';

const TYPES: SceneType[] = ['static', 'motion', '3d'];
const SWATCH_ROLES = ['canvas', 'ink', 'primary', 'accent'] as const;

/** 템플릿 메뉴: 신 종류별 가이드 템플릿·컬러 팔레트·구성 기법 샘플. 적용은 각 화면(신 디자인 탭 등)에서 한다. */
export function Templates() {
  const { t, locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'ko';
  const guides = useMemo(() => listBuiltinTemplates(), []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 p-6 text-sm" data-testid="templates-page">
      <div>
        <h1 className="text-base font-semibold">{t('tpl.title')}</h1>
        <p className="mt-1 text-xs text-muted-foreground">{t('tpl.desc')}</p>
      </div>

      <section aria-label={t('tpl.guides')} className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">{t('tpl.guides')}</h2>
        {TYPES.map((type) => (
          <div key={type}>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">{t(`scene.type.${type}`)}</h3>
            <ul className="space-y-2">
              {guides
                .filter((g) => g.meta.type === type)
                .map((g) => (
                  <li key={g.ref} className="rounded-md border border-border p-3">
                    <div className="flex items-center gap-2">
                      <b>{g.meta.label[lang]}</b>
                      <span className="font-mono text-xs text-muted-foreground">{g.ref}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                        {t('tpl.terms', { count: g.glossary.terms.length })}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <details className="min-w-48 flex-1 rounded border border-border p-2">
                        <summary className="cursor-pointer font-medium">{t('tpl.rules')}</summary>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{g.rules}</pre>
                      </details>
                      <details className="min-w-48 flex-1 rounded border border-border p-2">
                        <summary className="cursor-pointer font-medium">{t('tpl.checklist')}</summary>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">{g.checklist}</pre>
                      </details>
                    </div>
                    <div className="mt-2">
                      <p className="mb-1 text-xs font-medium">{t('tpl.techniques')}</p>
                      <ul className="space-y-1">
                        {categories(g.glossary).map((c) => (
                          <li key={c}>
                            <details className="rounded bg-muted/50 px-2 py-1">
                              <summary className="cursor-pointer text-xs">
                                {c} ({termsIn(g.glossary, c).length})
                              </summary>
                              <ul className="mt-1 space-y-1 pl-2">
                                {termsIn(g.glossary, c).map((term) => (
                                  <li key={term.id} className="text-[11px]">
                                    <b>{term.label[lang]}</b>
                                    <span className="text-muted-foreground"> — {term.definition[lang]}</span>
                                    {term.implementationHint && <span className="block text-muted-foreground">→ {term.implementationHint}</span>}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-label={t('tpl.palettes')} className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('tpl.palettes')}</h2>
        <p className="text-xs text-muted-foreground">{t('tpl.paletteApplyHint')}</p>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {BUILT_IN_PALETTES.map((p) => (
            <li key={p.id} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <b className="text-xs">{p.name}</b>
                <span className="font-mono text-[10px] text-muted-foreground">{p.id}</span>
              </div>
              <div className="mt-2 flex gap-1" aria-hidden>
                {SWATCH_ROLES.map((role) => (
                  <span
                    key={role}
                    title={`${role}: ${p.colors[role] ?? ''}`}
                    className="h-8 flex-1 rounded border border-border"
                    style={{ backgroundColor: p.colors[role] }}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">{t('tpl.samplesLater')}</p>
    </div>
  );
}

export default Templates;
