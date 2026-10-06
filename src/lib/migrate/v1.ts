import { defaultTemplateFor } from '@/lib/guides/template';
import { applyTemplateDefaults } from '@/lib/guides/merge';
import { newScene, sceneSchema, type Scene, type SceneType } from '@/lib/scene/schema';
import { canvasFromPreset, CANVAS_PRESETS, type Canvas } from '@/lib/workspace/schema';
import { parseProjectManifest } from './legacy-schema';

// v1 프로젝트 → v2 워크스페이스 변환 계획(T7.5, D-033, Refactor-Spec-v2 §11.1).
// 원칙: 원본 비파괴(읽기만)·복사 방식·단방향·best-effort. 변환하지 못한 것은 버리지 않고 `unconverted`에 이유와 함께 남기며, 가능한 것은 `v1-archive/`에 보존한다.
// 이 모듈은 순수 함수만 둔다. 파일 읽기(Rust `read_v1_project`)와 쓰기(`applyV1Migration`)는 바깥에서 한다.

export interface V1Bundle {
  /** v1 프로젝트 루트(정규 경로). 바이너리 복사의 출발점. */
  root: string;
  /** 상대 경로 → 텍스트. */
  texts: Record<string, string>;
  /** 내용을 읽지 않은 파일(복사 대상). */
  binaries: string[];
  /** 변환하지 않는 최상위 항목 이름. */
  skipped: string[];
}

export type V1OutputType = 'web' | 'interactive' | 'slides' | 'image' | 'video';

export interface MigrationOptions {
  /** `interactive` 프로젝트를 어떤 신 타입으로 옮길지(사용자 선택). 기본 static. */
  interactiveAs?: 'static' | 'motion';
}

export type UnconvertedKind = 'archived' | 'partial' | 'dropped';
export interface Unconverted {
  item: string;
  kind: UnconvertedKind;
  detail: string;
}

export interface MigrationPlan {
  workspaceName: string;
  canvas: Canvas;
  sceneType: SceneType;
  sceneName: string;
  /** 새 신에 덮어쓸 scene.json 필드(id는 신을 만들 때 발급된 것을 쓴다). */
  scene: (id: string) => Scene;
  /** 워크스페이스 루트 기준 텍스트 파일. */
  workspaceFiles: Record<string, string>;
  /** 신 폴더 기준 텍스트 파일. */
  sceneFiles: Record<string, string>;
  /** 복사할 바이너리: 원본 절대 경로의 상대 경로(`from`) → 대상 위치. */
  copies: { from: string; scope: 'workspace' | 'scene'; to: string }[];
  unconverted: Unconverted[];
  warnings: string[];
}

export type PlanResult = { ok: true; plan: MigrationPlan } | { ok: false; error: string };

const MEDIA_IMAGE = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'bmp'];
const MEDIA_VIDEO = ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'];
const extOf = (p: string): string => (/\.([A-Za-z0-9]+)$/.exec(p)?.[1] ?? '').toLowerCase();

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** 규격 → 워크스페이스 캔버스. 프리셋과 같은 비율·크기면 프리셋 이름을 쓴다. */
export function canvasFromFormat(format: { width: number; height: number; fps?: number }): Canvas {
  const fps = format.fps ?? 30;
  const clamp = (n: number) => Math.min(7680, Math.max(16, Math.round(n)));
  const w = clamp(format.width);
  const h = clamp(format.height);
  for (const [name, size] of Object.entries(CANVAS_PRESETS)) {
    if (size.width === w && size.height === h) return canvasFromPreset(name as keyof typeof CANVAS_PRESETS, fps);
  }
  const g = gcd(w, h);
  const ratio = `${w / g}:${h / g}`;
  return { aspect: /^\d+:\d+$/.test(ratio) && w / g <= 64 && h / g <= 64 ? ratio : 'custom', width: w, height: h, fps };
}

export function sceneTypeFor(outputType: V1OutputType, opts: MigrationOptions): SceneType {
  switch (outputType) {
    case 'web':
    case 'slides':
      return 'static';
    case 'video':
    case 'image':
      return 'motion';
    case 'interactive':
      return opts.interactiveAs ?? 'static';
  }
}

interface BriefFields {
  subject: string;
  goal: string;
  audience: string;
  message: string;
}

const BRIEF_KEYS: [keyof BriefFields, RegExp][] = [
  ['goal', /^(목적|목표|goal|objective|purpose)$/i],
  ['audience', /^(대상|타깃|타겟|청중|audience|target)$/i],
  ['message', /^(핵심\s*메시지|메시지|message|key\s*message)$/i],
  ['subject', /^(주제|제품|subject|product|topic)$/i],
];

/** `## 목적` 같은 제목 구간과 `목적: …` 같은 줄을 읽는다. 읽지 못한 칸은 비운다(best-effort). */
export function parseBrief(md: string): BriefFields {
  const out: BriefFields = { subject: '', goal: '', audience: '', message: '' };
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let section: keyof BriefFields | null = null;
  const put = (key: keyof BriefFields, text: string) => {
    if (text.trim()) out[key] = out[key] ? `${out[key]}\n${text.trim()}` : text.trim();
  };
  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^#{1,6}\s+(.+)$/.exec(line);
    if (heading) {
      section = BRIEF_KEYS.find(([, re]) => re.test(heading[1].trim()))?.[0] ?? null;
      continue;
    }
    const pair = /^[-*]?\s*([^:：]{1,20})[:：]\s*(.+)$/.exec(line);
    const pairKey = pair ? BRIEF_KEYS.find(([, re]) => re.test(pair[1].trim()))?.[0] : undefined;
    if (pair && pairKey) {
      put(pairKey, pair[2]);
      continue;
    }
    if (section && line) put(section, line);
  }
  return out;
}

interface PlanScene {
  id: string;
  title?: string;
  purpose?: string;
  start?: number;
  end?: number;
  layout?: string;
  implementation?: { approach?: string };
}

function readPlanScenes(planJson: string | undefined): PlanScene[] | null {
  if (!planJson) return null;
  try {
    const plan = JSON.parse(planJson) as { scenes?: unknown };
    if (!Array.isArray(plan.scenes)) return null;
    return plan.scenes.filter((s): s is PlanScene => typeof s === 'object' && s !== null && typeof (s as PlanScene).id === 'string');
  } catch {
    return null;
  }
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** 계획서의 Scene 구간 → 이어 붙은 beats. 구간 길이를 이어 붙여 `duration`과 맞춘다. 쓸 수 없으면 null. */
export function beatsFromPlan(scenes: PlanScene[]): { beats: { id: string; start: number; end: number; role: string; copy: string; visual: string; motion: string[]; camera: string; transitionOut: string; notes: string }[]; seconds: number } | null {
  const timed = scenes.filter((s) => typeof s.start === 'number' && typeof s.end === 'number' && (s.end as number) > (s.start as number));
  if (timed.length === 0 || timed.length !== scenes.length) return null;
  let cursor = 0;
  const seen = new Set<string>();
  const beats = timed.map((s, i) => {
    const length = (s.end as number) - (s.start as number);
    const start = round3(cursor);
    cursor += length;
    let id = s.id;
    if (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);
    return { id, start, end: round3(cursor), role: s.purpose ?? s.title ?? '', copy: '', visual: s.layout ?? '', motion: [] as string[], camera: '', transitionOut: '', notes: s.implementation?.approach ?? '' };
  });
  return { beats, seconds: round3(cursor) };
}

const SCENE_SRC = /^src\//;

/** v1 번들 → 변환 계획. v1 프로젝트가 아니거나 매니페스트가 깨졌으면 이유를 돌려준다. */
export function planV1Migration(bundle: V1Bundle, opts: MigrationOptions = {}): PlanResult {
  const manifestText = bundle.texts['vanilla.json'];
  if (manifestText === undefined) return { ok: false, error: 'not-a-v1-project' };
  const parsed = parseProjectManifest(manifestText);
  if (!parsed.ok) return { ok: false, error: `invalid-vanilla-json: ${parsed.error}` };
  const m = parsed.manifest;

  const type = sceneTypeFor(m.outputType, opts);
  const template = defaultTemplateFor(type);
  const canvas = canvasFromFormat({ width: m.format.width, height: m.format.height, fps: m.format.fps });
  const warnings: string[] = [];
  const unconverted: Unconverted[] = [];
  const planScenes = readPlanScenes(bundle.texts['plan/plan.json']);
  const brief = parseBrief(bundle.texts['brief/brief.md'] ?? '');
  if (!bundle.texts['brief/brief.md']) warnings.push('no brief/brief.md: the brief fields start empty');

  const sceneFiles: Record<string, string> = {};
  const workspaceFiles: Record<string, string> = {};
  const copies: MigrationPlan['copies'] = [];

  // 소스: v1 `src/`를 신 폴더 `src/`로 그대로 복사한다(같은 런타임 API). 엔트리 HTML만 새로 만든다.
  let hasSource = false;
  for (const [rel, text] of Object.entries(bundle.texts)) {
    if (SCENE_SRC.test(rel)) {
      sceneFiles[rel] = text;
      hasSource = true;
    } else if (/^params\/.+\.json$/.test(rel)) {
      sceneFiles[rel] = text;
    } else if (rel === 'assets/CREDITS.md') {
      sceneFiles['CREDITS.md'] = text;
    } else if (/^public\//.test(rel)) {
      workspaceFiles[rel] = text;
    }
  }
  for (const rel of bundle.binaries) {
    if (SCENE_SRC.test(rel)) copies.push({ from: rel, scope: 'scene', to: rel });
    else if (/^public\//.test(rel)) copies.push({ from: rel, scope: 'workspace', to: rel });
  }
  if (!hasSource) warnings.push('no src/: the scene has no code yet (the agent can generate it from the brief)');
  if (!sceneFiles['src/main.tsx'] && hasSource) warnings.push('src/main.tsx is missing: the scene may not start until it is added');
  sceneFiles['src/index.html'] = `<!doctype html>\n<html lang="${/[가-힣]/.test(manifestText + (bundle.texts['brief/brief.md'] ?? '')) ? 'ko' : 'en'}"><head><meta charset="UTF-8" /><title>${m.name.replace(/[<>&"]/g, '')}</title><style>html,body,#root{margin:0;height:100%}</style></head>\n<body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>\n`;

  // DESIGN.md는 워크스페이스 것이 된다(v1 프로젝트 하나 = v2 워크스페이스 하나).
  if (bundle.texts['DESIGN.md'] !== undefined) workspaceFiles['DESIGN.md'] = bundle.texts['DESIGN.md'];
  else warnings.push('no DESIGN.md: the workspace keeps the default design');

  // 레퍼런스: brief/materials의 이미지·영상은 레퍼런스로 등록하고, 나머지는 복사만 한다.
  const references: Scene['references'] = [];
  const materials = [...Object.keys(bundle.texts).filter((p) => p.startsWith('brief/materials/')), ...bundle.binaries.filter((p) => p.startsWith('brief/materials/'))].sort();
  for (const rel of materials) {
    const to = `references/materials/${rel.slice('brief/materials/'.length)}`;
    if (rel in bundle.texts) sceneFiles[to] = bundle.texts[rel];
    else copies.push({ from: rel, scope: 'scene', to });
    const ext = extOf(rel);
    const kind = MEDIA_IMAGE.includes(ext) ? 'image' : MEDIA_VIDEO.includes(ext) ? 'video' : null;
    if (kind) references.push({ id: `ref-${references.length + 1}`, kind, path: to, url: null, note: 'from the v1 brief materials', analysis: null });
    else unconverted.push({ item: rel, kind: 'partial', detail: `copied to ${to} but not registered as a reference (only images and videos are)` });
  }

  // 보존용 보관함: 변환하지 않은 v1 문서.
  const archive = (rel: string, to: string, why: string) => {
    if (bundle.texts[rel] === undefined) return;
    sceneFiles[`v1-archive/${to}`] = bundle.texts[rel];
    unconverted.push({ item: rel, kind: 'archived', detail: why });
  };
  archive('brief/brief.md', 'brief.md', 'the full v1 brief is kept; its main fields were copied into the scene brief');
  archive('plan/plan.md', 'plan.md', 'the human-readable plan is kept for reference');
  archive('plan/plan.json', 'plan.json', 'assets, animations and parameter declarations are not part of the v2 scene; kept for reference');
  archive('frame.md', 'frame.md', 'video pacing notes have no v2 field; kept for reference');

  for (const name of bundle.skipped) {
    unconverted.push({ item: `${name}/`, kind: 'dropped', detail: name === 'reviews' || name === 'exports' || name === 'prompts' ? 'v1 working history and generated prompts are not carried over' : 'not part of the v2 workspace' });
  }
  unconverted.push({ item: 'vanilla.json: palette, agents, template, runtime, createdAt', kind: 'dropped', detail: 'the palette lives in DESIGN.md; the default agent and guide template are chosen again in v2' });

  // 신 필드.
  let duration = m.format.durationSec ?? 10;
  let beats: ReturnType<typeof beatsFromPlan> = null;
  let steps: { id: string; title: string; copy: string; layout: string; enter: string; advance: string }[] = [];
  let sections: string[] = [];
  if (planScenes) {
    if (type === 'motion') {
      beats = beatsFromPlan(planScenes);
      if (beats) duration = m.format.durationSec && Math.abs(m.format.durationSec - beats.seconds) > 0.001 ? beats.seconds : (m.format.durationSec ?? beats.seconds);
      else if (planScenes.length > 0) unconverted.push({ item: 'plan/plan.json: scene times', kind: 'partial', detail: 'scene start/end times were missing or invalid, so the beats start empty (the agent can fill them in)' });
    } else if (m.outputType === 'slides') {
      steps = planScenes.map((s) => ({ id: s.id, title: s.title ?? '', copy: '', layout: s.layout ?? '', enter: '', advance: 'click' }));
    } else {
      sections = planScenes.map((s) => s.title ?? s.id);
    }
  }
  if (beats && m.format.durationSec && Math.abs(m.format.durationSec - beats.seconds) > 0.001) {
    warnings.push(`the plan's scene times add up to ${beats.seconds}s, not the declared ${m.format.durationSec}s; the scene duration uses ${beats.seconds}s`);
  }

  const fields = { brief: { ...brief, language: (/[가-힣]/.test(bundle.texts['brief/brief.md'] ?? '') ? 'ko' : 'en') as 'ko' | 'en' } };
  const build = (id: string): Scene => {
    let scene = newScene({ id, name: m.name, type, template: template.ref, language: fields.brief.language });
    scene = { ...scene, brief: { ...scene.brief, ...fields.brief }, references, status: hasSource ? 'generated' : 'draft' } as Scene;
    const s = scene as unknown as Record<string, unknown>;
    if (type === 'static') {
      s.mode = m.outputType === 'slides' ? 'steps' : 'scroll';
      s.steps = steps;
      s.sections = sections;
    } else {
      s.duration = { seconds: duration };
      if (beats) s.beats = beats.beats;
    }
    return sceneSchema.parse(applyTemplateDefaults(sceneSchema.parse(s), template));
  };
  // 만들어지는지 미리 확인한다(실패하면 계획 자체를 거부).
  try {
    build('scn_PLANCHECK');
  } catch (e) {
    return { ok: false, error: `cannot-build-scene: ${e instanceof Error ? e.message : String(e)}` };
  }

  return {
    ok: true,
    plan: { workspaceName: m.name, canvas, sceneType: type, sceneName: m.name, scene: build, workspaceFiles, sceneFiles, copies, unconverted, warnings },
  };
}
