// Playground index provider (T6.8, F-PLY-01): the global-DB item list behind
// the side panel. React Context per concern (AGENTS.md §2); the repo is
// injectable so tests never touch SQLite.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PlaygroundContext, type AddPlaygroundInput, type PlaygroundContextValue, type UpdatePlaygroundInput } from './playgroundContextValue';
import { deletePlaygroundItem, listPlaygroundItems, savePlaygroundItem } from './playgroundRepo';
import { makePlaygroundId, normalizeTags, type PlaygroundItem } from './types';

export interface PlaygroundProviderDeps {
  list?: () => Promise<PlaygroundItem[]>;
  save?: (item: PlaygroundItem) => Promise<void>;
  remove?: (id: string) => Promise<void>;
  now?: () => string;
  newId?: () => string;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function PlaygroundProvider({
  children,
  list,
  save,
  remove,
  now = () => new Date().toISOString(),
  newId,
}: {
  children: ReactNode;
} & PlaygroundProviderDeps) {
  const [items, setItems] = useState<PlaygroundItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const genId = useRef(newId ?? (() => makePlaygroundId())).current;
  const listRef = useRef(list);
  const saveRef = useRef(save);
  const removeRef = useRef(remove);
  const nowRef = useRef(now);

  useEffect(() => {
    listRef.current = list;
    saveRef.current = save;
    removeRef.current = remove;
    nowRef.current = now;
  });

  // State changes happen in promise callbacks only (no sync setState in effects).
  useEffect(() => {
    let alive = true;
    const load = listRef.current ?? listPlaygroundItems;
    load().then(
      (loaded) => {
        if (!alive) return;
        setItems(loaded);
        setIsLoaded(true);
      },
      (e: unknown) => {
        if (!alive) return;
        setError(errorMessage(e));
        setIsLoaded(true);
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const loaded = await (listRef.current ?? listPlaygroundItems)();
      setItems(loaded);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const addItem = useCallback(
    async (input: AddPlaygroundInput): Promise<string> => {
      const title = input.title.trim();
      if (!title) throw new Error('empty-title');
      const at = nowRef.current();
      const item: PlaygroundItem = {
        id: genId(),
        title,
        kind: input.kind,
        dirPath: input.dirPath,
        sourceProject: input.sourceProject,
        tags: normalizeTags(input.tags ?? []),
        createdAt: at,
        updatedAt: at,
      };
      await (saveRef.current ?? savePlaygroundItem)(item);
      setItems((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
      return item.id;
    },
    [genId],
  );

  const removeItem = useCallback(async (id: string): Promise<void> => {
    await (removeRef.current ?? deletePlaygroundItem)(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateItem = useCallback(async (id: string, patch: UpdatePlaygroundInput): Promise<void> => {
    const current = await (listRef.current ?? listPlaygroundItems)();
    const found = current.find((i) => i.id === id) ?? null;
    if (!found) throw new Error('not-found');
    const next: PlaygroundItem = {
      ...found,
      title: patch.title !== undefined ? patch.title.trim() || found.title : found.title,
      tags: patch.tags !== undefined ? normalizeTags(patch.tags) : found.tags,
      updatedAt: nowRef.current(),
    };
    await (saveRef.current ?? savePlaygroundItem)(next);
    setItems((prev) => prev.map((i) => (i.id === id ? next : i)));
  }, []);

  const value = useMemo<PlaygroundContextValue>(
    () => ({ items, isLoaded, error, refresh, addItem, removeItem, updateItem }),
    [items, isLoaded, error, refresh, addItem, removeItem, updateItem],
  );
  return <PlaygroundContext.Provider value={value}>{children}</PlaygroundContext.Provider>;
}
