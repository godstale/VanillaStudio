import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

interface FloatingPanelProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  /** true면 헤더 드래그로 패널을 움직일 수 있다. */
  draggable?: boolean;
}

/** 우측 인스펙터 대신 쓰는 플로팅 박스. 크기를 조절할 수 있으며 부모(relative) 안에서 겹쳐 보인다. */
export function FloatingPanel({ title, onClose, children, className, style, testId, draggable }: FloatingPanelProps) {
  const { t } = useLanguage();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  const onHeaderPointerDown = (e: React.PointerEvent) => {
    if (!draggable) return;
    // 닫기 버튼에서 시작한 드래그는 무시한다.
    if ((e.target as HTMLElement).closest('button')) return;
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHeaderPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setOffset({ x: d.baseX + e.clientX - d.startX, y: d.baseY + e.clientY - d.startY });
  };
  const endDrag = () => {
    drag.current = null;
  };
  return (
    <div
      role="dialog"
      aria-label={title}
      data-testid={testId}
      style={{ width: 400, maxHeight: '100%', ...style, ...(draggable ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : null) }}
      className={cn('absolute flex min-h-40 min-w-64 resize flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl', className)}
    >
      <div
        className={cn('flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2', draggable && 'cursor-move touch-none select-none')}
        title={draggable ? t('float.dragHint') : undefined}
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <b className="truncate text-xs">{title}</b>
        {onClose && (
          <button type="button" aria-label={t('float.close')} onClick={onClose} className="rounded p-0.5 text-muted-foreground hover:bg-accent">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
