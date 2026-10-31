// Standalone play manifest (app-owned, workspace-template).
// Build-time only: workspace.json / sequence.json / scenes/*/scene.json are bundled
// via import.meta.glob, so dist/play.html runs on any static server without fetch.

export interface CanvasSpec {
  width: number;
  height: number;
  fps: number;
}

export interface PlayNode {
  sceneId: string;
}

export interface PlayEdge {
  from: string;
  to: string;
  trigger: string;
}

export interface PlaySequence {
  mode: string;
  nodes: PlayNode[];
  edges: PlayEdge[];
  start: string | null;
}

export type SceneKind = 'static' | 'motion' | '3d';

export interface SceneMeta {
  /** scene.json id (scn_*). */
  id: string;
  /** Folder name under scenes/. */
  slug: string;
  name: string;
  type: SceneKind;
  /** scene.json runtime.entry, default src/index.html. */
  entry: string;
}

export interface Manifest {
  workspaceName: string;
  canvas: CanvasSpec;
  sequence: PlaySequence;
  /** sceneId -> meta. */
  scenes: ReadonlyMap<string, SceneMeta>;
  /** sceneId list in sequence.nodes order, filtered to known scenes. */
  order: string[];
  /** Non-blocking problems (shown in the help panel, logged to console). */
  warnings: string[];
}

const DEFAULT_CANVAS: CanvasSpec = { width: 1920, height: 1080, fps: 30 };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const asString = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

function asCanvas(v: unknown): CanvasSpec {
  if (!isRecord(v)) return DEFAULT_CANVAS;
  const num = (k: string, fb: number): number => (typeof v[k] === 'number' && Number.isFinite(v[k]) ? (v[k] as number) : fb);
  return { width: num('width', 1920), height: num('height', 1080), fps: num('fps', 30) };
}

function asSequence(v: unknown): PlaySequence {
  if (!isRecord(v)) return { mode: 'linear', nodes: [], edges: [], start: null };
  const nodes = Array.isArray(v['nodes'])
    ? (v['nodes'] as unknown[]).filter(isRecord).map((n) => ({ sceneId: asString(n['sceneId']) })).filter((n) => n.sceneId !== '')
    : [];
  const edges = Array.isArray(v['edges'])
    ? (v['edges'] as unknown[])
        .filter(isRecord)
        .map((e) => ({ from: asString(e['from']), to: asString(e['to']), trigger: asString(e['trigger']) }))
        .filter((e) => e.from !== '' && e.to !== '' && e.trigger !== '')
    : [];
  const start = typeof v['start'] === 'string' ? (v['start'] as string) : null;
  return { mode: asString(v['mode'], 'linear'), nodes, edges, start };
}

function asSceneMeta(slug: string, v: unknown): SceneMeta | null {
  if (!isRecord(v)) return null;
  const id = asString(v['id']);
  if (id === '') return null;
  const typeRaw = asString(v['type'], 'motion');
  const type: SceneKind = typeRaw === 'static' || typeRaw === '3d' ? typeRaw : 'motion';
  const runtime = isRecord(v['runtime']) ? v['runtime'] : null;
  const entry = runtime ? asString(runtime['entry'], 'src/index.html') : 'src/index.html';
  return { id, slug, name: asString(v['name'], slug), type, entry };
}

// Paths are relative to this file (play/manifest.ts).
const workspaceModules = import.meta.glob<unknown>('../workspace.json', { eager: true, import: 'default' });
const sequenceModules = import.meta.glob<unknown>('../sequence.json', { eager: true, import: 'default' });
const sceneModules = import.meta.glob<unknown>('../scenes/*/scene.json', { eager: true, import: 'default' });

function slugOf(key: string): string {
  const m = /..\/scenes\/([^/]+)\/scene\.json$/.exec(key);
  return m ? m[1] : key;
}

export function loadManifest(): Manifest {
  const warnings: string[] = [];
  const workspaceRaw = Object.values(workspaceModules)[0];
  const workspaceName = isRecord(workspaceRaw) ? asString(workspaceRaw['name'], 'Vanilla Play') : 'Vanilla Play';
  const canvas = isRecord(workspaceRaw) ? asCanvas(workspaceRaw['canvas']) : DEFAULT_CANVAS;

  const sequence = asSequence(Object.values(sequenceModules)[0]);

  const scenes = new Map<string, SceneMeta>();
  for (const [key, raw] of Object.entries(sceneModules)) {
    const meta = asSceneMeta(slugOf(key), raw);
    if (meta) scenes.set(meta.id, meta);
  }

  const workspaceId = isRecord(workspaceRaw) ? asString(workspaceRaw['workspaceId']) : '';
  const sequenceId = (() => {
    // sequence.json carries its own workspaceId; a mismatch means mixed workspaces.
    try {
      const raw = Object.values(sequenceModules)[0];
      return isRecord(raw) ? asString(raw['workspaceId']) : '';
    } catch {
      return '';
    }
  })();
  if (workspaceId !== '' && sequenceId !== '' && workspaceId !== sequenceId) {
    warnings.push(`workspaceId mismatch: workspace.json (${workspaceId}) vs sequence.json (${sequenceId})`);
  }

  const order: string[] = [];
  for (const n of sequence.nodes) {
    if (!scenes.has(n.sceneId)) {
      warnings.push(`sequence node points at missing scene: ${n.sceneId}`);
      continue;
    }
    if (!order.includes(n.sceneId)) order.push(n.sceneId);
  }
  if (sequence.start !== null && !scenes.has(sequence.start)) {
    warnings.push(`sequence start points at missing scene: ${sequence.start}`);
  }
  if (order.length === 0) warnings.push('no playable scenes (empty sequence)');

  return { workspaceName, canvas, sequence, scenes, order, warnings };
}
