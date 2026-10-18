import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { emptyStoryboard } from '@/lib/storyboard/schema';

const io = vi.hoisted(() => ({ writes: [] as { path: string; contents: string }[] }));
const sbState = vi.hoisted(() => ({ scenes: [] as unknown[] }));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    if (cmd === 'read_text_file') {
      return JSON.stringify({
        version: 1,
        workspaceId: 'ws_1',
        name: 'W',
        canvas: { aspect: '16:9', width: 1920, height: 1080, fps: 30 },
      });
    }
    if (cmd === 'list_dir') return [];
    if (cmd === 'write_text_file') {
      io.writes.push({
        path: String((args as { path: string }).path),
        contents: String((args as { contents: string }).contents),
      });
      return undefined;
    }
    throw new Error(`unexpected invoke ${cmd}`);
  }),
}));

vi.mock('@/lib/scene/files', () => ({
  listScenes: async () => sbState.scenes,
}));

import { newScene } from '@/lib/scene/schema';
import { StoryboardOnboarding } from './StoryboardOnboarding';

function renderOnboarding(initial: Parameters<typeof StoryboardOnboarding>[0]['initial']) {
  const onAgentStarted = vi.fn();
  render(
    <LanguageProvider>
      <StoryboardOnboarding root="/w" initial={initial} onAgentStarted={onAgentStarted} />
    </LanguageProvider>,
  );
  return { onAgentStarted };
}

describe('StoryboardOnboarding', () => {
  beforeEach(() => {
    io.writes.length = 0;
    sbState.scenes = [];
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('requires title and one-liner, keeps the rest behind Advanced', async () => {
    renderOnboarding(null);
    // 고급 항목은 접혀 있다.
    expect(screen.queryByText('목적')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /고급|Advanced/ }));
    expect(screen.getByText('목적')).toBeTruthy();

    // 비어 있으면 필수 오류만 보이고 저장하지 않는다.
    fireEvent.click(screen.getByRole('button', { name: /작업 지시서 저장|Save brief/ }));
    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    expect(io.writes).toHaveLength(0);
  });

  it('saves the brief, stays on screen, and allows re-saving before the agent starts', async () => {
    const { onAgentStarted } = renderOnboarding(null);
    fireEvent.change(screen.getByPlaceholderText(/2026 봄|Spring 2026/), { target: { value: '봄 쇼케이스' } });
    fireEvent.change(screen.getByPlaceholderText(/하루 빛|day of light/), { target: { value: '하루 빛의 흐름' } });
    fireEvent.click(screen.getByRole('button', { name: /작업 지시서 저장|Save brief/ }));

    // 저장 후에도 화면을 닫지 않고(콜백 미호출) 대기 안내를 보여준다.
    await screen.findByRole('status');
    expect(onAgentStarted).not.toHaveBeenCalled();
    expect(io.writes).toHaveLength(7);
    const storyboardWrite = io.writes.find((w) => w.path.endsWith('storyboard/storyboard.json'));
    expect(storyboardWrite?.contents).toContain('"title": "봄 쇼케이스"');
    expect(storyboardWrite?.contents).toContain('"stage": "briefing"');
    const briefWrite = io.writes.find((w) => w.path.endsWith('storyboard/01-brief.md'));
    expect(briefWrite?.contents).toContain('## 타이틀\n\n봄 쇼케이스');
    const orderWrite = io.writes.find((w) => w.path.endsWith('WORK_ORDER.md'));
    expect(orderWrite?.contents).toContain('- 타이틀: 봄 쇼케이스');

    // 에이전트 시작 전에는 고쳐서 다시 저장할 수 있다.
    fireEvent.change(screen.getByPlaceholderText(/2026 봄|Spring 2026/), { target: { value: '봄 쇼케이스 v2' } });
    fireEvent.click(screen.getByRole('button', { name: /작업 지시서 저장|Save brief/ }));
    await screen.findByRole('status');
    expect(io.writes).toHaveLength(14);
    expect(onAgentStarted).not.toHaveBeenCalled();
  });

  it('prefills a saved brief for editing', () => {
    renderOnboarding({
      ...emptyStoryboard('ws_1'),
      stage: 'briefing',
      brief: { title: '저장된 타이틀', oneLiner: '저장된 한 줄', mediaIntent: 'web', purpose: '이유', inScope: ['a'], nonGoals: [] },
    });
    expect(screen.getByDisplayValue('저장된 타이틀')).toBeTruthy();
    expect(screen.getByDisplayValue('저장된 한 줄')).toBeTruthy();
    // 고급 값이 있으면 펼쳐진 채로 시작한다.
    expect(screen.getByDisplayValue('이유')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('moves on once the agent creates a valid scene', async () => {
    vi.useFakeTimers();
    const { onAgentStarted } = renderOnboarding(null);
    await vi.advanceTimersByTimeAsync(0); // workspaceId 확정·폴링 구독까지 진행
    sbState.scenes = [
      { slug: 'intro', scene: newScene({ id: 'scn_AAA', name: 'Intro', type: 'static', template: 'web-page@1' }) },
    ];
    await vi.advanceTimersByTimeAsync(3100);
    expect(onAgentStarted).toHaveBeenCalledTimes(1);
  });

  it('ignores empty scaffolding: node-less sequence and broken scene folders', async () => {
    vi.useFakeTimers();
    const { onAgentStarted } = renderOnboarding(null);
    await vi.advanceTimersByTimeAsync(0);
    // 빈 sequence.json(노드 없음)은 invoke 목이, 깨진 신 폴더는 아래 항목이 재현한다.
    sbState.scenes = [{ slug: 'broken', error: 'missing scene.json' }];
    await vi.advanceTimersByTimeAsync(9100);
    expect(onAgentStarted).not.toHaveBeenCalled();
  });
});
