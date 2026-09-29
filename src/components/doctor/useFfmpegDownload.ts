import { useCallback, useState } from 'react';
import { ffmpegDownload, ffmpegDownloadCancel } from './doctorApi';
import type { FfmpegEvent, FfmpegInstallResult } from './types';

export type FfmpegPhase =
  | { kind: 'idle' }
  | { kind: 'running'; event: FfmpegEvent | null }
  | { kind: 'done'; result: FfmpegInstallResult }
  | { kind: 'error'; code: string };

/** Backend errors are short codes ("already-running", "cancelled") or plain messages. */
export function errorCode(e: unknown): string {
  return typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
}

/** Call `start` only after the user confirmed the consent dialog (AGENTS.md section 7). */
export function useFfmpegDownload(onFinished?: () => void) {
  const [phase, setPhase] = useState<FfmpegPhase>({ kind: 'idle' });

  const start = useCallback(async () => {
    setPhase({ kind: 'running', event: null });
    try {
      const result = await ffmpegDownload((event) =>
        setPhase({ kind: 'running', event }),
      );
      setPhase({ kind: 'done', result });
    } catch (e) {
      setPhase({ kind: 'error', code: errorCode(e) });
    } finally {
      onFinished?.();
    }
  }, [onFinished]);

  const cancel = useCallback(() => {
    void ffmpegDownloadCancel();
  }, []);

  return { phase, start, cancel };
}
