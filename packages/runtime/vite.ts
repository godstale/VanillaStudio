// @vanilla/runtime/vite: exposes the project's DESIGN.md as the virtual module `virtual:vanilla/design`
// and hot-updates it when the file changes. No generated files are written into the project, so an
// agent has nothing to edit by mistake and the export build follows the same path (Technical-Design §4.4).
//
// The parser lives in the app (`src/lib/design`, T3.5) and is bundled into this plugin by the runtime
// build (T4.9); until then it is imported by relative path inside the monorepo.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { parseDesign, type ParsedDesign } from '../../src/lib/design/parse';
import type { Design } from './src/design/types';

const ID = 'virtual:vanilla/design';
const RESOLVED = '\0' + ID;

/** Issues that make a DESIGN.md unusable; anything else (broken refs in components...) is only reported. */
const FATAL = (issue: string) => issue.startsWith('missing core roles') || issue.includes('invalid color') || issue.startsWith('no YAML front matter');

export function toRuntimeDesign(parsed: ParsedDesign): Design {
  const t = parsed.tokens;
  const body = {
    colors: parsed.colors,
    typography: t.typography as Design['typography'],
    spacing: t.spacing,
    rounded: t.rounded,
  };
  const hash = createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 12);
  return { ...body, hash };
}

export interface DesignLoad {
  /** Tokens to serve: the new ones, or the previous good ones when the file is currently unusable. */
  design: Design | null;
  /** True when `design` comes from `previous` because the file is broken. */
  stale: boolean;
  issues: string[];
}

/** Parse DESIGN.md text; keep the last good tokens if the agent left the file mid-edit or broken. */
export function loadDesign(text: string, previous: Design | null): DesignLoad {
  let parsed: ParsedDesign;
  try {
    parsed = parseDesign(text);
  } catch (e) {
    return { design: previous, stale: previous !== null, issues: [`unreadable: ${(e as Error).message}`] };
  }
  if (parsed.issues.some(FATAL)) return { design: previous, stale: previous !== null, issues: parsed.issues };
  return { design: toRuntimeDesign(parsed), stale: false, issues: parsed.issues };
}

export function vanillaDesign(file = 'DESIGN.md'): Plugin {
  let designPath = '';
  let isBuild = false;
  let last: Design | null = null;
  return {
    name: 'vanilla-design',
    configResolved(config) {
      designPath = path.resolve(config.root, file);
      isBuild = config.command === 'build';
    },
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return;
      this.addWatchFile(designPath);
      let text = '';
      let readError: string | null = null;
      try {
        text = readFileSync(designPath, 'utf8');
      } catch (e) {
        readError = (e as Error).message;
      }
      const result = readError ? { design: last, stale: last !== null, issues: [readError] } : loadDesign(text, last);
      if (result.design) last = result.design;
      if (result.stale || !result.design) {
        const message = `DESIGN.md: ${result.issues.join('; ')}`;
        // A build must not silently ship tokenless output; the live preview keeps going with the last good tokens.
        if (isBuild && !result.design) this.error(message);
        this.warn(message);
      }
      const design: Design = result.design ?? { colors: {}, typography: {}, spacing: {}, rounded: {}, hash: 'none' };
      return `export default ${JSON.stringify(design)};`;
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
