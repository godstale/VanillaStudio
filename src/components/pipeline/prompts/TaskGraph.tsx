import { useMemo } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { findCycle, topoSort } from '@/lib/pipeline/topo';
import type { Task } from '@/lib/pipeline/schemas/tasks';
import { taskLevels } from './taskLevels';

/** Build 단계에서 쓰는 태스크 상태. 실행 상태는 프로젝트 DB에 두고 여기서는 표시만 한다. */
export type TaskStatus = 'pending' | 'running' | 'done' | 'failed';

export interface TaskGraphProps {
  tasks: Task[];
  statuses?: Partial<Record<string, TaskStatus>>;
}

const STATUS_DOT: Record<TaskStatus, string> = {
  pending: 'bg-muted-foreground/40',
  running: 'bg-primary',
  done: 'bg-primary/40',
  failed: 'bg-destructive',
};

/** `tasks.json` 의존성 그래프(F-PIP-06). 읽기 전용 시각화이며 편집은 하지 않는다. */
export function TaskGraph({ tasks, statuses = {} }: TaskGraphProps) {
  const { t } = useLanguage();
  const model = useMemo(() => {
    if (tasks.length === 0) return { kind: 'empty' } as const;
    const cycle = findCycle(tasks);
    if (cycle.length > 0) return { kind: 'cycle', cycle } as const;
    const sorted = topoSort(tasks);
    if (!sorted.ok) return { kind: 'cycle', cycle: sorted.cycle } as const;
    const byId = new Map(tasks.map((task) => [task.id, task]));
    return { kind: 'graph', order: sorted.order, levels: taskLevels(tasks, sorted.order), byId } as const;
  }, [tasks]);

  if (model.kind === 'empty') {
    return <p className="text-sm text-muted-foreground" data-testid="task-graph-empty">{t('checkpoint.graph.empty')}</p>;
  }
  if (model.kind === 'cycle') {
    return (
      <p className="text-sm text-destructive" data-testid="task-graph-cycle">
        {t('checkpoint.graph.cycle', { cycle: model.cycle.join(' -> ') })}
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="task-graph">
      <h3 className="text-sm font-medium">{t('checkpoint.graph.title')}</h3>
      <ol className="flex flex-col gap-2">
        {model.order.map((id, index) => {
          const task = model.byId.get(id);
          if (!task) return null;
          const status: TaskStatus = statuses[id] ?? 'pending';
          return (
            <li
              key={id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2"
              data-testid={`task-node-${id}`}
            >
              <span className="font-mono text-xs text-muted-foreground">{index + 1}</span>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
              <div className="min-w-0">
                <p className="font-mono text-sm font-medium">{id}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {task.kind}
                  {task.target ? ` · ${task.target}` : ''} · {task.prompt}
                </p>
                {task.dependsOn.length > 0 && (
                  <p className="font-mono text-xs text-muted-foreground" data-testid={`task-edge-${id}`}>
                    {task.dependsOn.join(', ')} → {id}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
