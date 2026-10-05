import { z } from 'zod';
import { AGENT_IDS, type AgentId } from '@/lib/types/project';
import type { SqlDatabase } from '@/lib/db/client';

// 에이전트 레지스트리(D-022): 앱은 에이전트 CLI를 터미널(PTY)에서 **고정 argv**로 실행하고 프롬프트를 클립보드로 전달할 뿐이다.
// 에이전트별 차이(지침 파일 이름·설치 감지·붙여넣기 방식)는 이 레지스트리가 흡수한다.
// 편집 가능한 것은 argv의 **인자**뿐이다(실행 파일 이름은 내장값 고정). 편집은 설정 화면의 확인 다이얼로그를 거친다(D-012).

/** 에이전트가 읽는 지침 파일. 신 폴더에는 AGENTS.md와 CLAUDE.md(@AGENTS.md)가 모두 있다. */
export const INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md'] as const;
export type InstructionFile = (typeof INSTRUCTION_FILES)[number];

/**
 * 프롬프트를 터미널에 넣는 방식.
 * - `bracketed`: bracketed paste(ESC[200~ … ESC[201~)로 한 번에 붙여넣는다.
 * - `plain`: 그냥 입력 스트림으로 보낸다(bracketed paste를 못 알아듣는 CLI).
 * - `clipboard`: 자동 입력하지 않고 클립보드 복사만 한다.
 */
export const PASTE_MODES = ['bracketed', 'plain', 'clipboard'] as const;
export type PasteMode = (typeof PASTE_MODES)[number];

// argv 문자열: 셸이 없는 PTY 직접 실행이라 인용은 필요 없지만, 제어 문자·개행은 거부한다.
const argvPart = z
  .string()
  .min(1)
  .max(500)
  // eslint-disable-next-line no-control-regex
  .refine((s) => !/[\u0000-\u001f\u007f]/.test(s), 'argv must not contain control characters');

export const agentEntrySchema = z
  .object({
    id: z.enum(AGENT_IDS),
    label: z.string().trim().min(1).max(100),
    /** [실행 파일, ...인자]. 실행 파일은 내장값과 같아야 한다. */
    argv: z.array(argvPart).min(1).max(21),
    instructionFile: z.enum(INSTRUCTION_FILES),
    /** 설치 감지: 이 명령을 실행해 종료 코드 0이면 설치됨(Doctor가 사용). */
    detect: z.object({ command: z.string().min(1).max(100), args: z.array(z.string().max(100)).max(5) }).strict(),
    pasteMode: z.enum(PASTE_MODES),
    enabled: z.boolean(),
    isDefault: z.boolean(),
  })
  .strict();

export type AgentEntry = z.infer<typeof agentEntrySchema>;

export const BUILTIN_AGENTS: readonly AgentEntry[] = [
  { id: 'claude-code', label: 'Claude Code', argv: ['claude'], instructionFile: 'CLAUDE.md', detect: { command: 'claude', args: ['--version'] }, pasteMode: 'bracketed', enabled: true, isDefault: true },
  { id: 'codex', label: 'Codex', argv: ['codex'], instructionFile: 'AGENTS.md', detect: { command: 'codex', args: ['--version'] }, pasteMode: 'bracketed', enabled: true, isDefault: false },
  { id: 'opencode', label: 'OpenCode', argv: ['opencode'], instructionFile: 'AGENTS.md', detect: { command: 'opencode', args: ['--version'] }, pasteMode: 'bracketed', enabled: true, isDefault: false },
  { id: 'hermes', label: 'Hermes Agent', argv: ['hermes'], instructionFile: 'AGENTS.md', detect: { command: 'hermes', args: ['--version'] }, pasteMode: 'bracketed', enabled: true, isDefault: false },
  { id: 'agy', label: 'Antigravity CLI', argv: ['agy'], instructionFile: 'AGENTS.md', detect: { command: 'agy', args: ['--version'] }, pasteMode: 'plain', enabled: true, isDefault: false },
];

export const DEFAULT_AGENT_ID: AgentId = 'claude-code';

export const builtinAgent = (id: string): AgentEntry | undefined => BUILTIN_AGENTS.find((b) => b.id === id);

/** 전역 DB `agents` 테이블의 행(마이그레이션 0002). 쓰지 않는 열(env·session_options·support_tier)은 기본값으로 둔다. */
export interface AgentRow {
  id: string;
  name: string;
  command: string;
  args: string;
  env: string;
  session_options: string;
  support_tier: string;
  enabled: number;
  is_default: number;
}

function parseArgs(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * 내장 항목 위에 DB 행을 덮는다. 행에서 읽는 것은 인자(argv)·사용 여부·기본 여부뿐이고, 나머지(지침 파일·감지·붙여넣기 방식·표시 이름)는 항상 내장값이다.
 * 검증에 실패하거나 실행 파일이 바뀐 행은 무시해서, 잘못된 편집이 레지스트리를 망가뜨리지 못하게 한다.
 */
export function applyRow(base: AgentEntry, row: AgentRow): AgentEntry {
  const args = parseArgs(row.args);
  const merged = agentEntrySchema.safeParse({
    ...base,
    argv: Array.isArray(args) ? [row.command, ...args] : base.argv,
    enabled: row.enabled === 1,
    isDefault: row.is_default === 1,
  });
  if (!merged.success || merged.data.argv[0] !== base.argv[0]) return base;
  return merged.data;
}

/** 내장 목록을 행으로 덮어쓴 결과. 기본 에이전트는 정확히 하나다(없으면 Claude Code, 그다음 사용 가능한 첫 번째). */
export function mergeRegistry(rows: readonly AgentRow[]): AgentEntry[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const entries = BUILTIN_AGENTS.map((b) => {
    const row = byId.get(b.id);
    return row ? applyRow(b, row) : { ...b };
  });
  const stored = entries.find((e) => byId.get(e.id)?.is_default === 1 && e.enabled);
  const fallback = entries.find((e) => e.id === DEFAULT_AGENT_ID && e.enabled);
  const chosen = stored ?? fallback ?? entries.find((e) => e.enabled) ?? entries[0];
  return entries.map((e) => ({ ...e, isDefault: e.id === chosen.id }));
}

export async function loadAgents(db: SqlDatabase): Promise<AgentEntry[]> {
  const rows = await db.select<AgentRow[]>('SELECT id, name, command, args, env, session_options, support_tier, enabled, is_default FROM agents');
  return mergeRegistry(rows);
}

/**
 * 한 항목을 저장한다(upsert). 알 수 없는 id, 실행 파일 변경, 내장값을 벗어난 필드(지침 파일·감지·붙여넣기 방식·표시 이름)는 거부한다 —
 * 저장 가능한 것은 인자·사용 여부·기본 여부뿐이다.
 */
export async function saveAgent(db: SqlDatabase, entry: AgentEntry): Promise<void> {
  const valid = agentEntrySchema.parse(entry);
  const builtin = builtinAgent(valid.id);
  if (!builtin) throw new Error(`unknown agent: ${valid.id}`);
  if (valid.argv[0] !== builtin.argv[0]) throw new Error(`the executable of ${valid.id} cannot be changed`);
  for (const k of ['label', 'instructionFile', 'detect', 'pasteMode'] as const) {
    if (JSON.stringify(valid[k]) !== JSON.stringify(builtin[k])) throw new Error(`${k} of ${valid.id} cannot be edited`);
  }
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO agents (id, name, command, args, env, session_options, support_tier, enabled, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, '{}', '{}', 'experimental', ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, command = excluded.command, args = excluded.args,
       enabled = excluded.enabled, is_default = excluded.is_default, updated_at = excluded.updated_at`,
    [valid.id, valid.label, valid.argv[0], JSON.stringify(valid.argv.slice(1)), valid.enabled ? 1 : 0, valid.isDefault ? 1 : 0, now, now],
  );
}

/** `id`만 기본으로 만든다. 사용 가능한 에이전트여야 한다. */
export async function setDefaultAgent(db: SqlDatabase, id: AgentId): Promise<void> {
  const agents = await loadAgents(db);
  const target = agents.find((a) => a.id === id);
  if (!target?.enabled) throw new Error(`cannot default to a disabled agent: ${id}`);
  for (const a of agents) {
    if (a.id !== id && a.isDefault) await saveAgent(db, { ...a, isDefault: false });
  }
  await saveAgent(db, { ...target, isDefault: true });
}

/** Rust `pty_start`에 넘기는 추가 인자(argv[1..]). 실행 파일은 Rust가 에이전트 id로 정한다. */
export const extraArgs = (entry: AgentEntry): string[] => entry.argv.slice(1);
