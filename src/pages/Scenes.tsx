import { EmptyScreen } from '@/components/layout/EmptyScreen';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function Scenes() {
  const { t } = useLanguage();
  return <EmptyScreen title={t('shell.nav.scenes')}>{t('shell.scenes.empty')}</EmptyScreen>;
}

export default Scenes;
