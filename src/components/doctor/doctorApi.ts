import { Channel, invoke } from '@tauri-apps/api/core';
import type { DoctorReport, FfmpegEvent, FfmpegInstallResult } from './types';

export function doctorCheck(freshPath = true): Promise<DoctorReport> {
  return invoke<DoctorReport>('doctor_check', { freshPath });
}

export function ffmpegDownload(
  onEvent: (e: FfmpegEvent) => void,
): Promise<FfmpegInstallResult> {
  const channel = new Channel<FfmpegEvent>();
  channel.onmessage = onEvent;
  return invoke<FfmpegInstallResult>('ffmpeg_download', { onEvent: channel });
}

export function ffmpegDownloadCancel(): Promise<void> {
  return invoke('ffmpeg_download_cancel');
}
