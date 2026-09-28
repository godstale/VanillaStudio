import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWorkspaceTabs } from '@/lib/context/WorkspaceTabsContext';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// Example app-level settings page: layout reset + recent-folder cleanup.
// Add your own app settings here and persist them via SettingsContext.
export function SettingsApp() {
  const { t } = useLanguage();
  const { closeAllTabs } = useWorkspaceTabs();
  const { clearRecentWorkspaces } = useWorkspace();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">{t('settingsApp.title')}</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {t('settingsApp.desc')}
        </p>
      </div>

      <div className="border border-border rounded-xl p-5 bg-card/40 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{t('settingsApp.storage')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('settingsApp.storageDesc')}
          </p>
        </div>
      </div>

      <div className="border border-border rounded-xl p-5 bg-card/40 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold">
              {t('settingsApp.resetLayout')}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('settingsApp.resetLayoutDesc')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              closeAllTabs();
              setNotice(t('settingsApp.resetLayoutDone'));
            }}
          >
            {t('settingsApp.resetLayout')}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
          <div>
            <h3 className="text-sm font-semibold">
              {t('settingsApp.clearRecent')}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('settingsApp.clearRecentDesc')}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              clearRecentWorkspaces();
              setNotice(t('settingsApp.clearRecentDone'));
            }}
          >
            {t('settingsApp.clearRecent')}
          </Button>
        </div>
        {notice && <p className="text-xs text-success">{notice}</p>}
      </div>
    </div>
  );
}

export default SettingsApp;
