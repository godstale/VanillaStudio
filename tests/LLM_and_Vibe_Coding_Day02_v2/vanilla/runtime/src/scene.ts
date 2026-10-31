// defineScene(): declare a scene and register it so the runtime can list and mount it.
import type { ComponentType } from 'react';
import type { ParamSchema } from './params';

export interface SceneDefinition<P extends ParamSchema = ParamSchema> {
  id: string;
  /** Seconds; omitted for slides/image scenes. */
  duration?: number;
  params: P;
  Component: ComponentType;
}

/** Serializable description sent to the host in the Bridge `ready` message. */
export interface SceneMeta {
  id: string;
  duration?: number;
  params: ParamSchema;
}

const ID_RE = /^[a-z0-9][a-z0-9_-]*$/i;
const registry = new Map<string, SceneDefinition>();

export function defineScene<P extends ParamSchema = Record<never, never>>(def: {
  id: string;
  duration?: number;
  params?: P;
  Component: ComponentType;
}): SceneDefinition<P> {
  if (!ID_RE.test(def.id)) throw new Error(`defineScene: invalid id "${def.id}" (letters, digits, "-" and "_")`);
  if (def.duration !== undefined && !(Number.isFinite(def.duration) && def.duration > 0)) {
    throw new Error(`defineScene(${def.id}): duration must be a positive number of seconds`);
  }
  const scene: SceneDefinition<P> = { id: def.id, duration: def.duration, params: def.params ?? ({} as P), Component: def.Component };
  // Re-registering the same id is expected on HMR; the latest module wins.
  registry.set(scene.id, scene as unknown as SceneDefinition);
  return scene;
}

export const getScene = (id: string): SceneDefinition | undefined => registry.get(id);
export const getScenes = (): SceneDefinition[] => [...registry.values()];
export const clearScenes = (): void => registry.clear();

export const sceneMeta = (s: SceneDefinition): SceneMeta => ({ id: s.id, duration: s.duration, params: s.params });
