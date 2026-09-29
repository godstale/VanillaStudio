import { useNavigate } from 'react-router-dom';
import { Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { useDoctor } from './useDoctor';
import { summarize, type Severity } from './doctorModel';
import type { DoctorReport } from './types';

const TONE: Record<Severity, string> = {
  ok: 'text-success border-success/40',
  warn: 'text-warning border-warning/40',
  error: 'text-destructive border-destructive/40',
};

/** Welcome-screen summary; clicking opens Settings > Environment check. */
export function DoctorBadge({ report }: { report: DoctorReport | null }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  if (!report) return null;
  const s = summarize(report);
  const text =
    s.level === 'ok'
      ? t('doctor.summary.ok')
      : s.blocking > 0
        ? t('doctor.summary.blocking', { n: s.blocking })
        : s.noAgent
          ? t('doctor.summary.noAgent')
          : t('doctor.summary.warnings', { n: s.warnings });
  return (
    <button
      type="button"
      title={t('doctor.badge.open')}
      data-testid="doctor-badge"
      data-level={s.level}
      onClick={() => void navigate('/settings/doctor')}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium bg-card hover:bg-accent transition-colors',
        TONE[s.level],
      )}
    >
      <Stethoscope className="h-3.5 w-3.5" />
      {text}
    </button>
  );
}

export function DoctorWelcomeBadge() {
  const { report } = useDoctor();
  return <DoctorBadge report={report} />;
}
