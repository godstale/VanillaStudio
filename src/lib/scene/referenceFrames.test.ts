import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ calls: [] as { cmd: string; args: Record<string, unknown> }[], files: new Map<string, string>(), fail: null as string | null }));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    state.calls.push({ cmd, args });
    if (cmd === 'extract_reference_frames') {
      if (state.fail) throw state.fail;
      return { frames: ['f1', 'f2'], metaPath: 'm', meta: { duration: 3, width: 1, height: 1, fps: 24, hasAudio: false, videoCodec: 'h264' } };
    }
    if (cmd === 'list_dir') {
      const dir = String(args.path).replace(/^\/w\//, '').replace(/\/$/, '');
      return [...state.files.keys()].filter((k) => k.startsWith(`${dir}/`) && !k.slice(dir.length + 1).includes('/')).map((k) => ({ name: k.slice(dir.length + 1), is_dir: false }));
    }
    if (cmd === 'read_text_file') return state.files.get(String(args.path).replace(/^\/w\//, '')) ?? '';
    throw new Error(`unexpected ${cmd}`);
  },
}));

import { analysisDir, extractErrorKey, extractReferenceFrames, readExtractedInfo } from './referenceFrames';
import type { Reference } from './references';

const video: Reference = { id: 'ref-1', kind: 'video', path: 'references/ref-1-clip.mp4', url: null, note: '', analysis: null };

beforeEach(() => {
  state.calls = [];
  state.files.clear();
  state.fail = null;
});

describe('referenceFrames', () => {
  it('sends only ids and the scene-relative path (no command text)', async () => {
    const r = await extractReferenceFrames('/w', 'intro', video, 6);
    expect(r.frames).toHaveLength(2);
    expect(state.calls[0]).toEqual({ cmd: 'extract_reference_frames', args: { workspaceRoot: '/w', slug: 'intro', refId: 'ref-1', videoPath: 'references/ref-1-clip.mp4', count: 6 } });
  });

  it('refuses non-video references', async () => {
    await expect(extractReferenceFrames('/w', 'intro', { ...video, kind: 'url', path: null, url: 'https://a.b/' })).rejects.toThrow('not-a-video');
    await expect(extractReferenceFrames('/w', 'intro', { ...video, kind: 'image' })).rejects.toThrow('not-a-video');
    expect(state.calls).toEqual([]);
  });

  it('reads a previous result from meta.json', async () => {
    expect(await readExtractedInfo('/w', 'intro', 'ref-1')).toBeNull();
    state.files.set(`${analysisDir('intro', 'ref-1')}/meta.json`, JSON.stringify({ frames: 8, duration: 12.5 }));
    expect(await readExtractedInfo('/w', 'intro', 'ref-1')).toEqual({ frames: 8, duration: 12.5 });
    state.files.set(`${analysisDir('intro', 'ref-1')}/meta.json`, '{bad');
    expect(await readExtractedInfo('/w', 'intro', 'ref-1')).toBeNull();
  });

  it('maps known backend errors to messages', () => {
    expect(extractErrorKey('ffmpeg-not-installed')).toBe('references.ffmpegMissing');
    expect(extractErrorKey('no-video-stream')).toBe('references.noVideoStream');
    expect(extractErrorKey('boom')).toBeNull();
  });
});
