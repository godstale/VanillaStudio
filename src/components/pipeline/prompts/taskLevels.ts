import type { Task } from '@/lib/pipeline/schemas/tasks';

/** 실행 순서(위상 정렬)에서 태스크의 깊이를 구한다. 같은 깊이는 한 열에 나란히 둔다. */
export function taskLevels(tasks: readonly Task[], order: readonly string[]): string[][] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const depth = new Map<string, number>();
  for (const id of order) {
    const deps = byId.get(id)?.dependsOn ?? [];
    depth.set(id, deps.length === 0 ? 0 : 1 + Math.max(...deps.map((d) => depth.get(d) ?? 0)));
  }
  const levels: string[][] = [];
  for (const id of order) {
    const d = depth.get(id) ?? 0;
    (levels[d] ??= []).push(id);
  }
  return levels;
}
