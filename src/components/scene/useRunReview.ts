import { useCallback, useEffect, useRef, useState } from 'react';
import type { TerminalContextValue } from '@/components/terminal/terminalContextValue';
import { writeScene, type TemplateResolver, type WorkspaceRef } from '@/lib/scene/files';
import type { Scene } from '@/lib/scene/schema';
import { reviewRun, revertFields, saveSnapshot, type RunReview } from '@/lib/scene/writeback';

export interface PendingReview {
  slug: string;
  sceneName: string;
  before: Scene;
  review: RunReview;
}

export interface UseRunReviewArgs {
  root: string;
  workspace: WorkspaceRef;
  resolve: TemplateResolver;
  terminals: TerminalContextValue | null;
  /** 결정이 파일에 반영된 뒤(목록을 다시 읽을 때). */
  onApplied: () => void;
}

/**
 * 에이전트 실행 → 종료 → 결과 검토 흐름(R-2). 실행 직전 scene을 스냅샷하고, 그 신의 터미널이 끝나면 scene.json을 다시 검증해
 * 변경 사항을 보여 준다. 승인하면 완료 상태(generated/needs-revision)를 저장하고, 되돌리면 실행 전 값을 복원한다.
 */
export function useRunReview({ root, workspace, resolve, terminals, onApplied }: UseRunReviewArgs) {
  const before = useRef(new Map<string, Scene>());
  const handled = useRef(new Set<string>());
  const [current, setCurrent] = useState<PendingReview | null>(null);
  const sessions = terminals?.sessions;

  /** 실행 직전에 호출: 되돌릴 기준과 이력 스냅샷을 남긴다. */
  const begin = useCallback(
    (slug: string, scene: Scene) => {
      before.current.set(slug, scene);
      void saveSnapshot(root, slug, scene, 'before-run').catch(() => undefined);
    },
    [root],
  );

  useEffect(() => {
    if (!sessions || current) return;
    for (const s of sessions) {
      const base = before.current.get(s.sceneSlug);
      if (s.status !== 'exited' || !base || handled.current.has(s.id)) continue;
      handled.current.add(s.id);
      void reviewRun(root, s.sceneSlug, base).then((review) => setCurrent({ slug: s.sceneSlug, sceneName: s.sceneName, before: base, review }));
      break; // 한 번에 하나씩 검토한다
    }
  }, [sessions, current, root]);

  const finish = useCallback(
    async (scene: Scene, label: string, slug: string) => {
      await writeScene(root, slug, workspace, scene, resolve);
      await saveSnapshot(root, slug, scene, label).catch(() => undefined);
      before.current.delete(slug);
      setCurrent(null);
      onApplied();
    },
    [root, workspace, resolve, onApplied],
  );

  const approve = useCallback(async () => {
    if (!current || current.review.state !== 'ok') return;
    const { after, status } = current.review;
    await finish({ ...after, status } as Scene, 'approved', current.slug);
  }, [current, finish]);

  const revertDisallowed = useCallback(async () => {
    if (!current || current.review.state !== 'ok') return;
    const { after, disallowed, status } = current.review;
    const fixed = revertFields(after, current.before, disallowed);
    await finish({ ...fixed, status } as Scene, 'reverted-partial', current.slug);
  }, [current, finish]);

  const revertAll = useCallback(async () => {
    if (!current) return;
    await finish(current.before, 'reverted', current.slug);
  }, [current, finish]);

  const dismiss = useCallback(() => setCurrent(null), []);

  return { current, begin, approve, revertDisallowed, revertAll, dismiss };
}
