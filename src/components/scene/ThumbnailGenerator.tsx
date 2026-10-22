import { useEffect, useRef } from 'react';
import { BridgeProvider } from '@/lib/review/BridgeContext';
import { previewOriginOf } from '@/lib/review/bridgeProtocol';
import { usePreviewServer } from '@/lib/review/previewServer';
import { ScenePreview } from './Preview';
import { useThumbnailCapture } from './useThumbnailCapture';

export interface ThumbnailTarget {
  slug: string;
  sceneType: 'static' | 'motion' | '3d';
  entry?: string;
}

export interface ThumbnailGeneratorProps {
  root: string;
  canvas: { width: number; height: number; fps: number };
  /** 썸네일이 없는 신. 앞에서부터 하나씩 만든다. */
  targets: ThumbnailTarget[];
  onThumbnail: (slug: string, dataUrl: string) => void;
  /** 한 신의 시도가 끝났다(성공·실패·시간 초과). 같은 신을 다시 넘기지 않도록 부모가 기록한다. */
  onSettled: (slug: string) => void;
}

const GIVE_UP_MS = 30_000;
const PREVIEW_W = 320;

function Capture({ root, target, onThumbnail, onSettled }: { root: string; target: ThumbnailTarget; onThumbnail: ThumbnailGeneratorProps['onThumbnail']; onSettled: (slug: string) => void }) {
  const settledRef = useRef(onSettled);
  useEffect(() => {
    settledRef.current = onSettled;
  }, [onSettled]);
  // 신이 준비되지 않거나 캡처가 응답하지 않아도 다음 신으로 넘어간다.
  useEffect(() => {
    const id = setTimeout(() => settledRef.current(target.slug), GIVE_UP_MS);
    return () => clearTimeout(id);
  }, [target.slug]);
  useThumbnailCapture({ root, slug: target.slug, sceneType: target.sceneType, onThumbnail, onSettled: () => settledRef.current(target.slug) });
  return null;
}

/**
 * 썸네일이 없는 신을 보이지 않는 미리보기에서 열어 하나씩 캡처해 저장한다.
 * 화면 밖(display:none 등)에 두면 교차 출처 iframe의 렌더링이 멈추므로, 투명하게 겹쳐 두고 입력은 받지 않는다.
 */
export function ThumbnailGenerator({ root, canvas, targets, onThumbnail, onSettled }: ThumbnailGeneratorProps) {
  const { state } = usePreviewServer(root);
  const serverUrl = state.phase === 'running' ? state.url : null;
  const origin = previewOriginOf(serverUrl);
  const target = targets[0];
  const failed = state.phase === 'failed';
  // 서버를 못 띄우면 시도를 모두 끝낸 것으로 쳐서 다시 돌지 않게 한다(미리보기 패널이 따로 오류를 보여준다).
  const failedRef = useRef(onSettled);
  useEffect(() => {
    failedRef.current = onSettled;
  }, [onSettled]);
  useEffect(() => {
    if (failed) for (const t of targets) failedRef.current(t.slug);
  }, [failed, targets]);

  if (!target || failed) return null;
  const height = Math.round((PREVIEW_W * canvas.height) / canvas.width);
  return (
    <div aria-hidden data-testid="thumbnail-generator" className="pointer-events-none fixed bottom-0 right-0 -z-10 opacity-0" style={{ width: PREVIEW_W, height }}>
      <BridgeProvider key={target.slug} previewOrigin={origin} canvas={canvas}>
        <ScenePreview serverUrl={serverUrl} slug={target.slug} entry={target.entry} format={canvas} />
        <Capture root={root} target={target} onThumbnail={onThumbnail} onSettled={onSettled} />
      </BridgeProvider>
    </div>
  );
}
