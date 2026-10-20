import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useBridge } from '@/lib/review/bridgeContextValue';
import { previewFrameUrl, sceneEntryPath } from '@/lib/review/bridgeProtocol';
import { computePreviewLayout, type PreviewZoom } from '@/lib/review/previewLayout';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export interface ScenePreviewProps {
  /** 프리뷰 서버 URL(`http://127.0.0.1:<port>`). 서버가 뜨기 전에는 아무것도 그리지 않는다. */
  serverUrl: string | null;
  slug: string;
  entry?: string;
  /** workspace.json.canvas 크기. 화면비를 맞추는 데 쓴다. */
  format: { width: number; height: number };
  zoom?: PreviewZoom;
}

/**
 * 신 하나의 미리보기 iframe. 앱과 다른 origin(`127.0.0.1:<port>`)이라 신 코드는 앱 명령을 호출할 수 없다(Technical-Design §10).
 * `allow-same-origin`은 "프리뷰 서버와 같은 origin"일 뿐이며 Vite HMR에 필요하다.
 */
export function ScenePreview({ serverUrl, slug, entry, format, zoom = 'fit' }: ScenePreviewProps) {
  const { t } = useLanguage();
  const { registerFrame } = useBridge();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 480, height: 320 });

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth || 480, height: el.clientHeight || 320 });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const src = useMemo(() => (serverUrl ? previewFrameUrl(serverUrl, window.location.origin, sceneEntryPath(slug, entry)) : null), [serverUrl, slug, entry]);
  const layout = computePreviewLayout({ container: size, format, zoom, deviceWidth: null });

  const attach = useCallback(() => registerFrame(frameRef.current?.contentWindow ?? null), [registerFrame]);
  useEffect(() => {
    attach();
    return () => registerFrame(null);
  }, [attach, registerFrame, src]);

  return (
    <div ref={hostRef} data-testid="preview-host" className="relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-muted">
      {src && (
        <div data-testid="preview-box" className="shrink-0 overflow-hidden shadow-lg" style={{ width: layout.box.width, height: layout.box.height }}>
          <iframe
            ref={frameRef}
            key={src}
            title={t('preview.frameTitle')}
            src={src}
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            onLoad={attach}
            className="block origin-top-left border-0 bg-background"
            style={{ width: layout.frame.width, height: layout.frame.height, transform: `scale(${layout.scale})` }}
          />
        </div>
      )}
    </div>
  );
}
