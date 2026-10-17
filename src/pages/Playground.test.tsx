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
const sceneB = newScene({ id: 'scn_BBB', name: 'Beta', type: 'static', template: 'web-page-v1@1' });
vi.mock('@/lib/scene/files', () => ({
  listScenes: async () => [
    { slug: 'alpha', scene: sceneA },
    { slug: 'beta', scene: sceneB },
  ],
}));
vi.mock('@/lib/sequence/file', () => ({
  readSequence: async () => addNode(addNode(newSequence('ws_1'), 'scn_AAA', { x: 0, y: 0 }), 'scn_BBB', { x: 300, y: 0 }),
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

function renderPlayground(seen: (string | null)[]) {
  return render(
    <LanguageProvider>
      <MemoryRouter initialEntries={['/playground']}>
        <Routes>
          <Route path="/playground" element={<Playground />} />
          <Route path="/scenes" element={<Probe onHit={(s) => seen.push(s)} />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>,
  );
}

describe('Playground', () => {
  it('registers the sequence (not scenes) and floats the player at the bottom-right', async () => {
    const seen: (string | null)[] = [];
    renderPlayground(seen);
    // 시퀀스 단위 등록: 갤러리에 시퀀스 카드 1개, 그 안에 첫 번째 신 카드 하나만.
    expect(await screen.findByTestId('sequence-gallery')).toBeTruthy();
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.queryByText('Beta')).toBeNull();
    // 처음부터 재생 버튼은 없다.
    expect(screen.queryByRole('button', { name: /처음부터 재생|Play from the start/ })).toBeNull();
    expect(screen.getByText(/온라인 탐색|Online browsing/)).toBeTruthy();
    // 재생 화면은 기본으로 우측 하단에 플로팅되어 있다.
    const float = await screen.findByTestId('playground-float-player');
    expect(within(float).getByTestId('sequence-player')).toBeTruthy();
    // 썸네일 클릭은 플로팅 화면에서 그 신부터 재생한다(신 화면으로 가지 않는다).
    fireEvent.click(screen.getByRole('button', { name: /Alpha.*플로팅|Play sequence from Alpha/ }));
    expect(await screen.findByTestId('playground-float-player')).toBeTruthy();
    expect(seen).toEqual([]);
    // 닫았다가 다시 열 수 있다.
    fireEvent.click(within(await screen.findByTestId('playground-float-player')).getByRole('button', { name: /닫기|Close/ }));
    expect(screen.queryByTestId('playground-float-player')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /재생 화면 열기|Open player/ }));
    expect(await screen.findByTestId('playground-float-player')).toBeTruthy();
    // 신 화면 열기는 별도 버튼으로 간다.
    fireEvent.click(screen.getByRole('button', { name: /Alpha.*열기|Open Alpha/ }));
    expect(seen).toContain('scn_AAA');
  });
});
