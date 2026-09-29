export const PACKAGE_NAME = '@vanilla/runtime';

export { defineScene, getScene, getScenes, sceneMeta } from './scene';
export type { SceneDefinition, SceneMeta } from './scene';
export { param, token, useParams, resolveParams, ParamsProvider } from './params';
export type { ParamDef, ParamSchema, ParamValues, TokenRef } from './params';
export {
  ClockProvider,
  SceneTimeProvider,
  activeAt,
  createClock,
  installHfSeek,
  layoutSegments,
  parseClockMode,
  parseInitialTime,
  sceneAt,
  toGlobalTime,
  toLocalTime,
  totalDuration,
  transitionAt,
  useClock,
  useGlobalTime,
  usePlaying,
  useTime,
} from './clock';
export type { ActiveSegment, Clock, ClockMode, ClockOptions, Renderer, Segment } from './clock';
export * from './helpers';
export { VanillaCanvas } from './canvas';
export type { VanillaCanvasProps } from './canvas';
export { canvasSettings } from './canvasSettings';
export type { CanvasSettings, FrameLoop } from './canvasSettings';
export { applyAndSettle, createReadiness, fontSpecs, readiness, ReadinessProvider, registerAsset, useReadiness } from './ready';
export type { Readiness, ReadinessOptions } from './ready';
export { DesignContextProvider } from './design/provider';
export { useDesign } from './design/context';
export type { DesignProviderProps } from './design/provider';
export { applyCssVars, cssVars } from './design/cssVars';
export { EMPTY_DESIGN } from './design/types';
export type { Colors, Design, TypographyStyle } from './design/types';
