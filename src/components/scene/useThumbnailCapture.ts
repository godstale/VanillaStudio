import { useEffect, useRef } from 'react';
import { useBridge, useBridgeEvents } from '@/lib/review/bridgeContextValue';
import { pickBestFrame, RICH_SCORE, scoreFrame, type ScoredFrame } from '@/lib/scene/frameScore';
import { saveThumbnail } from '@/lib/scene/thumbnail';

const THUMB_SCALE = 0.25;
const THUMB_SETTLE_MS = 400;
/** 시크 후 렌더가 반영되길 기다리는 시간. */
const SEEK_SETTLE_MS = 250;
/** 영상 신에서 후보로 찍는 길이 비율. 앞에서부터 보고, 내용이 충분한 프레임이 나오면 멈춘다. */
const MOTION_FRACTIONS = [0.3, 0.5, 0.7, 0.9, 0.15];
/** 정적 신은 시간축이 없어 진입 애니메이션이 끝나길 기다리며 다시 찍는다(미리보기 준비 후 ms). */
const STATIC_DELAYS_MS = [THUMB_SETTLE_MS, 1400, 2800];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface ThumbnailCaptureOptions {
  root: string;
  slug: string;
  sceneType: 'static' | 'motion' | '3d';
  /** 저장된 썸네일을 알린다. 없으면 캡처하지 않는다. */
  onThumbnail?: (slug: string, dataUrl: string) => void;
  /** 캡처 시도가 끝났다(성공·실패 모두). */
  onSettled?: (ok: boolean) => void;
}

/**
 * 미리보기가 준비될 때마다 썸네일을 한 번 캡처해 저장한다(T4.8).
 * 모션은 시작·끝이 빈 화면인 경우가 많아 여러 시점을 찍어 내용이 가장 잘 보이는 프레임을 고른다.
 */
export function useThumbnailCapture({ root, slug, sceneType, onThumbnail, onSettled }: ThumbnailCaptureOptions): void {
  const bridge = useBridge();
  const run = useRef(0);
  useEffect(
    () => () => {
      run.current++;
    },
    [],
  );

  useBridgeEvents((e) => {
    if (e.type !== 'ready' || !onThumbnail) return;
    const id = ++run.current;
    const superseded = () => run.current !== id;
    const duration = sceneType !== 'static' ? e.payload.duration : undefined;

    void (async () => {
      const frames: ScoredFrame[] = [];
      const grab = async () => {
        const c = await bridge.capture(THUMB_SCALE);
        frames.push({ dataUrl: c.dataUrl, score: await scoreFrame(c.dataUrl) });
        return frames[frames.length - 1]!.score >= RICH_SCORE;
      };
      let sought = false;
      let ok = false;
      try {
        if (duration) {
          await sleep(THUMB_SETTLE_MS);
          for (const f of MOTION_FRACTIONS) {
            if (superseded()) return;
            bridge.seek(duration * f);
            sought = true;
            await sleep(SEEK_SETTLE_MS);
            if (await grab()) break;
          }
        } else {
          let waited = 0;
          for (const at of STATIC_DELAYS_MS) {
            await sleep(at - waited);
            waited = at;
            if (superseded()) return;
            if (await grab()) break;
          }
        }
        const best = pickBestFrame(frames);
        if (superseded() || !best) return;
        if (await saveThumbnail(root, slug, best.dataUrl)) {
          ok = true;
          onThumbnail(slug, best.dataUrl);
        }
      } catch {
        // 썸네일은 부가 기능이다. 실패해도 미리보기는 계속 쓴다.
      } finally {
        if (!superseded()) {
          if (sought) bridge.seek(0);
          onSettled?.(ok);
        }
      }
    })();
  });
}
