export interface AnnotPoint {
  x: number;
  y: number;
}

export interface AnnotStroke {
  id: number;
  color: string;
  width: number;
  points: AnnotPoint[];
}

/** 고정 펜 스타일(발표용 필기: 슬라이드 위에서 잘 보이는 빨강). 색상 선택은 범위 밖. */
export const PEN_COLOR = '#ff3b30';
export const PEN_WIDTH = 6;
export const ERASER_RADIUS = 32;

export function strokeToPath(stroke: Pick<AnnotStroke, 'points'>): string {
  return stroke.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}

function distPointToSegment(p: AnnotPoint, a: AnnotPoint, b: AnnotPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function strokeHit(stroke: AnnotStroke, at: AnnotPoint, radius: number): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) return Math.hypot(pts[0].x - at.x, pts[0].y - at.y) <= radius + stroke.width / 2;
  for (let i = 1; i < pts.length; i += 1) {
    if (distPointToSegment(at, pts[i - 1], pts[i]) <= radius + stroke.width / 2) return true;
  }
  return false;
}

/** 지우개가 닿은 스트로크를 제거한다(순수 함수, 테스트용). */
export function eraseStrokes(strokes: AnnotStroke[], at: AnnotPoint, radius: number): AnnotStroke[] {
  return strokes.filter((s) => !strokeHit(s, at, radius));
}
