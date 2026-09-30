// Frontend side of the project file watcher (T4.12). The backend reports root-relative source paths;
// this module only names the project, like previewServer.ts does for the preview job.
import { useEffect, useRef } from 'react';
import { Channel, invoke } from '@tauri-apps/api/core';
import { enqueueDirJob } from './previewServer';

export type WatchEvent = { kind: 'changed'; paths: string[] };

export interface WatchApi {
  start(projectDir: string, onEvent: (e: WatchEvent) => void): Promise<void>;
  stop(projectDir: string): Promise<void>;
}

export const tauriWatchApi: WatchApi = {
  start(projectDir, onEvent) {
    const channel = new Channel<WatchEvent>();
    channel.onmessage = onEvent;
    return invoke<void>('start_preview_watch', { projectDir, onEvent: channel });
  },
  stop: (projectDir) => invoke<void>('stop_preview_watch', { projectDir }),
};

export interface UsePreviewWatchOptions {
  api?: WatchApi;
  onBatch?: (paths: string[]) => void;
}

// The latest callback without re-subscribing.
function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

/** Watches `projectDir` while it is set and reports every `Changed` batch through `onBatch`. */
export function usePreviewWatch(projectDir: string | null, options: UsePreviewWatchOptions = {}): void {
  const { api = tauriWatchApi, onBatch } = options;
  const onBatchRef = useLatest(onBatch);

  useEffect(() => {
    if (!projectDir) return;
    let alive = true;
    const onEvent = (e: WatchEvent) => {
      if (!alive || e.kind !== 'changed') return;
      onBatchRef.current?.(e.paths);
    };
    void enqueueDirJob(projectDir, () => api.start(projectDir, onEvent)).catch(() => undefined);
    return () => {
      alive = false;
      void enqueueDirJob(projectDir, () => api.stop(projectDir)).catch(() => undefined);
    };
    // onBatch is read through a ref so late callbacks never restart the watcher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir, api]);
}
