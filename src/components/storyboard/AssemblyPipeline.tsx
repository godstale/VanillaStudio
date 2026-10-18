import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { StoryboardFile } from '@/lib/storyboard/schema';

const LAYER_ORDER = ['data', 'component', 'section', 'scene'] as const;

/** 3층: 상향식 조립 파이프라인 (Data → Component → Section → Scene). */
export function AssemblyPipeline({ file, root }: { file: StoryboardFile; root: string }) {
  void root;
  const { t } = useLanguage();
  const plan = [...file.designFlow.assemblyPlan].sort(
    (a, b) => LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer),
  );
  return (
    <section className="space-y-2 rounded-lg border border-border p-4" aria-label={t('storyboard.assembly')}>
      <h2 className="text-sm font-bold">{t('storyboard.assembly')}</h2>
      {plan.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('storyboard.empty')}</p>
      ) : (
        <ol className="space-y-1.5">
          {plan.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-xs">
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{item.layer}</span>
              <b>{item.name}</b>
              <span className="text-muted-foreground">[{item.status}]</span>
              {item.taxonomy.map((tag) => (
                <span key={tag} className="rounded bg-accent px-1.5 py-0.5 font-mono text-[10px]">{tag}</span>
              ))}
              {item.targetScene && (
                <Link to="/scenes" className="ml-auto rounded border border-border px-1.5 py-0.5 hover:bg-accent">
                  {t('storyboard.openScene')}: {item.targetScene}
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
