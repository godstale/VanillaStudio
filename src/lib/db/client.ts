import Database, { type QueryResult } from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';

export interface SqlDatabase {
  execute(query: string, bindValues?: unknown[]): Promise<QueryResult>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  close?(db?: string): Promise<boolean>;
}

import initSql from './migrations/0001_init.sql?raw';
import globalSql from './migrations/0002_global.sql?raw';
import projectSql from './migrations/0003_project.sql?raw';

// Project data folder inside a user project (Technical-Design §8.2).
export const PROJECT_DATA_DIR = '.vanilla';

export type MigrationScope = 'global' | 'project' | 'all';

// All statements are idempotent (IF NOT EXISTS), so they run on every open.
// 0001 is shared; 0002 is global-only; 0003 is project-only.
const MIGRATION_SQL: Record<MigrationScope, string[]> = {
  global: [initSql, globalSql],
  project: [initSql, projectSql],
  all: [initSql, globalSql, projectSql],
};

export function splitSqlStatements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
}

export function getMigrationStatements(scope: MigrationScope): string[] {
  return MIGRATION_SQL[scope].flatMap(splitSqlStatements);
}

type Row = Record<string, unknown>;

function norm(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

// Minimal in-memory SQL interpreter for tests and `pnpm dev` web preview.
// Supports exactly the statements this template issues (see repositories/).
export class MemorySqlFallback implements SqlDatabase {
  private tables = new Map<string, Map<string, Row>>();

  constructor() {
    this.tables.set('app_settings', new Map());
  }

  async execute(
    query: string,
    bindValues: unknown[] = [],
  ): Promise<QueryResult> {
    const q = norm(query);
    if (
      q.startsWith('CREATE TABLE') ||
      q.startsWith('CREATE UNIQUE INDEX') ||
      q.startsWith('CREATE INDEX') ||
      q.startsWith('DROP TABLE')
    ) {
      return { rowsAffected: 0 };
    }
    if (q.startsWith('INSERT INTO app_settings')) {
      const [
        id,
        open_tabs,
        active_tab_id,
        theme,
        language,
        trusted_workspaces,
        last_workspace_root,
      ] = bindValues;
      this.tables.get('app_settings')?.set(id as string, {
        id,
        open_tabs,
        active_tab_id,
        theme,
        language,
        trusted_workspaces,
        last_workspace_root,
      });
      return { rowsAffected: 1 };
    }
    if (q.startsWith('UPDATE app_settings SET')) {
      const [
        open_tabs,
        active_tab_id,
        theme,
        language,
        trusted_workspaces,
        last_workspace_root,
      ] = bindValues;
      const row = this.tables.get('app_settings')?.get('singleton');
      if (row) {
        Object.assign(row, {
          open_tabs,
          active_tab_id,
          theme,
          language,
          trusted_workspaces,
          last_workspace_root,
        });
      }
      return { rowsAffected: 1 };
    }
    throw new Error(
      `MemorySqlFallback: unsupported statement: ${q.slice(0, 80)}`,
    );
  }

  async select<T>(query: string): Promise<T> {
    const q = norm(query);
    if (q.startsWith("SELECT * FROM app_settings WHERE id = 'singleton'")) {
      return Array.from(this.tables.get('app_settings')?.values() ?? []) as T;
    }
    throw new Error(`MemorySqlFallback: unsupported query: ${q.slice(0, 80)}`);
  }
}

let activeWorkspaceRoot: string | null = null;
let mockDb: SqlDatabase | null = null;
let globalMigrationDone = false;
const projectInits = new Map<string, Promise<SqlDatabase>>();
const projectDbs = new Map<string, SqlDatabase>();

export function setActiveWorkspaceRoot(root: string | null): void {
  activeWorkspaceRoot = root;
}

export function getActiveWorkspaceRoot(): string | null {
  return activeWorkspaceRoot;
}

export function setDatabase(db: SqlDatabase | null): void {
  mockDb = db;
}

export async function runMigrations(
  db: SqlDatabase,
  scope: MigrationScope = 'all',
): Promise<void> {
  for (const stmt of getMigrationStatements(scope)) {
    await db.execute(stmt);
  }
}

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// Concurrent callers (several providers mount at once) must share one open+migrate, otherwise
// their migration statements race and SQLite reports "database is locked".
let globalInit: Promise<SqlDatabase> | null = null;

async function initGlobalDatabase(): Promise<SqlDatabase> {
  if (!isTauriEnvironment()) {
    const memDb = new MemorySqlFallback();
    await runMigrations(memDb, 'global');
    return memDb;
  }
  const db = await Database.load('sqlite:app.db');
  await runMigrations(db, 'global');
  return db;
}

export async function getGlobalDatabase(): Promise<SqlDatabase> {
  if (mockDb) {
    if (!globalMigrationDone) {
      await runMigrations(mockDb);
      globalMigrationDone = true;
    }
    return mockDb;
  }
  if (!globalInit) {
    globalInit = initGlobalDatabase().then(
      (db) => {
        globalMigrationDone = true;
        return db;
      },
      (err) => {
        globalInit = null;
        throw err;
      },
    );
  }
  return globalInit;
}

export async function getProjectDatabase(
  workspaceRoot?: string | null,
): Promise<SqlDatabase> {
  if (mockDb) {
    if (!globalMigrationDone) {
      await runMigrations(mockDb);
      globalMigrationDone = true;
    }
    return mockDb;
  }
  const root =
    workspaceRoot ??
    activeWorkspaceRoot ??
    (typeof window !== 'undefined'
      ? localStorage.getItem('wt_current_workspace_root')
      : null);
  if (!root) {
    return getGlobalDatabase();
  }
  const cached = projectDbs.get(root);
  if (cached) {
    return cached;
  }
  let init = projectInits.get(root);
  if (!init) {
    init = initProjectDatabase(root).then(
      (db) => {
        projectDbs.set(root, db);
        projectInits.delete(root);
        return db;
      },
      (err) => {
        projectInits.delete(root);
        throw err;
      },
    );
    projectInits.set(root, init);
  }
  return init;
}

async function initProjectDatabase(root: string): Promise<SqlDatabase> {
  if (!isTauriEnvironment()) {
    const memDb = new MemorySqlFallback();
    await runMigrations(memDb, 'project');
    return memDb;
  }
  try {
    await invoke('ensure_app_dir', { workspaceRoot: root });
  } catch (err) {
    console.warn(
      'ensure_app_dir invoke failed, proceeding with Database.load:',
      err,
    );
  }
  const normalized = root.replace(/\\/g, '/');
  const db = await Database.load(
    `sqlite:${normalized}/${PROJECT_DATA_DIR}/app.db`,
  );
  await runMigrations(db, 'project');
  return db;
}

export async function getDatabase(
  workspaceRoot?: string | null,
): Promise<SqlDatabase> {
  if (mockDb) {
    if (!globalMigrationDone) {
      await runMigrations(mockDb);
      globalMigrationDone = true;
    }
    return mockDb;
  }
  const root =
    workspaceRoot ??
    activeWorkspaceRoot ??
    (typeof window !== 'undefined'
      ? localStorage.getItem('wt_current_workspace_root')
      : null);
  if (root) {
    return getProjectDatabase(root);
  }
  return getGlobalDatabase();
}
