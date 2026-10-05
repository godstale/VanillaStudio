import { useCallback, useEffect, useRef, useState } from 'react';
import type { Viewport } from '@xyflow/react';
import { EmptyScreen } from '@/components/layout/EmptyScreen';
import { WorkspaceCanvas } from '@/components/canvas/WorkspaceCanvas';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { readWorkspace, saveWorkspaceView } from '@/lib/workspace/file';
import type { Workspace as WorkspaceFile } from '@/lib/workspace/schema';

const SAVE_DEBOUNCE_MS = 400;

export function Workspace() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const [result, setResult] = useState<{ root: string; ws?: WorkspaceFile; error?: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!workspaceRoot) return;
    let cancelled = false;
    readWorkspace(workspaceRoot)
      .then((ws) => !cancelled && setResult({ root: workspaceRoot, ws }))
      .catch((e: unknown) => {
        if (!cancelled) setResult({ root: workspaceRoot, error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onViewChange = useCallback(
    (view: Viewport) => {
      if (!workspaceRoot) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void saveWorkspaceView(workspaceRoot, view).catch(() => {
          // 뷰포트 저장 실패는 작업을 막지 않는다. 다음 이동 때 다시 시도한다.
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [workspaceRoot],
  );

  if (!workspaceRoot) {
    return <EmptyScreen title={t('shell.nav.workspace')}>{t('shell.workspace.none')}</EmptyScreen>;
  }
  // 다른 워크스페이스의 결과이거나 아직 읽는 중이면 아무것도 그리지 않는다.
  if (!result || result.root !== workspaceRoot) return null;
  if (!result.ws) {
    return <EmptyScreen title={t('shell.nav.workspace')}>{`${t('shell.workspace.invalid')} (${result.error})`}</EmptyScreen>;
  }
  return <WorkspaceCanvas key={result.ws.workspaceId} initialView={result.ws.view} onViewChange={onViewChange} />;
}

export default Workspace;
