export type StyleScope = 'scene' | 'image' | 'motion';
export const STYLE_SCOPES: readonly StyleScope[];
export interface SceneStyleRef {
  id: string;
  scope: StyleScope;
}
export interface StyleEntry {
  id: string;
  sourceTag: string;
  group: string;
  family: string;
  label: { ko: string; en: string };
  description: { ko: string; en: string };
  keywords: string[];
  example: string;
  ipSensitive?: boolean;
}
export interface StyleFamily {
  sceneTypes: string[];
  technique: string;
}
export interface StyleLibraryData {
  styles: StyleEntry[];
  families: Record<string, StyleFamily>;
}
export function renderStylesSection(styles: readonly SceneStyleRef[] | undefined, library: StyleLibraryData | null): string;
export function renderStylesGuide(styles: readonly SceneStyleRef[]): string;
export function matchesStyle(style: StyleEntry, query: string): boolean;
