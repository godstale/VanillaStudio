import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test-utils';
import { screen } from '@testing-library/react';
import { TaskGraph } from '@/components/pipeline/prompts/TaskGraph';
import { taskLevels } from '@/components/pipeline/prompts/taskLevels';
import type { Task } from '@/lib/pipeline/schemas/tasks';

const task = (id: string, dependsOn: string[] = [], extra: Partial<Task> = {}): Task => {
  const base: Task = {
    id,
    kind: 'asset',
    target: `${id}-target`,
    prompt: `prompts/assets/${id}.md`,
    dependsOn,
  };
  return { ...base, ...extra };
};

describe('TaskGraph', () => {
  it('renders a sample tasks.json in execution order with dependency edges', () => {
    const tasks: Task[] = [
      task('T03', ['T01', 'T02'], { kind: 'scene', target: 's1', prompt: 'prompts/scenes/s1.md' }),
      task('T01'),
      task('T02', ['T01'], { kind: 'animation' }),
      { id: 'T04', kind: 'compose', target: '', prompt: 'prompts/00-master.md', dependsOn: ['T03'] },
    ];
    renderWithProviders(<TaskGraph tasks={tasks} statuses={{ T01: 'done', T02: 'running' }} />);

    const graph = screen.getByTestId('task-graph');
    const nodes = ['T01', 'T02', 'T03', 'T04'].map((id) => screen.getByTestId(`task-node-${id}`));
    // Execution order: T01, T02, T03, T04.
    const positions = nodes.map((n) => graph.textContent?.indexOf(n.textContent ?? '') ?? -1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    expect(screen.getByTestId('task-edge-T03').textContent).toContain('T01, T02 → T03');
    expect(screen.getByTestId('task-edge-T04').textContent).toContain('T03 → T04');
    expect(screen.queryByTestId('task-edge-T01')).toBeNull();
  });

  it('shows an empty state without tasks', () => {
    renderWithProviders(<TaskGraph tasks={[]} />);
    expect(screen.getByTestId('task-graph-empty')).toBeTruthy();
  });

  it('reports a dependency cycle instead of a graph', () => {
    renderWithProviders(<TaskGraph tasks={[task('T01', ['T02']), task('T02', ['T01'])]} />);
    const cycle = screen.getByTestId('task-graph-cycle');
    expect(cycle.textContent).toContain('T01');
    expect(screen.queryByTestId('task-graph')).toBeNull();
  });
});

describe('taskLevels', () => {
  it('groups independent tasks and stacks dependents', () => {
    expect(
      taskLevels([task('a'), task('b', ['a']), task('c', ['a']), task('d', ['b', 'c'])], ['a', 'b', 'c', 'd']),
    ).toEqual([['a'], ['b', 'c'], ['d']]);
  });
});
