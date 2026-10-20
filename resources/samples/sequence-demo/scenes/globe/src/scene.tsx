import { defineScene, useTime, useDesign, VanillaCanvas } from '@vanilla/runtime';

// 3D 신: 회전은 useTime()의 순수 함수다(결정성). 색은 DESIGN.md 토큰(useDesign)에서 가져온다.
function Knot() {
  const t = useTime();
  const design = useDesign();
  return (
    <mesh rotation={[t * 0.6, t * 1.1, 0]}>
      <torusKnotGeometry args={[1, 0.34, 128, 16]} />
      <meshStandardMaterial color={design.colors.primary} metalness={0.3} roughness={0.4} />
    </mesh>
  );
}

function Globe() {
  const design = useDesign();
  return (
    <div data-testid="globe" style={{ width: '100%', height: '100%', background: design.colors.canvas }}>
      <VanillaCanvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 4, 5]} intensity={1.4} />
        <Knot />
      </VanillaCanvas>
    </div>
  );
}

export default defineScene({ id: 'globe', duration: 3, Component: Globe });
