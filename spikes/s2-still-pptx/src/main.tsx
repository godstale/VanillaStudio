// S2 slides: web font + texture + WebGL. `window.__vanillaReady` flips only after every asset
// the slide needs is loaded and the requested time has been painted.
import '@fontsource/instrument-serif/400.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

declare global {
  interface Window {
    __vanillaReady?: boolean;
    __vanillaState?: Record<string, unknown>;
  }
}

const q = new URLSearchParams(location.search);
const slide = Number(q.get('slide') ?? 1);
const t = Number(q.get('t') ?? 2);
const FONT = '96px "Instrument Serif"';

// Fonts load lazily (only when text uses them), so document.fonts.ready alone can resolve too early.
const fontReady = document.fonts.load(FONT).then(() => document.fonts.ready);
const textureReady = new Promise<THREE.Texture>((resolve, reject) =>
  new THREE.TextureLoader().load('./texture.png', resolve, undefined, reject),
);
let resolveCanvas!: () => void;
const canvasReady = new Promise<void>((r) => (resolveCanvas = r));

function Cube({ texture }: { texture: THREE.Texture | null }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame(() => mesh.current?.rotation.set(t * 0.5, t * 0.8, 0));
  return (
    <mesh ref={mesh}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial map={texture ?? undefined} color={texture ? '#ffffff' : '#888888'} />
    </mesh>
  );
}

function Slide() {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    textureReady.then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      setTexture(tex);
    });
  }, []);
  const title = useMemo(() => ['', 'Vanilla Studio', 'Textured Scene', 'Numbers That Matter'][slide], []);
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#e9e5db', color: '#1b2566' }}>
      {slide === 2 && (
        <Canvas frameloop="demand" onCreated={() => resolveCanvas()} style={{ position: 'absolute', right: 0, width: 1000, height: 1080 }} camera={{ position: [0, 0, 5] }} gl={{ preserveDrawingBuffer: true }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 4, 2]} intensity={2.5} />
          <Cube texture={texture} />
        </Canvas>
      )}
      <div style={{ position: 'absolute', left: 120, top: 160, fontFamily: '"Instrument Serif", Georgia, serif', fontSize: 140, lineHeight: 1 }}>{title}</div>
      <div style={{ position: 'absolute', left: 124, top: 330, font: '32px Arial', opacity: 0.7 }}>slide {slide} · t = {t.toFixed(2)}s</div>
      {slide === 3 && (
        <div style={{ position: 'absolute', left: 120, top: 460, display: 'flex', gap: 40, alignItems: 'flex-end' }}>
          {[320, 480, 260, 540].map((h, i) => (
            <div key={i} style={{ width: 140, height: h * Math.min(1, t / 2), background: i === 3 ? '#e26b4a' : '#1b2566' }} />
          ))}
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Slide />);

const waits: Promise<unknown>[] = [fontReady, textureReady];
if (slide === 2) waits.push(canvasReady);
Promise.all(waits)
  .then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  .then(() => {
    window.__vanillaState = { fontLoaded: document.fonts.check(FONT), slide, t };
    window.__vanillaReady = true;
  });
