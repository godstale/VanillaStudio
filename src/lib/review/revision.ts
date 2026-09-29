// Revision requests (T4.18, F-REV-04): target + time + comment + screenshot
// capture → `reviews/R-NNN.md`, then an agent request built on the real
// merged APIs: `assemblePrompt({ kind: 'revision' })` (T3.3) for the prompt and
// the T3.14 runner contract for sending (send → `stopReason` check →
// checkpoint → `task_runs`-style status).
import { invoke } from '@tauri-apps/api/core';
import { assemblePrompt } from '@/lib/pipeline/assemble';
import { projectPath } from '@/lib/pipeline/briefFiles';
import { readOptionalFile } from '@/lib/pipeline/planFiles';
import type { StopReason } from '@/lib/agents/types';
import type { Locale } from '@/lib/i18n/types';

export const REVIEWS_DIR = 'reviews';

export const REVISION_STATUSES = ['open', 'sent', 'applied', 'closed'] as const;
export type RevisionStatus = (typeof REVISION_STATUSES)[number];

export interface RevisionRequest {
  id: string;
  target: string;
  /** Scene-local time in seconds; null when the comment is not time-bound. */
  t: number | null;
  comment: string;
  /** Screenshot sidecar file name (e.g. `R-001.png.b64`), or null. */
  screenshot: string | null;
  status: RevisionStatus;
  createdAt: string;
}

export interface CreateRevisionInput {
  /** Scene id the comment is about (e.g. `s1-intro`). */
  target: string;
  t: number | null;
  comment: string;
  /** `data:image/png;base64,…` from the Bridge `capture()`; omit for no shot. */
  captureDataUrl?: string;
}

export function revisionDocRel(id: string): string {
  return `${REVIEWS_DIR}/${id}.md`;
}

/** Base64 sidecar: the WebView cannot write binary files, and no Tauri binary
 * write command exists, so the PNG bytes travel as base64 text. The MCP
 * `snapshot_scene` tool (T4.20) decodes the same file back to a data URL. */
export function revisionShotRel(id: string): string {
  return `${REVIEWS_DIR}/${id}.png.b64`;
}

export function isRevisionId(id: string): boolean {
  return /^R-\d{3}$/.test(id);
}

function isStatus(value: string): value is RevisionStatus {
  return (REVISION_STATUSES as readonly string[]).includes(value);
}

function frontValue(front: string[], key: string): string | null {
  for (const line of front) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    if (line.slice(0, i).trim() === key) {
      const v = line.slice(i + 1).trim().replace(/^"|"$/g, '').trim();
      if (v !== '') return v;
    }
  }
  return null;
}

/** Parse an R-NNN.md file. `null` for anything malformed (mirrors the Rust
 * `get_review` parser; both stay line-based so they cannot drift). */
export function parseRevisionDoc(text: string): RevisionRequest | null {
  const lines = text.split('\n');
  if (lines[0]?.trim() !== '---') return null;
  const front: string[] = [];
  let i = 1;
  for (; i < lines.length; i++) {
    if (lines[i].trim() === '---') break;
    front.push(lines[i]);
  }
  if (i >= lines.length) return null;
  const body = lines.slice(i + 1).join('\n').trim();
  const id = frontValue(front, 'id');
  const target = frontValue(front, 'target');
  if (!id || !isRevisionId(id) || !target) return null;
  const tRaw = frontValue(front, 't');
  const t = tRaw === null ? null : Number(tRaw);
  if (tRaw !== null && !(typeof t === 'number' && Number.isFinite(t) && t >= 0)) return null;
  const statusRaw = frontValue(front, 'status') ?? 'open';
  if (!isStatus(statusRaw)) return null;
  const comment = body;
  if (!comment) return null;
  return {
    id,
    target,
    t,
    comment,
    screenshot: frontValue(front, 'screenshot'),
    status: statusRaw,
    createdAt: frontValue(front, 'createdAt') ?? '',
  };
}

export function formatRevisionDoc(rev: RevisionRequest): string {
  const head = [
    '---',
    `id: ${rev.id}`,
    `target: ${rev.target}`,
    ...(rev.t === null ? [] : [`t: ${rev.t}`]),
    `status: ${rev.status}`,
    ...(rev.createdAt ? [`createdAt: ${rev.createdAt}`] : []),
    ...(rev.screenshot ? [`screenshot: ${rev.screenshot}`] : []),
    '---',
    '',
  ];
  return `${head.join('\n')}${rev.comment.trim()}\n`;
}

function checkInput(input: CreateRevisionInput): { target: string; t: number | null; comment: string } {
  const target = input.target.trim();
  if (!target || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(target)) {
    throw new Error(`Revision target must be a scene id, got ${JSON.stringify(input.target)}`);
  }
  const comment = input.comment.trim();
  if (!comment) throw new Error('Revision comment is empty');
  if (comment.length > 2000) throw new Error('Revision comment is too long (max 2000 chars)');
  const t = input.t;
  if (t !== null && !(typeof t === 'number' && Number.isFinite(t) && t >= 0)) {
    throw new Error(`Revision time must be a non-negative second, got ${String(t)}`);
  }
  if (input.captureDataUrl !== undefined && !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(input.captureDataUrl)) {
    throw new Error('Screenshot must be a PNG data URL from the Bridge capture()');
  }
  return { target, t, comment };
}

/** Next free id (`R-001`, `R-002`, …) from the files already in `reviews/`. */
export async function nextRevisionId(root: string): Promise<string> {
  let max = 0;
  try {
    const entries = await invoke<{ name: string; is_dir: boolean }[]>('list_dir', {
      path: projectPath(root, REVIEWS_DIR),
      workspaceRoot: root,
    });
    for (const e of entries) {
      const m = !e.is_dir && /^R-(\d{3})\.md$/.exec(e.name);
      if (m) max = Math.max(max, Number(m[1]));
    }
  } catch {
    // reviews/ does not exist yet: start at R-001.
  }
  return `R-${String(max + 1).padStart(3, '0')}`;
}

export async function listRevisions(root: string): Promise<RevisionRequest[]> {
  const first = await nextRevisionId(root);
  const count = Number(first.slice(2)) - 1;
  const out: RevisionRequest[] = [];
  for (let n = 1; n <= count; n++) {
    const id = `R-${String(n).padStart(3, '0')}`;
    const text = await readOptionalFile(root, revisionDocRel(id));
    if (text === null) continue;
    const rev = parseRevisionDoc(text);
    if (rev) out.push(rev);
  }
  return out;
}

export async function readRevision(root: string, id: string): Promise<RevisionRequest | null> {
  if (!isRevisionId(id)) return null;
  const text = await readOptionalFile(root, revisionDocRel(id));
  return text === null ? null : parseRevisionDoc(text);
}

/** Write `reviews/R-NNN.md` (+ `.png.b64` sidecar when a capture is given). */
export async function createRevision(
  root: string,
  input: CreateRevisionInput,
  now: () => string = () => new Date().toISOString(),
): Promise<RevisionRequest> {
  const { target, t, comment } = checkInput(input);
  const id = await nextRevisionId(root);
  let screenshot: string | null = null;
  if (input.captureDataUrl !== undefined) {
    const b64 = input.captureDataUrl.slice('data:image/png;base64,'.length);
    const shotRel = revisionShotRel(id);
    await invoke('write_text_file', { path: projectPath(root, shotRel), contents: b64, workspaceRoot: root });
    screenshot = `${id}.png.b64`;
  }
  const rev: RevisionRequest = { id, target, t, comment, screenshot, status: 'open', createdAt: now() };
  await invoke('write_text_file', {
    path: projectPath(root, revisionDocRel(id)),
    contents: formatRevisionDoc(rev),
    workspaceRoot: root,
  });
  return rev;
}

export async function setRevisionStatus(root: string, id: string, status: RevisionStatus): Promise<RevisionRequest | null> {
  const rev = await readRevision(root, id);
  if (!rev) return null;
  const next = { ...rev, status };
  await invoke('write_text_file', {
    path: projectPath(root, revisionDocRel(id)),
    contents: formatRevisionDoc(next),
    workspaceRoot: root,
  });
  return next;
}

/** Screenshot sidecar as a data URL for `<img>`; null when there is no shot. */
export async function loadRevisionScreenshot(root: string, rev: RevisionRequest): Promise<string | null> {
  if (!rev.screenshot) return null;
  const b64 = await readOptionalFile(root, `${REVIEWS_DIR}/${rev.screenshot}`);
  if (!b64 || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) return null;
  return `data:image/png;base64,${b64.replace(/\s/g, '')}`;
}

/** Revision prompt: preamble + file-path reference, never a pasted body (설계서 §3.4). */
export function buildRevisionPrompt(reviewFile: string, userInput?: string, locale: Locale = 'ko'): string {
  return assemblePrompt({ kind: 'revision', locale, reviewFile, userInput });
}

export interface RevisionFixDeps {
  /**
   * Task prompt transport. Pass the agent session's sendPrompt as
   * `(text) => sendPrompt(text, sessionId)` — the same shape as the T3.14
   * `RunnerDeps.send`. The outcome is judged by `stopReason`, like `runSingleTask`.
   */
  send: (prompt: string) => Promise<StopReason>;
  /** Per-task checkpoint after a good turn (T3.14 `RunnerDeps.checkpoint`). */
  checkpoint: (message: string) => Promise<string | null>;
  locale?: Locale;
}

export interface RevisionFixOutcome {
  stopReason: StopReason;
  /** Checkpoint id after an applied fix; null when the turn failed. */
  commit: string | null;
  applied: boolean;
}

/**
 * Send one revision to the agent: assemble → send → judge `stopReason` →
 * checkpoint → mark applied. Only `end_turn` applies; `cancelled` stops
 * without a checkpoint, anything else leaves the request `sent` for retry.
 */
export async function requestRevisionFix(
  root: string,
  rev: RevisionRequest,
  deps: RevisionFixDeps,
): Promise<RevisionFixOutcome> {
  await setRevisionStatus(root, rev.id, 'sent');
  const prompt = buildRevisionPrompt(revisionDocRel(rev.id), rev.comment, deps.locale ?? 'ko');
  const stopReason = await deps.send(prompt);
  if (stopReason !== 'end_turn') {
    return { stopReason, commit: null, applied: false };
  }
  const commit = await deps.checkpoint(`revise ${rev.id}: ${rev.target}`);
  await setRevisionStatus(root, rev.id, 'applied');
  return { stopReason, commit, applied: true };
}
