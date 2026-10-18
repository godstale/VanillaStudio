import { invoke } from '@tauri-apps/api/core';
import { z } from 'zod';
import { projectPath, readOptionalFile } from '@/lib/workspace/files';

// 신 코멘트(`scenes/<slug>/comments.json`): 사용자가 에이전트에게 바라는 수정 사항을
// 시간·처리 내역과 함께 남기는 파일. 에이전트가 폴더를 읽으면 인식할 수 있다.
// 바이트 정규화: 키 순서 고정(스키마 정의 순), 2-space, LF.

export const commentActionSchema = z.enum(['created', 'edited', 'done', 'reopened']);
export type CommentAction = z.infer<typeof commentActionSchema>;

export const commentHistorySchema = z.object({
  at: z.string().min(1),
  action: commentActionSchema,
});
export type CommentHistory = z.infer<typeof commentHistorySchema>;

export const rootCauseLayerSchema = z.enum(['auto', 'brief', 'design-flow', 'visual-direction', 'materials', 'scene-polish']);
export type RootCauseLayer = z.infer<typeof rootCauseLayerSchema>;

export const sceneCommentSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  body: z.string().min(1),
  status: z.enum(['open', 'done']).default('open'),
  /** 원인 계층: 화면 코드를 고치기 전 먼저 갱신해야 할 상위 문서. 미지정(auto)은 에이전트가 판단. */
  layer: rootCauseLayerSchema.default('auto'),
  /** 원하는 디자인 텍소노미 패턴 ID (예: shared-layout-transition). */
  taxonomyTags: z.array(z.string()).default([]),
  history: z.array(commentHistorySchema).default([]),
});
export type SceneComment = z.infer<typeof sceneCommentSchema>;

export const commentsFileSchema = z.object({
  version: z.literal(1),
  sceneId: z.string().min(1),
  comments: z.array(sceneCommentSchema).default([]),
});
export type CommentsFile = z.infer<typeof commentsFileSchema>;

export const COMMENTS_REL = (slug: string): string => `scenes/${slug}/comments.json`;

export function emptyCommentsFile(sceneId: string): CommentsFile {
  return { version: 1, sceneId, comments: [] };
}

function genId(now: string): string {
  return `cmt_${now.replace(/[^0-9]/g, '').slice(-12)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function addComment(
  file: CommentsFile,
  body: string,
  now: string,
  id?: string,
  opts?: { layer?: RootCauseLayer; taxonomyTags?: string[] },
): CommentsFile {
  const trimmed = body.trim();
  if (!trimmed) return file;
  const at = now;
  const comment: SceneComment = {
    id: id ?? genId(now),
    createdAt: at,
    body: trimmed,
    status: 'open',
    layer: opts?.layer ?? 'auto',
    taxonomyTags: opts?.taxonomyTags ?? [],
    history: [{ at, action: 'created' }],
  };
  return { ...file, comments: [...file.comments, comment] };
}

export function editCommentBody(file: CommentsFile, id: string, body: string, now: string): CommentsFile {
  const trimmed = body.trim();
  if (!trimmed) return file;
  let touched = false;
  const comments = file.comments.map((c) => {
    if (c.id !== id || c.body === trimmed) return c;
    touched = true;
    return { ...c, body: trimmed, history: [...c.history, { at: now, action: 'edited' as const }] };
  });
  return touched ? { ...file, comments } : file;
}

export function setCommentStatus(file: CommentsFile, id: string, status: 'open' | 'done', now: string): CommentsFile {
  let touched = false;
  const comments = file.comments.map((c) => {
    if (c.id !== id || c.status === status) return c;
    touched = true;
    return { ...c, status, history: [...c.history, { at: now, action: status === 'done' ? ('done' as const) : ('reopened' as const) }] };
  });
  return touched ? { ...file, comments } : file;
}

export function removeComment(file: CommentsFile, id: string): CommentsFile {
  const comments = file.comments.filter((c) => c.id !== id);
  return comments.length === file.comments.length ? file : { ...file, comments };
}

export function openCommentCount(file: CommentsFile): number {
  return file.comments.filter((c) => c.status === 'open').length;
}

export function parseComments(text: string): CommentsFile {
  return commentsFileSchema.parse(JSON.parse(text) as unknown);
}

export function serializeComments(file: CommentsFile): string {
  return `${JSON.stringify(commentsFileSchema.parse(file), null, 2)}\n`;
}

/** 없으면 빈 코멘트 파일(쓰지는 않는다). 깨져 있으면 던진다(빈 값으로 오해해 덮어쓰지 않도록). */
export async function readComments(root: string, slug: string, sceneId: string): Promise<CommentsFile> {
  const text = await readOptionalFile(root, COMMENTS_REL(slug));
  if (text === null) return emptyCommentsFile(sceneId);
  return parseComments(text);
}

export async function writeComments(root: string, slug: string, file: CommentsFile): Promise<void> {
  await invoke('write_text_file', { path: projectPath(root, COMMENTS_REL(slug)), contents: serializeComments(file), workspaceRoot: root });
}
