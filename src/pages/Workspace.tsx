import { useCallback, useEffect, useRef, useState } from 'react';
import type { Viewport } from '@xyflow/react';
import { Onboarding } from '@/components/workspace/Onboarding';
import { SceneWorkspace } from '@/components/scene/SceneWorkspace';
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
    return <Onboarding />;
  }
  // 다른 워크스페이스의 결과이거나 아직 읽는 중이면 아무것도 그리지 않는다.
  if (!result || result.root !== workspaceRoot) return null;
  if (!result.ws) {
    // 복원한 폴더가 유효한 워크스페이스가 아니면(예: v1 프로젝트) 다른 폴더를 고르게 한다.
    return (
      <div className="h-full">
        <p role="alert" className="px-8 pt-6 text-sm text-destructive">{`${t('shell.workspace.invalid')} (${result.error})`}</p>
        <Onboarding />
      </div>
    );
  }
  return (
    <SceneWorkspace
      key={result.ws.workspaceId}
      root={workspaceRoot}
      workspace={{ id: result.ws.workspaceId, name: result.ws.name }}
      initialView={result.ws.view}
      defaultAgent={result.ws.defaultAgent}
      onViewChange={onViewChange}
    />
  );
}

export default Workspace;
