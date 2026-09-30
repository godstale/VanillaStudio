// Preview sizing: the frame keeps its native size (so the scene lays out exactly as it will render) and is
// scaled with a CSS transform to fit the pane, or to a fixed zoom.

export type PreviewZoom = 'fit' | number;
export type PreviewBackground = 'checker' | 'canvas' | 'light' | 'dark';

export interface DevicePreset {
  id: 'desktop' | 'tablet' | 'mobile';
  /** Frame width in CSS px; `null` uses the project format width. */
  width: number | null;
}

export const DEVICE_PRESETS: readonly DevicePreset[] = [
  { id: 'desktop', width: null },
  { id: 'tablet', width: 768 },
  { id: 'mobile', width: 390 },
];

export const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2] as const;

export interface PreviewLayoutInput {
  container: { width: number; height: number };
  format: { width: number; height: number };
  zoom: PreviewZoom;
  /** Fixed frame width for the device preview (web output). The height then follows the pane. */
  deviceWidth: number | null;
  padding?: number;
}

export interface PreviewLayout {
  /** Native iframe size in CSS px. */
  frame: { width: number; height: number };
  scale: number;
  /** Size the scaled frame occupies. */
  box: { width: number; height: number };
}

const MIN_SCALE = 0.05;

export function computePreviewLayout({ container, format, zoom, deviceWidth, padding = 16 }: PreviewLayoutInput): PreviewLayout {
  const availW = Math.max(1, container.width - padding * 2);
  const availH = Math.max(1, container.height - padding * 2);
  const frame = { width: deviceWidth ?? format.width, height: deviceWidth === null ? format.height : Math.max(1, Math.round(availH)) };
  const fit = Math.min(availW / frame.width, availH / frame.height);
  const scale = Math.max(MIN_SCALE, zoom === 'fit' ? fit : zoom);
  return { frame, scale, box: { width: Math.round(frame.width * scale), height: Math.round(frame.height * scale) } };
}

export function nextZoom(current: number, dir: 1 | -1): number {
  const steps = ZOOM_STEPS as readonly number[];
  if (dir === 1) return steps.find((s) => s > current + 1e-6) ?? steps[steps.length - 1];
  return [...steps].reverse().find((s) => s < current - 1e-6) ?? steps[0];
}
