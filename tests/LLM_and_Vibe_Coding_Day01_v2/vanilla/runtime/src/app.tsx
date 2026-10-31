// `@vanilla/runtime/app`: what the app-owned `src/main.tsx` calls. Binds the project's DESIGN.md
// (virtual module, via DesignProvider) and `params/*.values.json` to the runtime bootstrap.
import { DesignProvider } from './designFile';
import { mountVanilla as mount } from './mount';
import type { Composition, ParamsBySceneId } from './composition';
import { paramsForPath } from './paramsFiles';

// Values live next to their scene (`/scenes/<slug>/params/`); a root `/params/` is still read for v1 projects. Paths are relative to the project root.
const files = import.meta.glob<Record<string, unknown>>(['/params/*.values.json', '/scenes/*/params/*.values.json'], { eager: true, import: 'default' });

const paramsFiles: ParamsBySceneId = paramsForPath(files, window.location.pathname);

export const mountVanilla = (composition: Composition): (() => void) =>
  mount(composition, { DesignProvider, paramsFiles, hmr: import.meta.hot });
