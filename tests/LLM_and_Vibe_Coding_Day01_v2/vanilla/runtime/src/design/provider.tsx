// useDesign() + CSS variables. `override` is the Bridge `setDesign` palette: preview-only, never
// written to DESIGN.md, and dropped by passing null.
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { fontSpecs, useReadiness } from '../ready';
import { applyCssVars, cssVars } from './cssVars';
import { DesignContext } from './context';
import type { Colors, Design } from './types';

export interface DesignProviderProps {
  /** Tokens parsed from the project's DESIGN.md. */
  file: Design;
  override?: Colors | null;
  /** Element that receives the CSS variables (default: `<html>`). */
  target?: HTMLElement;
  children?: ReactNode;
}

export function DesignContextProvider({ file, override = null, target, children }: DesignProviderProps) {
  const readiness = useReadiness();
  const design = useMemo<Design>(() => (override ? { ...file, colors: { ...file.colors, ...override } } : file), [file, override]);

  const applied = useRef<Record<string, string>>({});
  useLayoutEffect(() => {
    const el = target ?? document.documentElement;
    const next = cssVars(design);
    applyCssVars(el.style, next, applied.current);
    applied.current = next;
  }, [design, target]);
  useLayoutEffect(
    () => () => {
      // Leave no variables behind when the provider goes away.
      applyCssVars((target ?? document.documentElement).style, {}, applied.current);
      applied.current = {};
    },
    [target],
  );

  // Web fonts named in typography must be loaded before a frame counts as ready.
  const specs = useMemo(() => fontSpecs(file.typography), [file.typography]);
  useLayoutEffect(() => {
    readiness.loadFonts(specs);
  }, [readiness, specs]);

  return <DesignContext.Provider value={design}>{children}</DesignContext.Provider>;
}
