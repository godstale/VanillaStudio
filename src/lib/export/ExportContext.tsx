// Export job queue (T5.2, F-EXP-08): one job runs at a time, the rest wait.
// Progress and logs stream from the backend Channel; terminal states persist
// to the project DB (`export_jobs`). React Context per concern (AGENTS.md §2).
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSafeWorkspace } from '@/lib/context/WorkspaceContext';
import { tauriExportApi, type BackendExportEvent, type ExportApi } from './exportApi';
import { ExportContext, type ExportContextValue } from './exportContextValue';
import { defaultId, toRow } from './exportModel';
import { rowToRecord } from './exportModel';
import { loadExportJobs, saveExportJob, type ExportJobRow } from './exportRepo';
import { buildExportJob, type ExportBuildDetails } from './jobBuilder';
import { isTerminalStatus, newJobRecord, type ExportJobRecord, type ExportKind } from './types';

export interface ExportProviderDeps {
  api?: ExportApi;
  load?: (root: string) => Promise<ExportJobRow[]>;
  save?: (root: string, row: ExportJobRow) => Promise<void>;
  now?: () => Date;
  newId?: () => string;
  /** Test seam: bypass the workspace context. */
  projectRoot?: string | null;
}

export function ExportProvider({
  children,
  api = tauriExportApi,
  load,
  save,
  now = () => new Date(),
  newId = defaultId,
  projectRoot: projectRootOverride,
}: {
  children: ReactNode;
} & ExportProviderDeps) {
  const contextRoot = useSafeWorkspace()?.workspaceRoot ?? null;
  const projectRoot = projectRootOverride !== undefined ? projectRootOverride : contextRoot;
  const [jobs, setJobs] = useState<ExportJobRecord[]>([]);
  // History belongs to one project folder; `null` (no folder) is trivially loaded.
  const [loadedRoot, setLoadedRoot] = useState<string | null>(null);
  const isLoaded = projectRoot === null || loadedRoot === projectRoot;
  const jobsRef = useRef(jobs);
  const pendingJson = useRef(new Map<string, string>());
  const inFlight = useRef(new Set<string>());
  const apiRef = useRef(api);
  const loadRef = useRef(load);
  const saveRef = useRef(save);
  const nowRef = useRef(now);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    apiRef.current = api;
    loadRef.current = load;
    saveRef.current = save;
    nowRef.current = now;
  });

  // Folder switch (same render-time adjustment as usePreviewServer): drop the
  // other folder's jobs; the load effect below fetches this folder's history.
  const [dir, setDir] = useState(projectRoot);
  if (dir !== projectRoot) {
    setDir(projectRoot);
    setJobs([]);
  }

  useEffect(() => {
    pendingJson.current.clear();
    inFlight.current.clear();
    if (!projectRoot) return;
    let alive = true;
    const loadJobs = loadRef.current ?? loadExportJobs;
    loadJobs(projectRoot).then(
      (rows) => {
        if (!alive) return;
        const loaded = rows.flatMap((r) => {
          const rec = rowToRecord(r);
          return rec ? [rec] : [];
        });
        // Jobs enqueued while history was loading must survive: merge the
        // loaded history underneath them instead of overwriting the queue.
        const ids = new Set(jobsRef.current.map((j) => j.id));
        const merged = [...loaded.filter((r) => !ids.has(r.id)), ...jobsRef.current];
        jobsRef.current = merged;
        setJobs(merged);
        setLoadedRoot(projectRoot);
      },
      () => {
        if (!alive) return;
        setLoadedRoot(projectRoot);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectRoot]);

  const persist = useCallback((root: string | null, job: ExportJobRecord) => {
    if (!root) return;
    const saveJobs = saveRef.current ?? saveExportJob;
    void saveJobs(root, toRow(job)).catch((err: unknown) => console.warn('export_jobs save failed:', err));
  }, []);

  const update = useCallback(
    (id: string, fn: (job: ExportJobRecord) => ExportJobRecord, root: string | null) => {
      const current = jobsRef.current.find((j) => j.id === id);
      if (!current) return;
      const next = fn(current);
      jobsRef.current = jobsRef.current.map((j) => (j.id === id ? next : j));
      setJobs(jobsRef.current);
      if (isTerminalStatus(next.status)) persist(root, next);
    },
    [persist],
  );

  const runOne = useCallback(
    async (id: string, root: string) => {
      const at = nowRef.current().toISOString();
      update(id, (j) => ({ ...j, status: 'running', startedAt: j.startedAt ?? at }), root);
      const json = pendingJson.current.get(id);
      if (!json) {
        update(
          id,
          (j) => ({ ...j, status: 'failed', error: 'missing-job-json', endedAt: nowRef.current().toISOString() }),
          root,
        );
        return;
      }
      const onEvent = (e: BackendExportEvent) => {
        if (e.kind === 'started') {
          update(id, (j) => (j.status === 'queued' ? { ...j, status: 'running' } : j), root);
        } else if (e.kind === 'progress') {
          update(
            id,
            (j) => ({
              ...j,
              status: 'running',
              percent: Math.min(100, Math.max(0, e.percent)),
              step: e.message ? `${e.step}: ${e.message}` : e.step,
            }),
            root,
          );
        } else if (e.kind === 'log') {
          update(
            id,
            (j) => ({ ...j, logs: [...j.logs, { stream: e.stream === 'stderr' ? ('stderr' as const) : ('stdout' as const), line: e.line }] }),
            root,
          );
        } else {
          update(id, (j) => ({ ...j, status: 'done', percent: 100, files: e.files, outDir: e.outDir }), root);
        }
      };
      try {
        const report = await apiRef.current.start(root, id, json, onEvent);
        update(
          id,
          (j) =>
            isTerminalStatus(j.status)
              ? j
              : { ...j, status: 'done', percent: 100, files: report.files, outDir: report.outDir, endedAt: nowRef.current().toISOString() },
          root,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const cancelled = /cancelled/.test(message);
        update(
          id,
          (j) =>
            isTerminalStatus(j.status) && j.status !== 'running'
              ? j
              : { ...j, status: cancelled ? 'cancelled' : 'failed', error: message, endedAt: nowRef.current().toISOString() },
          root,
        );
      } finally {
        pendingJson.current.delete(id);
        inFlight.current.delete(id);
      }
    },
    [update],
  );

  // Sequential runner: while a job runs, the rest stay queued.
  useEffect(() => {
    if (!projectRoot) return;
    if (jobs.some((j) => j.status === 'running' || inFlight.current.has(j.id))) return;
    const next = jobs.find((j) => j.status === 'queued');
    if (!next) return;
    inFlight.current.add(next.id);
    void runOne(next.id, projectRoot);
  }, [jobs, projectRoot, runOne]);

  const enqueue = useCallback(
    async (kind: ExportKind, label: string, details: ExportBuildDetails): Promise<string> => {
      if (!projectRoot) throw new Error('no-project');
      const id = newId();
      const { json } = buildExportJob(projectRoot, details, now());
      pendingJson.current.set(id, json);
      const record = { ...newJobRecord(id, kind, label), startedAt: now().toISOString() };
      jobsRef.current = [...jobsRef.current, record];
      setJobs(jobsRef.current);
      persist(projectRoot, record);
      return id;
    },
    [now, newId, persist, projectRoot],
  );

  const cancel = useCallback(
    (id: string) => {
      const job = jobsRef.current.find((j) => j.id === id);
      if (!job || isTerminalStatus(job.status)) return;
      if (job.status === 'queued' && !inFlight.current.has(id)) {
        pendingJson.current.delete(id);
        update(id, (j) => ({ ...j, status: 'cancelled', endedAt: nowRef.current().toISOString() }), projectRoot);
        return;
      }
      // Running: ask the backend to kill the worker tree; the start()
      // rejection settles the record as cancelled.
      void apiRef.current.cancel(id).catch(() => undefined);
    },
    [projectRoot, update],
  );

  const clearFinished = useCallback(() => {
    jobsRef.current = jobsRef.current.filter((j) => !isTerminalStatus(j.status));
    setJobs(jobsRef.current);
  }, []);

  const value = useMemo<ExportContextValue>(
    () => ({ jobs, isLoaded, enqueue, cancel, clearFinished }),
    [jobs, isLoaded, enqueue, cancel, clearFinished],
  );
  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>;
}
