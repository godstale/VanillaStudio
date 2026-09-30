import { z } from 'zod';
import { findCycle, topoSort } from '../topo';

/** tasks.json 스키마 버전. 계약을 바꾸면 이 값과 설계서·vanilla-core 스킬을 함께 올린다. */
export const TASKS_VERSION = 1;

export const TASK_KINDS = ['asset', 'animation', 'scene', 'compose'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

const taskId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, 'task id');

/** 프로젝트 안의 상대 경로만 허용한다(절대 경로·`..` 금지, AGENTS.md §7). */
const promptPath = z
  .string()
  .min(1)
  .refine(
    (p) => !/^([A-Za-z]:|[\\/])/.test(p) && !p.split(/[\\/]/).includes('..'),
    'must be a relative path inside the project',
  )
  .refine((p) => p.endsWith('.md'), 'must be a .md file');

const taskSchema = z
  .object({
    id: taskId,
    kind: z.enum(TASK_KINDS),
    /** asset/animation/scene id. compose는 비워도 된다. */
    target: z.string().default(''),
    prompt: promptPath,
    dependsOn: z.array(taskId).default([]),
  })
  .strict();

export const tasksSchema = z
  .object({
    version: z.literal(TASKS_VERSION).optional(),
    tasks: z.array(taskSchema),
  })
  .strict()
  .superRefine((file, ctx) => {
    const add = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const ids = new Set<string>();
    file.tasks.forEach((t, i) => {
      if (ids.has(t.id)) add(['tasks', i, 'id'], `duplicate id "${t.id}"`);
      ids.add(t.id);
      if (t.kind !== 'compose' && !t.target) add(['tasks', i, 'target'], `required for ${t.kind}`);
    });
    file.tasks.forEach((t, i) => {
      t.dependsOn.forEach((d, j) => {
        if (d === t.id) add(['tasks', i, 'dependsOn', j], 'task cannot depend on itself');
        else if (!ids.has(d)) add(['tasks', i, 'dependsOn', j], `unknown task "${d}"`);
      });
    });
    const cycle = findCycle(file.tasks);
    if (cycle.length > 0) add(['tasks'], `dependency cycle: ${cycle.join(' -> ')}`);
  });

export type TasksFile = z.infer<typeof tasksSchema>;
export type Task = TasksFile['tasks'][number];

export type TasksParseResult =
  | { ok: true; tasks: Task[]; order: string[] }
  | { ok: false; errors: string[] };

/** 검증과 위상 정렬을 한 번에 한다. `order`는 실행 순서(id 목록)다. */
export function parseTasks(text: string): TasksParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  const r = tasksSchema.safeParse(raw);
  if (!r.success) {
    return {
      ok: false,
      errors: r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const sorted = topoSort(r.data.tasks);
  if (!sorted.ok) return { ok: false, errors: [`dependency cycle: ${sorted.cycle.join(' -> ')}`] };
  return { ok: true, tasks: r.data.tasks, order: sorted.order };
}
