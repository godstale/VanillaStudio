import { useState, useEffect } from 'react';
import { Plus, NotebookText, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWorkspaceTabs } from '@/lib/context/WorkspaceTabsContext';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import {
  listItems,
  createItem,
  updateItem,
  deleteItem,
} from '@/lib/collections/itemsRepo';
import type { CollectionItem } from '@/lib/types/collection';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

// Example domain panel: CRUD list backed by the project SQLite database.
// Copy this pattern for your own entities (see Docs/Extension-Guide.md).
export function CollectionListPanel() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const { openTab, updateTab } = useWorkspaceTabs();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CollectionItem | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!workspaceRoot) {
        if (active) setItems([]);
        return;
      }
      try {
        const next = await listItems();
        if (active) setItems(next);
      } catch (err) {
        console.error('Failed to list items:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [workspaceRoot]);

  const handleOpen = (item: CollectionItem) => {
    openTab({
      id: `collection:${item.id}`,
      type: 'collection-editor',
      title: item.title || t('collections.untitled'),
      meta: { itemId: item.id },
    });
  };

  const handleCreate = async () => {
    try {
      const item = await createItem(t('collections.untitled'));
      setItems((prev) => [item, ...prev]);
      handleOpen(item);
    } catch (err) {
      console.error('Failed to create item:', err);
    }
  };

  const commitRename = async (id: string) => {
    const title = renameValue.trim();
    setRenamingId(null);
    if (!title) return;
    try {
      const next = await updateItem(id, { title });
      if (next) {
        setItems((prev) => prev.map((it) => (it.id === id ? next : it)));
        updateTab(`collection:${id}`, { title: next.title });
      }
    } catch (err) {
      console.error('Failed to rename item:', err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteItem(deleteTarget.id);
      setItems((prev) => prev.filter((it) => it.id !== deleteTarget.id));
    } catch (err) {
      console.error('Failed to delete item:', err);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold">{t('collections.title')}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void handleCreate()}
          className="h-7 w-7"
          title={t('collections.newItem')}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {items.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 space-y-2">
            <NotebookText className="h-8 w-8 mx-auto opacity-30" />
            <p className="text-xs">{t('collections.empty')}</p>
            <p className="text-[11px] opacity-70">
              {t('collections.emptyHint')}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 cursor-pointer"
              onClick={() => handleOpen(item)}
            >
              <NotebookText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {renamingId === item.id ? (
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={() => void commitRename(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitRename(item.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="h-6 text-xs"
                />
              ) : (
                <span
                  className="flex-1 min-w-0 truncate text-xs"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(item.id);
                    setRenameValue(item.title);
                  }}
                  title={t('collections.rename')}
                >
                  {item.title || t('collections.untitled')}
                </span>
              )}
              <button
                type="button"
                aria-label={t('collections.delete')}
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(item);
                }}
                className={cn(
                  'p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                  'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="px-3 py-1.5 border-t border-border text-[10px] text-muted-foreground">
        {t('collections.items', { count: items.length })}
      </div>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('collections.deleteTitle')}</DialogTitle>
            <DialogDescription>{t('collections.deleteDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t('collections.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              {t('collections.confirmDelete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
