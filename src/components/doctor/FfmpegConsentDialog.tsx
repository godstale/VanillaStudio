import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Network download of a third-party binary: never starts without this explicit consent.
export function FfmpegConsentDialog({ open, onConfirm, onCancel }: Props) {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="ffmpeg-consent">
        <DialogHeader>
          <DialogTitle>{t('doctor.ffmpeg.consent.title')}</DialogTitle>
          <DialogDescription>
            {t('doctor.ffmpeg.consent.desc')}
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
          <li>{t('doctor.ffmpeg.consent.source')}</li>
          <li>{t('doctor.ffmpeg.consent.target')}</li>
          <li>{t('doctor.ffmpeg.consent.verify')}</li>
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t('doctor.ffmpeg.consent.cancel')}
          </Button>
          <Button onClick={onConfirm}>
            {t('doctor.ffmpeg.consent.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
