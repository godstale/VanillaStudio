import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWorkspaceTabs } from '@/lib/context/WorkspaceTabsContext';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import noticeText from '../../../NOTICE.md?raw';

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

      <div className="border border-border rounded-xl p-5 bg-card/40 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{t('userGuide.title')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('userGuide.desc')}
          </p>
        </div>
        <ul className="text-xs space-y-1.5" data-testid="user-guide-links">
          <li className="flex items-center justify-between gap-2">
            <span>{t('userGuide.gettingStarted')}</span>
            <code className="text-muted-foreground">Docs/User-Guide/01-getting-started.md</code>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>{t('userGuide.doctor')}</span>
            <code className="text-muted-foreground">Docs/User-Guide/02-doctor.md</code>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>{t('userGuide.pipeline')}</span>
            <code className="text-muted-foreground">Docs/User-Guide/03-pipeline.md</code>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span>{t('userGuide.exportLimits')}</span>
            <code className="text-muted-foreground">Docs/User-Guide/04-export-limits.md</code>
          </li>
        </ul>
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

      <div className="border border-border rounded-xl p-5 bg-card/40 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{t('settingsApp.notice')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('settingsApp.noticeDesc')}
          </p>
        </div>
        <details>
          <summary className="text-xs font-medium cursor-pointer text-primary">
            {t('settingsApp.noticeView')}
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed border border-border rounded-lg p-3 bg-background">
            {noticeText}
          </pre>
        </details>
      </div>
    </div>
  );
}

export default SettingsApp;
