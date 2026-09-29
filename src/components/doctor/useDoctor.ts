import { useCallback, useEffect, useState } from 'react';
import { doctorCheck } from './doctorApi';
import type { DoctorReport } from './types';

export interface DoctorState {
  report: DoctorReport | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Runs the Doctor check on mount and on demand. `freshPath` is on so new installs are seen. */
export function useDoctor(): DoctorState {
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await doctorCheck(true));
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    doctorCheck(true)
      .then((r) => alive && setReport(r))
      .catch((e: unknown) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { report, loading, error, refresh };
}
