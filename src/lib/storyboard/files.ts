import { invoke } from '@tauri-apps/api/core';
import { projectPath, readOptionalFile } from '@/lib/workspace/files';
import { parseStoryboard, serializeStoryboard, type StoryboardFile } from './schema';

// `storyboard/` 파일 계약 (Refactor Plan §3.2). 내용은 파일이 진실 공급원.

export const STORYBOARD_JSON_REL = 'storyboard/storyboard.json';
export const BRIEF_MD_REL = 'storyboard/01-brief.md';
export const DESIGN_FLOW_MD_REL = 'storyboard/02-design-flow.md';
export const VISUAL_MD_REL = 'storyboard/03-visual-direction.md';
export const CONTENT_JSON_REL = 'storyboard/data/content.json';
export const ITEMS_JSON_REL = 'storyboard/data/items.json';

export async function readStoryboard(root: string): Promise<{ file: StoryboardFile | null; raw: Record<string, string | null> }> {
  const rels = [STORYBOARD_JSON_REL, BRIEF_MD_REL, DESIGN_FLOW_MD_REL, VISUAL_MD_REL, CONTENT_JSON_REL, ITEMS_JSON_REL];
  const raw: Record<string, string | null> = {};
  for (const rel of rels) {
    raw[rel] = await readOptionalFile(root, rel);
  }
  if (raw[STORYBOARD_JSON_REL] === null) return { file: null, raw };
  try {
    return { file: parseStoryboard(raw[STORYBOARD_JSON_REL] as string), raw };
  } catch {
    throw new Error(`Cannot parse ${STORYBOARD_JSON_REL}`);
  }
}

export async function writeStoryboard(root: string, file: StoryboardFile): Promise<void> {
  await invoke('write_text_file', {
    path: projectPath(root, STORYBOARD_JSON_REL),
    contents: serializeStoryboard(file),
    workspaceRoot: root,
  });
}

export async function writeStoryboardDoc(root: string, rel: string, contents: string): Promise<void> {
  await invoke('write_text_file', { path: projectPath(root, rel), contents, workspaceRoot: root });
}

export function renderBriefMd(title: string, oneLiner: string, purpose: string, inScope: string[], nonGoals: string[]): string {
  const list = (items: string[]): string => (items.length > 0 ? items.map((i) => `- ${i}`).join('\n') : '_(없음)_');
  return `# 01 — 기획서 (Brief)\n\n## 타이틀\n\n${title.trim() || '_(비어 있음)_'}\n\n## 핵심 한 문장\n\n${oneLiner || '_(비어 있음)_'}\n\n## 목적\n\n${purpose || '_(비어 있음)_'}\n\n## 다룰 내용 (In-Scope)\n\n${list(inScope)}\n\n## 하지 않을 것 (Non-Goals)\n\n${list(nonGoals)}\n`;
}

/** 작업 지시서 저장 시 만드는 자리 표시자 문서. 에이전트 시작 감지가 이 값과의 차이로 판단한다. */
export const DESIGN_FLOW_PLACEHOLDER =
  '# 02 — 설계서 (Design Flow)\n\n## 서사·시퀀스 흐름\n\n\n## 데이터 규격\n\n- `storyboard/data/content.json`\n- `storyboard/data/items.json`\n';
export const VISUAL_PLACEHOLDER =
  '# 03 — 비주얼 디렉션 (Visual Direction)\n\n## 무드·빛·색온도\n\n\n## 공통 불변 키워드 (A)\n\n- \n\n## 개별 가변 속성 (B)\n\n- \n';
export const CONTENT_JSON_PLACEHOLDER = '{\n  "version": 1,\n  "hierarchy": []\n}\n';
export const ITEMS_JSON_PLACEHOLDER = '{\n  "version": 1,\n  "items": []\n}\n';

export function renderWorkOrderBriefMd(workspaceName: string, title: string, intent: string, oneLiner: string): string {
  return `# WORK_ORDER.md — ${workspaceName} 작업 지시서\n\n- 타이틀: ${title}\n- 매체 의도: ${intent}\n- 핵심 한 줄: ${oneLiner}\n\n에이전트 시작: \`pnpm vanilla init-storyboard\` 이후 3대 문서와 핵심 재료를 작성하세요.\n`;
}

/**
 * 에이전트가 작업을 시작했는가. 작업 지시서 저장 직후(`stage: briefing` + 자리 표시자 그대로)에는
 * false를 돌려 온보딩 화면을 유지하고, 에이전트가 단계·문서·재료를 갱신하기 시작하면 true가 된다.
 * 01-brief.md는 사용자 입력으로 채워지므로 비교 대상에서 뺀다.
 */
export function isAgentStarted(file: StoryboardFile | null, raw: Record<string, string | null>): boolean {
  if (!file) return false;
  if (file.stage !== 'empty' && file.stage !== 'briefing') return true;
  const flow = file.designFlow;
  if (flow.narrativeArc.trim() || flow.assemblyPlan.length > 0 || flow.dataSchemas.length > 0) return true;
  const visual = file.visualDirection;
  if (
    visual.moodKeywords.length > 0 ||
    visual.themeStages.length > 0 ||
    visual.invariants.length > 0 ||
    visual.variables.length > 0 ||
    visual.selectedTaxonomy.length > 0 ||
    (visual.paletteId ?? '') !== '' ||
    (visual.selectedTemplate ?? '') !== ''
  ) {
    return true;
  }
  if (raw[DESIGN_FLOW_MD_REL] != null && raw[DESIGN_FLOW_MD_REL] !== DESIGN_FLOW_PLACEHOLDER) return true;
  if (raw[VISUAL_MD_REL] != null && raw[VISUAL_MD_REL] !== VISUAL_PLACEHOLDER) return true;
  if (raw[CONTENT_JSON_REL] != null && raw[CONTENT_JSON_REL] !== CONTENT_JSON_PLACEHOLDER) return true;
  if (raw[ITEMS_JSON_REL] != null && raw[ITEMS_JSON_REL] !== ITEMS_JSON_PLACEHOLDER) return true;
  return false;
}
