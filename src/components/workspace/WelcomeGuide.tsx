import {
  FolderOpen,
  Clock,
  Files,
  Columns2,
  Languages,
  ArrowRight,
  FilePlus2,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppMark } from '@/components/brand/AppMark';
import { APP_NAME } from '@/lib/brand';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';
import { projectFolderExists } from '@/lib/project/openProject';
import { NewProjectWizard } from '@/components/project/NewProjectWizard';
import { DoctorWelcomeBadge } from '@/components/doctor/DoctorBadge';

// Shown when no folder is open, and in `welcome` tabs.
// Replace the highlight cards with your own feature tour.
export function WelcomeGuide() {
  const { t } = useLanguage();
  const {
    workspaceRoot,
    setWorkspaceRoot,
    recentWorkspaces,
    isTrusted,
    setTrustModalOpen,
  } = useWorkspace();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [missingPath, setMissingPath] = useState<string | null>(null);

  const handleOpenRecent = async (path: string) => {
    if (!(await projectFolderExists(path))) {
      setMissingPath(path);
      return;
    }
    setMissingPath(null);
    setWorkspaceRoot(path);
  };

  const handlePickFolder = async () => {
    try {
      const picked = await invoke<string | null>('pick_project_folder');
      if (picked) {
        setWorkspaceRoot(picked);
      }
    } catch (err) {
      console.error('Failed to pick project folder:', err);
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto flex flex-col items-center justify-center p-8 select-none bg-background text-foreground">
      <div className="max-w-xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className="text-center space-y-3">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-card border border-border items-center justify-center text-brand shadow-sm">
            <AppMark className="h-10 w-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            {t('welcome.subtitle')}
            <br />
            {t('welcome.guide')}
          </p>
          <DoctorWelcomeBadge />
        </div>

        <div className="border border-border/80 rounded-2xl bg-card p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <FolderOpen className="h-4 w-4 text-warning" />
              {t('welcome.openTitle')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('welcome.openDesc')}
            </p>
          </div>

          <Button
            size="lg"
            onClick={() => void handlePickFolder()}
            className="w-full h-11 gap-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
          >
            <FolderOpen className="h-4 w-4" />
            <span>{t('welcome.pickFolder')}</span>
            <ArrowRight className="h-4 w-4 ml-auto opacity-70" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setWizardOpen(true)}
            className="w-full h-11 gap-2 text-sm font-semibold"
          >
            <FilePlus2 className="h-4 w-4" />
            <span>{t('project.new')}</span>
          </Button>
          <NewProjectWizard open={wizardOpen} onOpenChange={setWizardOpen} />

          {recentWorkspaces.length > 0 && (
            <div className="pt-3 border-t border-border/60 space-y-2">
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{t('welcome.recent')}</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {recentWorkspaces.slice(0, 5).map((path) => (
                  <button
                    key={path}
                    type="button"
                    onClick={() => void handleOpenRecent(path)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-muted/60 transition-colors text-left group border border-transparent hover:border-border/60"
                  >
                    <span className="font-mono truncate text-foreground text-[11px]">
                      {path}
                    </span>
                    <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      {t('welcome.open')}
                    </span>
                  </button>
                ))}
              </div>
              {missingPath && (
                <div role="alert" className="text-[11px] text-destructive break-all">
                  {t('project.recent.missing', { path: missingPath })}
                </div>
              )}
            </div>
          )}
        </div>

        {workspaceRoot && !isTrusted && (
          <div className="border border-warning/40 rounded-xl bg-warning/10 p-4 flex items-start gap-3">
            <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="space-y-2 min-w-0">
              <p className="text-xs text-foreground leading-relaxed">
                {t('project.untrusted.notice')}
              </p>
              <Button size="sm" variant="outline" onClick={() => setTrustModalOpen(true)} className="text-xs">
                {t('project.untrusted.review')}
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3.5 rounded-xl border border-border/50 bg-card/40 space-y-1">
            <Files className="h-4 w-4 text-primary mx-auto" />
            <div className="text-[11px] font-semibold text-foreground">
              {t('welcome.localFiles')}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t('welcome.localFilesDesc')}
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-border/50 bg-card/40 space-y-1">
            <Columns2 className="h-4 w-4 text-success mx-auto" />
            <div className="text-[11px] font-semibold text-foreground">
              {t('welcome.splitView')}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t('welcome.splitViewDesc')}
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-border/50 bg-card/40 space-y-1">
            <Languages className="h-4 w-4 text-warning mx-auto" />
            <div className="text-[11px] font-semibold text-foreground">
              {t('welcome.bilingual')}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t('welcome.bilingualDesc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
