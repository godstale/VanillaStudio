import { describe, expect, it } from 'vitest';
import sample from './__fixtures__/plan.sample.json';
import { buildTimeline, formatParamDefault, formatParamRange } from './planView';
import { planSchema, type Plan } from './schemas/plan';

const plan: Plan = planSchema.parse(sample);

describe('plan view helpers', () => {
  it('lays scenes and animations out as percentages of the duration', () => {
    const tl = buildTimeline(plan)!;
    expect(tl.duration).toBe(15);
    const s1 = tl.rows.find((r) => r.id === 's1-intro')!;
    expect(s1).toMatchObject({ kind: 'scene', left: 0, width: 40 });
    const s2 = tl.rows.find((r) => r.id === 's2-outro')!;
    expect(s2).toMatchObject({ left: 40, width: 60 });
    const reveal = tl.rows.find((r) => r.id === 'logo-reveal')!;
    expect(reveal).toMatchObject({ kind: 'animation', left: 3.33, width: 10 });
  });

  it('returns null when nothing has timing', () => {
    const web: Plan = planSchema.parse({
      version: 1,
      outputType: 'web',
      format: { width: 1280, height: 720 },
      concept: { title: 'T' },
      scenes: [{ id: 's1', title: 'One' }],
    });
    expect(buildTimeline(web)).toBeNull();
  });

  it('formats parameter defaults and ranges', () => {
    const byId = (id: string) => plan.params.find((p) => p.id === id)!;
    expect(formatParamDefault(byId('bgColor'))).toBe('{colors.canvas}');
    expect(formatParamRange(byId('spin'))).toBe('0 – 4 (step 0.1)');
    expect(formatParamRange(byId('bgColor'))).toBe('');
    expect(formatParamDefault({ id: 'p', scope: 'global', label: 'P', type: 'vec2', default: [1, 2] })).toBe('(1, 2)');
    expect(
      formatParamRange({ id: 'm', scope: 'global', label: 'M', type: 'select', default: 'a', options: ['a', 'b'] }),
    ).toBe('a / b');
  });
});
