import type { Plugin } from 'vite';

/** Serves the project's DESIGN.md as the virtual module `virtual:vanilla/design` (hot-updated). */
export declare function vanillaDesign(file?: string): Plugin;
