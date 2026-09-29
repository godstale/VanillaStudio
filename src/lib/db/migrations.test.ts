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
];
const PROJECT_TABLES = [
  'agent_sessions',
  'app_settings',
  'export_jobs',
  'pipeline_state',
  'reviews',
  'task_runs',
];

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

  it('has no statements that are empty or comments', () => {
    for (const stmt of getMigrationStatements('all')) {
      expect(stmt).toMatch(/^(CREATE|DROP)/);
    }
  });

  it('uses .vanilla as the project data directory', () => {
    expect(PROJECT_DATA_DIR).toBe('.vanilla');
  });
});
