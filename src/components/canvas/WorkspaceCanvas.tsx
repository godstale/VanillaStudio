import type { ReactNode } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type OnReconnect,
  type ReactFlowProps,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './canvas.css';
import { useTheme } from '@/lib/context/ThemeContext';

export interface WorkspaceCanvasProps {
  nodes?: Node[];
  edges?: Edge[];
  nodeTypes?: NodeTypes;
  /** 저장된 뷰포트. 없으면 내용에 맞춰 보여 준다. */
  initialView?: Viewport;
  onViewChange?: (view: Viewport) => void;
  onNodesChange?: OnNodesChange;
  /** 엣지 편집: 핸들을 끌어 잇기·삭제(Delete 키)·끝점 옮기기·선택. */
  onConnect?: OnConnect;
  onEdgesChange?: OnEdgesChange;
  onReconnect?: OnReconnect;
  onEdgeClick?: ReactFlowProps['onEdgeClick'];
  onNodeClick?: ReactFlowProps['onNodeClick'];
  onPaneClick?: ReactFlowProps['onPaneClick'];
  onNodeDragStop?: ReactFlowProps['onNodeDragStop'];
  onPaneContextMenu?: ReactFlowProps['onPaneContextMenu'];
  children?: ReactNode;
}

const EMPTY_NODES: Node[] = [];
const EMPTY_EDGES: Edge[] = [];

/**
 * ComfyUI형 캔버스. `ReactFlowProvider`는 호출한 쪽이 감싼다(화면 좌표 변환 등 훅을 같이 쓰기 위해).
 * 100노드 팬/줌 60fps는 PoC R-5로 확인(wiki/sources/poc-r5.md).
 */
export function WorkspaceCanvas({
  nodes = EMPTY_NODES,
  edges = EMPTY_EDGES,
  initialView,
  onViewChange,
  children,
  ...handlers
}: WorkspaceCanvasProps) {
  const { resolvedTheme } = useTheme();
  const viewportProps = initialView ? { defaultViewport: initialView } : { fitView: true };
  return (
    <div className="h-full w-full">
      <ReactFlow
        className="vs-canvas"
        nodes={nodes}
        edges={edges}
        colorMode={resolvedTheme}
        minZoom={0.05}
        maxZoom={2}
        onlyRenderVisibleElements
        onMoveEnd={(_, v) => onViewChange?.(v)}
        {...handlers}
        {...viewportProps}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} />
        <MiniMap pannable zoomable />
        <Controls />
        {children}
      </ReactFlow>
    </div>
  );
}
