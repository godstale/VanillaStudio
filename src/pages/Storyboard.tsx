import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { readWorkspace } from '@/lib/workspace/file';
import { fileExists, readOptionalFile } from '@/lib/workspace/files';
import type { Workspace } from '@/lib/workspace/schema';
import { collectWorkspaceComments, readWorkOrder, type WorkOrderChange, type WorkOrderCommentEntry } from '@/lib/workspace/workOrder';
import { listScenes } from '@/lib/scene/files';
import type { Sequence } from '@/lib/sequence/schema';
import { readSequence } from '@/lib/sequence/file';
import { validateSequence, type SequenceIssue } from '@/lib/sequence/validate';
import {
  BRIEF_MD_REL,
  DESIGN_FLOW_MD_REL,
  isAgentStarted,
  readStoryboard,
  VISUAL_MD_REL,
} from '@/lib/storyboard/files';
import type { StoryboardFile } from '@/lib/storyboard/schema';
import { StoryboardOnboarding } from '@/components/storyboard/StoryboardOnboarding';
import { ThreePillarCards } from '@/components/storyboard/ThreePillarCards';
import { StatusCards, type SceneStatusRow } from '@/components/storyboard/StatusCards';

interface Loaded {
  root: string;
  file: StoryboardFile | null;
  docs: Record<string, string | null>;
  raw: Record<string, string | null>;
  workspace: Workspace;
  sequence: Sequence | null;
  seqError: string | null;
  issues: SequenceIssue[];
  scenes: SceneStatusRow[];
  sceneCount: number;
  sequenceNodes: number;
  designText: string | null;
  changes: WorkOrderChange[];
  comments: WorkOrderCommentEntry[];
  loadErrors: string[];
}

export function Storyboard() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
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
        const loadErrors: string[] = [];
        const ws = await readWorkspace(workspaceRoot);
        const { file: sb, raw } = await readStoryboard(workspaceRoot);
        const docs = {
          [BRIEF_MD_REL]: raw[BRIEF_MD_REL],
          [DESIGN_FLOW_MD_REL]: raw[DESIGN_FLOW_MD_REL],
          [VISUAL_MD_REL]: raw[VISUAL_MD_REL],
        };
        const startedRaw = raw;
        let sequence: Sequence | null = null;
        let seqError: string | null = null;
        try {
          sequence = await readSequence(workspaceRoot, ws.workspaceId);
        } catch (e) {
          seqError = e instanceof Error ? e.message : String(e);
          loadErrors.push(`sequence.json: ${seqError}`);
        }
        const entries = await listScenes(workspaceRoot).catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : String(e);
          loadErrors.push(`scenes: ${msg}`);
          return [];
        });
        const sceneRows: SceneStatusRow[] = await Promise.all(
          entries.map(async (e) => {
            const [hasDesignOverride, hasGuide] = await Promise.all([
              fileExists(workspaceRoot, `scenes/${e.slug}/DESIGN.md`),
              fileExists(workspaceRoot, `scenes/${e.slug}/GUIDE.md`),
            ]);
            if (e.error) loadErrors.push(`scenes/${e.slug}: ${e.error}`);
            return { slug: e.slug, scene: e.scene, error: e.error, hasDesignOverride, hasGuide };
          }),
        );
        const scenesForValidate = new Map(
          entries.flatMap((e) => (e.scene ? [[e.scene.id, { type: e.scene.type, name: e.scene.name }]] as const : [])),
        );
        const issues = sequence ? validateSequence(sequence, { workspaceId: ws.workspaceId, scenes: scenesForValidate }) : [];
        for (const i of issues.filter((x) => x.severity === 'error')) loadErrors.push(i.message);
        const designText = await readOptionalFile(workspaceRoot, 'DESIGN.md');
        if (designText === null) loadErrors.push(t('storyboard.designMissing'));
        const workOrder = await readWorkOrder(workspaceRoot, ws.workspaceId).catch((e: unknown) => {
          loadErrors.push(`work-order: ${e instanceof Error ? e.message : String(e)}`);
          return null;
        });
        const comments = await collectWorkspaceComments(workspaceRoot).catch(() => [] as WorkOrderCommentEntry[]);
        if (!cancelled) {
          setLoaded({
            root: workspaceRoot,
            file: sb,
            docs,
            raw: startedRaw,
            workspace: ws,
            sequence,
            seqError,
            issues,
            scenes: sceneRows,
            sceneCount: sceneRows.filter((r) => r.scene != null).length,
            sequenceNodes: sequence?.nodes.length ?? 0,
            designText,
            changes: workOrder?.changes ?? [],
            comments,
            loadErrors,
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
  }, [workspaceRoot, reloadKey, t]);

  if (!workspaceRoot) {
    return <p className="px-8 pt-6 text-sm text-muted-foreground">{t('storyboard.openWorkspace')}</p>;
  }
  if (error) {
    return <p role="alert" className="px-8 pt-6 text-sm text-destructive">{error}</p>;
  }
  if (!loaded || loaded.root !== workspaceRoot) {
    return <p className="px-8 pt-6 text-sm text-muted-foreground">{t('editor.loading')}</p>;
  }
  const { file, docs, raw } = loaded;
  // 작업 지시서 저장 후에도 에이전트가 파일 생성을 시작하기 전에는 온보딩을 유지한다.
  // 에이전트 시작 신호: 단계 전진·문서/재료 갱신·시퀀스 노드·유효한 신. 빈 스캐폴딩은 시작이 아니다.
  const agentStarted =
    file !== null && (isAgentStarted(file, raw) || loaded.sequenceNodes > 0 || loaded.sceneCount > 0);
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
      <StatusCards
        workspaceName={loaded.workspace.name}
        canvas={loaded.workspace.canvas}
        sequence={loaded.sequence}
        seqError={loaded.seqError}
        issues={loaded.issues}
        scenes={loaded.scenes}
        designText={loaded.designText}
        changes={loaded.changes}
        comments={loaded.comments}
        loadErrors={loaded.loadErrors}
        selectedTemplate={file.visualDirection.selectedTemplate}
        selectedTaxonomy={file.visualDirection.selectedTaxonomy}
      />
    </div>
  );
}

export default Storyboard;
