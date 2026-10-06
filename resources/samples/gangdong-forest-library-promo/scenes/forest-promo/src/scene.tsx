import { useEffect, useRef } from 'react';
import { defineScene, useTime } from '@vanilla/runtime';
import { drawFrame } from './draw';

// 모션 신: 캔버스 그림은 useTime()의 순수 함수다(같은 t → 같은 프레임). 그리기 코드는 draw.ts에 있다.
function Forest() {
  const t = useTime();
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawFrame(ref.current, t);
  }, [t]);
  return <canvas ref={ref} id="forest" width={1920} height={1080} aria-label="강동 숲속 도서관 강좌 홍보 모션 그래픽" style={{ width: '100%', height: '100%', display: 'block' }} />;
}

export default defineScene({ id: 'forest-promo', duration: 10, Component: Forest });
