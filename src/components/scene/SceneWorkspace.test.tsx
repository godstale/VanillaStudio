import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import { newScene, type Scene } from '@/lib/scene/schema';
import { newSequence, type Sequence } from '@/lib/sequence/schema';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.stubGlobal(
  'DOMMatrixReadOnly',
  class {
    m22 = 1;
  },
);

const state = vi.hoisted(() => ({ entries: [] as unknown[], seq: null as unknown, created: [] as unknown[], onBatch: undefined as ((paths: string[]) => void) | undefined }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@/lib/review/watchClient', () => ({
  usePreviewWatch: (_root: string, o: { onBatch?: (paths: string[]) => void }) => {
    state.onBatch = o.onBatch;
  },
}));
vi.mock('@/lib/scene/files', () => ({
  listScenes: async () => state.entries,
  refreshStatuses: async () => false,
  createScene: async (_r: string, _w: unknown, input: { name: string; type: 'static' | 'motion' | '3d' }) => {
    const { newScene: mk } = await import('@/lib/scene/schema');
    const scene = mk({ id: 'scn_NEW000000001', name: input.name, type: input.type, template: 'commercial@1' });
    state.entries = [...state.entries, { slug: 'new', scene }];
    state.created.push(input);
    return { slug: 'new', scene };
  },
}));
vi.mock('@/lib/sequence/file', () => ({
  readSequence: async () => state.seq,
  writeSequence: async (_r: string, s: unknown) => {
    state.seq = s;
  },
}));

import { TerminalContext, type TerminalContextValue } from '@/components/terminal/terminalContextValue';
import { SceneWorkspace } from './SceneWorkspace';

const sceneA: Scene = newScene({ id: 'scn_AAA', name: 'Alpha', type: 'motion', template: 'commercial@1' });
const sceneB: Scene = newScene({ id: 'scn_BBB', name: 'Beta', type: 'static', template: 'web-page@1' });

function Probe({ onHit }: { onHit: (scene: string | null) => void }) {
  const [params] = useSearchParams();
  useEffect(() => {
    onHit(params.get('scene'));
  }, [params, onHit]);
  return null;
}

function renderWs(probe?: (scene: string | null) => void) {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <MemoryRouter initialEntries={['/workspace']}>
          <Routes>
            <Route
              path="/workspace"
              element={
                <div style={{ width: 1000, height: 700 }}>
                  <SceneWorkspace root="/w" workspace={{ id: 'ws_1', name: 'W' }} />
                </div>
              }
            />
            <Route path="/scenes" element={<Probe onHit={probe ?? (() => undefined)} />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  state.entries = [
    { slug: 'alpha', scene: sceneA },
    { slug: 'beta', scene: sceneB },
    { slug: 'broken', error: 'bad json' },
  ];
  state.seq = newSequence('ws_1');
  state.created = [];
});

describe('SceneWorkspace', () => {
  it('shows a node per scene folder, including an unreadable one', async () => {
    renderWs();
    expect(await screen.findByText('Alpha')).toBeTruthy();
    // 코멘트 툴박스의 신 선택 옵션에도 같은 이름이 있어 여러 개가 나온다.
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('scene-node')).toHaveLength(3);
    expect(screen.getAllByRole('alert', { hidden: true }).length).toBeGreaterThan(0); // xyflow hides nodes until measured (jsdom never measures)
  });

  it('adds missing scenes to sequence.json on load', async () => {
    renderWs();
    await screen.findByText('Alpha');
    const seq = state.seq as Sequence;
    expect(seq.nodes.map((n) => n.sceneId).sort()).toEqual(['scn_AAA', 'scn_BBB']);
    expect(seq.start).not.toBeNull();
  });

  it('creates a scene from the dialog and stores its node', async () => {
    renderWs();
    await screen.findByText('Alpha');
    fireEvent.click(screen.getByRole('button', { name: /신 추가|Add scene/ }));
    fireEvent.change(await screen.findByRole('textbox'), { target: { value: 'Gamma' } });
    fireEvent.click(screen.getByDisplayValue('3d'));
    fireEvent.click(screen.getByRole('button', { name: /만들기|Create/ }));
    await waitFor(() => expect(state.created).toEqual([expect.objectContaining({ name: 'Gamma', type: '3d' })]));
    await waitFor(() => expect((state.seq as Sequence).nodes.some((n) => n.sceneId === 'scn_NEW000000001')).toBe(true));
    expect((await screen.findAllByText('Gamma')).length).toBeGreaterThan(0);
  });

  it('has no agent-run button; play jumps to the scene screen', async () => {
    const seen: (string | null)[] = [];
    renderWs((s) => seen.push(s));
    await screen.findByText('Alpha');
    expect(screen.queryByText(/에이전트 실행|Run agent/)).toBeNull();
    // jsdom에서 노드는 visibility:hidden이라 role 쿼리에 안 잡혀 텍스트로 찾는다.
    const play = screen.getAllByText(/재생|Play/)[0].closest('button')!;
    fireEvent.click(play);
    await waitFor(() => expect(seen).toContain('scn_AAA'));
  });

  it('shows the comment toolbox overlay', async () => {
    renderWs();
    await screen.findByText('Alpha');
    expect(await screen.findByTestId('comment-toolbox')).toBeTruthy();
  });
});

describe('outside writes warning', () => {
  const withSessions = (sessions: { id: string; sceneSlug: string; status: string }[]) => {
    const value = { runAgent: vi.fn(), sessions, activeId: null, setActiveId: vi.fn(), manager: {} as never, pickAgent: vi.fn() } as unknown as TerminalContextValue;
    render(
      <ThemeProvider>
        <LanguageProvider>
          <TerminalContext.Provider value={value}>
            <MemoryRouter initialEntries={['/workspace']}>
              <div style={{ width: 1000, height: 700 }}>
                <SceneWorkspace root="/w" workspace={{ id: 'ws_1', name: 'W' }} />
              </div>
            </MemoryRouter>
          </TerminalContext.Provider>
        </LanguageProvider>
      </ThemeProvider>,
    );
  };

  it('warns about writes outside the running scene folder, not inside it', async () => {
    withSessions([{ id: 's1', sceneSlug: 'alpha', status: 'running' }]);
    await screen.findByText('Alpha');
    state.onBatch?.(['scenes/alpha/src/main.tsx', 'workspace.json']);
    expect(screen.queryByTestId('outside-writes')).toBeNull();
    state.onBatch?.(['scenes/beta/src/main.tsx', 'DESIGN.md']);
    const box = await screen.findByTestId('outside-writes');
    expect(box.textContent).toContain('scenes/beta/src/main.tsx');
    expect(box.textContent).toContain('DESIGN.md');
    expect(box.textContent).not.toContain('scenes/alpha');
  });

  it('is silent when no agent is running', async () => {
    withSessions([{ id: 's1', sceneSlug: 'alpha', status: 'exited' }]);
    await screen.findByText('Alpha');
    state.onBatch?.(['scenes/beta/src/main.tsx']);
    expect(screen.queryByTestId('outside-writes')).toBeNull();
  });
});
