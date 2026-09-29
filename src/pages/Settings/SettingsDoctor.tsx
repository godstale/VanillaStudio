import { DoctorPanel } from '@/components/doctor/DoctorPanel';
import { useDoctor } from '@/components/doctor/useDoctor';
import { useFfmpegDownload } from '@/components/doctor/useFfmpegDownload';

export function SettingsDoctor() {
  const { report, loading, error, refresh } = useDoctor();
  const ffmpeg = useFfmpegDownload(() => void refresh());
  return (
    <DoctorPanel
      report={report}
      loading={loading}
      error={error}
      onRecheck={() => void refresh()}
      ffmpeg={ffmpeg.phase}
      onFfmpegDownload={() => void ffmpeg.start()}
      onFfmpegCancel={ffmpeg.cancel}
    />
  );
}

export default SettingsDoctor;
