import { useEffect, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

// 웹 프리뷰·테스트에는 Tauri 창이 없으므로 호출 실패는 무시한다.
async function withWindow(fn: (w: import('@tauri-apps/api/window').Window) => unknown): Promise<void> {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await fn(getCurrentWindow());
  } catch {
    // Tauri 밖
  }
}

function CaptionButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex h-full w-11 items-center justify-center text-muted-foreground transition-colors',
        danger ? 'hover:bg-destructive hover:text-destructive-foreground' : 'hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** 앱이 그리는 타이틀 라인(네이티브 장식 없음). 빈 영역 드래그로 창 이동, 더블클릭으로 최대화 전환. */
export function TitleBar() {
  const { t } = useLanguage();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void withWindow(async (w) => {
      const sync = async () => setMaximized(await w.isMaximized());
      await sync();
      const off = await w.onResized(() => void sync());
      if (disposed) off();
      else unlisten = off;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  return (
    <header className="flex h-8 shrink-0 select-none items-stretch border-b border-border bg-sidebar">
      <div
        data-tauri-drag-region
        onDoubleClick={() => void withWindow((w) => w.toggleMaximize())}
        className="flex min-w-0 flex-1 items-center px-3 text-xs font-medium text-muted-foreground"
      >
        <span data-tauri-drag-region className="truncate">{t('app.title')}</span>
      </div>
      <CaptionButton label={t('shell.window.minimize')} onClick={() => void withWindow((w) => w.minimize())}>
        <Minus className="h-4 w-4" />
      </CaptionButton>
      <CaptionButton label={t(maximized ? 'shell.window.restore' : 'shell.window.maximize')} onClick={() => void withWindow((w) => w.toggleMaximize())}>
        {maximized ? <Copy className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      </CaptionButton>
      <CaptionButton label={t('shell.window.close')} danger onClick={() => void withWindow((w) => w.close())}>
        <X className="h-4 w-4" />
      </CaptionButton>
    </header>
  );
}
