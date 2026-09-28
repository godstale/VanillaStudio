// A scene written the way vanilla-core asks agents to: every color comes from tokens.
import { Canvas } from '@react-three/fiber';
import { useDesign } from './runtime/design';

function Knot() {
  const { colors } = useDesign();
  return (
    <mesh rotation={[0.4, 0.6, 0]}>
      <torusKnotGeometry args={[1, 0.32, 200, 24]} />
      {/* CSS variables are unreachable from WebGL, so 3D materials read JS token values. */}
      <meshStandardMaterial color={colors.primary} roughness={0.35} />
    </mesh>
  );
}

export function Scene() {
  const { colors } = useDesign();
  return (
    <div id="scene" style={{ position: 'absolute', inset: 0, background: 'var(--color-canvas)', color: 'var(--color-ink)', fontFamily: 'Georgia, serif' }}>
      <Canvas frameloop="demand" style={{ position: 'absolute', right: 0, top: 0, width: '55%', height: '100%' }} camera={{ position: [0, 0, 5] }}>
        <color attach="background" args={[colors.canvas]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 2]} intensity={2} />
        <Knot />
      </Canvas>
      <div id="card" style={{ position: 'absolute', left: 64, top: 96, width: 520, padding: 'var(--spacing-lg)', background: 'var(--color-surface)', border: '2px solid var(--color-line)', borderRadius: 'var(--rounded-md)' }}>
        <div id="title" style={{ fontSize: 72, lineHeight: 1 }}>Palette Swap</div>
        <p id="body" style={{ color: 'var(--color-ink-muted)', fontSize: 22 }}>Same layout, different palette.</p>
        <span id="badge" style={{ display: 'inline-block', padding: '6px 14px', background: 'var(--color-primary)', color: 'var(--color-on-primary)', borderRadius: 'var(--rounded-md)' }}>primary</span>
        <span id="accent" style={{ display: 'inline-block', marginLeft: 12, padding: '6px 14px', background: 'var(--color-accent)', color: 'var(--color-ink)' }}>accent</span>
      </div>
    </div>
  );
}
