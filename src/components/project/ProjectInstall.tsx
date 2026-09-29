import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { InstallDependenciesDialog } from '@/components/doctor/InstallDependenciesDialog';
import { useInstallDependencies } from '@/components/doctor/useInstallDependencies';
import { ProjectInstallContext, type RequestInstall } from './projectInstallContext';
import { useWorkspace } from '@/lib/context/WorkspaceContext';

/**
 * Lives above both wizard entry points: WelcomeGuide unmounts as soon as the new project opens,
 * so the install dialog must not be owned by the wizard. The install starts only after the
 * project is the active workspace, because the Rust job rejects dirs outside it.
 */
export function ProjectInstallProvider({ children }: { children: ReactNode }) {
  const { workspaceRoot } = useWorkspace();
  const [pending, setPending] = useState<string | null>(null);
  const install = useInstallDependencies(pending);
  const { request } = install;
  const started = useRef<string | null>(null);

  const requestInstall = useCallback<RequestInstall>((dir) => setPending(dir), []);

  useEffect(() => {
    if (!pending || workspaceRoot !== pending || started.current === pending) return;
    started.current = pending;
    void request();
  }, [pending, workspaceRoot, request]);

  return (
    <ProjectInstallContext.Provider value={requestInstall}>
      {children}
      <InstallDependenciesDialog
        phase={install.phase}
        logs={install.logs}
        onConfirm={() => void install.confirm()}
        onDecline={() => {
          install.decline();
          setPending(null);
          started.current = null;
        }}
        onCancel={install.cancel}
      />
    </ProjectInstallContext.Provider>
  );
}
