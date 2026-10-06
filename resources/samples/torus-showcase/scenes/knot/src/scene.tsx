import { defineScene, useDesign, useTime, VanillaCanvas } from '@vanilla/runtime';

// 3D 신: 회전은 useTime()의 순수 함수다(같은 t → 같은 프레임). 색은 DESIGN.md 토큰(useDesign)에서 가져온다.
function Knot() {
  const t = useTime();
  const design = useDesign();
  return (
    <mesh rotation={[t * 0.5, t * 0.9, 0]}>
      <torusKnotGeometry args={[1, 0.32, 160, 20]} />
      <meshStandardMaterial color={design.colors.primary} metalness={0.4} roughness={0.35} />
    </mesh>
  );
}

function Showcase() {
  const design = useDesign();
  return (
    <div data-testid="showcase" style={{ width: '100%', height: '100%', background: design.colors.canvas }}>
      <VanillaCanvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 5]} intensity={1.5} />
        <Knot />
      </VanillaCanvas>
    </div>
  );
}

export default defineScene({ id: 'knot', duration: 6, Component: Showcase });
