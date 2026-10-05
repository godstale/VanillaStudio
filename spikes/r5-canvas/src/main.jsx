import { StrictMode, useCallback, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Background, BackgroundVariant, Controls, Handle, MiniMap, Position, ReactFlow,
  useReactFlow, ReactFlowProvider, useNodesState, useEdgesState, addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './theme.css';

const TYPES = ['static', 'motion', '3d'];

// ComfyUI형 Scene 노드: 헤더(타입·이름) + 상태 배지 + 썸네일 자리 + 버튼 자리 + 입출력 핸들.
function SceneNode({ data, selected }) {
  return (
    <div className={`scene-node ${selected ? 'sel' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <div className="hd"><span className={`ty ${data.type}`}>{data.type}</span><b>{data.name}</b></div>
      <div className="thumb" />
      <div className="row"><span className="badge">{data.status}</span><span>{data.duration}s</span></div>
      <div className="row"><button>Run agent</button><button>Play</button></div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
const nodeTypes = { scene: SceneNode };

function makeGraph(n) {
  const cols = Math.ceil(Math.sqrt(n));
  const nodes = Array.from({ length: n }, (_, i) => ({
    id: `n${i}`, type: 'scene',
    position: { x: (i % cols) * 280, y: Math.floor(i / cols) * 260 },
    data: { name: `Scene ${i}`, type: TYPES[i % 3], status: i % 4 ? 'draft' : 'generated', duration: 3 + (i % 5) },
  }));
  const edges = Array.from({ length: n - 1 }, (_, i) => ({ id: `e${i}`, source: `n${i}`, target: `n${i + 1}`, animated: i % 7 === 0 }));
  return { nodes, edges };
}

function Canvas({ n }) {
  const g = useMemo(() => makeGraph(n), [n]);
  const [nodes, , onNodesChange] = useNodesState(g.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(g.edges);
  const rf = useReactFlow();
  const onConnect = useCallback((c) => setEdges((e) => addEdge(c, e)), [setEdges]);

  useEffect(() => {
    // 측정 훅: 뷰포트를 프로그램적으로 팬/줌하며 프레임 간격을 잰다.
    window.__bench = (seconds = 4) => new Promise((resolve) => {
      const frames = []; let last = performance.now(); const t0 = last;
      const tick = (now) => {
        frames.push(now - last); last = now;
        const k = (now - t0) / 1000;
        rf.setViewport({ x: -400 * k, y: -150 * k, zoom: 0.6 + 0.4 * Math.sin(k * 2) });
        if (now - t0 < seconds * 1000) requestAnimationFrame(tick);
        else {
          const s = frames.slice(1).sort((a, b) => a - b);
          const avg = s.reduce((a, b) => a + b, 0) / s.length;
          resolve({ nodes: n, frames: s.length, avgMs: +avg.toFixed(2), p95Ms: +s[Math.floor(s.length * 0.95)].toFixed(2), maxMs: +s[s.length - 1].toFixed(2), fps: +(1000 / avg).toFixed(1) });
        }
      };
      requestAnimationFrame(tick);
    });
  }, [rf, n]);

  return (
    <ReactFlow
      nodes={nodes} edges={edges} nodeTypes={nodeTypes}
      onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
      colorMode="dark" fitView minZoom={0.05} maxZoom={2} onlyRenderVisibleElements
    >
      <Background variant={BackgroundVariant.Dots} gap={20} />
      <MiniMap pannable zoomable />
      <Controls />
    </ReactFlow>
  );
}

const n = Number(new URLSearchParams(location.search).get('n') || 100);
createRoot(document.getElementById('root')).render(
  <StrictMode><ReactFlowProvider><div style={{ width: '100vw', height: '100vh' }}><Canvas n={n} /></div></ReactFlowProvider></StrictMode>,
);
