// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildExportEnv, STRIPPED_KEYS } from './env';

describe('buildExportEnv (T5.1)', () => {
  it('pins the telemetry/skill opt-outs', () => {
    const env = buildExportEnv({});
    expect(env.DO_NOT_TRACK).toBe('1');
    expect(env.HYPERFRAMES_SKIP_SKILLS).toBe('1');
  });

  it('forwards app-managed FFmpeg paths without touching PATH', () => {
    const env = buildExportEnv({ PATH: '/usr/bin' }, { ffmpegPath: 'C:/a/ffmpeg.exe', ffprobePath: 'C:/a/ffprobe.exe' });
    expect(env.HYPERFRAMES_FFMPEG_PATH).toBe('C:/a/ffmpeg.exe');
    expect(env.HYPERFRAMES_FFPROBE_PATH).toBe('C:/a/ffprobe.exe');
    expect(env.PATH).toBe('/usr/bin');
  });

  it('omits FFmpeg vars when no managed build is given', () => {
    const env = buildExportEnv({});
    expect(env.HYPERFRAMES_FFMPEG_PATH).toBeUndefined();
    expect(env.HYPERFRAMES_FFPROBE_PATH).toBeUndefined();
  });

  it('strips API keys (HyperFrames would use GEMINI_API_KEY for vision analysis)', () => {
    const base: NodeJS.ProcessEnv = {};
    for (const k of STRIPPED_KEYS) base[k] = 'secret';
    const env = buildExportEnv(base);
    for (const k of STRIPPED_KEYS) expect(env[k]).toBeUndefined();
  });

  it('does not mutate the input', () => {
    const base: NodeJS.ProcessEnv = { GEMINI_API_KEY: 'secret', DO_NOT_TRACK: '0' };
    buildExportEnv(base);
    expect(base.GEMINI_API_KEY).toBe('secret');
    expect(base.DO_NOT_TRACK).toBe('0');
  });
});
