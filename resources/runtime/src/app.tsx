// `@vanilla/runtime/app`: what the app-owned `src/main.tsx` calls. Binds the project's DESIGN.md
// (virtual module, via DesignProvider) and `params/*.values.json` to the runtime bootstrap.
import { DesignProvider } from './designFile';
import { mountVanilla as mount } from './mount';
import type { Composition, ParamsBySceneId } from './composition';

// `/params/...` is relative to the project root, where the user's values live.
const files = import.meta.glob<Record<string, unknown>>('/params/*.values.json', { eager: true, import: 'default' });

const paramsFiles: ParamsBySceneId = Object.fromEntries(
  Object.entries(files).map(([path, values]) => [/([^/]+)\.values\.json$/.exec(path)?.[1] ?? path, values]),
);

export const mountVanilla = (composition: Composition): (() => void) =>
  mount(composition, { DesignProvider, paramsFiles, hmr: import.meta.hot });
