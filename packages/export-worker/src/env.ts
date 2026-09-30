// Export worker environment (T5.1): Technical-Design §2.3, §6.
//
// The worker spawns tools (HyperFrames, Chrome, vite) that must not phone home,
// fetch remote skills, or send frames to hosted AI vision. Every spawn goes
// through `buildExportEnv`, which pins the opt-outs and strips API keys.
export interface FfmpegPaths {
  ffmpegPath?: string;
  ffprobePath?: string;
}

/** Keys that must never reach a child process (S1: HyperFrames reads GEMINI_API_KEY for `--describe`). */
export const STRIPPED_KEYS: readonly string[] = ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'];

/**
 * Build the environment for an export child process.
 * Sets `DO_NOT_TRACK=1` and `HYPERFRAMES_SKIP_SKILLS=1` (S1), forwards the
 * app-managed FFmpeg paths without touching PATH, and deletes API keys.
 */
export function buildExportEnv(base: NodeJS.ProcessEnv = process.env, ffmpeg: FfmpegPaths = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...base,
    DO_NOT_TRACK: '1',
    HYPERFRAMES_SKIP_SKILLS: '1',
  };
  if (ffmpeg.ffmpegPath) env.HYPERFRAMES_FFMPEG_PATH = ffmpeg.ffmpegPath;
  if (ffmpeg.ffprobePath) env.HYPERFRAMES_FFPROBE_PATH = ffmpeg.ffprobePath;
  for (const key of STRIPPED_KEYS) delete env[key];
  return env;
}
