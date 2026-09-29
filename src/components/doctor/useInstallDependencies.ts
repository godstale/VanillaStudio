import { useCallback, useRef, useState } from 'react';
import {
  installProjectDeps,
  installProjectDepsCancel,
  readPackageJson,
} from './installApi';
import {
  appendLog,
  decideConsent,
  hashText,
  localStorageConsentStore,
  type ConsentStore,
  type InstallEvent,
  type LogLine,
} from './installModel';
import { errorCode } from './useFfmpegDownload';

export type InstallPhase =
  | { kind: 'idle' }
  | { kind: 'consent'; reason: 'ask-first' | 'ask-changed' }
  | { kind: 'running' }
  | { kind: 'done'; exitCode: number | null }
  | { kind: 'error'; code: string };

export interface InstallDeps {
  readPackageJson: (projectDir: string) => Promise<string>;
  run: (
    projectDir: string,
    onEvent: (e: InstallEvent) => void,
  ) => Promise<number | null>;
  cancel: () => Promise<void>;
  store: ConsentStore;
}

const DEFAULT_DEPS: InstallDeps = {
  readPackageJson,
  run: installProjectDeps,
  cancel: installProjectDepsCancel,
  store: localStorageConsentStore,
};

/**
 * `request()` decides whether consent is needed (first time, or package.json changed) and either
 * opens the consent step or installs right away. Nothing runs before `confirm()` when consent is
 * required (AGENTS.md section 7).
 */
export function useInstallDependencies(
  projectDir: string | null,
  deps: InstallDeps = DEFAULT_DEPS,
) {
  const [phase, setPhase] = useState<InstallPhase>({ kind: 'idle' });
  const [logs, setLogs] = useState<LogLine[]>([]);
  const pendingHash = useRef<string | null>(null);

  const execute = useCallback(async () => {
    if (!projectDir) return;
    setLogs([]);
    setPhase({ kind: 'running' });
    try {
      const exitCode = await deps.run(projectDir, (e) =>
        setLogs((prev) => appendLog(prev, e)),
      );
      setPhase({ kind: 'done', exitCode });
    } catch (e) {
      setPhase({ kind: 'error', code: errorCode(e) });
    }
  }, [projectDir, deps]);

  const request = useCallback(async () => {
    if (!projectDir) return;
    try {
      const hash = await hashText(await deps.readPackageJson(projectDir));
      pendingHash.current = hash;
      const decision = decideConsent(deps.store.get(projectDir), hash);
      if (decision === 'skip') await execute();
      else setPhase({ kind: 'consent', reason: decision });
    } catch (e) {
      setPhase({ kind: 'error', code: errorCode(e) });
    }
  }, [projectDir, deps, execute]);

  const confirm = useCallback(async () => {
    if (!projectDir || pendingHash.current === null) return;
    deps.store.set(projectDir, pendingHash.current);
    await execute();
  }, [projectDir, deps, execute]);

  const decline = useCallback(() => setPhase({ kind: 'idle' }), []);
  const cancel = useCallback(() => void deps.cancel(), [deps]);

  return { phase, logs, request, confirm, decline, cancel };
}
