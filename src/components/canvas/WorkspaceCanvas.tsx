import { useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './canvas.css';
import { useTheme } from '@/lib/context/ThemeContext';

export interface WorkspaceCanvasProps {
  nodes?: Node[];
  edges?: Edge[];
  /** 저장된 뷰포트. 없으면 내용에 맞춰 보여 준다. */
  initialView?: Viewport;
  onViewChange?: (view: Viewport) => void;
}

const EMPTY_NODES: Node[] = [];
const EMPTY_EDGES: Edge[] = [];

// 노드 타입은 T2.4(SceneNode)에서 등록한다. 100노드 팬/줌 60fps는 PoC R-5로 확인(wiki/sources/poc-r5.md).
function Canvas({ nodes = EMPTY_NODES, edges = EMPTY_EDGES, initialView, onViewChange }: WorkspaceCanvasProps) {
  const { resolvedTheme } = useTheme();
  const viewportProps = useMemo(
    () => (initialView ? { defaultViewport: initialView } : { fitView: true }),
    [initialView],
  );
  return (
    <ReactFlow
      className="vs-canvas"
      nodes={nodes}
      edges={edges}
      colorMode={resolvedTheme}
      minZoom={0.05}
      maxZoom={2}
      onlyRenderVisibleElements
      onMoveEnd={(_, v) => onViewChange?.(v)}
      {...viewportProps}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} />
      <MiniMap pannable zoomable />
      <Controls />
    </ReactFlow>
  );
}

export function WorkspaceCanvas(props: WorkspaceCanvasProps) {
  return (
    <ReactFlowProvider>
      <div className="h-full w-full">
        <Canvas {...props} />
      </div>
    </ReactFlowProvider>
  );
}
