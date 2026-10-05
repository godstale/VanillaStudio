import { EmptyScreen } from '@/components/layout/EmptyScreen';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';

// 캔버스(T1.13)가 들어올 자리.
export function Workspace() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  return (
    <EmptyScreen title={t('shell.nav.workspace')}>
      {workspaceRoot ?? t('shell.workspace.none')}
    </EmptyScreen>
  );
}

export default Workspace;
