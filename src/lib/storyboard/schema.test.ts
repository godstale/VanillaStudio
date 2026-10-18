import { describe, expect, it } from 'vitest';
import { emptyStoryboard, parseStoryboard, serializeStoryboard } from './schema';

describe('storyboard schema', () => {
  it('round-trips through canonical serialization', () => {
    const sb = {
      ...emptyStoryboard('ws_1'),
      stage: 'docs-ready' as const,
      brief: {
        title: '2026 봄 신제품 런칭 쇼케이스',
        oneLiner: '하루 빛의 흐름으로 제품을 만나게 하는 쇼케이스',
        mediaIntent: 'web' as const,
        purpose: '시간대별 빛의 경험 전달',
        inScope: ['4단계 테마 블렌딩'],
        nonGoals: ['복잡한 장바구니 팝업'],
      },
      designFlow: {
        narrativeArc: '히어로 → 그리드',
        dataSchemas: [{ id: 'content', path: 'storyboard/data/content.json', description: '문구', itemCount: 3 }],
        assemblyPlan: [
          { id: 'asm_1', layer: 'data' as const, name: '데이터', dependsOn: [], status: 'done' as const, taxonomy: [] },
          { id: 'asm_2', layer: 'component' as const, name: '카드', dependsOn: ['asm_1'], status: 'planned' as const, taxonomy: ['line-grid-2to1'] },
        ],
      },
    };
    const text = serializeStoryboard(sb);
    expect(text.endsWith('\n')).toBe(true);
    expect(parseStoryboard(text)).toEqual(sb);
  });

  it('rejects unknown assembly dependencies and duplicates', () => {
    const bad = {
      ...emptyStoryboard('ws_1'),
      designFlow: {
        narrativeArc: '',
        dataSchemas: [],
        assemblyPlan: [
          { id: 'a', layer: 'data', name: 'A', dependsOn: ['missing'], status: 'planned', taxonomy: [] },
          { id: 'a', layer: 'data', name: 'A2', dependsOn: [], status: 'planned', taxonomy: [] },
        ],
      },
    };
    expect(() => serializeStoryboard(bad as never)).toThrow();
  });

  it('defaults a missing title so older files still parse', () => {
    const sb = {
      ...emptyStoryboard('ws_1'),
      stage: 'briefing' as const,
      brief: {
        title: '',
        oneLiner: '하루 빛의 흐름으로 제품을 만나게 하는 쇼케이스',
        mediaIntent: 'web' as const,
        purpose: '',
        inScope: [],
        nonGoals: [],
      },
    };
    expect(parseStoryboard(serializeStoryboard(sb)).brief?.title).toBe('');
  });
});
