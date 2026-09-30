export interface TopoNode {
  id: string;
  dependsOn: readonly string[];
}

export type TopoResult =
  | { ok: true; order: string[] }
  | { ok: false; cycle: string[] };

/**
 * Kahn algorithm. Ties keep declaration order so the same tasks.json always
 * runs in the same order. Unknown dependencies are ignored here (schema validation reports them).
 */
export function topoSort(nodes: readonly TopoNode[]): TopoResult {
  const position = new Map(nodes.map((n, i) => [n.id, i]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const n of nodes) {
    const deps = [...new Set(n.dependsOn.filter((d) => position.has(d)))];
    indegree.set(n.id, deps.length);
    for (const d of deps) dependents.set(d, [...(dependents.get(d) ?? []), n.id]);
  }
  const byPosition = (a: string, b: string) => (position.get(a) ?? 0) - (position.get(b) ?? 0);
  const ready = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const order: string[] = [];
  while (ready.length > 0) {
    const next = ready.shift() as string;
    order.push(next);
    for (const dep of dependents.get(next) ?? []) {
      const left = (indegree.get(dep) ?? 0) - 1;
      indegree.set(dep, left);
      if (left === 0) {
        ready.push(dep);
        ready.sort(byPosition);
      }
    }
  }
  if (order.length === nodes.length) return { ok: true, order };
  return { ok: false, cycle: findCycle(nodes) };
}

/** Returns one dependency cycle as `[a, b, c, a]`, or an empty array when acyclic. */
export function findCycle(nodes: readonly TopoNode[]): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    state.set(id, 'visiting');
    stack.push(id);
    for (const dep of byId.get(id)?.dependsOn ?? []) {
      if (!byId.has(dep)) continue;
      if (state.get(dep) === 'visiting') return [...stack.slice(stack.indexOf(dep)), dep];
      if (!state.has(dep)) {
        const found = visit(dep);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(id, 'done');
    return null;
  };

  for (const n of nodes) {
    if (!state.has(n.id)) {
      const found = visit(n.id);
      if (found) return found;
    }
  }
  return [];
}
