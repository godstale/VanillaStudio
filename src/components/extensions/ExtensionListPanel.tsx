import { useState, useEffect } from 'react';
import { Puzzle, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkspaceTabs } from '@/lib/context/WorkspaceTabsContext';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useSettings } from '@/lib/context/SettingsContext';
import { scanWorkspaceExtensions } from '@/lib/extensions/scanner';
import type { ExtensionManifest } from '@/lib/types/extension';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { cn } from '@/lib/utils';

// Example file-scan panel: reads manifests from `.extensions/`
// and persists the enabled set in app_settings.
export function ExtensionListPanel() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  const { openTab } = useWorkspaceTabs();
  const { settings, updateSettings } = useSettings();
  const [manifests, setManifests] = useState<ExtensionManifest[]>([]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!workspaceRoot) {
        if (active) setManifests([]);
        return;
      }
      try {
        const next = await scanWorkspaceExtensions(workspaceRoot);
        if (active) setManifests(next);
      } catch (err) {
        console.error('Failed to scan extensions:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [workspaceRoot]);

  const enabledSet = new Set(settings.enabledExtensions);

  const toggle = async (name: string) => {
    const next = enabledSet.has(name)
      ? settings.enabledExtensions.filter((n) => n !== name)
      : [...settings.enabledExtensions, name];
    await updateSettings({ enabledExtensions: next });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold">{t('extensions.title')}</span>
        <span className="text-[10px] text-muted-foreground">
          {t('extensions.enabled', {
            count: settings.enabledExtensions.length,
          })}
        </span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {manifests.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 space-y-2">
            <Puzzle className="h-8 w-8 mx-auto opacity-30" />
            <p className="text-xs">{t('extensions.empty')}</p>
            <p className="text-[11px] opacity-70 font-mono">
              {t('extensions.emptyHint')}
            </p>
          </div>
        ) : (
          manifests.map((m) => {
            const enabled = enabledSet.has(m.name);
            return (
              <div
                key={m.name}
                className="rounded-md border border-border/60 p-2.5 space-y-1.5 hover:bg-accent/30 cursor-pointer"
                onClick={() =>
                  openTab({
                    id: `extension:${m.name}`,
                    type: 'extension-viewer',
                    title: m.name,
                    meta: { extensionName: m.name },
                  })
                }
              >
                <div className="flex items-center gap-2">
                  {enabled ? (
                    <Puzzle className="h-3.5 w-3.5 shrink-0 text-success" />
                  ) : (
                    <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold font-mono">
                    {m.name}
                  </span>
                  <Button
                    variant={enabled ? 'default' : 'outline'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggle(m.name);
                    }}
                    className={cn(
                      'h-6 px-2 text-[10px]',
                      !enabled && 'text-muted-foreground',
                    )}
                  >
                    {enabled ? t('extensions.disable') : t('extensions.enable')}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {m.description}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
