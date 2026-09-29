import { useLanguage } from '@/lib/i18n/LanguageContext';
import { formatParamDefault, formatParamRange } from '@/lib/pipeline/planView';
import type { Plan } from '@/lib/pipeline/schemas/plan';

export function ParamsTable({ plan }: { plan: Plan }) {
  const { t } = useLanguage();
  if (plan.params.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('pipeline.plan.noParams')}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm" data-testid="plan-params">
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">{t('pipeline.plan.param.label')}</th>
            <th className="px-3 py-2 font-medium">id</th>
            <th className="px-3 py-2 font-medium">{t('pipeline.plan.param.scope')}</th>
            <th className="px-3 py-2 font-medium">{t('pipeline.plan.param.type')}</th>
            <th className="px-3 py-2 font-medium">{t('pipeline.plan.param.default')}</th>
            <th className="px-3 py-2 font-medium">{t('pipeline.plan.param.range')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {plan.params.map((p) => (
            <tr key={p.id} data-testid={`param-row-${p.id}`}>
              <td className="px-3 py-2">{p.label}</td>
              <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
              <td className="px-3 py-2 font-mono text-xs">{p.scope}</td>
              <td className="px-3 py-2 text-xs">{p.type}</td>
              <td className="px-3 py-2 font-mono text-xs">{formatParamDefault(p)}</td>
              <td className="px-3 py-2 font-mono text-xs">{formatParamRange(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
