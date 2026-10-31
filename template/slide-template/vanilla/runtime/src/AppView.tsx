import { useEffect, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import type { Bridge } from './bridge';
import { ClockProvider, useClock, type Clock } from './clock';
import type { AppState } from './appState';
import { CompositionView } from './CompositionView';
import type { Composition } from './composition';
import { useDesign } from './design/context';
import type { Colors } from './design/types';
import { readiness } from './ready';
import { sceneMeta } from './scene';

export type DesignProviderComponent = ComponentType<{ override?: Colors | null; children?: ReactNode }>;

function ReadyReporter({ composition, bridge }: { composition: Composition; bridge: Bridge }) {
  const design = useDesign();
  useEffect(() => {
    let live = true;
    readiness.ready().then(
      () => {
        if (!live) return;
        const f = composition.format;
        bridge.ready({
          scenes: composition.scenes.map(sceneMeta),
          duration: composition.duration,
          format: f ? `${f.width}x${f.height}` : '',
          design: { hash: design.hash, roles: design.colors },
        });
      },
      (e: unknown) => bridge.error(e),
    );
    return () => {
      live = false;
    };
    // Reported once per mount; the design hash rides along so the host can spot drift.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, composition]);
  return null;
}

/** Design overrides and param changes are React state; layers drawn outside React (WebGL) need a redraw. */
function RedrawOnChange({ state }: { state: AppState }) {
  const clock = useClock();
  const snap = useSyncExternalStore(state.subscribe, state.get);
  useEffect(() => {
    clock.redraw();
  }, [clock, snap]);
  return null;
}

export interface AppProps {
  composition: Composition;
  clock: Clock;
  state: AppState;
  DesignProvider: DesignProviderComponent;
  bridge: Bridge | null;
}

export function App({ composition, clock, state, DesignProvider, bridge }: AppProps) {
  const snap = useSyncExternalStore(state.subscribe, state.get);
  return (
    <ClockProvider clock={clock}>
      <DesignProvider override={snap.override}>
        <CompositionView composition={composition} params={snap.params} />
        <RedrawOnChange state={state} />
        {bridge && <ReadyReporter composition={composition} bridge={bridge} />}
      </DesignProvider>
    </ClockProvider>
  );
}

