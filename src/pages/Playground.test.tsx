import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { newScene } from '@/lib/scene/schema';
import { addNode, newSequence } from '@/lib/sequence/schema';
import { Playground } from './Playground';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('@/lib/context/WorkspaceContext', () => ({
  useWorkspace: () => ({ workspaceRoot: '/w', setWorkspaceRoot: vi.fn() }),
}));
vi.mock('@/lib/workspace/file', () => ({
  readWorkspace: async () => ({ workspaceId: 'ws_1', name: 'W', canvas: { aspect: '16:9', width: 1280, height: 720, fps: 30 } }),
}));
const sceneA = newScene({ id: 'scn_AAA', name: 'Alpha', type: 'motion', template: 'commercial-v1@1' });
vi.mock('@/lib/scene/files', () => ({
  listScenes: async () => [{ slug: 'alpha', scene: sceneA }],
}));
vi.mock('@/lib/sequence/file', () => ({
  readSequence: async () => addNode(newSequence('ws_1'), 'scn_AAA', { x: 0, y: 0 }),
}));
vi.mock('@/lib/playground/transitions/custom', () => ({
  loadCustomTransitions: async () => ({ defs: new Map() }),
}));
vi.mock('@/lib/review/previewServer', () => ({
  usePreviewServer: () => ({ state: { phase: 'running' as const, url: 'http://127.0.0.1:5123' }, retry: () => undefined }),
}));
vi.mock('@/components/playground/SequencePlayer', () => ({
  SequencePlayer: () => <div data-testid="sequence-player" />,
}));

function Probe({ onHit }: { onHit: (scene: string | null) => void }) {
  const [params] = useSearchParams();
  useEffect(() => {
    onHit(params.get('scene'));
  }, [params, onHit]);
  return null;
}

describe('Playground', () => {
  it('shows the scene gallery and opens a floating player on card click', async () => {
    const seen: (string | null)[] = [];
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={['/playground']}>
          <Routes>
            <Route path="/playground" element={<Playground />} />
            <Route path="/scenes" element={<Probe onHit={(s) => seen.push(s)} />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );
    expect(await screen.findByTestId('scene-gallery')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText(/온라인 탐색|Online browsing/)).toBeTruthy();
    // 카드 클릭은 신 화면으로 가지 않고 우측 하단 플로팅 재생을 연다.
    fireEvent.click(screen.getByRole('button', { name: /Alpha.*플로팅|Play sequence from Alpha/ }));
    const float = await screen.findByTestId('playground-float-player');
    expect(within(float).getByTestId('sequence-player')).toBeTruthy();
    expect(seen).toEqual([]);
    // 신 화면 열기는 별도 버튼으로 간다.
    fireEvent.click(screen.getByRole('button', { name: /Alpha.*열기|Open Alpha/ }));
    expect(seen).toContain('scn_AAA');
  });
});
