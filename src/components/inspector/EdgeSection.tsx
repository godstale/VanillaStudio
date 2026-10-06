import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { BUILTIN_TRANSITIONS, isBuiltinTransition, MAX_TRANSITION_MS } from '@/lib/playground/transitions';
import { buildTrigger, triggerKind, triggerValue, type SeqEdge, type TriggerKind } from '@/lib/sequence/edit';
import type { SceneType } from '@/lib/scene/schema';
import type { SequenceIssue } from '@/lib/sequence/validate';

export interface EdgeSectionProps {
  edge: SeqEdge;
  fromName: string;
  toName: string;
  /** 출발 신 타입. static이면 사용자 입력 trigger만 고를 수 있다(D-032). */
  fromType: SceneType;
  /** 워크스페이스에 정의된 선언형 전환 이름(`custom:<name>`으로 고른다). */
  customTransitions: readonly string[];
  /** 이 엣지에 대한 검증 결과. */
  issues: readonly SequenceIssue[];
  onChange: (patch: Partial<Pick<SeqEdge, 'trigger' | 'transition'>>) => void;
  onDelete: () => void;
}

const select = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm';
const EASINGS = ['ease-in-out', 'ease', 'ease-in', 'ease-out', 'linear'] as const;
const DIRECTIONS = ['left', 'right', 'up', 'down'] as const;
const AUTO: TriggerKind[] = ['end', 'timeout'];
const KINDS: TriggerKind[] = ['end', 'click', 'key', 'timeout', 'choice'];

const numberOr = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** 엣지 인스펙터: trigger(입력·시간·분기)와 전환(종류·길이·이징·파라미터). 저장할 수 없는 중간 값은 저장하지 않고 안내한다. */
export function EdgeSection({ edge, fromName, toName, fromType, customTransitions, issues, onChange, onDelete }: EdgeSectionProps) {
  const { t } = useLanguage();
  const kind = triggerKind(edge.trigger);
  const [value, setValue] = useState(triggerValue(edge.trigger));
  const [valueError, setValueError] = useState(false);
  const tr = edge.transition;
  const params = tr.params;

  function changeKind(next: TriggerKind) {
    // 종류가 바뀌면 값도 그 종류의 기본값으로 시작한다(다른 종류의 값을 끌고 가지 않는다).
    const nextValue = next === 'timeout' ? '3' : next === 'key' ? 'ArrowRight' : next === 'choice' ? toName : '';
    setValue(nextValue);
    const trigger = buildTrigger(next, nextValue);
    setValueError(trigger === null);
    if (trigger) onChange({ trigger });
  }

  function changeValue(v: string) {
    setValue(v);
    const trigger = buildTrigger(kind, v);
    setValueError(trigger === null);
    if (trigger) onChange({ trigger });
  }

  const setTransition = (patch: Partial<SeqEdge['transition']>) => onChange({ transition: { ...tr, ...patch } });
  const setParam = (key: string, v: unknown) => setTransition({ params: { ...params, [key]: v } });
  const customName = tr.type.startsWith('custom:') ? tr.type.slice('custom:'.length) : null;
  const unknownCustom = customName !== null && !customTransitions.includes(customName);

  return (
    <div className="flex h-full flex-col gap-3 p-3 text-xs" data-testid="edge-section">
      <header className="flex items-center gap-2">
        <b className="min-w-0 flex-1 truncate text-sm">{t('edge.title', { from: fromName, to: toName })}</b>
        <Button size="sm" variant="ghost" aria-label={t('edge.delete')} onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </header>

      {issues.map((i, n) => (
        <p key={n} role="alert" className={i.severity === 'error' ? 'text-destructive' : 'text-warning'}>
          {i.message}
        </p>
      ))}

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">{t('edge.trigger')}</h3>
        <select className={select} aria-label={t('edge.triggerKind')} value={kind} onChange={(e) => changeKind(e.target.value as TriggerKind)}>
          {KINDS.map((k) => (
            <option key={k} value={k} disabled={fromType === 'static' && AUTO.includes(k)}>
              {t(`edge.trigger.${k}`)}
            </option>
          ))}
        </select>
        {fromType === 'static' && <p className="text-muted-foreground">{t('edge.staticHint')}</p>}
        {(kind === 'key' || kind === 'timeout' || kind === 'choice') && (
          <>
            <Input value={value} aria-label={t(`edge.value.${kind}`)} placeholder={t(`edge.value.${kind}`)} onChange={(e) => changeValue(e.target.value)} />
            {valueError && (
              <p role="alert" className="text-warning">
                {t('edge.valueInvalid')}
              </p>
            )}
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">{t('edge.transition')}</h3>
        <select className={select} aria-label={t('edge.transitionType')} value={tr.type} onChange={(e) => setTransition({ type: e.target.value, params: {} })}>
          {BUILTIN_TRANSITIONS.map((x) => (
            <option key={x} value={x}>
              {t(`edge.transition.${x}`)}
            </option>
          ))}
          {customTransitions.map((n) => (
            <option key={n} value={`custom:${n}`}>
              {t('edge.transition.custom', { name: n })}
            </option>
          ))}
          {!isBuiltinTransition(tr.type) && unknownCustom && <option value={tr.type}>{tr.type}</option>}
        </select>
        {!isBuiltinTransition(tr.type) && unknownCustom && (
          <p role="alert" className="text-destructive">
            {t('edge.unknownTransition', { type: tr.type })}
          </p>
        )}

        {tr.type !== 'cut' && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">{t('edge.duration')}</span>
              <Input type="number" min={0} max={MAX_TRANSITION_MS} step={50} value={tr.durationMs} onChange={(e) => setTransition({ durationMs: Math.max(0, Math.min(MAX_TRANSITION_MS, Math.round(Number(e.target.value) || 0))) })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground">{t('edge.easing')}</span>
              <select className={select} value={EASINGS.includes(tr.easing as (typeof EASINGS)[number]) ? tr.easing : 'ease-in-out'} onChange={(e) => setTransition({ easing: e.target.value })}>
                {EASINGS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}

        {tr.type === 'mask-wipe' && (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">{t('edge.param.direction')}</span>
            <select className={select} value={typeof params.direction === 'string' ? params.direction : 'left'} onChange={(e) => setParam('direction', e.target.value)}>
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {t(`edge.direction.${d}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        {tr.type === 'circular-reveal' && (
          <div className="flex gap-2">
            {(['x', 'y'] as const).map((axis) => (
              <label key={axis} className="flex flex-1 flex-col gap-1">
                <span className="text-muted-foreground">{t(`edge.param.${axis}`)}</span>
                <Input type="number" min={0} max={100} value={numberOr(params[axis], 50)} onChange={(e) => setParam(axis, Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
              </label>
            ))}
          </div>
        )}
        {tr.type === 'zoom-through' && (
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">{t('edge.param.scale')}</span>
            <Input type="number" min={1.1} max={6} step={0.1} value={numberOr(params.scale, 2.2)} onChange={(e) => setParam('scale', Math.max(1.1, Math.min(6, Number(e.target.value) || 2.2)))} />
          </label>
        )}
      </section>
    </div>
  );
}
