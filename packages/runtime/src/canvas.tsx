// <VanillaCanvas>: R3F <Canvas> that follows the Vanilla clock.
//   render  -> frameloop="never"; every seek draws synchronously with advance(t)
//   preview -> frameloop="demand"; every seek/design change invalidates
//   live    -> free-mode scenes; frameloop defaults to "always"
import { useEffect, useMemo, useRef, type ComponentProps } from 'react';
import { Canvas, advance, invalidate } from '@react-three/fiber';
import { canvasSettings, type FrameLoop } from './canvasSettings';
import { useClock } from './clock';
import { useReadiness } from './ready';

type CanvasProps = ComponentProps<typeof Canvas>;

export interface VanillaCanvasProps extends Omit<CanvasProps, 'frameloop' | 'gl' | 'dpr'> {
  /** Only honoured in live (free-mode) scenes; clock-contract scenes are always demand/never. */
  frameloop?: FrameLoop;
  /** Extra WebGL context attributes / renderer parameters. */
  gl?: Record<string, unknown>;
  /** Defaults to true in render mode (screenshots), false otherwise. */
  preserveDrawingBuffer?: boolean;
  dpr?: number | [min: number, max: number];
}

export function VanillaCanvas({ frameloop, gl, preserveDrawingBuffer, dpr, onCreated, ...rest }: VanillaCanvasProps) {
  const clock = useClock();
  const readiness = useReadiness();
  const settings = useMemo(
    () => canvasSettings({ mode: clock.mode, frameloop, preserveDrawingBuffer, dpr }),
    [clock.mode, frameloop, preserveDrawingBuffer, dpr],
  );

  const { drive } = settings;
  const draw = useRef<(t: number) => void>(() => {});
  useEffect(() => {
    if (drive === 'none') return;
    draw.current = drive === 'advance' ? (t) => advance(t * 1000) : () => invalidate();
    return clock.registerRenderer((t) => draw.current(t));
  }, [clock, drive]);

  // Counts as pending until R3F has created its renderer (asynchronous: it measures the canvas first).
  const created = useRef<() => void>(() => {});
  useEffect(() => {
    const done = readiness.registerCanvas();
    created.current = done;
    // An unmounted canvas must never block a capture.
    return done;
  }, [readiness]);

  return (
    <Canvas
      {...rest}
      frameloop={settings.frameloop}
      dpr={settings.dpr}
      gl={{ antialias: true, ...gl, preserveDrawingBuffer: settings.preserveDrawingBuffer } as CanvasProps['gl']}
      onCreated={(state) => {
        // The renderer appears asynchronously (after the canvas is measured): paint the current time once.
        if (drive !== 'none') draw.current(clock.getTime());
        created.current();
        onCreated?.(state);
      }}
    />
  );
}
