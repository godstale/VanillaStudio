import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { newScene } from '@/lib/scene/schema';
import { newSequence } from '@/lib/sequence/schema';
import { Scenes } from './Scenes';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@/lib/context/WorkspaceContext', () => ({
  useWorkspace: () => ({ workspaceRoot: '/w', setWorkspaceRoot: vi.fn() }),
}));
vi.mock('@/lib/workspace/file', () => ({
  readWorkspace: async () => ({ workspaceId: 'ws_1', name: 'W', canvas: { aspect: '16:9', width: 1280, height: 720, fps: 30 } }),
}));
const sceneA = newScene({ id: 'scn_AAA', name: 'Alpha', type: 'motion', template: 'commercial-v1@1' });
const sceneB = newScene({ id: 'scn_BBB', name: 'Beta', type: 'static', template: 'web-page-v1@1' });
vi.mock('@/lib/scene/files', () => ({
  listScenes: async () => [
    { slug: 'alpha', scene: sceneA },
    { slug: 'beta', scene: sceneB },
  ],
  writeScene: async () => undefined,
  renameScene: async () => undefined,
}));
vi.mock('@/lib/sequence/file', () => ({
  readSequence: async () => newSequence('ws_1'),
  writeSequence: async () => undefined,
}));

function renderScenes(initial: string) {
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/scenes" element={<Scenes />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('Scenes', () => {
  it('lists scenes and shows the first with playback; comments open on demand', async () => {
    renderScenes('/scenes');
    expect((await screen.findAllByText('Alpha')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Beta').length).toBeGreaterThan(0);
    expect(await screen.findByTestId('preview-panel')).toBeTruthy();
    // 코멘트는 기본 닫힘(뷰어 역할). 버튼을 눌러야 열린다.
    expect(screen.queryByTestId('comment-toolbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /코멘트|Comments/ }));
    expect(await screen.findByTestId('comment-toolbox')).toBeTruthy();
  });

  it('honors the ?scene= parameter and opens the floating inspector', async () => {
    renderScenes('/scenes?scene=scn_BBB');
    expect((await screen.findAllByText('Beta')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /가이드 편집|Edit guide/ }));
    expect(await screen.findByTestId('scene-inspector-float')).toBeTruthy();
    expect(await screen.findByTestId('scene-inspector')).toBeTruthy();
  });

  it('does nothing on right-click (no context menu)', async () => {
    renderScenes('/scenes');
    await screen.findAllByText('Alpha');
    const item = screen.getByRole('button', { name: /Alpha[\s\S]*모션|Alpha[\s\S]*Motion/ });
    fireEvent.contextMenu(item);
    expect(screen.queryByTestId('scene-context-menu')).toBeNull();
  });

  it('comments live in a draggable floating panel', async () => {
    renderScenes('/scenes');
    await screen.findAllByText('Alpha');
    expect(screen.queryByTestId('scene-comments-float')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /코멘트|Comments/ }));
    expect(await screen.findByTestId('scene-comments-float')).toBeTruthy();
    expect(await screen.findByTestId('comment-toolbox')).toBeTruthy();
  });
});
