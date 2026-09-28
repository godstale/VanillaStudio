import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import type { SidePanelView } from '@/lib/types/workspaceTab';
import { useSafeWorkspace } from './WorkspaceContext';

export interface SidePanelContextValue {
  activeView: SidePanelView;
  setActiveView: (view: SidePanelView) => void;
  toggleView: (view: Exclude<SidePanelView, null>) => void;
  /** Shared handle of the resizable side panel (registered by Workspace page). */
  panelRef: React.RefObject<ImperativePanelHandle | null>;
  /** Collapse the panel if open, otherwise expand it with the last view. */
  togglePanel: () => void;
}

const SidePanelContext = createContext<SidePanelContextValue | undefined>(
  undefined,
);

export function SidePanelProvider({
  children,
  initialView = 'explorer',
}: {
  children: React.ReactNode;
  initialView?: SidePanelView;
}) {
  const workspace = useSafeWorkspace();
  const hasWorkspaceContext = workspace !== null;
  const workspaceRoot = workspace?.workspaceRoot ?? null;
  const panelRef = useRef<ImperativePanelHandle | null>(null);

  const [internalView, setInternalView] = useState<SidePanelView>(() => {
    if (hasWorkspaceContext && !workspaceRoot) {
      return 'explorer';
    }
    return initialView;
  });

  const activeView: SidePanelView =
    hasWorkspaceContext && !workspaceRoot ? 'explorer' : internalView;

  const handleSetActiveView = useCallback(
    (view: SidePanelView) => {
      if (hasWorkspaceContext && !workspaceRoot) {
        return;
      }
      setInternalView(view);
    },
    [hasWorkspaceContext, workspaceRoot],
  );

  const toggleView = useCallback(
    (view: Exclude<SidePanelView, null>) => {
      if (hasWorkspaceContext && !workspaceRoot) {
        return;
      }
      setInternalView((prev) => (prev === view ? null : view));
    },
    [hasWorkspaceContext, workspaceRoot],
  );

  const togglePanel = useCallback(() => {
    if (hasWorkspaceContext && !workspaceRoot) {
      panelRef.current?.expand();
      setInternalView('explorer');
      return;
    }
    const panel = panelRef.current;
    if (!panel) {
      setInternalView((prev) => (prev ? null : 'explorer'));
      return;
    }
    if (panel.isCollapsed()) {
      panel.expand();
      setInternalView((prev) => prev ?? 'explorer');
    } else {
      panel.collapse();
      setInternalView(null);
    }
  }, [hasWorkspaceContext, workspaceRoot]);

  return (
    <SidePanelContext.Provider
      value={{
        activeView,
        setActiveView: handleSetActiveView,
        toggleView,
        panelRef,
        togglePanel,
      }}
    >
      {children}
    </SidePanelContext.Provider>
  );
}

export function useSidePanel(): SidePanelContextValue {
  const ctx = useContext(SidePanelContext);
  if (!ctx) {
    throw new Error('useSidePanel must be used within a SidePanelProvider');
  }
  return ctx;
}
