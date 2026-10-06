import { useCallback, useEffect, useRef, useState } from 'react';
import type { TerminalContextValue } from '@/components/terminal/terminalContextValue';
import { writeScene, type TemplateResolver, type WorkspaceRef } from '@/lib/scene/files';
import { reviewAnalysis, revertAnalysis, snapshotAnalysis, type AnalysisReview, type AnalysisSnapshot } from '@/lib/scene/analysisReview';
import type { Scene } from '@/lib/scene/schema';
import { reviewRun, revertFields, saveSnapshot, type RunReview } from '@/lib/scene/writeback';

export interface PendingReview {
  slug: string;
  sceneName: string;
  before: Scene;
  review: RunReview;
  /** 레퍼런스 분석 실행이면 분석 파일·DESIGN.md 구간의 변경(T5.5). */
  analysis?: AnalysisReview;
}

export interface UseRunReviewArgs {
  root: string;
  workspace: WorkspaceRef;
  resolve: TemplateResolver;
  terminals: TerminalContextValue | null;
  /** 결정이 파일에 반영된 뒤(목록을 다시 읽을 때). */
  onApplied: () => void;
}

export interface BeginOptions {
  /** 레퍼런스 분석 실행: 분석 파일·DESIGN.md도 실행 전 상태를 찍어 두고 끝난 뒤 함께 검토한다. 완료 상태(generated)는 바꾸지 않는다. */
  analysis?: boolean;
}

/**
 * 에이전트 실행 → 종료 → 결과 검토 흐름(R-2). 실행 직전 scene을 스냅샷하고, 그 신의 터미널이 끝나면 scene.json을 다시 검증해
 * 변경 사항을 보여 준다. 승인하면 완료 상태(generated/needs-revision)를 저장하고, 되돌리면 실행 전 값을 복원한다.
 */
export function useRunReview({ root, workspace, resolve, terminals, onApplied }: UseRunReviewArgs) {
  const before = useRef(new Map<string, Scene>());
  const analysisBefore = useRef(new Map<string, AnalysisSnapshot>());
  const handled = useRef(new Set<string>());
  const [current, setCurrent] = useState<PendingReview | null>(null);
  const sessions = terminals?.sessions;

  /** 실행 직전에 호출: 되돌릴 기준과 이력 스냅샷을 남긴다. 분석 실행이면 스냅샷이 끝나면 풀리는 약속을 돌려준다(에이전트가 쓰기 전에 기다린다). */
  const begin = useCallback(
    (slug: string, scene: Scene, opts: BeginOptions = {}): Promise<void> => {
      before.current.set(slug, scene);
      void saveSnapshot(root, slug, scene, 'before-run').catch(() => undefined);
      if (!opts.analysis) {
        analysisBefore.current.delete(slug);
        return Promise.resolve();
      }
      return snapshotAnalysis(root, slug).then(
        (s) => void analysisBefore.current.set(slug, s),
        () => undefined,
      );
    },
    [root],
  );

  useEffect(() => {
    if (!sessions || current) return;
    for (const s of sessions) {
      const base = before.current.get(s.sceneSlug);
      if (s.status !== 'exited' || !base || handled.current.has(s.id)) continue;
      handled.current.add(s.id);
      const snap = analysisBefore.current.get(s.sceneSlug);
      void Promise.all([reviewRun(root, s.sceneSlug, base), snap ? reviewAnalysis(root, s.sceneSlug, snap).catch(() => undefined) : Promise.resolve(undefined)]).then(([review, analysis]) =>
        setCurrent({ slug: s.sceneSlug, sceneName: s.sceneName, before: base, review, analysis }),
      );
      break; // 한 번에 하나씩 검토한다
    }
  }, [sessions, current, root]);

  const finish = useCallback(
    async (scene: Scene, label: string, slug: string) => {
      await writeScene(root, slug, workspace, scene, resolve);
      await saveSnapshot(root, slug, scene, label).catch(() => undefined);
      before.current.delete(slug);
      analysisBefore.current.delete(slug);
      setCurrent(null);
      onApplied();
    },
    [root, workspace, resolve, onApplied],
  );

  /** 분석 실행의 완료 상태: 분석은 신을 "생성"하는 일이 아니므로 실행 전 상태를 유지한다. */
  const statusAfter = (cur: PendingReview, judged: 'generated' | 'needs-revision') => (cur.analysis ? cur.before.status : judged);

  const approve = useCallback(async () => {
    if (!current || current.review.state !== 'ok') return;
    const { after, status } = current.review;
    await finish({ ...after, status: statusAfter(current, status) } as Scene, 'approved', current.slug);
  }, [current, finish]);

  const revertDisallowed = useCallback(async () => {
    if (!current) return;
    const snap = analysisBefore.current.get(current.slug);
    if (snap && current.analysis) await revertAnalysis(root, current.slug, snap, current.analysis, 'disallowed');
    if (current.review.state !== 'ok') return; // 무효한 scene.json은 부분 되돌림 대상이 아니다(전부 되돌리기만)
    const { after, disallowed, status } = current.review;
    const fixed = revertFields(after, current.before, disallowed);
    await finish({ ...fixed, status: statusAfter(current, status) } as Scene, 'reverted-partial', current.slug);
  }, [current, finish, root]);

  const revertAll = useCallback(async () => {
    if (!current) return;
    const snap = analysisBefore.current.get(current.slug);
    if (snap && current.analysis) await revertAnalysis(root, current.slug, snap, current.analysis, 'all');
    await finish(current.before, 'reverted', current.slug);
  }, [current, finish, root]);

  const dismiss = useCallback(() => setCurrent(null), []);

  return { current, begin, approve, revertDisallowed, revertAll, dismiss };
}
