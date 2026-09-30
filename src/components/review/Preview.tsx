import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useBridge } from '@/lib/review/bridgeContextValue';
import { previewFrameUrl } from '@/lib/review/bridgeProtocol';
import {
  computePreviewLayout,
  type PreviewBackground,
  type PreviewZoom,
} from '@/lib/review/previewLayout';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

export interface PreviewProps {
  /** Preview server URL (`http://127.0.0.1:<port>`); nothing is rendered until it exists. */
  serverUrl: string | null;
  format: { width: number; height: number };
  zoom?: PreviewZoom;
  background?: PreviewBackground;
  /** Fixed frame width for the device preview (web output); `null` uses the format size. */
  deviceWidth?: number | null;
}

const BACKGROUNDS: Record<PreviewBackground, { className: string; style?: CSSProperties }> = {
  checker: {
    className: 'bg-muted',
    style: {
      backgroundImage:
        'linear-gradient(45deg, hsl(var(--border)) 25%, transparent 25%, transparent 75%, hsl(var(--border)) 75%), linear-gradient(45deg, hsl(var(--border)) 25%, transparent 25%, transparent 75%, hsl(var(--border)) 75%)',
      backgroundSize: '16px 16px',
      backgroundPosition: '0 0, 8px 8px',
    },
  },
  canvas: { className: 'bg-background' },
  light: { className: 'bg-foreground' },
  dark: { className: 'bg-code' },
};

/**
 * The preview iframe. It is cross-origin (`127.0.0.1:<port>` vs the app origin) and the app grants that
 * origin no Tauri capability, so scene code cannot call app commands (Technical-Design section 10).
 * `allow-same-origin` here only means "same origin as the preview server", which Vite HMR needs.
 */
export function Preview({ serverUrl, format, zoom = 'fit', background = 'checker', deviceWidth = null }: PreviewProps) {
  const { t } = useLanguage();
  const { registerFrame } = useBridge();
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const src = useMemo(() => (serverUrl ? previewFrameUrl(serverUrl, window.location.origin) : null), [serverUrl]);
  const layout = computePreviewLayout({ container: size, format, zoom, deviceWidth });

  const attach = useCallback(() => registerFrame(frameRef.current?.contentWindow ?? null), [registerFrame]);
  useEffect(() => {
    attach();
    return () => registerFrame(null);
  }, [attach, registerFrame, src]);

  const bg = BACKGROUNDS[background];
  return (
    <div
      ref={hostRef}
      data-testid="preview-host"
      className={cn('relative flex h-full w-full items-center justify-center overflow-auto', bg.className)}
      style={bg.style}
    >
      {src && (
        <div
          data-testid="preview-box"
          className="shrink-0 overflow-hidden shadow-lg"
          style={{ width: layout.box.width, height: layout.box.height }}
        >
          <iframe
            ref={frameRef}
            key={src}
            title={t('review.preview.frameTitle')}
            src={src}
            sandbox="allow-scripts allow-same-origin"
            referrerPolicy="no-referrer"
            onLoad={attach}
            className="block origin-top-left border-0 bg-background"
            style={{
              width: layout.frame.width,
              height: layout.frame.height,
              transform: `scale(${layout.scale})`,
            }}
          />
        </div>
      )}
    </div>
  );
}
