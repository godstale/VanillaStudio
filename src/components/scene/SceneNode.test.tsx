import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider, type NodeProps } from '@xyflow/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { SceneNode, type SceneFlowNode, type SceneNodeData } from './SceneNode';

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const base: SceneNodeData = { slug: 'intro', name: 'Intro', type: 'motion', status: 'draft', duration: 10, referenceCount: 2 };

function renderNode(data: Partial<SceneNodeData> = {}) {
  const props = { id: 'n1', data: { ...base, ...data }, selected: false } as unknown as NodeProps<SceneFlowNode>;
  return render(
    <LanguageProvider>
      <ReactFlowProvider>
        <SceneNode {...props} />
      </ReactFlowProvider>
    </LanguageProvider>,
  );
}

describe('SceneNode', () => {
  it.each([
    ['draft', /초안|Draft/],
    ['prompt-ready', /프롬프트 준비|Prompt ready/],
    ['generated', /생성됨|Generated/],
    ['needs-revision', /수정 필요|Needs revision/],
  ] as const)('shows the %s badge', (status, label) => {
    renderNode({ status });
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('run button becomes "revise" only in needs-revision', () => {
    const { unmount } = renderNode({ status: 'generated', onRunAgent: () => undefined });
    expect(screen.getByRole('button', { name: /에이전트 실행|Run agent/ })).toBeTruthy();
    unmount();
    renderNode({ status: 'needs-revision', onRunAgent: () => undefined });
    expect(screen.getByRole('button', { name: /재생성|Revise/ })).toBeTruthy();
  });

  it('shows the saved thumbnail instead of the placeholder', () => {
    renderNode({ thumbnail: 'data:image/png;base64,QUJD' });
    expect(screen.getByRole('img').getAttribute('src')).toBe('data:image/png;base64,QUJD');
    expect(screen.queryByText(/썸네일 없음|No thumbnail/)).toBeNull();
  });

  it('shows name, duration and reference count', () => {
    renderNode();
    expect(screen.getByText('Intro')).toBeTruthy();
    expect(screen.getByText('10s')).toBeTruthy();
    expect(screen.getByText(/레퍼런스 2|References 2/)).toBeTruthy();
  });

  it('static scenes have no duration', () => {
    renderNode({ type: 'static', duration: undefined });
    expect(screen.queryByText(/^\d+s$/)).toBeNull();
  });

  it('shows an alert for an unreadable scene.json', () => {
    renderNode({ error: 'bad' });
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('opens the folder; run and play are off without handlers', () => {
    const onOpenFolder = vi.fn();
    renderNode({ onOpenFolder });
    fireEvent.click(screen.getByRole('button', { name: /폴더 열기|Open folder/ }));
    expect(onOpenFolder).toHaveBeenCalledWith('intro');
    expect((screen.getByRole('button', { name: /에이전트 실행|Run agent/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /재생|Play/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Run agent and Play call their handlers with the scene folder when provided', () => {
    const onRunAgent = vi.fn();
    const onPlay = vi.fn();
    renderNode({ onRunAgent, onPlay });
    fireEvent.click(screen.getByRole('button', { name: /에이전트 실행|Run agent/ }));
    fireEvent.click(screen.getByRole('button', { name: /재생|Play/ }));
    expect(onRunAgent).toHaveBeenCalledWith('intro');
    expect(onPlay).toHaveBeenCalledWith('intro');
  });

  it('both buttons are disabled for an unreadable scene.json', () => {
    renderNode({ onRunAgent: vi.fn(), onPlay: vi.fn(), error: 'bad' });
    expect((screen.getByRole('button', { name: /에이전트 실행|Run agent/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /재생|Play/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
