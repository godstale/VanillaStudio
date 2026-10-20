// beats 편집 도우미(순수 함수).

export interface Beat {
  id: string;
  start: number;
  end: number;
  role: string;
  copy: string;
  visual: string;
  motion: string[];
  camera: string;
  transitionOut: string;
  notes: string;
}

export const round = (n: number) => Math.round(n * 1000) / 1000;

function nextId(beats: Beat[]): string {
  const used = new Set(beats.map((b) => b.id));
  for (let n = beats.length + 1; ; n++) if (!used.has(`b${n}`)) return `b${n}`;
}

/** 빈 beat: 마지막 beat 끝에서 시작해 최대 2초(길이를 넘지 않게). 길이가 이미 찼으면 마지막 2초를 쪼갠다. */
export function newBeat(beats: Beat[], duration: number): Beat {
  const start = beats.length ? beats[beats.length - 1].end : 0;
  const end = round(Math.min(start + 2, duration));
  return { id: nextId(beats), start: round(start), end: end > start ? end : round(start + 0.5), role: '', copy: '', visual: '', motion: [], camera: '', transitionOut: '', notes: '' };
}

/** 길이를 beat 수로 균등 분할(마지막 end는 길이와 정확히 같다). */
export function distribute(beats: Beat[], duration: number): Beat[] {
  const n = beats.length;
  return beats.map((b, i) => ({ ...b, start: round((duration / n) * i), end: i === n - 1 ? round(duration) : round((duration / n) * (i + 1)) }));
}

