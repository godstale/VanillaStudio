import { z } from 'zod';
import { AGENT_IDS, type AgentId } from '@/lib/types/project';
import type { SqlDatabase } from '@/lib/db/client';

/** Adapter package pinned for the built-in Claude Code entry (PoC S3 verified). Install path is `{appData}/adapters/claude-agent-acp@<version>`. */
export const CLAUDE_ADAPTER_PACKAGE = '@agentclientprotocol/claude-agent-acp';
export const CLAUDE_ADAPTER_VERSION = '0.83.0';

/** Replaced by the Rust agent host with the app data directory. Keeps the DB row machine-independent. */
export const APP_DATA_TOKEN = '{appData}';

export type AgentMode = 'acp' | 'terminal';
export type SupportTier = 'official' | 'experimental';

export const agentEntrySchema = z
  .object({
    id: z.enum(AGENT_IDS),
    name: z.string().trim().min(1).max(100),
    mode: z.enum(['acp', 'terminal']),
    command: z.string().trim().min(1).max(500),
    args: z.array(z.string().max(1000)).max(50),
    env: z.record(z.string().max(2000)),
    /** Extra `_meta` merged into `session/new` (adapter specific). The host still enforces D-018. */
    sessionOptions: z.record(z.unknown()),
    supportTier: z.enum(['official', 'experimental']),
    enabled: z.boolean(),
    isDefault: z.boolean(),
  })
  .strict();

export type AgentEntry = z.infer<typeof agentEntrySchema>;

/** D-018 isolation for Claude Code. Rust re-applies the shell ask rule regardless of what is stored. */
export const CLAUDE_SESSION_OPTIONS: Record<string, unknown> = {
  claudeCode: {
    options: {
      settingSources: ['project'],
      settings: { permissions: { ask: ['Bash', 'PowerShell'] } },
    },
  },
};

export const BUILTIN_AGENTS: readonly AgentEntry[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    mode: 'acp',
    command: 'node',
    args: [`${APP_DATA_TOKEN}/adapters/claude-agent-acp@${CLAUDE_ADAPTER_VERSION}/node_modules/${CLAUDE_ADAPTER_PACKAGE}/dist/index.js`],
    env: {},
    sessionOptions: CLAUDE_SESSION_OPTIONS,
    supportTier: 'official',
    enabled: true,
    isDefault: true,
  },
  {
    id: 'codex',
    name: 'Codex',
    mode: 'acp',
    command: 'node',
    args: [`${APP_DATA_TOKEN}/adapters/codex-acp/node_modules/@agentclientprotocol/codex-acp/dist/index.js`],
    env: {},
    sessionOptions: {},
    supportTier: 'official',
    enabled: true,
    isDefault: false,
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    mode: 'acp',
    command: 'opencode',
    args: ['acp'],
    env: {},
    sessionOptions: {},
    supportTier: 'experimental',
    enabled: true,
    isDefault: false,
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    mode: 'acp',
    command: 'hermes',
    args: ['acp'],
    env: {},
    sessionOptions: {},
    supportTier: 'experimental',
    enabled: true,
    isDefault: false,
  },
  {
    id: 'agy',
    name: 'Antigravity CLI',
    mode: 'terminal',
    command: 'agy',
    args: [],
    env: {},
    sessionOptions: {},
    supportTier: 'experimental',
    enabled: true,
    isDefault: false,
  },
];

export const DEFAULT_AGENT_ID: AgentId = 'claude-code';

/** Row shape of the global DB `agents` table (migration 0002). */
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

function parseJson(text: string, fallback: unknown): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

/**
 * Apply a DB row over the built-in entry with the same id. `mode` is not stored (no column): it
 * always comes from the built-in. A row that fails validation is ignored so a bad edit cannot
 * brick the registry.
 */
export function applyRow(base: AgentEntry, row: AgentRow): AgentEntry {
  const merged = agentEntrySchema.safeParse({
    ...base,
    name: row.name,
    command: row.command,
    args: parseJson(row.args, base.args),
    env: parseJson(row.env, base.env),
    sessionOptions: parseJson(row.session_options, base.sessionOptions),
    supportTier: row.support_tier,
    enabled: row.enabled === 1,
    isDefault: row.is_default === 1,
  });
  return merged.success ? merged.data : base;
}

/** Built-ins first, overridden by rows. Exactly one entry is the default (falls back to Claude Code, then the first enabled). */
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
  const rows = await db.select<AgentRow[]>(
    'SELECT id, name, command, args, env, session_options, support_tier, enabled, is_default FROM agents',
  );
  return mergeRegistry(rows);
}

/** Persist one entry (upsert). Validates first; `mode` and `id` must match the built-in. */
export async function saveAgent(db: SqlDatabase, entry: AgentEntry): Promise<void> {
  const valid = agentEntrySchema.parse(entry);
  const builtin = BUILTIN_AGENTS.find((b) => b.id === valid.id);
  if (!builtin || builtin.mode !== valid.mode) throw new Error(`unknown agent or mode mismatch: ${valid.id}`);
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO agents (id, name, command, args, env, session_options, support_tier, enabled, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, command = excluded.command, args = excluded.args,
       env = excluded.env, session_options = excluded.session_options, support_tier = excluded.support_tier,
       enabled = excluded.enabled, is_default = excluded.is_default, updated_at = excluded.updated_at`,
    [
      valid.id,
      valid.name,
      valid.command,
      JSON.stringify(valid.args),
      JSON.stringify(valid.env),
      JSON.stringify(valid.sessionOptions),
      valid.supportTier,
      valid.enabled ? 1 : 0,
      valid.isDefault ? 1 : 0,
      now,
      now,
    ],
  );
}

/** Make `id` the only default. The agent must be enabled. */
export async function setDefaultAgent(db: SqlDatabase, id: AgentId): Promise<void> {
  const agents = await loadAgents(db);
  const target = agents.find((a) => a.id === id);
  if (!target?.enabled) throw new Error(`cannot default to a disabled agent: ${id}`);
  for (const a of agents) {
    if (a.id !== id && a.isDefault) await saveAgent(db, { ...a, isDefault: false });
  }
  await saveAgent(db, { ...target, isDefault: true });
}
