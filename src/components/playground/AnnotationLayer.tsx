import { useRef } from 'react';
import type { AnnotPoint, AnnotStroke } from '@/lib/playground/annotations';

export type AnnotTool = 'pen' | 'eraser';

interface AnnotationLayerProps {
  canvas: { width: number; height: number };
  strokes: AnnotStroke[];
  /** 'off'면 그리지 않고 클릭을 아래 입력 레이어로 통과시킨다. */
  active: boolean;
  tool: AnnotTool;
  onStrokeEnd: (points: AnnotPoint[]) => void;
  onEraseAt: (at: AnnotPoint) => void;
}

function toCanvasPoint(svg: SVGSVGElement, clientX: number, clientY: number, canvas: { width: number; height: number }): AnnotPoint {
  const rect = svg.getBoundingClientRect();
  const rx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
  const ry = rect.height > 0 ? (clientY - rect.top) / rect.height : 0;
  return {
    x: Math.min(Math.max(rx, 0), 1) * canvas.width,
    y: Math.min(Math.max(ry, 0), 1) * canvas.height,
  };
}

function strokeToPath(points: AnnotPoint[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

/**
 * 슬라이드(정적 신) 위 발표용 필기 오버레이.
 * SVG 패스 방식: 캔버스 해상도 좌표로 저장해 표시 크기와 무관하게 같은 그림이 유지된다.
 * 파일에 저장하지 않는 일회성 필기다(신·시퀀스 파일 불변, 녹화 대상 아님).
 */
export function AnnotationLayer({ canvas, strokes, active, tool, onStrokeEnd, onEraseAt }: AnnotationLayerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drawing = useRef<AnnotPoint[] | null>(null);

  const at = (clientX: number, clientY: number): AnnotPoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    return toCanvasPoint(svg, clientX, clientY, canvas);
  };

  return (
    <svg
      ref={svgRef}
      data-testid="player-annotations"
      viewBox={`0 0 ${canvas.width} ${canvas.height}`}
      preserveAspectRatio="none"
      aria-hidden={!active}
      className={`absolute inset-0 z-[15] h-full w-full touch-none ${active ? (tool === 'pen' ? 'cursor-crosshair' : 'cursor-cell') : 'pointer-events-none'}`}
      style={active ? undefined : { pointerEvents: 'none' }}
      onPointerDown={(e) => {
        if (!active) return;
        const p = at(e.clientX, e.clientY);
        if (!p) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        if (tool === 'eraser') {
          onEraseAt(p);
          drawing.current = [];
          return;
        }
        drawing.current = [p];
      }}
      onPointerMove={(e) => {
        if (!active || !drawing.current) return;
        const p = at(e.clientX, e.clientY);
        if (!p) return;
        if (tool === 'eraser') {
          onEraseAt(p);
          return;
        }
        const last = drawing.current[drawing.current.length - 1];
        if (Math.hypot(p.x - last.x, p.y - last.y) < 2) return;
        drawing.current.push(p);
      }}
      onPointerUp={() => {
        if (!active || tool !== 'pen') {
          drawing.current = null;
          return;
        }
        const pts = drawing.current;
        drawing.current = null;
        if (pts && pts.length > 1) onStrokeEnd(pts);
      }}
      onPointerCancel={() => {
        drawing.current = null;
      }}
    >
      {strokes.map((s) => (
        <path
          key={s.id}
          d={strokeToPath(s.points)}
          fill="none"
          stroke={s.color}
          strokeWidth={s.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.95}
        />
      ))}
    </svg>
  );
}
