import { createContext, useContext } from 'react';
import type { ExportBuildDetails } from './jobBuilder';
import type { ExportJobRecord, ExportKind } from './types';

export interface ExportContextValue {
  jobs: ExportJobRecord[];
  isLoaded: boolean;
  /** Queue one job. Resolves with the job id once queued (not when done). */
  enqueue(kind: ExportKind, label: string, details: ExportBuildDetails): Promise<string>;
  cancel(id: string): void;
  clearFinished(): void;
}

export const ExportContext = createContext<ExportContextValue | null>(null);

export function useExport(): ExportContextValue {
  const ctx = useContext(ExportContext);
  if (!ctx) throw new Error('useExport must be used within ExportProvider');
  return ctx;
}
