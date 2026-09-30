/* eslint-disable react-refresh/only-export-components -- a scene module exports its scene definition */
// 시작용 Scene. 색·글꼴·간격은 DESIGN.md 토큰(CSS 변수, useDesign)에서만 가져온다.
import { defineScene, ease, clamp01, param, useParams, useTime } from '@vanilla/runtime';

const params = {
  title: param.text('Vanilla Studio', { label: 'Title' }),
};

function Hello() {
  const t = useTime();
  const { title } = useParams<typeof params>();
  const p = ease.expoOut(clamp01(t / 1.5));
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-canvas)',
        color: 'var(--color-ink)',
      }}
    >
      <h1 style={{ opacity: p, transform: `translateY(${(1 - p) * 24}px)`, fontSize: 96, margin: 0 }}>{title}</h1>
    </div>
  );
}

export default defineScene({ id: 'hello', duration: 3, params, Component: Hello });
