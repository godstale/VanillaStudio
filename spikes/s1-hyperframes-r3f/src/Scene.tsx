import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTime, markSceneReady, useTime } from './clock';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const expoOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

// Seeded PRNG (mulberry32): same seed → same particle field every render.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function Knot() {
  const mesh = useRef<THREE.Mesh>(null);
  // Reads injected time, not the frame delta → deterministic.
  useFrame(() => {
    const t = getTime();
    if (!mesh.current) return;
    mesh.current.rotation.set(t * 0.6, t * 0.9, 0);
    const s = 0.4 + 0.6 * expoOut(clamp01(t / 2));
    mesh.current.scale.setScalar(s);
  });
  return (
    <mesh ref={mesh}>
      <torusKnotGeometry args={[1, 0.32, 256, 32]} />
      <meshStandardMaterial color="#f2c230" metalness={0.3} roughness={0.25} />
    </mesh>
  );
}

function Particles() {
  const points = useRef<THREE.Points>(null);
  const base = useMemo(() => {
    const rand = mulberry32(42);
    const arr = new Float32Array(3000 * 3);
    for (let i = 0; i < arr.length; i++) arr[i] = (rand() - 0.5) * 12;
    return arr;
  }, []);
  const positions = useMemo(() => base.slice(), [base]);
  useFrame(() => {
    const t = getTime();
    const p = points.current;
    if (!p) return;
    for (let i = 0; i < positions.length; i += 3) {
      const phase = base[i] * 0.3;
      positions[i + 1] = base[i + 1] + Math.sin(t * 1.5 + phase) * 0.4;
    }
    p.geometry.attributes.position.needsUpdate = true;
    p.rotation.y = t * 0.1;
  });
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#9fb4ff" size={0.03} sizeAttenuation />
    </points>
  );
}

function CameraRig() {
  useFrame(({ camera }) => {
    const t = getTime();
    camera.position.set(Math.sin(t * 0.2) * 6, 1.5, Math.cos(t * 0.2) * 6);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

function Overlay() {
  const t = useTime();
  const enter = expoOut(clamp01((t - 0.5) / 1.5));
  return (
    <div style={{ position: 'absolute', left: 120, bottom: 120, color: '#f4eedf', fontFamily: 'Georgia, serif' }}>
      <div style={{ fontSize: 96, transform: `translateY(${(1 - enter) * 60}px)`, opacity: enter }}>
        Vanilla Studio
      </div>
      <div style={{ fontSize: 32, fontFamily: 'Consolas, monospace', opacity: 0.7 }}>
        t = {t.toFixed(3)}s · frame {Math.round(t * 30)}
      </div>
    </div>
  );
}

export function Scene() {
  return (
    <>
      <Canvas
        frameloop="never"
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        dpr={1}
        style={{ position: 'absolute', inset: 0 }}
        camera={{ fov: 45, position: [0, 1.5, 6] }}
        onCreated={markSceneReady}
      >
        <color attach="background" args={['#0b0d12']} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[4, 6, 3]} intensity={2} />
        <CameraRig />
        <Knot />
        <Particles />
      </Canvas>
      <Overlay />
    </>
  );
}
