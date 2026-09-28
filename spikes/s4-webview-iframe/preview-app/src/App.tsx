import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Canvas } from '@react-three/fiber';
import type * as THREE from 'three';
import { afterPaint, onHostMessage, toHost } from './bridge';
import { LABEL } from './label';

type Params = { color: string; speed: number };

function Knot({ t, params }: { t: number; params: Params }) {
  const mesh = useRef<THREE.Mesh>(null);
  return (
    <mesh ref={mesh} rotation={[t * 0.6 * params.speed, t * 0.9 * params.speed, 0]}>
      <torusKnotGeometry args={[1, 0.32, 200, 24]} />
      <meshStandardMaterial color={params.color} metalness={0.3} roughness={0.3} />
    </mesh>
  );
}

export function App() {
  const [params, setParams] = useState<Params>({ color: '#f2c230', speed: 1 });
  const [t, setT] = useState(0);
  const state = useRef({ params, t });
  state.current = { params, t };

  useEffect(() => {
    return onHostMessage(async (m) => {
      const p = m.payload ?? {};
      switch (m.type) {
        case 'init':
        case 'setParams': {
          const values = (p.values ?? p.paramsValues ?? {}) as Partial<Params>;
          flushSync(() => setParams((prev) => ({ ...prev, ...values })));
          await afterPaint();
          if (p.id) toHost('applied', { id: p.id });
          break;
        }
        case 'seek':
          flushSync(() => setT(Number(p.t)));
          await afterPaint();
          toHost('applied', { id: p.id });
          break;
        case 'getState':
          toHost('state', { id: p.id, ...state.current, label: LABEL });
          break;
        case 'isolationCheck': {
          const w = window as unknown as Record<string, unknown>;
          const tryParent = (f: () => unknown) => {
            try {
              return { ok: true, value: String(f()) };
            } catch (e) {
              return { ok: false, error: (e as Error).name };
            }
          };
          // WebView2 injects Tauri's init script into every frame; what matters is whether IPC is honoured.
          type Internals = { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> };
          const internals = w.__TAURI_INTERNALS__ as Internals | undefined;
          const tryInvoke = async (cmd: string, args?: Record<string, unknown>) => {
            if (!internals?.invoke) return 'no invoke';
            try {
              return `ALLOWED: ${JSON.stringify(await internals.invoke(cmd, args))}`;
            } catch (e) {
              return `rejected: ${String(e)}`;
            }
          };
          toHost('isolation', {
            invokeAppCommand: await tryInvoke('touch_preview', { label: 'written-from-iframe' }),
            invokePluginCommand: await tryInvoke('plugin:app|version'),
            origin: location.origin,
            ownTauriInternals: typeof w.__TAURI_INTERNALS__,
            ownTauri: typeof w.__TAURI__,
            ownIpc: typeof w.ipc,
            parentDocument: tryParent(() => window.parent.document.title),
            parentTauriInternals: tryParent(() => typeof (window.parent as unknown as Record<string, unknown>).__TAURI_INTERNALS__),
            fetchIpcLocalhost: await fetch('http://ipc.localhost/plugin%3Aapp%7Cversion', { method: 'POST' })
              .then((r) => `status ${r.status}`)
              .catch((e: Error) => `blocked: ${e.name}`),
          });
          break;
        }
      }
    });
  }, []);

  useEffect(() => {
    toHost('ready', { scenes: [{ id: 's1' }], duration: 15, format: { width: 1920, height: 1080 } });
  }, []);

  // Fires on first mount and whenever Fast Refresh swaps in a new label module.
  useEffect(() => {
    toHost('label', { id: LABEL });
  }, [LABEL]);

  return (
    <>
      <Canvas frameloop="demand" camera={{ position: [0, 0, 5] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 2]} intensity={2} />
        <Knot t={t} params={params} />
      </Canvas>
      <div style={{ position: 'absolute', left: 16, top: 12, color: '#eee', font: '14px Consolas' }}>
        {LABEL} · t={t.toFixed(2)} · {params.color}
      </div>
    </>
  );
}

