import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import type { WorkspaceTab } from '@/lib/types/workspaceTab';
import { getItem, updateItem } from '@/lib/collections/itemsRepo';
import { useWorkspaceTabs } from '@/lib/context/WorkspaceTabsContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

export interface CollectionEditorTabProps {
  tab: WorkspaceTab;
}

// Example entity editor tab: loads by meta.itemId, autosaves with debounce.
// Opened with id `collection:<itemId>` so reopening focuses the same tab.
export function CollectionEditorTab({ tab }: CollectionEditorTabProps) {
  const { t } = useLanguage();
  const { updateTab } = useWorkspaceTabs();
  const itemId = tab.meta?.itemId as string | undefined;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<
    'loading' | 'idle' | 'saving' | 'saved' | 'error' | 'missing'
  >('loading');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!itemId) {
        if (active) setStatus('missing');
        return;
      }
      if (active) setStatus('loading');
      try {
        const item = await getItem(itemId);
        if (!active) return;
        if (!item) {
          setStatus('missing');
          return;
        }
        loadedId.current = item.id;
        setTitle(item.title);
        setBody(item.body);
        setStatus('idle');
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [itemId]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const scheduleSave = (nextTitle: string, nextBody: string) => {
    if (!itemId || loadedId.current !== itemId) return;
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void updateItem(itemId, { title: nextTitle, body: nextBody })
        .then((next) => {
          if (next) {
            setStatus('saved');
            updateTab(tab.id, {
              title: next.title || t('collections.untitled'),
            });
          } else {
            setStatus('missing');
          }
        })
        .catch(() => setStatus('error'));
    }, 500);
  };

  if (status === 'missing') {
    return (
      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
        {t('collectionEditor.notFound')}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 p-4 gap-3 overflow-hidden">
      <div className="shrink-0 space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground">
          {t('collectionEditor.titleLabel')}
        </label>
        <Input
          value={title}
          disabled={status === 'loading'}
          placeholder={t('collectionEditor.titlePlaceholder')}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave(e.target.value, body);
          }}
          className="text-sm font-semibold"
        />
      </div>
      <div className="flex-1 min-h-0 flex flex-col space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground shrink-0">
          {t('collectionEditor.bodyLabel')}
        </label>
        <textarea
          value={body}
          disabled={status === 'loading'}
          onChange={(e) => {
            setBody(e.target.value);
            scheduleSave(title, e.target.value);
          }}
          className="flex-1 min-h-0 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
      <div
        className={cn(
          'shrink-0 text-[11px]',
          status === 'error' ? 'text-destructive' : 'text-muted-foreground',
        )}
      >
        {status === 'loading' && t('collectionEditor.loading')}
        {status === 'saving' && t('collectionEditor.saving')}
        {status === 'saved' && t('collectionEditor.saved')}
        {status === 'error' && t('collectionEditor.saveFailed')}
      </div>
    </div>
  );
}
