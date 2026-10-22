// Frontend side of the app-owned preview server job (T4.10, D-012). The backend runs a fixed argv; this
// module only names the project.
import { useEffect, useState } from 'react';
import { Channel, invoke } from '@tauri-apps/api/core';
import { installProjectDeps } from '@/components/doctor/installApi';

export type PreviewEvent =
  | { kind: 'listening'; port: number; url: string }
  | { kind: 'log'; stream: 'stdout' | 'stderr'; line: string }
  | { kind: 'exited'; exitCode: number | null; willRestart: boolean }
  | { kind: 'failed'; message: string };

export interface PreviewInfo {
  port: number;
  url: string;
}

export interface PreviewApi {
  start(projectDir: string, onEvent: (e: PreviewEvent) => void): Promise<PreviewInfo>;
  stop(projectDir: string): Promise<void>;
  /** Fixed `pnpm install` job; resolves with the exit code. Omitted: a missing install stays a failure. */
  install?(projectDir: string): Promise<number | null>;
}

export const tauriPreviewApi: PreviewApi = {
  start(projectDir, onEvent) {
    const channel = new Channel<PreviewEvent>();
    channel.onmessage = onEvent;
    return invoke<PreviewInfo>('start_preview_server', { projectDir, onEvent: channel });
  },
  stop: (projectDir) => invoke<void>('stop_preview_server', { projectDir }),
  install: (projectDir) => installProjectDeps(projectDir, () => undefined),
};

export type PreviewServerState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'installing' }
  | { phase: 'running'; url: string }
  | { phase: 'restarting' }
  | { phase: 'failed'; error: string };

export function reduceServerState(state: PreviewServerState, e: PreviewEvent): PreviewServerState {
  switch (e.kind) {
    case 'listening':
      return { phase: 'running', url: e.url };
    case 'exited':
      return e.willRestart ? { phase: 'restarting' } : state;
    case 'failed':
      return { phase: 'failed', error: e.message };
    case 'log':
      return state;
  }
}

// start/stop calls for one project run strictly one after another, so a quick unmount (or the dev-mode
// double effect) can never leave a server running that nobody owns.
const queues = new Map<string, Promise<unknown>>();
/** Run per-project jobs strictly one after another (shared with the file watcher). */
export function enqueueDirJob<T>(dir: string, job: () => Promise<T>): Promise<T> {
  const run = (queues.get(dir) ?? Promise.resolve()).then(job, job);
  queues.set(dir, run.catch(() => undefined));
  return run;
}

export interface UsePreviewServerOptions {
  api?: PreviewApi;
  onLog?: (e: Extract<PreviewEvent, { kind: 'log' }>) => void;
}

/** Starts the preview server while `projectDir` is set (open and trusted) and stops it afterwards. */
export function usePreviewServer(
  projectDir: string | null,
  options: UsePreviewServerOptions = {},
): { state: PreviewServerState; retry: () => void } {
  const { api = tauriPreviewApi, onLog } = options;
  const [state, setState] = useState<PreviewServerState>(() => (projectDir ? { phase: 'starting' } : { phase: 'idle' }));
  const [attempt, setAttempt] = useState(0);

  // The server belongs to one project folder: switching folders restarts from scratch.
  const [dir, setDir] = useState(projectDir);
  if (dir !== projectDir) {
    setDir(projectDir);
    setState(projectDir ? { phase: 'starting' } : { phase: 'idle' });
  }

  useEffect(() => {
    if (!projectDir) return;
    let alive = true;
    const onEvent = (e: PreviewEvent) => {
      if (!alive) return;
      if (e.kind === 'log') onLog?.(e);
      setState((s) => reduceServerState(s, e));
    };
    // Unzipped/cloned workspaces have no node_modules: install once (the folder is already trusted), then retry.
    const startOrInstall = async (): Promise<PreviewInfo> => {
      try {
        return await api.start(projectDir, onEvent);
      } catch (err) {
        if (!String(err).includes('not-installed') || !api.install) throw err;
      }
      if (alive) setState({ phase: 'installing' });
      const exitCode = await api.install!(projectDir);
      if (exitCode !== 0) throw new Error(`install-failed:${exitCode ?? 'killed'}`);
      if (alive) setState({ phase: 'starting' });
      return api.start(projectDir, onEvent);
    };
    enqueueDirJob(projectDir, startOrInstall).then(
      (info) => alive && setState((s) => (s.phase === 'running' ? s : { phase: 'running', url: info.url })),
      (err: unknown) => alive && setState({ phase: 'failed', error: String(err) }),
    );
    return () => {
      alive = false;
      void enqueueDirJob(projectDir, () => api.stop(projectDir)).catch(() => undefined);
    };
    // onLog is read once per start on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir, api, attempt]);

  return {
    state,
    retry: () => {
      if (projectDir) setState({ phase: 'starting' });
      setAttempt((n) => n + 1);
    },
  };
}
