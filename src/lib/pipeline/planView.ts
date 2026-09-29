import type { Plan, PlanParam } from './schemas/plan';

export interface TimelineRow {
  id: string;
  label: string;
  kind: 'scene' | 'animation';
  start: number;
  end: number;
  /** 0~100 (%) */
  left: number;
  width: number;
}

export interface Timeline {
  duration: number;
  rows: TimelineRow[];
}

const pct = (v: number, total: number) => Math.round((v / total) * 10000) / 100;

/**
 * 타임라인 막대 데이터. 장면(start/end가 있는 것)과 애니메이션을 시간순으로 배치한다.
 * 시간 정보가 없는 계획(slides·image·web)은 null.
 */
export function buildTimeline(plan: Plan): Timeline | null {
  const scenes = plan.scenes.filter((s) => s.start !== undefined && s.end !== undefined);
  if (scenes.length === 0 && plan.animations.length === 0) return null;
  const ends = [
    ...scenes.map((s) => s.end as number),
    ...plan.animations.map((a) => a.end),
  ];
  const duration = plan.format.durationSec ?? Math.max(...ends);
  if (!(duration > 0)) return null;

  const row = (
    id: string,
    label: string,
    kind: TimelineRow['kind'],
    start: number,
    end: number,
  ): TimelineRow => {
    const s = Math.min(Math.max(start, 0), duration);
    const e = Math.min(Math.max(end, s), duration);
    return { id, label, kind, start, end, left: pct(s, duration), width: pct(e - s, duration) };
  };

  const rows = [
    ...scenes.map((s) => row(s.id, s.title, 'scene', s.start as number, s.end as number)),
    ...plan.animations.map((a) => row(a.id, a.id, 'animation', a.start, a.end)),
  ];
  return { duration, rows };
}

export function formatParamDefault(p: PlanParam): string {
  switch (p.type) {
    case 'vec2':
    case 'vec3':
      return `(${p.default.join(', ')})`;
    case 'boolean':
      return p.default ? 'true' : 'false';
    default:
      return String(p.default);
  }
}

/** 조절 범위 표시: number는 min–max(step), select는 옵션 목록. 그 외는 빈 문자열. */
export function formatParamRange(p: PlanParam): string {
  if (p.type === 'number') {
    return `${p.min} – ${p.max}${p.step !== undefined ? ` (step ${p.step})` : ''}`;
  }
  if (p.type === 'select') return p.options.join(' / ');
  return '';
}

export function formatSeconds(v: number): string {
  return `${Math.round(v * 100) / 100}s`;
}
