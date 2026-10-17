import type { CSSProperties, ReactNode } from 'react';
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
}

/** 우측 인스펙터 대신 쓰는 플로팅 박스. 크기를 조절할 수 있으며 부모(relative) 안에서 겹쳐 보인다. */
export function FloatingPanel({ title, onClose, children, className, style, testId }: FloatingPanelProps) {
  const { t } = useLanguage();
  return (
    <div
      role="dialog"
      aria-label={title}
      data-testid={testId}
      style={{ width: 400, maxHeight: '100%', ...style }}
      className={cn('absolute flex min-h-40 min-w-64 resize flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl', className)}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
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
