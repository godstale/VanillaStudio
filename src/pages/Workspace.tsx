import { WorkspaceProvider } from '@/lib/context/WorkspaceContext';
import { TrustWorkspaceDialog } from '@/components/workspace/TrustWorkspaceDialog';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// v2 앱 셸(T1.10)이 들어올 자리. 레거시 셸 제거(T1.3) 후 임시 화면.
function WorkspaceContent() {
  const { t } = useLanguage();
  return (
    <div className="flex h-full w-full items-center justify-center bg-background text-muted-foreground">
      {t('workspace.shellPending')}
    </div>
  );
}

export function Workspace() {
  return (
    <WorkspaceProvider>
      <WorkspaceContent />
      <TrustWorkspaceDialog />
    </WorkspaceProvider>
  );
}

export default Workspace;
