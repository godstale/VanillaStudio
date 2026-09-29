import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { PlaygroundProvider } from './PlaygroundContext';
import { usePlayground } from './playgroundContextValue';
import type { PlaygroundItem } from './types';

const seed: PlaygroundItem[] = [
  {
    id: 'pg-1',
    title: 'Intro',
    kind: 'video',
    dirPath: 'C:/p/exports/v1',
    sourceProject: 'C:/p',
    tags: ['hero'],
    createdAt: 't1',
    updatedAt: 't1',
  },
];

function Probe({ onReady }: { onReady: (v: ReturnType<typeof usePlayground>) => void }) {
  const v = usePlayground();
  onReady(v);
  return <span data-testid="count">{v.items.length}</span>;
}

describe('PlaygroundProvider', () => {
  it('loads, adds and removes items', async () => {
    let store = [...seed];
    const list = vi.fn(async () => [...store]);
    const save = vi.fn(async (item: PlaygroundItem) => {
      store = [item, ...store.filter((i) => i.id !== item.id)];
    });
    const remove = vi.fn(async (id: string) => {
      store = store.filter((i) => i.id !== id);
    });
    let ctx: ReturnType<typeof usePlayground> | null = null;

    render(
      <PlaygroundProvider list={list} save={save} remove={remove} newId={() => 'pg-new'} now={() => 't2'}>
        <Probe onReady={(v) => { ctx = v; }} />
      </PlaygroundProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));

    await act(async () => {
      await ctx?.addItem({ title: '  Cover  ', kind: 'image', dirPath: 'C:/p/exports/i1', sourceProject: null, tags: ['A', 'a'] });
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('count').textContent).toBe('2');

    await act(async () => {
      await ctx?.removeItem('pg-1');
    });
    expect(remove).toHaveBeenCalledWith('pg-1');
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('rejects an empty title', async () => {
    let ctx: ReturnType<typeof usePlayground> | null = null;
    render(
      <PlaygroundProvider list={async () => []} newId={() => 'pg-x'}>
        <Probe onReady={(v) => { ctx = v; }} />
      </PlaygroundProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    await expect(
      act(async () => {
        await ctx?.addItem({ title: '   ', kind: 'video', dirPath: 'C:/x', sourceProject: null });
      }),
    ).rejects.toThrow('empty-title');
  });
});
