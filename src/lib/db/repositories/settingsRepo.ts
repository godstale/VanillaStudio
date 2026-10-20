import {
  getGlobalDatabase,
  getProjectDatabase,
  getActiveWorkspaceRoot,
  type SqlDatabase,
} from '@/lib/db/client';
import type { AppSettings } from '@/lib/types/settings';
import type { WorkspaceTab } from '@/lib/types/workspaceTab';

interface SettingsRow {
  id: string;
  open_tabs: string;
  active_tab_id: string | null;
  theme: 'dark' | 'light' | 'system';
  language: string;
  trusted_workspaces: string;
  last_workspace_root: string | null;
  templates_dir: string | null;
  terminal_auto_paste: number | null;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'singleton',
  openTabs: [],
  activeTabId: null,
  theme: 'light',
  language: 'ko',
  trustedWorkspaces: [],
  lastWorkspaceRoot: null,
  templatesDir: null,
  terminalAutoPaste: false,
};

function parseSettingsRow(row: SettingsRow): AppSettings {
  return {
    id: row.id,
    openTabs: JSON.parse(row.open_tabs || '[]') as WorkspaceTab[],
    activeTabId: row.active_tab_id,
    theme: row.theme,
    language: row.language === 'en' ? 'en' : 'ko',
    trustedWorkspaces: JSON.parse(row.trusted_workspaces || '[]') as string[],
    lastWorkspaceRoot: row.last_workspace_root,
    templatesDir: row.templates_dir ?? null,
    terminalAutoPaste: row.terminal_auto_paste === 1,
  };
}

async function fetchOrInitRow(db: SqlDatabase): Promise<SettingsRow> {
  const rows = await db.select<SettingsRow[]>(
    "SELECT * FROM app_settings WHERE id = 'singleton'",
  );
  if (rows.length > 0) {
    return rows[0];
  }
  await db.execute(
    `INSERT OR IGNORE INTO app_settings (
      id, open_tabs, active_tab_id, theme, language,
      trusted_workspaces, last_workspace_root, templates_dir, terminal_auto_paste
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      DEFAULT_APP_SETTINGS.id,
      JSON.stringify(DEFAULT_APP_SETTINGS.openTabs),
      DEFAULT_APP_SETTINGS.activeTabId,
      DEFAULT_APP_SETTINGS.theme,
      DEFAULT_APP_SETTINGS.language,
      JSON.stringify(DEFAULT_APP_SETTINGS.trustedWorkspaces),
      DEFAULT_APP_SETTINGS.lastWorkspaceRoot,
      DEFAULT_APP_SETTINGS.templatesDir,
      DEFAULT_APP_SETTINGS.terminalAutoPaste ? 1 : 0,
    ],
  );
  return {
    id: DEFAULT_APP_SETTINGS.id,
    open_tabs: JSON.stringify(DEFAULT_APP_SETTINGS.openTabs),
    active_tab_id: DEFAULT_APP_SETTINGS.activeTabId,
    theme: DEFAULT_APP_SETTINGS.theme,
    language: DEFAULT_APP_SETTINGS.language,
    trusted_workspaces: JSON.stringify(DEFAULT_APP_SETTINGS.trustedWorkspaces),
    last_workspace_root: DEFAULT_APP_SETTINGS.lastWorkspaceRoot,
    templates_dir: DEFAULT_APP_SETTINGS.templatesDir,
    terminal_auto_paste: 0,
  };
}

// Global settings win for everything except open tabs, which follow the
// active project database (see Docs/Architecture.md §4).
export async function getSettings(
  dbOverride?: SqlDatabase,
): Promise<AppSettings> {
  if (dbOverride) {
    return parseSettingsRow(await fetchOrInitRow(dbOverride));
  }
  const globalDb = await getGlobalDatabase();
  const globalSettings = parseSettingsRow(await fetchOrInitRow(globalDb));
  const activeWs = getActiveWorkspaceRoot();
  if (activeWs) {
    try {
      const projectDb = await getProjectDatabase(activeWs);
      const projectSettings = parseSettingsRow(await fetchOrInitRow(projectDb));
      return {
        ...globalSettings,
        openTabs: projectSettings.openTabs,
        activeTabId: projectSettings.activeTabId,
      };
    } catch (err) {
      console.warn(
        'Failed to load project-specific settings, fallback to global:',
        err,
      );
    }
  }
  return globalSettings;
}

let settingsWriteQueue: Promise<unknown> = Promise.resolve();

export function updateSettings(
  updates: Partial<Omit<AppSettings, 'id'>>,
  dbOverride?: SqlDatabase,
): Promise<AppSettings> {
  const next = settingsWriteQueue.then(
    () => updateSettingsInternal(updates, dbOverride),
    () => updateSettingsInternal(updates, dbOverride),
  );
  settingsWriteQueue = next.catch(() => undefined);
  return next;
}

async function updateSettingsInternal(
  updates: Partial<Omit<AppSettings, 'id'>>,
  dbOverride?: SqlDatabase,
): Promise<AppSettings> {
  const writeRow = async (
    db: SqlDatabase,
    rowUpdates: Partial<Omit<AppSettings, 'id'>>,
  ): Promise<AppSettings> => {
    const current = parseSettingsRow(await fetchOrInitRow(db));
    const merged: AppSettings = { ...current, ...rowUpdates };
    await db.execute(
      `UPDATE app_settings SET
        open_tabs = ?, active_tab_id = ?, theme = ?, language = ?,
        trusted_workspaces = ?, last_workspace_root = ?, templates_dir = ?, terminal_auto_paste = ?
      WHERE id = 'singleton'`,
      [
        JSON.stringify(merged.openTabs),
        merged.activeTabId,
        merged.theme,
        merged.language,
        JSON.stringify(merged.trustedWorkspaces),
        merged.lastWorkspaceRoot,
        merged.templatesDir,
        merged.terminalAutoPaste ? 1 : 0,
      ],
    );
    return merged;
  };

  if (dbOverride) {
    return writeRow(dbOverride, updates);
  }

  const globalDb = await getGlobalDatabase();
  const hasProject = getActiveWorkspaceRoot() !== null;

  // Without an active project, tab state lives in the global row
  // (mirrors getSettings, which falls back to global).
  const globalUpdates: Partial<Omit<AppSettings, 'id'>> = hasProject
    ? (({ openTabs, activeTabId, ...rest }) => {
        void openTabs;
        void activeTabId;
        return rest;
      })(updates)
    : updates;
  const globalMerged = await (async () => {
    if (Object.keys(globalUpdates).length === 0) {
      return parseSettingsRow(await fetchOrInitRow(globalDb));
    }
    return writeRow(globalDb, globalUpdates);
  })();

  // Tab state is project-scoped: persist to the project DB when one is active.
  if (
    (updates.openTabs !== undefined || updates.activeTabId !== undefined) &&
    getActiveWorkspaceRoot()
  ) {
    try {
      const projectDb = await getProjectDatabase();
      const current = parseSettingsRow(await fetchOrInitRow(projectDb));
      const merged: AppSettings = {
        ...current,
        openTabs: updates.openTabs ?? current.openTabs,
        activeTabId: updates.activeTabId ?? current.activeTabId,
      };
      await projectDb.execute(
        `UPDATE app_settings SET
          open_tabs = ?, active_tab_id = ?, theme = ?, language = ?,
          trusted_workspaces = ?, last_workspace_root = ?, templates_dir = ?, terminal_auto_paste = ?
        WHERE id = 'singleton'`,
        [
          JSON.stringify(merged.openTabs),
          merged.activeTabId,
          merged.theme,
          merged.language,
          JSON.stringify(merged.trustedWorkspaces),
          merged.lastWorkspaceRoot,
          merged.templatesDir,
          merged.terminalAutoPaste ? 1 : 0,
        ],
      );
      return {
        ...globalMerged,
        openTabs: merged.openTabs,
        activeTabId: merged.activeTabId,
      };
    } catch (err) {
      console.warn('Failed to persist project tab state:', err);
    }
  }
  return globalMerged;
}
