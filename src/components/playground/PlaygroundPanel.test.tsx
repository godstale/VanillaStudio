import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { PlaygroundPanel } from './PlaygroundPanel';
import type { PlaygroundItem } from '@/lib/playground/types';
import type { ExportJobRow } from '@/lib/export/exportRepo';

const ITEMS: PlaygroundItem[] = [
  {
    id: 'pg-1',
    title: 'Intro video',
    kind: 'video',
    dirPath: 'C:/p/exports/v1',
    sourceProject: 'C:/p',
    tags: ['hero'],
    createdAt: 't1',
    updatedAt: 't1',
  },
  {
    id: 'pg-2',
    title: 'Cover',
    kind: 'image',
    dirPath: 'C:/p/exports/i1',
    sourceProject: 'C:/p',
    tags: [],
    createdAt: 't2',
    updatedAt: 't2',
  },
];

const JOBS: ExportJobRow[] = [
  { id: 'j1', format: 'video', status: 'done', outputPath: 'C:/p/exports/v9', startedAt: null, endedAt: null, error: null },
  { id: 'j2', format: 'video', status: 'failed', outputPath: 'C:/p/exports/v8', startedAt: null, endedAt: null, error: 'x' },
];

const mocks = vi.hoisted(() => ({
  items: [] as PlaygroundItem[],
  opened: [] as unknown[],
  added: [] as PlaygroundItem[],
}));

vi.mock('@/lib/playground/playgroundRepo', () => ({
  listPlaygroundItems: async () => [...mocks.items],
  savePlaygroundItem: async (item: PlaygroundItem) => {
    mocks.added.push(item);
    mocks.items = [item, ...mocks.items.filter((i) => i.id !== item.id)];
  },
  deletePlaygroundItem: async (id: string) => {
    mocks.items = mocks.items.filter((i) => i.id !== id);
  },
}));

vi.mock('@/lib/export/exportRepo', () => ({
  loadExportJobs: async () => [...JOBS],
}));

vi.mock('@/lib/context/WorkspaceContext', () => ({
  useSafeWorkspace: () => ({ workspaceRoot: 'C:/p' }),
}));

vi.mock('@/lib/context/WorkspaceTabsContext', () => ({
  useWorkspaceTabs: () => ({
    openTab: (tab: unknown) => {
      mocks.opened.push(tab);
    },
  }),
}));

describe('PlaygroundPanel', () => {
  beforeEach(() => {
    mocks.items = [...ITEMS];
    mocks.opened.length = 0;
    mocks.added.length = 0;
  });

  it('lists items and filters by search text', async () => {
    renderWithProviders(<PlaygroundPanel />);
    expect(await screen.findByText('Intro video')).toBeTruthy();
    expect(screen.getByText('Cover')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/보관함 검색/), { target: { value: 'cover' } });
    expect(screen.queryByText('Intro video')).toBeNull();
    expect(screen.getByText('Cover')).toBeTruthy();
  });

  it('opens the player tab for an item', async () => {
    renderWithProviders(<PlaygroundPanel />);
    await screen.findByText('Intro video');
    fireEvent.click(screen.getAllByText('열기')[0]);
    expect(mocks.opened).toContainEqual(
      expect.objectContaining({ type: 'playground-item', meta: { itemId: 'pg-1' } }),
    );
  });

  it('adds a finished export job to the playground', async () => {
    renderWithProviders(<PlaygroundPanel />);
    await waitFor(() => expect(screen.getByText('v9')).toBeTruthy());
    // The failed job is not offered.
    expect(screen.queryByText('v8')).toBeNull();
    fireEvent.click(screen.getByText('보관함에 추가'));
    await waitFor(() => expect(mocks.added).toHaveLength(1));
    expect(mocks.added[0]).toMatchObject({ kind: 'video', dirPath: 'C:/p/exports/v9', sourceProject: 'C:/p' });
    expect(await screen.findByText('보관함에 추가했습니다.')).toBeTruthy();
  });
});
