import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ReactFlowProvider, type Node } from '@xyflow/react';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import { WorkspaceCanvas } from './WorkspaceCanvas';

// jsdom에는 ResizeObserver·DOMMatrix가 없어 xyflow가 요구하는 최소 스텁을 둔다.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
vi.stubGlobal(
  'DOMMatrixReadOnly',
  class {
    m22 = 1;
    constructor() {}
  },
);

function renderCanvas(nodes?: Node[]) {
  return render(
    <ThemeProvider>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlowProvider>
          <WorkspaceCanvas nodes={nodes} initialView={{ x: 5, y: 6, zoom: 1 }} />
        </ReactFlowProvider>
      </div>
    </ThemeProvider>,
  );
}

describe('WorkspaceCanvas', () => {
  it('renders the empty canvas with grid, minimap and controls', () => {
    const { container } = renderCanvas();
    expect(container.querySelector('.vs-canvas')).not.toBeNull();
    expect(container.querySelector('.react-flow__background')).not.toBeNull();
    expect(container.querySelector('.react-flow__minimap')).not.toBeNull();
    expect(container.querySelector('.react-flow__controls')).not.toBeNull();
  });

  it('applies the saved viewport', () => {
    const { container } = renderCanvas();
    const vp = container.querySelector('.react-flow__viewport') as HTMLElement;
    expect(vp.style.transform).toContain('translate(5px,6px) scale(1)');
  });
});
