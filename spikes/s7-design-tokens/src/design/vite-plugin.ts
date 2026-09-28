// @vanilla/runtime/vite stand-in: exposes the project's DESIGN.md as `virtual:vanilla/design`
// and hot-updates it when the file changes. No generated files are written into the project.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { parseDesign } from './parse';

const ID = 'virtual:vanilla/design';
const RESOLVED = '\0' + ID;

export function vanillaDesign(file = 'DESIGN.md'): Plugin {
  let designPath = '';
  let last = { tokens: {}, colors: {}, issues: ['not loaded'] } as unknown;
  return {
    name: 'vanilla-design',
    configResolved(c) {
      designPath = path.resolve(c.root, file);
    },
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return;
      this.addWatchFile(designPath);
      try {
        const parsed = parseDesign(readFileSync(designPath, 'utf8'));
        // Keep the last good tokens if the agent leaves the file mid-edit or broken.
        if (!parsed.issues.some((i) => i.startsWith('missing core roles') || i.includes('invalid color'))) last = parsed;
        else this.warn(`DESIGN.md: ${parsed.issues.join('; ')}`);
      } catch (e) {
        this.warn(`DESIGN.md unreadable: ${(e as Error).message}`);
      }
      return `export default ${JSON.stringify({ ...(last as object), at: Date.now() })};`;
    },
    handleHotUpdate({ file: changed, server }) {
      if (path.resolve(changed) !== designPath) return;
      const mod = server.moduleGraph.getModuleById(RESOLVED);
      if (!mod) return;
      server.moduleGraph.invalidateModule(mod);
      return [mod];
    },
  };
}
