// How <VanillaCanvas> configures R3F per clock mode (S1, Technical-Design §4.1).
import type { ClockMode } from './clock';

export type FrameLoop = 'always' | 'demand' | 'never';

export interface CanvasSettingsInput {
  mode: ClockMode;
  frameloop?: FrameLoop;
  preserveDrawingBuffer?: boolean;
  dpr?: number | [min: number, max: number];
}

export interface CanvasSettings {
  frameloop: FrameLoop;
  preserveDrawingBuffer: boolean;
  dpr: number | [min: number, max: number] | undefined;
  /** How the WebGL layer follows the clock: draw synchronously, ask for a redraw, or free-run. */
  drive: 'advance' | 'invalidate' | 'none';
}

export function canvasSettings({ mode, frameloop, preserveDrawingBuffer, dpr }: CanvasSettingsInput): CanvasSettings {
  switch (mode) {
    case 'render':
      // Frames are pulled one at a time; the drawing buffer must survive until the screenshot, and a
      // fixed dpr keeps pixels identical between workers.
      return { frameloop: 'never', preserveDrawingBuffer: preserveDrawingBuffer ?? true, dpr: dpr ?? 1, drive: 'advance' };
    case 'preview':
      return { frameloop: 'demand', preserveDrawingBuffer: preserveDrawingBuffer ?? false, dpr, drive: 'invalidate' };
    case 'live':
      // Free-mode scenes (web / interactive) may run their own loop.
      return { frameloop: frameloop ?? 'always', preserveDrawingBuffer: preserveDrawingBuffer ?? false, dpr, drive: 'none' };
  }
}
