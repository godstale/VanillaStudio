import { useLanguage } from '@/lib/i18n/LanguageContext';

interface Props {
  contentJson: string | null;
  itemsJson: string | null;
}

function parseLen(text: string | null): number {
  if (!text) return 0;
  try {
    const v = JSON.parse(text) as { hierarchy?: unknown[]; items?: unknown[] };
    if (Array.isArray(v.hierarchy)) return v.hierarchy.length;
    if (Array.isArray(v.items)) return v.items.length;
    return 0;
  } catch {
    return 0;
  }
}

/** 2층: 핵심 재료 뷰어 (문구 위계 + 아이템 테이블 원문). */
export function MaterialsViewer({ contentJson, itemsJson }: Props) {
  const { t } = useLanguage();
  return (
    <section className="space-y-2 rounded-lg border border-border p-4" aria-label={t('storyboard.materials')}>
      <h2 className="text-sm font-bold">{t('storyboard.materials')}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-medium">{t('storyboard.contentHierarchy')} ({parseLen(contentJson)})</h3>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{contentJson ?? t('storyboard.empty')}</pre>
        </div>
        <div>
          <h3 className="text-xs font-medium">{t('storyboard.itemsTable')} ({parseLen(itemsJson)})</h3>
          <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">{itemsJson ?? t('storyboard.empty')}</pre>
        </div>
      </div>
    </section>
  );
}
