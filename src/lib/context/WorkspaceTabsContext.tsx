import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
import type { WorkspaceTab } from '@/lib/types/workspaceTab';
import * as settingsRepo from '@/lib/db/repositories/settingsRepo';
import {
  getGlobalDatabase,
  getProjectDatabase,
  type SqlDatabase,
} from '@/lib/db/client';
import { useSafeWorkspace } from './WorkspaceContext';

export interface WorkspaceTabsContextValue {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  secondaryActiveTabId: string | null;
  splitDirection: 'horizontal' | 'vertical';
  isSplit: boolean;
  openTab: (
    tab: Omit<WorkspaceTab, 'id'> & { id?: string },
    pane?: 'primary' | 'secondary',
  ) => string;
  closeTab: (id: string) => void;
  closeTabs: (ids: string[]) => void;
  closeAllTabs: (pane?: 'primary' | 'secondary') => void;
  setActiveTab: (id: string) => void;
  setSecondaryActiveTab: (id: string) => void;
  updateTab: (id: string, patch: Partial<Omit<WorkspaceTab, 'id'>>) => void;
  moveTab: (
    fromIndex: number,
    toIndex: number,
    pane?: 'primary' | 'secondary',
  ) => void;
  moveTabToPane: (
    tabId: string,
    targetPane: 'primary' | 'secondary',
    targetIndex?: number,
  ) => void;
  splitTab: (
    tabId: string,
    direction: 'horizontal' | 'vertical',
    side: 'left' | 'right' | 'top' | 'bottom',
  ) => void;
  closeSplit: () => void;
  setSplitDirection: (dir: 'horizontal' | 'vertical') => void;
  isTabsLoaded: boolean;
}

const WorkspaceTabsContext = createContext<
  WorkspaceTabsContextValue | undefined
>(undefined);

// Tabs live in the project DB when a folder is open, otherwise in the global DB.
function getTabsDatabase(root: string | null): Promise<SqlDatabase> {
  return root ? getProjectDatabase(root) : getGlobalDatabase();
}

let tabCounter = 0;
function generateTabId(type: string): string {
  tabCounter += 1;
  return `${type}:${Date.now()}-${tabCounter}`;
}

export function WorkspaceTabsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = useSafeWorkspace();
  const hasWorkspaceContext = workspace !== null;
  const workspaceRoot = workspace?.workspaceRoot ?? null;

  const [internalTabs, setInternalTabs] = useState<WorkspaceTab[]>([]);
  const [internalActiveTabId, setInternalActiveTabId] = useState<string | null>(
    null,
  );
  const [internalSecondaryActiveTabId, setInternalSecondaryActiveTabId] =
    useState<string | null>(null);
  const [splitDirection, setSplitDirection] = useState<
    'horizontal' | 'vertical'
  >('horizontal');
  // Root whose tabs are currently held in state (undefined = nothing loaded yet).
  // Deriving everything from it keeps a previous project's tabs from ever showing or saving.
  const [loadedRoot, setLoadedRoot] = useState<string | null | undefined>(
    undefined,
  );
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isWithoutWorkspace = hasWorkspaceContext && !workspaceRoot;
  const isLoaded = isWithoutWorkspace || loadedRoot === workspaceRoot;
  const tabs = isWithoutWorkspace || !isLoaded ? [] : internalTabs;
  const activeTabId =
    isWithoutWorkspace || !isLoaded ? null : internalActiveTabId;
  const secondaryActiveTabId =
    isWithoutWorkspace || !isLoaded ? null : internalSecondaryActiveTabId;

  const primaryTabs = tabs.filter((t) => (t.pane ?? 'primary') === 'primary');
  const secondaryTabs = tabs.filter((t) => t.pane === 'secondary');
  const isSplit = secondaryTabs.length > 0 && primaryTabs.length > 0;

  // Restore this project's tabs from its own DB (global DB when no folder scope exists).
  useEffect(() => {
    if (isWithoutWorkspace) return;
    let active = true;
    setInternalTabs([]);
    setInternalActiveTabId(null);
    setInternalSecondaryActiveTabId(null);
    void (async () => {
      try {
        const settings = await settingsRepo.getSettings(
          await getTabsDatabase(workspaceRoot),
        );
        if (!active) return;
        const saved = settings.openTabs;
        const savedPrimary = saved.filter(
          (t) => (t.pane ?? 'primary') === 'primary',
        );
        const savedSecondary = saved.filter((t) => t.pane === 'secondary');
        setInternalTabs(saved);
        setInternalActiveTabId(
          settings.activeTabId &&
            savedPrimary.some((t) => t.id === settings.activeTabId)
            ? settings.activeTabId
            : (savedPrimary[0]?.id ?? null),
        );
        setInternalSecondaryActiveTabId(savedSecondary[0]?.id ?? null);
      } catch (err) {
        console.error('Failed to restore workspace tabs:', err);
      } finally {
        if (active) setLoadedRoot(workspaceRoot);
      }
    })();
    return () => {
      active = false;
    };
  }, [isWithoutWorkspace, workspaceRoot]);

  // 500ms debounced persistence into the DB of the root these tabs belong to.
  useEffect(() => {
    if (!isLoaded || isWithoutWorkspace) return;
    const root = workspaceRoot;

    debounceTimerRef.current = setTimeout(() => {
      void (async () => {
        try {
          await settingsRepo.updateSettings(
            { openTabs: internalTabs, activeTabId: internalActiveTabId },
            await getTabsDatabase(root),
          );
        } catch (err) {
          console.error('Failed to save workspace tabs:', err);
        }
      })();
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    internalTabs,
    internalActiveTabId,
    isLoaded,
    isWithoutWorkspace,
    workspaceRoot,
  ]);

  const openTab = useCallback(
    (
      tab: Omit<WorkspaceTab, 'id'> & { id?: string },
      pane: 'primary' | 'secondary' = 'primary',
    ) => {
      if (hasWorkspaceContext && !workspaceRoot) {
        return '';
      }
      const targetId = tab.id ?? generateTabId(tab.type);

      setInternalTabs((prev) => {
        const existing = prev.find((t) => t.id === targetId);
        if (existing) {
          return prev;
        }
        return [...prev, { ...tab, id: targetId, pane: tab.pane ?? pane }];
      });

      if (pane === 'secondary') {
        setInternalSecondaryActiveTabId(targetId);
      } else {
        setInternalActiveTabId(targetId);
      }
      return targetId;
    },
    [hasWorkspaceContext, workspaceRoot],
  );

  const closeTab = useCallback((id: string) => {
    setInternalTabs((prev) => {
      const targetTab = prev.find((t) => t.id === id);
      const isSecondary = targetTab?.pane === 'secondary';
      const next = prev.filter((t) => t.id !== id);

      const nextPrimary = next.filter(
        (t) => (t.pane ?? 'primary') === 'primary',
      );
      const nextSecondary = next.filter((t) => t.pane === 'secondary');

      if (nextPrimary.length === 0 && nextSecondary.length > 0) {
        const migrated = nextSecondary.map((t) => ({
          ...t,
          pane: 'primary' as const,
        }));
        setInternalActiveTabId(migrated[0]?.id ?? null);
        setInternalSecondaryActiveTabId(null);
        return migrated;
      }

      if (isSecondary) {
        setInternalSecondaryActiveTabId((curr) => {
          if (curr !== id) return curr;
          const closedIdx = prev
            .filter((t) => t.pane === 'secondary')
            .findIndex((t) => t.id === id);
          const fallback =
            nextSecondary[closedIdx] ??
            nextSecondary[closedIdx - 1] ??
            nextSecondary[0];
          return fallback ? fallback.id : null;
        });
      } else {
        setInternalActiveTabId((curr) => {
          if (curr !== id) return curr;
          const closedIdx = prev
            .filter((t) => (t.pane ?? 'primary') === 'primary')
            .findIndex((t) => t.id === id);
          const fallback =
            nextPrimary[closedIdx] ??
            nextPrimary[closedIdx - 1] ??
            nextPrimary[0];
          return fallback ? fallback.id : null;
        });
      }

      return next;
    });
  }, []);

  const closeTabs = useCallback((ids: string[]) => {
    const idSet = new Set(ids);
    setInternalTabs((prev) => {
      const next = prev.filter((t) => !idSet.has(t.id));
      const nextPrimary = next.filter(
        (t) => (t.pane ?? 'primary') === 'primary',
      );
      const nextSecondary = next.filter((t) => t.pane === 'secondary');

      if (nextPrimary.length === 0 && nextSecondary.length > 0) {
        const migrated = nextSecondary.map((t) => ({
          ...t,
          pane: 'primary' as const,
        }));
        setInternalActiveTabId(migrated[0]?.id ?? null);
        setInternalSecondaryActiveTabId(null);
        return migrated;
      }

      setInternalActiveTabId((current) => {
        if (!current || !idSet.has(current)) return current;
        return nextPrimary[0]?.id ?? null;
      });

      setInternalSecondaryActiveTabId((current) => {
        if (!current || !idSet.has(current)) return current;
        return nextSecondary[0]?.id ?? null;
      });

      return next;
    });
  }, []);

  const closeSplit = useCallback(() => {
    setInternalTabs((prev) => {
      const next = prev.map((t) => ({ ...t, pane: 'primary' as const }));
      setInternalSecondaryActiveTabId(null);
      return next;
    });
  }, []);

  const closeAllTabs = useCallback(
    (pane?: 'primary' | 'secondary') => {
      if (!pane) {
        setInternalTabs([]);
        setInternalActiveTabId(null);
        setInternalSecondaryActiveTabId(null);
      } else if (pane === 'secondary') {
        closeSplit();
      } else {
        setInternalTabs((prev) => {
          const secondary = prev.filter((t) => t.pane === 'secondary');
          const migrated = secondary.map((t) => ({
            ...t,
            pane: 'primary' as const,
          }));
          setInternalActiveTabId(migrated[0]?.id ?? null);
          setInternalSecondaryActiveTabId(null);
          return migrated;
        });
      }
    },
    [closeSplit],
  );

  const setActiveTab = useCallback((id: string) => {
    setInternalTabs((prev) => {
      const tab = prev.find((t) => t.id === id);
      if (tab?.pane === 'secondary') {
        setInternalSecondaryActiveTabId(id);
      } else {
        setInternalActiveTabId(id);
      }
      return prev;
    });
  }, []);

  const setSecondaryActiveTab = useCallback((id: string) => {
    setInternalSecondaryActiveTabId(id);
  }, []);

  const updateTab = useCallback(
    (id: string, patch: Partial<Omit<WorkspaceTab, 'id'>>) => {
      setInternalTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  const moveTab = useCallback(
    (
      fromIndex: number,
      toIndex: number,
      pane: 'primary' | 'secondary' = 'primary',
    ) => {
      if (fromIndex === toIndex) return;
      setInternalTabs((prev) => {
        const paneTabs = prev.filter((t) => (t.pane ?? 'primary') === pane);
        if (
          fromIndex < 0 ||
          fromIndex >= paneTabs.length ||
          toIndex < 0 ||
          toIndex >= paneTabs.length
        ) {
          return prev;
        }
        const otherTabs = prev.filter((t) => (t.pane ?? 'primary') !== pane);
        const updatedPaneTabs = [...paneTabs];
        const [moved] = updatedPaneTabs.splice(fromIndex, 1);
        updatedPaneTabs.splice(toIndex, 0, moved);
        return pane === 'primary'
          ? [...updatedPaneTabs, ...otherTabs]
          : [...otherTabs, ...updatedPaneTabs];
      });
    },
    [],
  );

  const moveTabToPane = useCallback(
    (
      tabId: string,
      targetPane: 'primary' | 'secondary',
      targetIndex?: number,
    ) => {
      setInternalTabs((prev) => {
        const tab = prev.find((t) => t.id === tabId);
        if (!tab) return prev;
        const currentPane = tab.pane ?? 'primary';
        if (currentPane === targetPane && targetIndex === undefined)
          return prev;

        const updatedTab = { ...tab, pane: targetPane };
        const remainingCurrent = prev.filter(
          (t) => t.id !== tabId && (t.pane ?? 'primary') === currentPane,
        );
        const targetList = prev.filter(
          (t) => t.id !== tabId && (t.pane ?? 'primary') === targetPane,
        );

        const newTargetList = [...targetList];
        if (
          targetIndex !== undefined &&
          targetIndex >= 0 &&
          targetIndex <= newTargetList.length
        ) {
          newTargetList.splice(targetIndex, 0, updatedTab);
        } else {
          newTargetList.push(updatedTab);
        }

        if (targetPane === 'secondary') {
          setInternalSecondaryActiveTabId(tabId);
        } else {
          setInternalActiveTabId(tabId);
        }

        if (currentPane === 'secondary') {
          setInternalSecondaryActiveTabId((curr) => {
            if (curr !== tabId) return curr;
            return remainingCurrent[0]?.id ?? null;
          });
        } else {
          setInternalActiveTabId((curr) => {
            if (curr !== tabId) return curr;
            return remainingCurrent[0]?.id ?? null;
          });
        }

        return targetPane === 'primary'
          ? [...newTargetList, ...remainingCurrent]
          : [...remainingCurrent, ...newTargetList];
      });
    },
    [],
  );

  const splitTab = useCallback(
    (
      tabId: string,
      direction: 'horizontal' | 'vertical',
      side: 'left' | 'right' | 'top' | 'bottom',
    ) => {
      setSplitDirection(direction);
      setInternalTabs((prev) => {
        const tab = prev.find((t) => t.id === tabId);
        if (!tab) return prev;

        if (side === 'right' || side === 'bottom') {
          const next = prev.map((t) =>
            t.id === tabId ? { ...t, pane: 'secondary' as const } : t,
          );
          const primary = next.filter(
            (t) => (t.pane ?? 'primary') === 'primary',
          );
          setInternalSecondaryActiveTabId(tabId);
          setInternalActiveTabId((curr) => {
            if (curr !== tabId) return curr;
            return primary[0]?.id ?? null;
          });
          return next;
        } else {
          const next = prev.map((t) =>
            t.id === tabId
              ? { ...t, pane: 'primary' as const }
              : { ...t, pane: 'secondary' as const },
          );
          setInternalActiveTabId(tabId);
          const secondary = next.filter((t) => t.pane === 'secondary');
          setInternalSecondaryActiveTabId(secondary[0]?.id ?? null);
          return next;
        }
      });
    },
    [],
  );

  return (
    <WorkspaceTabsContext.Provider
      value={{
        tabs,
        activeTabId,
        secondaryActiveTabId,
        splitDirection,
        isSplit,
        openTab,
        closeTab,
        closeTabs,
        closeAllTabs,
        setActiveTab,
        setSecondaryActiveTab,
        updateTab,
        moveTab,
        moveTabToPane,
        splitTab,
        closeSplit,
        setSplitDirection,
        isTabsLoaded: isLoaded,
      }}
    >
      {children}
    </WorkspaceTabsContext.Provider>
  );
}

export function useWorkspaceTabs(): WorkspaceTabsContextValue {
  const context = useContext(WorkspaceTabsContext);
  if (!context) {
    throw new Error(
      'useWorkspaceTabs must be used within a WorkspaceTabsProvider',
    );
  }
  return context;
}
