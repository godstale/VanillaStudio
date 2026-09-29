import { useLanguage } from '@/lib/i18n/LanguageContext';
import { formatSeconds } from '@/lib/pipeline/planView';
import type { Plan } from '@/lib/pipeline/schemas/plan';

function Chips({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item) => (
        <span key={item} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
          {item}
        </span>
      ))}
    </>
  );
}

export function StoryboardCards({ plan }: { plan: Plan }) {
  const { t } = useLanguage();
  return (
    <ol className="grid gap-3 sm:grid-cols-2" data-testid="plan-storyboard">
      {plan.scenes.map((scene, i) => (
        <li key={scene.id} data-testid={`scene-card-${scene.id}`} className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold">
              <span className="mr-1 text-muted-foreground">{i + 1}.</span>
              {scene.title}
            </h4>
            {scene.start !== undefined && scene.end !== undefined && (
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {formatSeconds(scene.start)} – {formatSeconds(scene.end)}
              </span>
            )}
          </div>
          {scene.purpose && <p className="text-sm">{scene.purpose}</p>}
          {scene.layout && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{t('pipeline.plan.layout')}: </span>
              {scene.layout}
            </p>
          )}
          {scene.implementation?.approach && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{t('pipeline.plan.approach')}: </span>
              {scene.implementation.approach}
              {scene.implementation.reason ? ` — ${scene.implementation.reason}` : ''}
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            <Chips items={[...scene.assets, ...scene.animations]} />
          </div>
        </li>
      ))}
    </ol>
  );
}
