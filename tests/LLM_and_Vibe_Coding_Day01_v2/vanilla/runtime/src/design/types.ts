// Design payload shared by the Vite plugin (build side) and the runtime (browser side).
export type Colors = Record<string, string>;
export type TypographyStyle = Record<string, string | number>;

export interface Design {
  /** Reference-resolved colors with derived roles filled in (canvas, ink, primary, accent, ...). */
  colors: Colors;
  typography: Record<string, TypographyStyle>;
  spacing: Record<string, string | number>;
  rounded: Record<string, string>;
  /** Short content hash; the Bridge `ready` message reports it so the host can detect drift. */
  hash: string;
}

export const EMPTY_DESIGN: Design = Object.freeze({
  colors: Object.freeze({}) as Colors,
  typography: Object.freeze({}),
  spacing: Object.freeze({}),
  rounded: Object.freeze({}),
  hash: 'none',
}) as Design;
