// HMR miss guard (T4.12, Technical-Design section 5). Vite can drop the last change when the same
// module is written ~30ms apart (S4): after changes settle for 500ms, modules the preview never
// reported `hmr` for are recovered with `reload` (the next `ready` restores host state via `init`).
import { useCallback, useEffect, useRef } from 'react';
import type { BridgeContextValue } from './bridgeContextValue';
import { usePreviewWatch, type WatchApi } from './watchClient';

/** Quiet period after the last change before comparing against `hmr` reports. */
export const HMR_QUIET_MS = 500;
/** Minimum gap between two recovery reloads so the guard can never loop. */
const RELOAD_COOLDOWN_MS = 2000;

/**
 * Source files Vite hot-updates. DESIGN.md and virtual token modules are owned by the runtime
 * plugin, and project metadata (`vanilla.json`) never reaches the preview, so the guard ignores
 * everything outside `src/` scripts and styles.
 */
const HMR_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css']);

export function isHmrRelevant(relPath: string): boolean {
  if (!relPath.startsWith('src/')) return false;
  const dot = relPath.lastIndexOf('.');
  return dot >= 0 && HMR_EXTENSIONS.has(relPath.slice(dot).toLowerCase());
}

/** Vite module id as the runtime reports it (`/src/app.tsx`) from a watcher path (`src/app.tsx`). */
export function toHmrModuleId(relPath: string): string {
  return `/${relPath.replace(/\\/g, '/').replace(/^\/+/, '')}`;
}

export interface PendingChange {
  module: string;
  at: number;
}

export interface HmrSighting {
  module: string;
  at: number;
}

/** Changed modules with no `hmr` report at or after their change time. */
export function findMissingModules(changed: PendingChange[], sightings: HmrSighting[]): string[] {
  const seen = new Map<string, number>();
  for (const s of sightings) {
    const at = seen.get(s.module);
    if (at === undefined || s.at > at) seen.set(s.module, s.at);
  }
  return changed.filter((c) => (seen.get(c.module) ?? Number.NEGATIVE_INFINITY) < c.at).map((c) => c.module);
}

export interface HmrGuardBridge {
  subscribe: BridgeContextValue['subscribe'];
  reload: BridgeContextValue['reload'];
}

/** Watch `projectDir` and reload the preview when Vite drops a change. Silent unless it fires. */
export function useHmrGuard(projectDir: string | null, bridge: HmrGuardBridge, options: { api?: WatchApi } = {}): void {
  const pending = useRef<PendingChange[]>([]);
  const sightings = useRef<HmrSighting[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReload = useRef(0);
  const bridgeRef = useRef(bridge);
  useEffect(() => {
    bridgeRef.current = bridge;
  }, [bridge]);

  // Root-relative paths belong to one project: a switch starts from scratch.
  const dirRef = useRef(projectDir);
  useEffect(() => {
    if (dirRef.current !== projectDir) {
      dirRef.current = projectDir;
      pending.current = [];
      sightings.current = [];
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    }
  }, [projectDir]);

  const check = useCallback(() => {
    timer.current = null;
    const missing = findMissingModules(pending.current, sightings.current);
    pending.current = [];
    if (missing.length === 0) return;
    const now = Date.now();
    if (now - lastReload.current < RELOAD_COOLDOWN_MS) return;
    lastReload.current = now;
    console.info(`[review] hmr miss for ${missing.join(', ')}, reloading preview`);
    bridgeRef.current.reload();
  }, []);

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(check, HMR_QUIET_MS);
  }, [check]);

  useEffect(() => {
    const unsub = bridge.subscribe((e) => {
      if (e.type !== 'hmr') return;
      for (const m of e.payload.modules) sightings.current.push({ module: m, at: e.payload.at });
      arm();
    });
    return unsub;
  }, [bridge, arm]);

  usePreviewWatch(projectDir, {
    api: options.api,
    onBatch: (paths) => {
      const at = Date.now();
      for (const p of paths) {
        if (!isHmrRelevant(p)) continue;
        const module = toHmrModuleId(p);
        pending.current = [...pending.current.filter((c) => c.module !== module), { module, at }];
      }
      arm();
    },
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
}
