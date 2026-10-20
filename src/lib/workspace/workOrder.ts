import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import { readComments } from '@/lib/scene/comments';
import { listScenes } from '@/lib/scene/files';
import { readWorkspace } from './file';
import { projectPath, readOptionalFile } from './files';

// 작업 지시서(`WORK_ORDER.md` + `.vanilla/work-order.json`):
// 사용자가 바닐라 스튜디오 UI에서 변경한 시퀀스·신·파라미터·디자인 내역과
// 신별 미해결 코멘트(`scenes/<slug>/comments.json`)를 집계하여 에이전트에게 전달한다.

export const WORK_ORDER_JSON_REL = '.vanilla/work-order.json';
export const WORK_ORDER_MD_REL = 'WORK_ORDER.md';

export const workOrderScopeSchema = z.enum(['workspace', 'sequence', 'scene', 'params', 'design']);
export type WorkOrderScope = z.infer<typeof workOrderScopeSchema>;

export const rootCauseLayerSchema = z.enum(['auto', 'brief', 'design-flow', 'visual-direction', 'materials', 'scene-polish']);
export type RootCauseLayer = z.infer<typeof rootCauseLayerSchema>;

export const workOrderChangeSchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  scope: workOrderScopeSchema,
  targetId: z.string().min(1),
  targetName: z.string().optional(),
  summary: z.string().min(1),
  fields: z.array(z.string()).optional(),
  details: z.string().optional(),
  /** 원인 계층: 화면 코드를 고치기 전 먼저 갱신해야 할 상위 문서. */
  layer: rootCauseLayerSchema.default('auto'),
  taxonomyTags: z.array(z.string()).default([]),
  status: z.enum(['open', 'done']).default('open'),
});
export type WorkOrderChange = z.infer<typeof workOrderChangeSchema>;

export const workOrderFileSchema = z.object({
  version: z.literal(1),
  workspaceId: z.string().min(1),
  updatedAt: z.string(),
  changes: z.array(workOrderChangeSchema).default([]),
});
export type WorkOrderFile = z.infer<typeof workOrderFileSchema>;

export interface WorkOrderCommentEntry {
  id: string;
  slug: string;
  sceneId: string;
  sceneName: string;
  createdAt: string;
  body: string;
  status: 'open' | 'done';
  layer?: RootCauseLayer;
  taxonomyTags?: string[];
}

/** 원인 계층별 역추적 실행 절차 (Root-Cause Backtracking Checklist). */
export function backtrackSteps(layer: RootCauseLayer): string[] {
  switch (layer) {
    case 'brief':
      return ['`storyboard/01-brief.md` 먼저 갱신', '`storyboard/02-design-flow.md` → `data/` → `scenes/` 순으로 재조립'];
    case 'design-flow':
      return ['`storyboard/02-design-flow.md` (`assemblyPlan`) 먼저 갱신', '`sequence.json` / `scene.json` → `scenes/` 순으로 재조립'];
    case 'visual-direction':
      return ['`storyboard/03-visual-direction.md` + `DESIGN.md` 먼저 갱신', '`scene.json` (`visualStyle`/`motionVocabulary`) → `scenes/` 순으로 재조립'];
    case 'materials':
      return ['`storyboard/data/content.json` 또는 `items.json` 먼저 갱신 (컴포넌트 코드는 건드리지 않기)', '`scene.json` `copy` 동기화 → `pnpm vanilla sync-guides`'];
    case 'scene-polish':
      return ['`scenes/<slug>/params/*.values.json` 또는 `scenes/<slug>/src/` 미세 조정', '`pnpm check:scene` 검증'];
    default:
      return ['원인 계층을 먼저 판단 (`brief` → `design-flow` → `visual-direction` → `materials` → `scene-polish`)', '상위 문서·데이터부터 갱신 후 하위 코드 재조립'];
  }
}

export function emptyWorkOrder(workspaceId: string, updatedAt = ''): WorkOrderFile {
  return {
    version: 1,
    workspaceId,
    updatedAt,
    changes: [],
  };
}

function genChangeId(now: string): string {
  return `chg_${now.replace(/[^0-9]/g, '').slice(-12)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export type NewWorkOrderChangeInput = {
  scope: WorkOrderScope;
  targetId: string;
  targetName?: string;
  summary: string;
  fields?: string[];
  details?: string;
  layer?: RootCauseLayer;
  taxonomyTags?: string[];
};

/**
 * 새 변경 내역을 추가한다.
 * 같은 대상(`scope` + `targetId`)에 대해 직전 `open` 항목이 있으면 필드를 병합해 연속 자동저장이 중복 항목을 만들지 않게 한다.
 */
export function appendWorkOrderChange(
  file: WorkOrderFile,
  input: NewWorkOrderChangeInput,
  now: string,
  id?: string,
): WorkOrderFile {
  const changes = [...file.changes];
  const lastIdx = changes.length - 1;
  const last = lastIdx >= 0 ? changes[lastIdx] : null;

  if (last && last.status === 'open' && last.scope === input.scope && last.targetId === input.targetId && !id) {
    const mergedFields = Array.from(new Set([...(last.fields ?? []), ...(input.fields ?? [])]));
    const mergedTaxonomy = Array.from(new Set([...(last.taxonomyTags ?? []), ...(input.taxonomyTags ?? [])]));
    changes[lastIdx] = {
      ...last,
      at: now,
      targetName: input.targetName ?? last.targetName,
      summary: input.summary,
      ...(mergedFields.length > 0 ? { fields: mergedFields } : {}),
      ...(input.details !== undefined ? { details: input.details } : {}),
      layer: input.layer ?? last.layer ?? 'auto',
      taxonomyTags: mergedTaxonomy,
    };
    return {
      ...file,
      updatedAt: now,
      changes,
    };
  }

  const entry: WorkOrderChange = {
    id: id ?? genChangeId(now),
    at: now,
    scope: input.scope,
    targetId: input.targetId,
    ...(input.targetName ? { targetName: input.targetName } : {}),
    summary: input.summary,
    ...(input.fields && input.fields.length > 0 ? { fields: [...new Set(input.fields)] } : {}),
    ...(input.details ? { details: input.details } : {}),
    layer: input.layer ?? 'auto',
    taxonomyTags: input.taxonomyTags ? [...new Set(input.taxonomyTags)] : [],
    status: 'open',
  };
  return {
    ...file,
    updatedAt: now,
    changes: [...changes, entry],
  };
}

export function resolveWorkOrderChange(file: WorkOrderFile, targetIdOrAll: string, now: string): WorkOrderFile {
  let touched = false;
  const changes = file.changes.map((c) => {
    if ((targetIdOrAll === '--all' || c.id === targetIdOrAll) && c.status === 'open') {
      touched = true;
      return { ...c, status: 'done' as const };
    }
    return c;
  });
  return touched ? { ...file, updatedAt: now, changes } : file;
}

export function renderWorkOrderMarkdown(
  workspace: { id: string; name: string },
  file: WorkOrderFile,
  comments: WorkOrderCommentEntry[],
): string {
  const openComments = comments.filter((c) => c.status === 'open');
  const openChanges = file.changes.filter((c) => c.status === 'open');
  const statusLine =
    openComments.length === 0 && openChanges.length === 0
      ? 'Clean (No pending changes or open comments)'
      : `${openComments.length} open comment(s), ${openChanges.length} pending studio change(s)`;

  const commentLines =
    openComments.length === 0
      ? '_(현재 등록된 미해결 코멘트가 없습니다.)_'
      : openComments
          .map((c) => {
            const layer = c.layer ?? 'auto';
            const tags = c.taxonomyTags?.length ? ` (택소노미: \`${c.taxonomyTags.join('`, `')}\`)` : '';
            const steps = backtrackSteps(layer)
              .map((s, i) => `    ${i + 1}. [ ] ${s}`)
              .join('\n');
            return (
              `- **[${c.id}]** \`scenes/${c.slug}\` (${c.sceneName}) · ${c.createdAt} [${layer}]${tags}\n` +
              `  - 요청 내용: ${c.body}\n` +
              `  - 역추적 실행 절차:\n${steps}\n` +
              `  - 완료 명령: \`pnpm vanilla resolve ${c.id}\``
            );
          })
          .join('\n');

  const changeLines =
    openChanges.length === 0
      ? '_(현재 기록된 미확인 변경 내역이 없습니다.)_'
      : openChanges
          .map((ch) => {
            const layer = ch.layer ?? 'auto';
            const tags = ch.taxonomyTags?.length ? ` (택소노미: \`${ch.taxonomyTags.join('`, `')}\`)` : '';
            const steps = backtrackSteps(layer)
              .map((s, i) => `    ${i + 1}. [ ] ${s}`)
              .join('\n');
            return (
              `- **[${ch.id}]** [${ch.scope}] \`${ch.targetName || ch.targetId}\` · ${ch.at} [${layer}]${tags}\n` +
              `  - 변경 요약: ${ch.summary}${ch.fields?.length ? ` (필드: \`${ch.fields.join('`, `')}\`)` : ''}${ch.details ? `\n  - 세부 내용: ${ch.details}` : ''}\n` +
              `  - 역추적 실행 절차:\n${steps}\n` +
              `  - 확인 완료 명령: \`pnpm vanilla resolve ${ch.id}\``
            );
          })
          .join('\n');

  return `# WORK_ORDER.md — ${workspace.name} 작업 지시서

- Workspace: **${workspace.name}** (\`${workspace.id}\`)
- Status: ${statusLine}
- Last Updated: ${file.updatedAt || 'Initialized'}

> 이 파일은 사용자가 **Vanilla Studio**에서 변경한 시퀀스·신·파라미터·디자인 내역과 신별 코멘트(\`scenes/<slug>/comments.json\`)를 에이전트가 한눈에 읽고 반영할 수 있도록 기록하는 **통합 작업 지시서**입니다.
> - 상세 구조화 데이터: \`.vanilla/work-order.json\` 및 \`scenes/<slug>/comments.json\`
> - CLI 조회: \`pnpm vanilla work-order\`
> - 반영 완료 처리: \`pnpm vanilla resolve <id>\` (또는 전체 완료 시 \`pnpm vanilla resolve --all\`)

## 1. 미해결 사용자 코멘트 (Open Comments)

${commentLines}

## 2. 바닐라 스튜디오 UI 변경 내역 (Pending Studio Changes)

${changeLines}

## 3. 에이전트 초기 작업 안내

아직 시퀀스(\`sequence.json\`)나 신(\`scenes/\`)이 생성되지 않았다면 다음 순서로 작업을 시작하세요:
1. 사용자의 요청 의도를 바탕으로 \`pnpm vanilla templates\`를 실행하여 어울리는 **매체 의도(\`web\`/\`image\`/\`slide\`/\`motion\`)·템플릿·기법·컬러 팔레트·파라미터**를 사용자와 인터뷰하여 구체화합니다.
2. 작업 규모가 크거나 다중 신인 경우, 먼저 \`pnpm vanilla scaffold-scene <slug> --name "<이름>" --type <static|motion|3d> --template <id@ver>\`로 **러프한 Draft 신과 시퀀스**를 생성해 사용자가 Vanilla Studio에서 흐름을 확인하게 합니다.
3. 사용자가 Vanilla Studio에서 확인 후 남긴 코멘트와 수정 내역이 이 파일(\`WORK_ORDER.md\`)에 기록되면 세부 연출과 코드를 다듬어 나갑니다.
`;
}

export function parseWorkOrder(text: string, fallbackWorkspaceId: string): WorkOrderFile {
  try {
    const raw = JSON.parse(text) as unknown;
    return workOrderFileSchema.parse(raw);
  } catch {
    return emptyWorkOrder(fallbackWorkspaceId);
  }
}

export function serializeWorkOrder(file: WorkOrderFile): string {
  return `${JSON.stringify(workOrderFileSchema.parse(file), null, 2)}\n`;
}

export async function readWorkOrder(root: string, workspaceId: string): Promise<WorkOrderFile> {
  const text = await readOptionalFile(root, WORK_ORDER_JSON_REL);
  if (text === null) return emptyWorkOrder(workspaceId);
  return parseWorkOrder(text, workspaceId);
}

export async function collectWorkspaceComments(root: string): Promise<WorkOrderCommentEntry[]> {
  const entries = await listScenes(root);
  const out: WorkOrderCommentEntry[] = [];
  for (const e of entries) {
    const sceneId = e.scene?.id ?? e.slug;
    const sceneName = e.scene?.name ?? e.slug;
    try {
      const file = await readComments(root, e.slug, sceneId);
      for (const c of file.comments) {
        out.push({
          id: c.id,
          slug: e.slug,
          sceneId,
          sceneName,
          createdAt: c.createdAt,
          body: c.body,
          status: c.status,
          layer: c.layer,
          taxonomyTags: c.taxonomyTags,
        });
      }
    } catch {
      // ignore unreadable comment file
    }
  }
  return out;
}

export async function syncWorkOrderFiles(root: string, nextFile?: WorkOrderFile): Promise<void> {
  try {
    const ws = await readWorkspace(root);
    const wo = nextFile ?? (await readWorkOrder(root, ws.workspaceId));
    const comments = await collectWorkspaceComments(root);
    const md = renderWorkOrderMarkdown({ id: ws.workspaceId, name: ws.name }, wo, comments);
    await invoke('write_text_file', {
      path: projectPath(root, WORK_ORDER_JSON_REL),
      contents: serializeWorkOrder(wo),
      workspaceRoot: root,
    });
    await invoke('write_text_file', {
      path: projectPath(root, WORK_ORDER_MD_REL),
      contents: md,
      workspaceRoot: root,
    });
  } catch {
    // 작업 지시서 동기화 실패가 주 UI 동작을 막지 않도록 한다.
  }
}

export async function recordStudioChange(
  root: string,
  input: NewWorkOrderChangeInput,
  now: string = new Date().toISOString(),
): Promise<void> {
  try {
    const ws = await readWorkspace(root);
    const current = await readWorkOrder(root, ws.workspaceId);
    const next = appendWorkOrderChange(current, input, now);
    await syncWorkOrderFiles(root, next);
  } catch {
    // ignore in non-workspace or test mocks without read_text_file
  }
}
