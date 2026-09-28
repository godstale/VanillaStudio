import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { DesignProvider, useDesign } from './runtime/design';
import { Scene } from './Scene';

type Msg = { v: 1; type: string; payload?: Record<string, unknown> };
const toHost = (type: string, payload: Record<string, unknown> = {}) => window.parent.postMessage({ v: 1, type, payload } satisfies Msg, location.origin);
const afterPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// Reports each file-driven design version so the host can time DESIGN.md hot updates.
function DesignReporter() {
  const d = useDesign();
  useEffect(() => {
    afterPaint().then(() => toHost('design', { at: d.at, primary: d.colors.primary }));
  }, [d.at, d.colors.primary]);
  return null;
}

export function App() {
  const [override, setOverride] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== window.parent) return;
      const m = e.data as Msg;
      if (m?.v !== 1 || m.type !== 'setDesign') return;
      flushSync(() => setOverride((m.payload?.colors as Record<string, string> | null) ?? null));
      await afterPaint();
      toHost('applied', { id: m.payload?.id });
    };
    window.addEventListener('message', onMessage);
    toHost('ready');
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return (
    <DesignProvider override={override}>
      <Scene />
      <DesignReporter />
    </DesignProvider>
  );
}
