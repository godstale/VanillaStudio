import { useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BridgeProvider } from '@/lib/review/BridgeContext';
import { useBridge } from '@/lib/review/bridgeContextValue';
import { previewOriginOf } from '@/lib/review/bridgeProtocol';
import { DEVICE_PRESETS, nextZoom, type PreviewBackground, type PreviewZoom } from '@/lib/review/previewLayout';
import { usePreviewServer, type PreviewServerState } from '@/lib/review/previewServer';
import { useReviewProject } from '@/lib/review/reviewProject';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { resolveAgentAccess } from '@/lib/project/access';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';
import { Preview } from '@/components/review/Preview';

const BACKGROUNDS: PreviewBackground[] = ['checker', 'canvas', 'light', 'dark'];

function ServerStatus({ state, onRetry }: { state: PreviewServerState; onRetry: () => void }) {
  const { t } = useLanguage();
  if (state.phase === 'running' || state.phase === 'idle') return null;
  const failed = state.phase === 'failed';
  const errorKey = failed && state.error === 'not-installed' ? 'review.status.notInstalled' : 'review.status.failed';
  return (
    <div
      role={failed ? 'alert' : 'status'}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 p-6 text-center text-sm"
    >
      {failed ? (
        <>
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="text-foreground">{t(errorKey)}</p>
          {state.error !== 'not-installed' && <p className="max-w-md break-all text-xs text-muted-foreground">{state.error}</p>}
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            {t('review.status.retry')}
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">{t(state.phase === 'restarting' ? 'review.status.restarting' : 'review.status.starting')}</p>
        </>
      )}
    </div>
  );
}

function ReviewBody({ root, server, onRetry }: { root: string; server: PreviewServerState; onRetry: () => void }) {
  const { t } = useLanguage();
  const project = useReviewProject(root);
  const bridge = useBridge();
  const [zoom, setZoom] = useState<PreviewZoom>('fit');
  const [background, setBackground] = useState<PreviewBackground>('checker');
  const [device, setDevice] = useState<(typeof DEVICE_PRESETS)[number]['id']>('desktop');
  const deviceWidth = DEVICE_PRESETS.find((d) => d.id === device)?.width ?? null;
  const showDevices = project.outputType === 'web';
  const serverUrl = server.phase === 'running' ? server.url : null;

  const zoomLabel = zoom === 'fit' ? t('review.toolbar.fit') : `${Math.round(zoom * 100)}%`;
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background" data-testid="review-tab">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 text-xs">
        <div className="flex items-center gap-1" role="group" aria-label={t('review.toolbar.zoom')}>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t('review.toolbar.zoomOut')} onClick={() => setZoom((z) => nextZoom(z === 'fit' ? 1 : z, -1))}>
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant={zoom === 'fit' ? 'secondary' : 'ghost'} className="h-7 min-w-14 px-2" onClick={() => setZoom('fit')}>
            {zoomLabel}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={t('review.toolbar.zoomIn')} onClick={() => setZoom((z) => nextZoom(z === 'fit' ? 1 : z, 1))}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label={t('review.toolbar.background')}>
          {BACKGROUNDS.map((b) => (
            <Button key={b} size="sm" variant={background === b ? 'secondary' : 'ghost'} className="h-7 px-2" aria-pressed={background === b} onClick={() => setBackground(b)}>
              {t(`review.bg.${b}`)}
            </Button>
          ))}
        </div>
        {showDevices && (
          <div className="flex items-center gap-1" role="group" aria-label={t('review.toolbar.device')}>
            {DEVICE_PRESETS.map((d) => (
              <Button key={d.id} size="sm" variant={device === d.id ? 'secondary' : 'ghost'} className="h-7 px-2" aria-pressed={device === d.id} onClick={() => setDevice(d.id)}>
                {t(`review.device.${d.id}`)}
              </Button>
            ))}
          </div>
        )}
        <span className={cn('ml-auto text-muted-foreground', bridge.status === 'ready' && 'text-success')} data-testid="bridge-status">
          {t(`review.bridge.${bridge.status}`)}
        </span>
      </div>
      {bridge.error && (
        <div role="alert" className="flex shrink-0 items-start gap-2 border-b border-border bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-all">{bridge.error.message}</span>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <ServerStatus state={server} onRetry={onRetry} />
        <Preview serverUrl={serverUrl} format={project.format} zoom={zoom} background={background} deviceWidth={showDevices ? deviceWidth : null} />
      </div>
    </div>
  );
}

/** Review studio (F-REV-01): the live preview of the open project plus its controls. */
export function ReviewTab() {
  const { t } = useLanguage();
  const { workspaceRoot, isTrusted } = useWorkspace();
  const access = resolveAgentAccess({ workspaceRoot, isTrusted });
  // Starting the preview runs project code (vite.config.ts), so it needs the same trust as an agent session.
  const projectDir = access.allowed ? workspaceRoot : null;
  const { state, retry } = usePreviewServer(projectDir);
  const origin = useMemo(() => previewOriginOf(state.phase === 'running' ? state.url : null), [state]);

  if (!access.allowed || !workspaceRoot) {
    return (
      <div data-testid="review-tab-blocked" className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {t(access.allowed ? 'review.status.noProject' : access.reason === 'untrusted' ? 'review.status.untrusted' : 'review.status.noProject')}
      </div>
    );
  }
  return (
    <BridgeProvider previewOrigin={origin}>
      <ReviewBody root={workspaceRoot} server={state} onRetry={retry} />
    </BridgeProvider>
  );
}

export default ReviewTab;
