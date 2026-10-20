import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { readWorkspace } from '@/lib/workspace/file';
import { listScenes } from '@/lib/scene/files';
import { readSequence } from '@/lib/sequence/file';
import {
  BRIEF_MD_REL,
  CONTENT_JSON_REL,
  DESIGN_FLOW_MD_REL,
  ITEMS_JSON_REL,
  isAgentStarted,
  readStoryboard,
  VISUAL_MD_REL,
} from '@/lib/storyboard/files';
import type { StoryboardFile } from '@/lib/storyboard/schema';
import { StoryboardOnboarding } from '@/components/storyboard/StoryboardOnboarding';
import { ThreePillarCards } from '@/components/storyboard/ThreePillarCards';
import { MaterialsViewer } from '@/components/storyboard/MaterialsViewer';
import { AssemblyPipeline } from '@/components/storyboard/AssemblyPipeline';

export function Storyboard() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const [loaded, setLoaded] = useState<{
    root: string;
    file: StoryboardFile | null;
    docs: Record<string, string | null>;
    sequenceNodes: number;
    sceneCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setLoaded(null);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!workspaceRoot) return;
    let cancelled = false;
    (async () => {
      try {
        const ws = await readWorkspace(workspaceRoot);
        const { file: sb, raw } = await readStoryboard(workspaceRoot);
        const [seq, scenes] = await Promise.all([
          readSequence(workspaceRoot, ws.workspaceId).catch(() => null),
          listScenes(workspaceRoot).catch(() => []),
        ]);
        if (!cancelled) {
          setLoaded({
            root: workspaceRoot,
            file: sb,
            docs: {
              [BRIEF_MD_REL]: raw[BRIEF_MD_REL],
              [DESIGN_FLOW_MD_REL]: raw[DESIGN_FLOW_MD_REL],
              [VISUAL_MD_REL]: raw[VISUAL_MD_REL],
              [CONTENT_JSON_REL]: raw[CONTENT_JSON_REL],
              [ITEMS_JSON_REL]: raw[ITEMS_JSON_REL],
            },
            sequenceNodes: seq?.nodes.length ?? 0,
            sceneCount: scenes.filter((e) => e.scene != null).length,
          });
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceRoot, reloadKey]);

  if (!workspaceRoot) {
    return <p className="px-8 pt-6 text-sm text-muted-foreground">{t('storyboard.openWorkspace')}</p>;
  }
  if (error) {
    return <p role="alert" className="px-8 pt-6 text-sm text-destructive">{error}</p>;
  }
  if (!loaded || loaded.root !== workspaceRoot) {
    return <p className="px-8 pt-6 text-sm text-muted-foreground">{t('editor.loading')}</p>;
  }
  const { file, docs } = loaded;
  // 작업 지시서 저장 후에도 에이전트가 파일 생성을 시작하기 전에는 온보딩을 유지한다.
  // 에이전트 시작 신호: 단계 전진·문서/재료 갱신·시퀀스 노드·유효한 신. 빈 스캐폴딩은 시작이 아니다.
  const agentStarted =
    file !== null && (isAgentStarted(file, docs) || loaded.sequenceNodes > 0 || loaded.sceneCount > 0);
  if (!agentStarted || !file) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-6">
        <StoryboardOnboarding root={workspaceRoot} initial={file} onAgentStarted={reload} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-8 py-6">
      <header className="space-y-1">
        <h1 className="text-xl font-bold">{t('storyboard.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('storyboard.desc')}</p>
        <p className="text-xs text-muted-foreground">{t('storyboard.stages')}</p>
        <p className="text-xs text-muted-foreground">{t('storyboard.stage', { stage: file.stage })}</p>
      </header>
      <ThreePillarCards brief={docs[BRIEF_MD_REL]} flow={docs[DESIGN_FLOW_MD_REL]} visual={docs[VISUAL_MD_REL]} file={file} />
      <MaterialsViewer contentJson={docs[CONTENT_JSON_REL]} itemsJson={docs[ITEMS_JSON_REL]} />
      <AssemblyPipeline file={file} root={workspaceRoot} />
    </div>
  );
}

export default Storyboard;
