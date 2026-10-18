import { describe, expect, it } from 'vitest';
import {
  appendWorkOrderChange,
  emptyWorkOrder,
  renderWorkOrderMarkdown,
  resolveWorkOrderChange,
} from './workOrder';

describe('workOrder', () => {
  it('appends and coalesces consecutive open changes for the same scope and targetId', () => {
    let wo = emptyWorkOrder('ws_1');
    wo = appendWorkOrderChange(
      wo,
      {
        scope: 'scene',
        targetId: 'scn_intro',
        targetName: 'Intro',
        summary: 'Updated scene guide fields',
        fields: ['duration'],
      },
      '2026-10-18T10:00:00Z',
    );
    expect(wo.changes).toHaveLength(1);
    expect(wo.changes[0].fields).toEqual(['duration']);

    wo = appendWorkOrderChange(
      wo,
      {
        scope: 'scene',
        targetId: 'scn_intro',
        targetName: 'Intro',
        summary: 'Updated scene guide fields',
        fields: ['beats', 'visualStyle'],
      },
      '2026-10-18T10:01:00Z',
    );
    expect(wo.changes).toHaveLength(1);
    expect(wo.changes[0].fields).toEqual(['duration', 'beats', 'visualStyle']);
    expect(wo.changes[0].at).toBe('2026-10-18T10:01:00Z');
  });

  it('resolves a specific change or all open changes', () => {
    let wo = emptyWorkOrder('ws_1');
    wo = appendWorkOrderChange(
      wo,
      { scope: 'sequence', targetId: 'seq_main', summary: 'Added transition edge' },
      '2026-10-18T10:00:00Z',
      'chg_1',
    );
    wo = appendWorkOrderChange(
      wo,
      { scope: 'design', targetId: 'DESIGN.md', summary: 'Applied palette opus-keynote-lime' },
      '2026-10-18T10:02:00Z',
      'chg_2',
    );
    wo = resolveWorkOrderChange(wo, 'chg_1', '2026-10-18T10:05:00Z');
    expect(wo.changes[0].status).toBe('done');
    expect(wo.changes[1].status).toBe('open');

    wo = resolveWorkOrderChange(wo, '--all', '2026-10-18T10:06:00Z');
    expect(wo.changes.every((c) => c.status === 'done')).toBe(true);
  });

  it('renders WORK_ORDER.md with open comments and pending studio changes', () => {
    let wo = emptyWorkOrder('ws_1');
    wo = appendWorkOrderChange(
      wo,
      {
        scope: 'scene',
        targetId: 'scn_intro',
        targetName: 'Intro',
        summary: 'Modified scene parameters',
        fields: ['beats', 'duration'],
        layer: 'visual-direction',
        taxonomyTags: ['shared-layout-transition'],
      },
      '2026-10-18T10:00:00Z',
      'chg_101',
    );

    const md = renderWorkOrderMarkdown(
      { id: 'ws_1', name: 'Demo Workspace' },
      wo,
      [
        {
          id: 'cmt_202',
          slug: 'intro',
          sceneId: 'scn_intro',
          sceneName: 'Intro',
          createdAt: '2026-10-18T10:01:00Z',
          body: '타이틀 등장 속도를 조금 더 빠르게 해주세요.',
          status: 'open',
        },
      ],
    );

    expect(md).toContain('Demo Workspace');
    expect(md).toContain('[cmt_202]');
    expect(md).toContain('타이틀 등장 속도를 조금 더 빠르게 해주세요.');
    expect(md).toContain('[chg_101]');
    expect(md).toContain('`beats`, `duration`');
    expect(md).toContain('[visual-direction]');
    expect(md).toContain('shared-layout-transition');
    expect(md).toContain('역추적 실행 절차');
    expect(md).toContain('pnpm vanilla resolve cmt_202');
    expect(md).toContain('pnpm vanilla resolve chg_101');
  });
});
