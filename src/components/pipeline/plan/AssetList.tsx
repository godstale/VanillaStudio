import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { Plan } from '@/lib/pipeline/schemas/plan';

export function AssetList({ plan }: { plan: Plan }) {
  const { t } = useLanguage();
  if (plan.assets.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('pipeline.plan.noAssets')}</p>;
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border" data-testid="plan-assets">
      {plan.assets.map((asset) => (
        <li key={asset.id} data-testid={`asset-row-${asset.id}`} className="space-y-1 p-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{asset.id}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{asset.kind}</span>
          </div>
          {asset.description && <p className="text-sm">{asset.description}</p>}
          {asset.implementation?.approach && (
            <p className="text-xs text-muted-foreground">
              {asset.implementation.approach}
              {asset.implementation.libraries?.length ? ` (${asset.implementation.libraries.join(', ')})` : ''}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
