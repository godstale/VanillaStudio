// File-backed <DesignProvider>: reads the project's DESIGN.md through the Vite plugin's
// `virtual:vanilla/design` module and follows its HMR updates. Kept out of the package index because
// the virtual module only exists inside a Vite project that uses `@vanilla/runtime/vite`.
import { useEffect, useState, type ReactNode } from 'react';
import fileDesign from 'virtual:vanilla/design';
import { DesignContextProvider } from './design/provider';
import type { Colors, Design } from './design/types';

let listener: ((d: Design) => void) | null = null;
if (import.meta.hot) {
  import.meta.hot.accept('virtual:vanilla/design', (mod) => {
    if (mod) listener?.(mod.default as Design);
  });
}

export function DesignProvider({ override = null, children }: { override?: Colors | null; children?: ReactNode }) {
  const [file, setFile] = useState<Design>(fileDesign);
  useEffect(() => {
    listener = setFile;
    return () => {
      listener = null;
    };
  }, []);
  return (
    <DesignContextProvider file={file} override={override}>
      {children}
    </DesignContextProvider>
  );
}
