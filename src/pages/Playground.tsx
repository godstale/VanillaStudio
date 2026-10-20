import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useWorkspace } from '@/lib/context/WorkspaceContext';
import { EmptyScreen } from '@/components/layout/EmptyScreen';
import { Onboarding } from '@/components/workspace/Onboarding';

/** 플레이그라운드: 온라인 미구축이라 비활성화. 재생은 재생(/play) 메뉴를 쓴다. */
export function Playground() {
  const { t } = useLanguage();
  const { workspaceRoot } = useWorkspace();
  if (!workspaceRoot) return <Onboarding />;
  return (
    <EmptyScreen title={t('shell.nav.playground')}>
      <span className="block text-xs text-muted-foreground">{t('playground.disabled')}</span>
      <a href="#/play" className="mt-1 block text-xs text-primary hover:underline">
        {t('playground.goPlay')}
      </a>
    </EmptyScreen>
  );
}

export default Playground;
