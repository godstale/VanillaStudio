import { EmptyScreen } from '@/components/layout/EmptyScreen';
import { useLanguage } from '@/lib/i18n/LanguageContext';

export function Playground() {
  const { t } = useLanguage();
  return <EmptyScreen title={t('shell.nav.playground')}>{t('shell.playground.empty')}</EmptyScreen>;
}

export default Playground;
