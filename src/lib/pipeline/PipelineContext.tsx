import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import {
  changedStages,
  currentStage,
  initialStates,
  stageAvailability,
  transitionStage,
} from './pipelineModel';
import { PipelineContext, type PipelineContextValue } from './pipelineContextValue';
import { loadPipelineStates, savePipelineStates } from './pipelineRepo';
import type { PipelineStates } from './stages';

interface Store {
  root: string | null;
  states: PipelineStates;
  loaded: boolean;
}

const EMPTY_STATES = initialStates();

export function PipelineProvider({ children }: { children: ReactNode }) {
  const root = useSafeWorkspace()?.workspaceRoot ?? null;
  const [store, setStore] = useState<Store>({ root: null, states: EMPTY_STATES, loaded: false });
  // transition() must see the latest state synchronously, before React re-renders.
  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    const settle = (states: PipelineStates) => {
      if (cancelled) return;
      const next = { root, states, loaded: true };
      storeRef.current = next;
      setStore(next);
    };
    loadPipelineStates(root).then(settle, (err: unknown) => {
      // The web preview has no project DB; keep working in memory.
      console.warn('pipeline_state load failed:', err);
      settle(initialStates());
    });
    return () => {
      cancelled = true;
    };
  }, [root]);

  // A store loaded for another folder must not leak into this one.
  const active: Store =
    store.root === root ? store : { root, states: EMPTY_STATES, loaded: root === null };

  const transition = useCallback<PipelineContextValue['transition']>(
    (stage, next, opts) => {
      const cur = storeRef.current;
      const before = cur.root === root ? cur.states : EMPTY_STATES;
      const result = transitionStage(before, stage, next, opts);
      if (!result.ok) return result;
      const updated = { root, states: result.states, loaded: true };
      storeRef.current = updated;
      setStore(updated);
      if (root) {
        savePipelineStates(root, changedStages(before, result.states)).catch((err: unknown) => {
          console.warn('pipeline_state save failed:', err);
        });
      }
      return result;
    },
    [root],
  );

  const value = useMemo<PipelineContextValue>(
    () => ({
      states: active.states,
      isLoaded: active.loaded,
      current: currentStage(active.states),
      availability: (stage) => stageAvailability(active.states, stage),
      transition,
    }),
    [active.states, active.loaded, transition],
  );

  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
}
