import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const state = vi.hoisted(() => ({ entries: [] as unknown[], seq: null as unknown, created: [] as unknown[] }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@/lib/review/watchClient', () => ({ usePreviewWatch: () => undefined }));
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

function renderWs() {
  return render(
    <ThemeProvider>
      <LanguageProvider>
        <div style={{ width: 1000, height: 700 }}>
          <SceneWorkspace root="/w" workspace={{ id: 'ws_1', name: 'W' }} />
        </div>
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
    expect(screen.getByText('Beta')).toBeTruthy();
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
    expect(await screen.findByText('Gamma')).toBeTruthy();
  });

  it('Run agent starts the terminal for that scene with the workspace default agent; failures are shown', async () => {
    const runAgent = vi.fn(async () => ({}) as never);
    const value = { runAgent, sessions: [], activeId: null, setActiveId: vi.fn(), manager: {} as never, pickAgent: vi.fn() } as unknown as TerminalContextValue;
    render(
      <ThemeProvider>
        <LanguageProvider>
          <TerminalContext.Provider value={value}>
            <div style={{ width: 1000, height: 700 }}>
              <SceneWorkspace root="/w" workspace={{ id: 'ws_1', name: 'W' }} defaultAgent="codex" />
            </div>
          </TerminalContext.Provider>
        </LanguageProvider>
      </ThemeProvider>,
    );
    await screen.findByText('Alpha');
    const alphaButton = screen.getAllByText(/에이전트 실행|Run agent/)[0].closest('button')!;
    fireEvent.click(alphaButton);
    await waitFor(() => expect(runAgent).toHaveBeenCalledOnce());
    expect(runAgent).toHaveBeenCalledWith({ workspaceId: 'ws_1', sceneId: 'scn_AAA', sceneSlug: 'alpha', sceneName: 'Alpha', preferredAgentId: 'codex' });

    runAgent.mockRejectedValueOnce(new Error('no-enabled-agent'));
    fireEvent.click(alphaButton);
    expect((await screen.findByText(/사용할 수 있는 에이전트가 없습니다|No agent is enabled/))).toBeTruthy();
  });

  it('the run button is disabled without a terminal provider and for unreadable scenes', async () => {
    renderWs();
    await screen.findByText('Alpha');
    for (const b of screen.getAllByText(/에이전트 실행|Run agent/)) expect((b.closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
