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
  /** false면 크기 조절 핸들을 숨긴다. 기본 true. */
  resizable?: boolean;
}

/** 우측 인스펙터 대신 쓰는 플로팅 박스. 4 귀퉁이·4 모서리 핸들로 크기를 조절할 수 있다. */
export function FloatingPanel({ title, onClose, children, className, style, testId, draggable, resizable = true }: FloatingPanelProps) {
  const { t } = useLanguage();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState<{ width?: number; height?: number }>(() => ({
    width: typeof style?.width === 'number' ? style.width : undefined,
    height: typeof style?.height === 'number' ? style.height : undefined,
  }));
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const resize = useRef<{ dir: string; startX: number; startY: number; w: number; h: number; ox: number; oy: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

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

  const startResize = (dir: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = boxRef.current;
    const rect = el?.getBoundingClientRect();
    resize.current = {
      dir,
      startX: e.clientX,
      startY: e.clientY,
      w: rect?.width ?? size.width ?? 400,
      h: rect?.height ?? (typeof size.height === 'number' ? size.height : 320),
      ox: offset.x,
      oy: offset.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    const r = resize.current;
    if (!r) return;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    let w = r.w;
    let h = r.h;
    let ox = r.ox;
    let oy = r.oy;
    if (r.dir.includes('e')) w = r.w + dx;
    if (r.dir.includes('s')) h = r.h + dy;
    if (r.dir.includes('w')) {
      w = r.w - dx;
      ox = r.ox + dx;
    }
    if (r.dir.includes('n')) {
      h = r.h - dy;
      oy = r.oy + dy;
    }
    w = Math.max(240, Math.min(window.innerWidth - 32, w));
    h = Math.max(160, Math.min(window.innerHeight - 32, h));
    setSize({ width: Math.round(w), height: Math.round(h) });
    setOffset({ x: ox, y: oy });
  };
  const endResize = () => {
    resize.current = null;
  };

  const handles: { dir: string; className: string; cursor: string; label: string }[] = [
    { dir: 'n', className: 'left-3 right-3 top-0 h-2 -translate-y-1/2', cursor: 'ns-resize', label: '북' },
    { dir: 's', className: 'bottom-0 left-3 right-3 h-2 translate-y-1/2', cursor: 'ns-resize', label: '남' },
    { dir: 'e', className: 'bottom-3 right-0 top-3 w-2 translate-x-1/2', cursor: 'ew-resize', label: '동' },
    { dir: 'w', className: 'bottom-3 left-0 top-3 w-2 -translate-x-1/2', cursor: 'ew-resize', label: '서' },
    { dir: 'ne', className: 'right-0 top-0 h-3 w-3 translate-x-1/2 -translate-y-1/2', cursor: 'nesw-resize', label: '북동' },
    { dir: 'nw', className: 'left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize', label: '북서' },
    { dir: 'se', className: 'bottom-0 right-0 h-3 w-3 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize', label: '남동' },
    { dir: 'sw', className: 'bottom-0 left-0 h-3 w-3 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize', label: '남서' },
  ];

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label={title}
      data-testid={testId}
      style={{
        width: size.width ?? 400,
        height: size.height,
        maxHeight: '100%',
        ...style,
        ...(size.width !== undefined ? { width: size.width } : null),
        ...(size.height !== undefined ? { height: size.height } : null),
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
      className={cn('absolute flex min-h-40 min-w-60 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl', className)}
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
      {resizable &&
        handles.map((h) => (
          <div
            key={h.dir}
            role="separator"
            aria-label={`${t('float.resize')}: ${h.label}`}
            data-testid={testId ? `${testId}-resize-${h.dir}` : undefined}
            className={`absolute z-10 touch-none ${h.className}`}
            style={{ cursor: h.cursor }}
            onPointerDown={startResize(h.dir)}
            onPointerMove={onResizeMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
        ))}
    </div>
  );
}
