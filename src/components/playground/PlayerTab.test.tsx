import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { PlayerTab } from './PlayerTab';
import type { PlaygroundItem } from '@/lib/playground/types';
import type { WorkspaceTab } from '@/lib/types/workspaceTab';

const ITEM: PlaygroundItem = {
  id: 'pg-1',
  title: 'Intro video',
  kind: 'video',
  dirPath: 'C:/p/exports/v1',
  sourceProject: 'C:/p',
  tags: [],
  createdAt: 't1',
  updatedAt: 't1',
};

const mocks = vi.hoisted(() => ({ files: [] as string[], failList: false }));

vi.mock('@/lib/playground/playgroundRepo', () => ({
  listPlaygroundItems: async () => [ITEM],
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string) => {
    if (cmd === 'list_dir') {
      if (mocks.failList) throw new Error('gone');
      return mocks.files.map((name) => ({ name, is_dir: false }));
    }
    if (cmd === 'reveal_in_explorer') return null;
    throw new Error(`unexpected command ${cmd}`);
  },
  convertFileSrc: (p: string) => `asset://${p}`,
}));

const tab: WorkspaceTab = { id: 'playground-item:pg-1', type: 'playground-item', title: 'Intro video', meta: { itemId: 'pg-1' } };

describe('PlayerTab', () => {
  it('plays a video result', async () => {
    mocks.failList = false;
    mocks.files = ['clip.mp4', 'poster.png'];
    renderWithProviders(<PlayerTab tab={tab} />);
    expect(await screen.findByTestId('playground-video')).toBeTruthy();
  });

  it('steps through slide images', async () => {
    mocks.failList = false;
    mocks.files = ['s1.png', 's2.png'];
    renderWithProviders(<PlayerTab tab={tab} />);
    expect(await screen.findByText('1 / 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('2 / 2')).toBeTruthy();
  });

  it('shows a missing state when the folder is gone', async () => {
    mocks.failList = true;
    mocks.files = [];
    renderWithProviders(<PlayerTab tab={tab} />);
    expect(await screen.findByText(/원본 폴더를 찾을 수 없습니다/)).toBeTruthy();
  });
});
