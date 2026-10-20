import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as settingsRepo from '@/lib/db/repositories/settingsRepo';
import { getWorkspaceByPath, touchWorkspace } from '@/lib/db/repositories/workspacesRepo';
import { setActiveWorkspaceRoot } from '@/lib/db/client';

const TRUST_STORAGE_KEY = 'wt_trusted_workspaces';

function getStoredTrustMap(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(TRUST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveTrustMap(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(TRUST_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

const RECENT_WORKSPACES_KEY = 'wt_recent_workspaces';

function getStoredRecentWorkspaces(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_WORKSPACES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentWorkspaces(list: string[]): void {
  try {
    localStorage.setItem(
      RECENT_WORKSPACES_KEY,
      JSON.stringify(list.slice(0, 10)),
    );
  } catch {
    // ignore
  }
}

export interface WorkspaceContextValue {
  workspaceRoot: string | null;
  setWorkspaceRoot: (root: string | null) => void;
  recentWorkspaces: string[];
  clearRecentWorkspaces: () => void;
  isTrusted: boolean;
  trustModalOpen: boolean;
  setTrustModalOpen: (open: boolean) => void;
  trustCurrentWorkspace: () => void;
  trustWorkspace: (path: string) => void;
  rejectCurrentWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceRoot, setWorkspaceRootState] = useState<string | null>(() => {
    return localStorage.getItem('wt_current_workspace_root');
  });

  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>(
    getStoredRecentWorkspaces,
  );

  const [trustModalOpen, setTrustModalOpen] = useState<boolean>(() => {
    const initialRoot = localStorage.getItem('wt_current_workspace_root');
    if (!initialRoot) return false;
    const map = getStoredTrustMap();
    return map[initialRoot] === undefined;
  });

  const [isTrusted, setIsTrusted] = useState<boolean>(() => {
    const initialRoot = localStorage.getItem('wt_current_workspace_root');
    if (!initialRoot) return false;
    const map = getStoredTrustMap();
    return Boolean(map[initialRoot]);
  });

  const currentRootRef = useRef<string | null>(workspaceRoot);
  const manualClearRef = useRef<boolean>(false);

  // Load and sync from app_settings (P4-05 migration from localStorage)
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const settings = await settingsRepo.getSettings();
        if (!active) return;

        let candidateRoot = workspaceRoot || (manualClearRef.current ? null : settings.lastWorkspaceRoot);
        if (!candidateRoot && !manualClearRef.current && settings.trustedWorkspaces?.length) {
          const lastTrusted = settings.trustedWorkspaces[settings.trustedWorkspaces.length - 1];
          if (lastTrusted) {
            try {
              const existingRecord = await getWorkspaceByPath(lastTrusted).catch(() => null);
              if (!existingRecord) {
                const inspected = await invoke<
                  { kind?: string; workspaceId?: string; name?: string } | undefined
                >('inspect_workspace_folder', { path: lastTrusted });
                if (
                  inspected &&
                  inspected.kind === 'workspace' &&
                  inspected.workspaceId &&
                  inspected.name
                ) {
                  await touchWorkspace({
                    workspaceId: inspected.workspaceId,
                    path: lastTrusted,
                    name: inspected.name,
                  }).catch(() => undefined);
                  candidateRoot = lastTrusted;
                  void settingsRepo.updateSettings({ lastWorkspaceRoot: lastTrusted });
                }
              }
            } catch {
              // ignore recovery failure
            }
          }
        }

        if (candidateRoot) {
          let validWorkspace = true;
          try {
            const inspected = await invoke<{ kind?: string } | undefined>(
              'inspect_workspace_folder',
              { path: candidateRoot },
            );
            if (inspected && typeof inspected === 'object' && 'kind' in inspected) {
              validWorkspace = inspected.kind === 'workspace';
            }
          } catch {
            // In Tauri, inspect_workspace_folder throws if the directory no longer exists.
            if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
              validWorkspace = false;
            }
          }

          if (!validWorkspace) {
            if (!active) return;
            currentRootRef.current = null;
            setActiveWorkspaceRoot(null);
            setWorkspaceRootState(null);
            localStorage.removeItem('wt_current_workspace_root');
            setIsTrusted(false);
            setTrustModalOpen(false);
            void settingsRepo.updateSettings({ lastWorkspaceRoot: null });
            return;
          }

          currentRootRef.current = candidateRoot;
          setActiveWorkspaceRoot(candidateRoot);
          if (!workspaceRoot) {
            setWorkspaceRootState(candidateRoot);
            localStorage.setItem('wt_current_workspace_root', candidateRoot);
          }
          try {
            await invoke('set_active_workspace', { path: candidateRoot });
            await invoke('open_workspace', { path: candidateRoot });
          } catch {
            // ignore in non-Tauri
          }
        }

        if (settings.trustedWorkspaces) {
          const map = getStoredTrustMap();
          let changed = false;
          for (const ws of settings.trustedWorkspaces) {
            if (!map[ws]) {
              map[ws] = true;
              changed = true;
            }
          }
          if (changed) {
            saveTrustMap(map);
          }
          if (candidateRoot && settings.trustedWorkspaces.includes(candidateRoot)) {
            setIsTrusted(true);
            setTrustModalOpen(false);
          }
        }
      } catch (err) {
        console.error(
          'Failed to sync trusted workspaces from app_settings:',
          err,
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [workspaceRoot]);

  const setWorkspaceRoot = useCallback((root: string | null) => {
    manualClearRef.current = root === null;
    currentRootRef.current = root;
    setActiveWorkspaceRoot(root);
    setWorkspaceRootState(root);
    try {
      void invoke('set_active_workspace', { path: root });
    } catch {
      // ignore in non-Tauri
    }
    if (root) {
      localStorage.setItem('wt_current_workspace_root', root);
      setRecentWorkspaces((prev) => {
        const next = [root, ...prev.filter((p) => p !== root)].slice(0, 10);
        saveRecentWorkspaces(next);
        return next;
      });

      const map = getStoredTrustMap();
      if (map[root] !== undefined) {
        setIsTrusted(map[root]);
        setTrustModalOpen(false);
      } else {
        setIsTrusted(false);
        setTrustModalOpen(true);
      }
      void settingsRepo.updateSettings({ lastWorkspaceRoot: root });
    } else {
      localStorage.removeItem('wt_current_workspace_root');
      setIsTrusted(false);
      setTrustModalOpen(false);
      void settingsRepo.updateSettings({ lastWorkspaceRoot: null });
    }
  }, []);

  const trustWorkspace = useCallback((path: string) => {
    const map = getStoredTrustMap();
    map[path] = true;
    saveTrustMap(map);
    if (path === currentRootRef.current) {
      setIsTrusted(true);
      setTrustModalOpen(false);
    }

    // Sync to SQLite app_settings
    void (async () => {
      try {
        const current = await settingsRepo.getSettings();
        const next = Array.from(new Set([...current.trustedWorkspaces, path]));
        await settingsRepo.updateSettings({ trustedWorkspaces: next });
      } catch {
        // ignore
      }
    })();
  }, []);

  const trustCurrentWorkspace = useCallback(() => {
    if (workspaceRoot) trustWorkspace(workspaceRoot);
  }, [workspaceRoot, trustWorkspace]);

  const rejectCurrentWorkspace = useCallback(() => {
    if (!workspaceRoot) return;
    const map = getStoredTrustMap();
    map[workspaceRoot] = false;
    saveTrustMap(map);
    setIsTrusted(false);
    setTrustModalOpen(false);

    // Sync to SQLite app_settings
    void (async () => {
      try {
        const current = await settingsRepo.getSettings();
        const next = current.trustedWorkspaces.filter(
          (w) => w !== workspaceRoot,
        );
        await settingsRepo.updateSettings({ trustedWorkspaces: next });
      } catch {
        // ignore
      }
    })();
  }, [workspaceRoot]);

  // 백엔드는 신뢰된 워크스페이스에서만 에이전트·프리뷰를 시작한다(AGENTS.md §7). 화면의 신뢰 결정을 그대로 알려 준다.
  useEffect(() => {
    if (!workspaceRoot) return;
    void invoke('set_workspace_trusted', { path: workspaceRoot, trusted: isTrusted }).catch(() => undefined);
  }, [workspaceRoot, isTrusted]);

  const clearRecentWorkspaces = useCallback(() => {
    setRecentWorkspaces([]);
    saveRecentWorkspaces([]);
  }, []);

  const value = useMemo(
    () => ({
      workspaceRoot,
      setWorkspaceRoot,
      recentWorkspaces,
      clearRecentWorkspaces,
      isTrusted,
      trustModalOpen,
      setTrustModalOpen,
      trustCurrentWorkspace,
      trustWorkspace,
      rejectCurrentWorkspace,
    }),
    [
      workspaceRoot,
      setWorkspaceRoot,
      recentWorkspaces,
      clearRecentWorkspaces,
      isTrusted,
      trustModalOpen,
      trustCurrentWorkspace,
      trustWorkspace,
      rejectCurrentWorkspace,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return ctx;
}

export function useSafeWorkspace(): WorkspaceContextValue | null {
  return useContext(WorkspaceContext);
}
