// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { runMigrations, type SqlDatabase } from '@/lib/db/client';
import {
  BUILTIN_AGENTS,
  agentEntrySchema,
  extraArgs,
  loadAgents,
  mergeRegistry,
  saveAgent,
  setDefaultAgent,
  type AgentRow,
} from '@/lib/agents/registry';
import { AGENT_IDS } from '@/lib/types/project';

async function openDb(): Promise<SqlDatabase> {
  const raw = new DatabaseSync(':memory:');
  const db: SqlDatabase = {
    async execute(query, binds = []) {
      const r = raw.prepare(query).run(...(binds as SQLInputValue[]));
      return { rowsAffected: Number(r.changes) };
    },
    async select<T>(query: string, binds: unknown[] = []) {
      return raw.prepare(query).all(...(binds as SQLInputValue[])) as T;
    },
  };
  await runMigrations(db, 'global');
  return db;
}

const row = (over: Partial<AgentRow>): AgentRow => ({
  id: 'opencode',
  name: 'OpenCode',
  command: 'opencode',
  args: '[]',
  env: '{}',
  session_options: '{}',
  support_tier: 'experimental',
  enabled: 1,
  is_default: 0,
  ...over,
});

const find = (list: ReturnType<typeof mergeRegistry>, id: string) => list.find((a) => a.id === id)!;

describe('builtin agents', () => {
  it('cover every AgentId once and satisfy the schema', () => {
    expect(BUILTIN_AGENTS.map((a) => a.id).sort()).toEqual([...AGENT_IDS].sort());
    for (const a of BUILTIN_AGENTS) expect(agentEntrySchema.safeParse(a).success).toBe(true);
  });

  it('has exactly one default: Claude Code', () => {
    expect(BUILTIN_AGENTS.filter((a) => a.isDefault).map((a) => a.id)).toEqual(['claude-code']);
  });

  it('absorbs per-agent differences: instruction file, detection, paste mode', () => {
    expect(find([...BUILTIN_AGENTS], 'claude-code').instructionFile).toBe('CLAUDE.md');
    expect(find([...BUILTIN_AGENTS], 'codex').instructionFile).toBe('AGENTS.md');
    expect(find([...BUILTIN_AGENTS], 'agy').pasteMode).toBe('plain');
    for (const a of BUILTIN_AGENTS) {
      expect(a.detect.command).toBe(a.argv[0]);
      expect(a.argv).toHaveLength(1); // default argv has no extra arguments
    }
  });
});

describe('agentEntrySchema', () => {
  const base = BUILTIN_AGENTS[0];

  it('rejects unknown ids, extra keys, empty or control-character argv', () => {
    expect(agentEntrySchema.safeParse({ ...base, id: 'evil' }).success).toBe(false);
    expect(agentEntrySchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
    expect(agentEntrySchema.safeParse({ ...base, argv: [] }).success).toBe(false);
    expect(agentEntrySchema.safeParse({ ...base, argv: ['claude', ''] }).success).toBe(false);
    expect(agentEntrySchema.safeParse({ ...base, argv: ['claude', 'a\nb'] }).success).toBe(false);
    expect(agentEntrySchema.safeParse({ ...base, argv: ['claude', 'x\u0000'] }).success).toBe(false);
  });

  it('rejects the old ACP-style fields', () => {
    expect(agentEntrySchema.safeParse({ ...base, mode: 'acp' }).success).toBe(false);
    expect(agentEntrySchema.safeParse({ ...base, command: 'x' }).success).toBe(false);
    expect(agentEntrySchema.safeParse({ ...base, env: {} }).success).toBe(false);
  });

  it('limits paste modes and instruction files', () => {
    expect(agentEntrySchema.safeParse({ ...base, pasteMode: 'magic' }).success).toBe(false);
    expect(agentEntrySchema.safeParse({ ...base, instructionFile: 'EVIL.md' }).success).toBe(false);
  });
});

describe('mergeRegistry', () => {
  it('returns built-ins when there are no rows', () => {
    const list = mergeRegistry([]);
    expect(list).toHaveLength(5);
    expect(list.filter((a) => a.isDefault).map((a) => a.id)).toEqual(['claude-code']);
  });

  it('applies the arguments of a row but keeps every other built-in field', () => {
    const list = mergeRegistry([row({ id: 'agy', name: 'Hacked', command: 'agy', args: '["--model","x"]' })]);
    const agy = find(list, 'agy');
    expect(agy.argv).toEqual(['agy', '--model', 'x']);
    expect(agy.label).toBe('Antigravity CLI');
    expect(agy.pasteMode).toBe('plain');
    expect(extraArgs(agy)).toEqual(['--model', 'x']);
  });

  it('ignores a row that changes the executable, is malformed or has an unknown id', () => {
    const list = mergeRegistry([row({ command: 'C:/evil/rm.exe' }), row({ id: 'codex', args: 'not json{' }), row({ id: 'codex', command: '' }), row({ id: 'ghost' })]);
    expect(find(list, 'opencode').argv).toEqual(['opencode']);
    expect(find(list, 'codex').argv).toEqual(['codex']);
    expect(list.some((a) => (a.id as string) === 'ghost')).toBe(false);
  });

  it('honours a stored default and falls back when it is disabled', () => {
    expect(mergeRegistry([row({ is_default: 1 })]).find((a) => a.isDefault)?.id).toBe('opencode');
    const disabled = mergeRegistry([row({ is_default: 1, enabled: 0 })]);
    expect(disabled.filter((a) => a.isDefault)).toHaveLength(1);
    expect(disabled.find((a) => a.isDefault)?.enabled).toBe(true);
  });
});

describe('registry persistence (real SQLite, migration 0002)', () => {
  it('round-trips edited arguments and enabled state', async () => {
    const db = await openDb();
    const base = find(await loadAgents(db), 'opencode');
    await saveAgent(db, { ...base, argv: ['opencode', '--verbose'], enabled: false });
    const again = find(await loadAgents(db), 'opencode');
    expect(again.argv).toEqual(['opencode', '--verbose']);
    expect(again.enabled).toBe(false);
  });

  it('refuses everything except arguments, enabled and default', async () => {
    const db = await openDb();
    const agy = BUILTIN_AGENTS.find((a) => a.id === 'agy')!;
    await expect(saveAgent(db, { ...agy, argv: ['bash', '-c', 'calc'] })).rejects.toThrow(/executable/);
    await expect(saveAgent(db, { ...agy, argv: [] })).rejects.toThrow();
    await expect(saveAgent(db, { ...agy, label: 'Pwned' })).rejects.toThrow(/label/);
    await expect(saveAgent(db, { ...agy, pasteMode: 'bracketed' })).rejects.toThrow(/pasteMode/);
    await expect(saveAgent(db, { ...agy, instructionFile: 'CLAUDE.md' })).rejects.toThrow(/instructionFile/);
    await expect(saveAgent(db, { ...agy, detect: { command: 'calc', args: [] } })).rejects.toThrow(/detect/);
    await expect(saveAgent(db, { ...agy, id: 'ghost' as never })).rejects.toThrow();
  });

  it('setDefaultAgent keeps exactly one default and rejects disabled agents', async () => {
    const db = await openDb();
    await setDefaultAgent(db, 'codex');
    expect((await loadAgents(db)).filter((a) => a.isDefault).map((a) => a.id)).toEqual(['codex']);
    await setDefaultAgent(db, 'claude-code');
    expect((await loadAgents(db)).filter((a) => a.isDefault).map((a) => a.id)).toEqual(['claude-code']);
    const hermes = find(await loadAgents(db), 'hermes');
    await saveAgent(db, { ...hermes, enabled: false });
    await expect(setDefaultAgent(db, 'hermes')).rejects.toThrow();
  });
});
