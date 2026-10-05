import { serializeScene, type Scene } from '@/lib/scene/schema';
import { normalizeEol } from './markers';
import { sha256 } from './sha256';
import { agentWritableFields } from './writeback';

// GUIDE.md = scene.json을 사람·에이전트가 읽기 좋게 풀어 쓴 읽기 전용 생성물(전체가 생성물, Technical-Design §3.4).
// 헤더에 scene.json 해시와 본문 해시를 둬서 "scene.json이 바뀜"과 "GUIDE.md를 손으로 고침"을 구분한다.

const HEADER_RE = /^<!-- vanilla:generated scene-hash=([0-9a-f]{64}) body-hash=([0-9a-f]{64}) -->\n/;

export const sceneHash = (scene: Scene): string => sha256(serializeScene(scene));

const EMPTY = '_(empty)_';
const list = (items: readonly string[]): string => (items.length ? items.map((i) => `- ${i}`).join('\n') : EMPTY);
const val = (s: string): string => (s.trim() ? s.trim() : EMPTY);
const sec = (title: string, body: string): string => `## ${title}\n\n${body}`;
const sec2 = (title: string, rows: [string, string][]): string =>
  sec(title, rows.map(([k, v]) => `- **${k}**: ${v.trim() ? v.trim() : EMPTY}`).join('\n'));
const fmt = (n: number): string => n.toFixed(3).replace(/\.?0+$/, '');

function timedSections(scene: Exclude<Scene, { type: 'static' }>): string[] {
  const beats = scene.beats.length
    ? scene.beats
        .map(
          (b) =>
            `### ${b.id} · ${fmt(b.start)}s – ${fmt(b.end)}s · ${b.role || EMPTY}\n\n` +
            [
              `- copy: ${b.copy || EMPTY}`,
              `- visual: ${b.visual || EMPTY}`,
              `- motion: ${b.motion.length ? b.motion.join(', ') : EMPTY}`,
              `- camera: ${b.camera || EMPTY}`,
              `- transitionOut: ${b.transitionOut || EMPTY}`,
              `- notes: ${b.notes || EMPTY}`,
            ].join('\n'),
        )
        .join('\n\n')
    : EMPTY;
  const mv = scene.motionVocabulary;
  return [
    sec2('Timing', [
      ['duration', `${fmt(scene.duration.seconds)} seconds`],
      ['structure', scene.structure],
      ['adStructure', scene.adStructure],
      ['creativeMode', scene.creativeMode.join(', ')],
    ]),
    sec('Brand voice', list(scene.brandVoice)),
    sec2('Visual style', Object.entries(scene.visualStyle) as [string, string][]),
    sec2('Motion vocabulary', [
      ['typography', mv.typography.join(', ')],
      ['object', mv.object.join(', ')],
      ['camera', mv.camera.join(', ')],
      ['material', mv.material.join(', ')],
      ['transition', mv.transition.join(', ')],
    ]),
    sec('Beats', beats),
    sec(
      `Copy (text fidelity: ${scene.copy.textFidelity})`,
      `Render these exactly, character for character.\n\n${scene.copy.items.length ? scene.copy.items.map((c) => `- "${c}"`).join('\n') : EMPTY}`,
    ),
    sec2('Identity', [
      ['product', scene.identity.product],
      ['character', scene.identity.character],
      ['mustKeep', scene.identity.mustKeep.join(', ')],
    ]),
    sec2('End card', [
      ['holdSeconds', fmt(scene.endCard.holdSeconds)],
      ['elements', scene.endCard.elements.join(', ')],
    ]),
    sec2('Audio (recorded only)', [
      ['voiceOver', scene.audio.voiceOver ?? ''],
      ['soundDesign', scene.audio.soundDesign ?? ''],
      ['music', scene.audio.music ?? ''],
    ]),
    sec2('Constraints', [
      ['avoid', scene.constraints.avoid.join(', ')],
      ['noUnspecifiedElements', String(scene.constraints.noUnspecifiedElements)],
    ]),
  ];
}

function typeSections(scene: Scene): string[] {
  if (scene.type === 'static') {
    const steps = scene.steps.length
      ? scene.steps.map((s) => `- **${s.id}** ${s.title || EMPTY} — advance: \`${s.advance}\`, enter: ${s.enter || EMPTY}${s.copy ? `\n  - copy: ${s.copy}` : ''}`).join('\n')
      : scene.mode === 'scroll'
        ? '_(scroll mode: the page counts as one step)_'
        : EMPTY;
    return [
      sec2('Page', [
        ['mode', scene.mode],
        ['layout', scene.layout],
      ]),
      sec('Sections', list(scene.sections)),
      sec('Steps', steps),
      sec('Breakpoints', list(scene.breakpoints)),
      sec('Accessibility', list(scene.accessibility)),
    ];
  }
  const out = timedSections(scene);
  if (scene.type === '3d') {
    out.push(
      sec2('3D scene', [
        ['composition', scene.composition],
        ['materials', scene.materials.join(', ')],
        ['lighting', scene.lighting],
        ['cameraPath', scene.cameraPath],
        ['performanceBudget', scene.performanceBudget],
      ]),
    );
  }
  return out;
}

function body(scene: Scene, workspaceName: string): string {
  const b = scene.brief;
  const refs = scene.references.length
    ? scene.references.map((r) => `- **${r.id}** (${r.kind}) ${r.path ?? r.url ?? ''}${r.note ? ` — ${r.note}` : ''}${r.analysis ? ` · analysis: \`${r.analysis}\`` : ''}`).join('\n')
    : EMPTY;
  const parts = [
    `# ${scene.name} — Guide`,
    `Generated from \`scene.json\` for workspace "${workspaceName}". Read-only: change the scene in the app or in \`scene.json\`, not here.\n\nTemplate: ${scene.template} · Type: ${scene.type} · Status: ${scene.status}`,
    sec2('Brief', [
      ['subject', b.subject],
      ['goal', b.goal],
      ['audience', b.audience],
      ['message', b.message],
      ['language', b.language],
    ]),
    ...typeSections(scene),
    sec('References', refs),
    sec('User prompt', val(scene.userPrompt)),
    sec('Fields you may fill', agentWritableFields(scene.type).map((f) => `\`${f}\``).join(', ')),
  ];
  return `${parts.join('\n\n')}\n`;
}

export function renderGuideMd(scene: Scene, workspaceName: string): string {
  const text = body(scene, workspaceName);
  return `<!-- vanilla:generated scene-hash=${sceneHash(scene)} body-hash=${sha256(text)} -->\n${text}`;
}

export type GuideState =
  | 'missing' // 파일 없음
  | 'ok' // scene.json과 일치하고 손대지 않음
  | 'stale' // scene.json이 바뀌어 다시 렌더해야 함
  | 'edited' // GUIDE.md 본문을 손으로 고침(다음 렌더에서 덮어쓰이므로 경고)
  | 'unknown'; // 헤더를 읽을 수 없음

/** 디스크의 GUIDE.md와 현재 scene.json을 비교한다. 수동 편집이 있으면 stale보다 먼저 알린다. */
export function checkGuide(existing: string | null, scene: Scene): GuideState {
  if (existing === null) return 'missing';
  const text = normalizeEol(existing);
  const m = HEADER_RE.exec(text);
  if (!m) return 'unknown';
  if (sha256(text.slice(m[0].length)) !== m[2]) return 'edited';
  return m[1] === sceneHash(scene) ? 'ok' : 'stale';
}
