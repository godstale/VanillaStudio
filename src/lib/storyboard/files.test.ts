import { describe, expect, it } from 'vitest';
import {
  CONTENT_JSON_PLACEHOLDER,
  DESIGN_FLOW_PLACEHOLDER,
  ITEMS_JSON_PLACEHOLDER,
  VISUAL_PLACEHOLDER,
  isAgentStarted,
  renderBriefMd,
  renderWorkOrderBriefMd,
} from './files';
import { emptyStoryboard, type StoryboardFile } from './schema';

function briefingFile(): StoryboardFile {
  return {
    ...emptyStoryboard('ws_1'),
    stage: 'briefing',
    brief: { title: 'T', oneLiner: '한 줄', mediaIntent: 'web', purpose: '', inScope: [], nonGoals: [] },
  };
}

function briefingRaw(): Record<string, string | null> {
  return {
    'storyboard/01-brief.md': renderBriefMd('T', '한 줄', '', [], []),
    'storyboard/02-design-flow.md': DESIGN_FLOW_PLACEHOLDER,
    'storyboard/03-visual-direction.md': VISUAL_PLACEHOLDER,
    'storyboard/data/content.json': CONTENT_JSON_PLACEHOLDER,
    'storyboard/data/items.json': ITEMS_JSON_PLACEHOLDER,
  };
}

describe('storyboard brief rendering', () => {
  it('renders the title section before the one-liner', () => {
    const md = renderBriefMd('봄 쇼케이스', '하루 빛의 흐름', '목적', ['포함'], ['제외']);
    expect(md).toContain('## 타이틀\n\n봄 쇼케이스');
    expect(md.indexOf('## 타이틀')).toBeLessThan(md.indexOf('## 핵심 한 문장'));
  });

  it('renders the work-order brief with title and intent', () => {
    const md = renderWorkOrderBriefMd('W', '봄 쇼케이스', 'web', '하루 빛의 흐름');
    expect(md).toContain('- 타이틀: 봄 쇼케이스');
    expect(md).toContain('- 매체 의도: web');
    expect(md).toContain('- 핵심 한 줄: 하루 빛의 흐름');
  });
});

describe('isAgentStarted', () => {
  it('returns false right after the brief save (briefing + placeholders)', () => {
    expect(isAgentStarted(briefingFile(), briefingRaw())).toBe(false);
  });

  it('returns false when nothing exists yet', () => {
    expect(isAgentStarted(null, {})).toBe(false);
  });

  it('returns true once the stage advances', () => {
    expect(isAgentStarted({ ...briefingFile(), stage: 'docs-ready' }, briefingRaw())).toBe(true);
  });

  it('returns true when the agent edits a doc or adds an assembly plan', () => {
    const base = briefingFile();
    expect(isAgentStarted(base, { ...briefingRaw(), 'storyboard/02-design-flow.md': '# edited\n' })).toBe(true);
    const withPlan: StoryboardFile = {
      ...base,
      designFlow: {
        narrativeArc: '',
        dataSchemas: [],
        assemblyPlan: [{ id: 'asm_1', layer: 'data', name: '데이터', dependsOn: [], status: 'planned', taxonomy: [] }],
      },
    };
    expect(isAgentStarted(withPlan, briefingRaw())).toBe(true);
  });
});
