import { useEffect, useRef } from 'react';
import { useBridge, useBridgeEvents } from '@/lib/review/bridgeContextValue';
import { saveThumbnail } from '@/lib/scene/thumbnail';

const THUMB_SCALE = 0.25;
const THUMB_SETTLE_MS = 400;

export interface ThumbnailCaptureOptions {
  root: string;
  slug: string;
  sceneType: 'static' | 'motion' | '3d';
  /** 저장된 썸네일을 알린다. 없으면 캡처하지 않는다. */
  onThumbnail?: (slug: string, dataUrl: string) => void;
  /** 캡처 시도가 끝났다(성공·실패 모두). */
  onSettled?: (ok: boolean) => void;
}

/** 미리보기가 준비될 때마다 썸네일을 한 번 캡처해 저장한다(T4.8). 첫 프레임이 비는 신이 많아 영상 신은 길이의 30% 지점에서 찍는다. */
export function useThumbnailCapture({ root, slug, sceneType, onThumbnail, onSettled }: ThumbnailCaptureOptions): void {
  const bridge = useBridge();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useBridgeEvents((e) => {
    if (e.type !== 'ready' || !onThumbnail) return;
    if (timer.current) clearTimeout(timer.current);
    const at = sceneType !== 'static' && e.payload.duration ? e.payload.duration * 0.3 : null;
    if (at !== null) bridge.seek(at);
    timer.current = setTimeout(() => {
      let ok = false;
      bridge
        .capture(THUMB_SCALE)
        .then(async (c) => {
          if (await saveThumbnail(root, slug, c.dataUrl)) {
            ok = true;
            onThumbnail(slug, c.dataUrl);
          }
        })
        .catch(() => undefined) // 썸네일은 부가 기능이다. 실패해도 미리보기는 계속 쓴다.
        .finally(() => {
          if (at !== null) bridge.seek(0);
          onSettled?.(ok);
        });
    }, THUMB_SETTLE_MS);
  });
}
