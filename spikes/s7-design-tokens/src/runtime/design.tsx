// Runtime side: DESIGN.md tokens → CSS custom properties + useDesign(), with a Bridge override
// (setDesign) for instant palette previews that never touch the file.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import fileDesign from 'virtual:vanilla/design';

type Colors = Record<string, string>;
export interface Design {
  colors: Colors;
  tokens: { spacing?: Record<string, string | number>; rounded?: Record<string, string> };
  at: number;
}

const DesignContext = createContext<Design>(fileDesign as Design);

// Same naming as `design.md export --format css-vars`.
function applyCssVars(d: Design) {
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(d.colors)) s.setProperty(`--color-${k}`, v);
  for (const [k, v] of Object.entries(d.tokens.spacing ?? {})) s.setProperty(`--spacing-${k}`, String(v));
  for (const [k, v] of Object.entries(d.tokens.rounded ?? {})) s.setProperty(`--rounded-${k}`, v);
}

let fileListener: ((d: Design) => void) | null = null;
if (import.meta.hot) {
  import.meta.hot.accept('virtual:vanilla/design', (mod) => {
    if (mod) fileListener?.(mod.default as Design);
  });
}

export function DesignProvider({ override, children }: { override: Colors | null; children: ReactNode }) {
  const [file, setFile] = useState<Design>(fileDesign as Design);
  useEffect(() => {
    fileListener = setFile;
    return () => {
      fileListener = null;
    };
  }, []);
  const design = useMemo<Design>(() => (override ? { ...file, colors: { ...file.colors, ...override } } : file), [file, override]);
  // Layout effect timing is not needed: the host waits for two frames before measuring.
  useEffect(() => applyCssVars(design), [design]);
  return <DesignContext.Provider value={design}>{children}</DesignContext.Provider>;
}

export const useDesign = () => useContext(DesignContext);
