// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import {
  PROJECT_DATA_DIR,
  getMigrationStatements,
  runMigrations,
  type MigrationScope,
  type SqlDatabase,
} from '@/lib/db/client';

// Runs the real migration SQL against SQLite (node:sqlite) to catch syntax errors.
function openSqlite(): { db: SqlDatabase; raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  const db: SqlDatabase = {
    async execute(query) {
      raw.exec(query);
      return { rowsAffected: 0 };
    },
    async select<T>(query: string) {
      return raw.prepare(query).all() as T;
    },
  };
  return { db, raw };
}

function tables(raw: DatabaseSync): string[] {
  return (
    raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[]
  )
    .map((r) => r.name)
    .sort();
}

const GLOBAL_TABLES = [
  'agents',
  'app_settings',
  'doctor_cache',
  'palettes',
  'playground_items',
  'playground_meta',
  'templates',
  'terminal_sessions',
  'workspaces',
];
const PROJECT_TABLES = ['app_settings', 'export_jobs'];

describe('migrations', () => {
  it.each([
    ['global', GLOBAL_TABLES],
    ['project', PROJECT_TABLES],
    ['all', [...new Set([...GLOBAL_TABLES, ...PROJECT_TABLES])].sort()],
  ] as [MigrationScope, string[]][])(
    'creates the %s tables',
    async (scope, expected) => {
      const { db, raw } = openSqlite();
      await runMigrations(db, scope);
      expect(tables(raw)).toEqual(expected);
    },
  );

  it('is idempotent', async () => {
    const { db, raw } = openSqlite();
    await runMigrations(db, 'global');
    await runMigrations(db, 'global');
    expect(tables(raw)).toEqual(GLOBAL_TABLES);
  });

  it('drops the legacy example table from existing databases', async () => {
    const { db, raw } = openSqlite();
    raw.exec('CREATE TABLE items (id TEXT PRIMARY KEY)');
    await runMigrations(db, 'global');
    expect(tables(raw)).not.toContain('items');
  });

  it('drops v1 pipeline tables from an existing project DB and adds templates_dir', async () => {
    const { db, raw } = openSqlite();
    raw.exec('CREATE TABLE pipeline_state (stage TEXT PRIMARY KEY)');
    raw.exec('CREATE TABLE app_settings (id TEXT PRIMARY KEY, theme TEXT)');
    await runMigrations(db, 'project');
    expect(tables(raw)).not.toContain('pipeline_state');
    const cols = (raw.prepare('PRAGMA table_info(app_settings)').all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain('templates_dir');
    await runMigrations(db, 'project');
  });

  it('has no statements that are empty or comments', () => {
    for (const stmt of getMigrationStatements('all')) {
      expect(stmt).toMatch(/^(CREATE|DROP)/);
    }
  });

  it('uses .vanilla as the project data directory', () => {
    expect(PROJECT_DATA_DIR).toBe('.vanilla');
  });
});
