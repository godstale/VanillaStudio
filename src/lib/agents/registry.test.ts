// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { runMigrations, type SqlDatabase } from '@/lib/db/client';
import {
  BUILTIN_AGENTS,
  agentEntrySchema,
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
  // migration statements contain no binds; exec each through prepare/run
  await runMigrations(db, 'global');
  return db;
}

const row = (over: Partial<AgentRow>): AgentRow => ({
  id: 'opencode',
  name: 'OpenCode',
  command: 'opencode',
  args: '["acp"]',
  env: '{}',
  session_options: '{}',
  support_tier: 'experimental',
  enabled: 1,
  is_default: 0,
  ...over,
});

describe('builtin agents', () => {
  it('cover every AgentId once and satisfy the schema', () => {
    expect(BUILTIN_AGENTS.map((a) => a.id).sort()).toEqual([...AGENT_IDS].sort());
    for (const a of BUILTIN_AGENTS) expect(agentEntrySchema.safeParse(a).success).toBe(true);
  });

  it('has exactly one default: Claude Code (official)', () => {
    const defaults = BUILTIN_AGENTS.filter((a) => a.isDefault);
    expect(defaults.map((a) => a.id)).toEqual(['claude-code']);
    expect(defaults[0].supportTier).toBe('official');
  });

  it('isolates Claude Code sessions (D-018)', () => {
    const claude = BUILTIN_AGENTS.find((a) => a.id === 'claude-code')!;
    const opts = (claude.sessionOptions as { claudeCode: { options: { settingSources: string[]; settings: { permissions: { ask: string[] } } } } }).claudeCode.options;
    expect(opts.settingSources).toEqual(['project']);
    expect(opts.settings.permissions.ask).toEqual(['Bash', 'PowerShell']);
  });

  it('marks AGY as terminal mode', () => {
    expect(BUILTIN_AGENTS.find((a) => a.id === 'agy')?.mode).toBe('terminal');
  });
});

describe('agentEntrySchema', () => {
  it('rejects unknown ids, extra keys and empty commands', () => {
    const base = BUILTIN_AGENTS[0];
    expect(agentEntrySchema.safeParse({ ...base, id: 'evil' }).success).toBe(false);
    expect(agentEntrySchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
    expect(agentEntrySchema.safeParse({ ...base, command: '  ' }).success).toBe(false);
  });
});

describe('mergeRegistry', () => {
  it('returns built-ins when there are no rows', () => {
    const list = mergeRegistry([]);
    expect(list).toHaveLength(5);
    expect(list.filter((a) => a.isDefault).map((a) => a.id)).toEqual(['claude-code']);
  });

  it('applies row overrides but keeps the built-in mode', () => {
    const list = mergeRegistry([row({ id: 'agy', command: 'C:/tools/agy.exe', args: '["--x"]' })]);
    const agy = list.find((a) => a.id === 'agy')!;
    expect(agy.command).toBe('C:/tools/agy.exe');
    expect(agy.args).toEqual(['--x']);
    expect(agy.mode).toBe('terminal');
  });

  it('ignores invalid rows and unknown ids', () => {
    const list = mergeRegistry([row({ args: 'not json{', command: '' }), row({ id: 'ghost' })]);
    expect(list.find((a) => a.id === 'opencode')?.command).toBe('opencode');
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
  it('round-trips an edited entry', async () => {
    const db = await openDb();
    const base = (await loadAgents(db)).find((a) => a.id === 'opencode')!;
    await saveAgent(db, { ...base, args: ['acp', '--verbose'], enabled: false });
    const again = (await loadAgents(db)).find((a) => a.id === 'opencode')!;
    expect(again.args).toEqual(['acp', '--verbose']);
    expect(again.enabled).toBe(false);
  });

  it('refuses a mode change or invalid entry', async () => {
    const db = await openDb();
    const agy = BUILTIN_AGENTS.find((a) => a.id === 'agy')!;
    await expect(saveAgent(db, { ...agy, mode: 'acp' })).rejects.toThrow();
    await expect(saveAgent(db, { ...agy, command: '' })).rejects.toThrow();
  });

  it('setDefaultAgent keeps exactly one default and rejects disabled agents', async () => {
    const db = await openDb();
    await setDefaultAgent(db, 'codex');
    const list = await loadAgents(db);
    expect(list.filter((a) => a.isDefault).map((a) => a.id)).toEqual(['codex']);
    await setDefaultAgent(db, 'claude-code');
    expect((await loadAgents(db)).filter((a) => a.isDefault).map((a) => a.id)).toEqual(['claude-code']);
    const hermes = (await loadAgents(db)).find((a) => a.id === 'hermes')!;
    await saveAgent(db, { ...hermes, enabled: false });
    await expect(setDefaultAgent(db, 'hermes')).rejects.toThrow();
  });
});
