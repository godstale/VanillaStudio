// Renders a Composition at the clock's current time (see composition.ts for the layouts).
import { createElement, type CSSProperties } from 'react';
import { activeAt, SceneTimeProvider, transitionAt, useGlobalTime } from './clock';
import type { Composition, ParamsBySceneId } from './composition';
import { useDesign } from './design/context';
import { ParamsProvider, resolveParams } from './params';
import type { SceneDefinition } from './scene';

function SceneLayer({ scene, start, user }: { scene: SceneDefinition; start: number; user: ParamsBySceneId }) {
  const { colors } = useDesign();
  const values = resolveParams(scene.params, { tokens: colors, user: user[scene.id] });
  return createElement(
    SceneTimeProvider,
    { start },
    createElement(ParamsProvider, { values }, createElement(scene.Component)),
  );
}

const fill: CSSProperties = { position: 'absolute', inset: 0 };

export function CompositionView({ composition, params = {} }: { composition: Composition; params?: ParamsBySceneId }) {
  const t = useGlobalTime();
  if (composition.layout === 'sections') {
    return (
      <div>
        {composition.scenes.map((scene) => (
          <section key={scene.id} data-scene={scene.id}>
            <SceneLayer scene={scene} start={0} user={params} />
          </section>
        ))}
      </div>
    );
  }
  const byId = new Map(composition.scenes.map((s) => [s.id, s]));
  const transition = transitionAt(composition.segments, t);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {activeAt(composition.segments, t).map(({ segment }) => {
        const scene = byId.get(segment.id);
        if (!scene) return null;
        const progress = transition?.to.segment.id === segment.id ? transition.progress : 1;
        return (
          <div key={segment.id} data-scene={segment.id} style={{ ...fill, opacity: progress }}>
            <SceneLayer scene={scene} start={segment.start} user={params} />
          </div>
        );
      })}
    </div>
  );
}
