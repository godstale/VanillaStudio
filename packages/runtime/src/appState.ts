import type { ParamsBySceneId } from './composition';
import type { Colors } from './design/types';

/** Preview-only state the host can change through the Bridge; it never touches project files. */
export function createAppState(initial: ParamsBySceneId) {
  let snapshot = { params: initial, override: null as Colors | null };
  const listeners = new Set<() => void>();
  const set = (next: Partial<typeof snapshot>) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((l) => l());
  };
  return {
    get: () => snapshot,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    mergeParams(sceneId: string, values: Record<string, unknown>) {
      set({ params: { ...snapshot.params, [sceneId]: { ...snapshot.params[sceneId], ...values } } });
    },
    mergeAll(all: Record<string, Record<string, unknown>>) {
      const params: Record<string, Record<string, unknown>> = { ...snapshot.params };
      for (const [id, v] of Object.entries(all)) params[id] = { ...params[id], ...v };
      set({ params });
    },
    setOverride: (override: Colors | null) => set({ override }),
  };
}

export type AppState = ReturnType<typeof createAppState>;
