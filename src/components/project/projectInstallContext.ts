import { createContext, useContext } from 'react';

export type RequestInstall = (projectDir: string) => void;

export const ProjectInstallContext = createContext<RequestInstall | null>(null);

/** Null outside the provider, so the wizard still works in isolation (tests). */
export function useProjectInstall(): RequestInstall | null {
  return useContext(ProjectInstallContext);
}
