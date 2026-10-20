import { beforeEach, describe, expect, it, vi } from 'vitest';

const files = new Map<string, string>();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: { path: string; data?: string }) => {
    if (cmd === 'write_binary_base64') files.set(a.path, a.data ?? '');
    else if (cmd === 'read_binary_base64') return files.get(a.path) ?? null;
    else if (cmd === 'read_text_file') {
      const v = files.get(a.path);
      if (v === undefined) throw new Error(`missing file ${a.path}`);
      return v;
    } else throw new Error(`unexpected ${cmd}`);
  },
}));

import { dataUrlToBase64, loadPoster, loadSceneThumbnail, loadThumbnail, posterRel, saveThumbnail, thumbnailRel } from './thumbnail';

beforeEach(() => files.clear());

describe('thumbnail', () => {
  it('lives under the scene .vanilla folder', () => {
    expect(thumbnailRel('intro')).toBe('scenes/intro/.vanilla/thumb.png');
  });

  it('only accepts PNG data URLs', () => {
    expect(dataUrlToBase64('data:image/png;base64,AAAA')).toBe('AAAA');
    expect(dataUrlToBase64('data:image/jpeg;base64,AAAA')).toBeNull();
    expect(dataUrlToBase64('data:image/png;base64,')).toBeNull();
  });

  it('round-trips through save and load', async () => {
    expect(await loadThumbnail('/w', 'intro')).toBeNull();
    expect(await saveThumbnail('/w', 'intro', 'data:image/png;base64,QUJD')).toBe(true);
    expect(await loadThumbnail('/w', 'intro')).toBe('data:image/png;base64,QUJD');
  });

  it('refuses to write non-PNG input', async () => {
    expect(await saveThumbnail('/w', 'intro', 'data:text/html;base64,QUJD')).toBe(false);
    expect(files.size).toBe(0);
  });

  it('poster lives next to scene.json and loads as an SVG data URL', async () => {
    expect(posterRel('intro')).toBe('scenes/intro/poster.svg');
    expect(await loadPoster('/w', 'intro')).toBeNull();
    files.set('/w/scenes/intro/poster.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"></svg>');
    const url = await loadPoster('/w', 'intro');
    expect(url?.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(url!.slice(url!.indexOf(',') + 1))).toContain('<svg');
  });

  it('poster rejects non-SVG text', async () => {
    files.set('/w/scenes/intro/poster.svg', '<html>not an svg</html>');
    expect(await loadPoster('/w', 'intro')).toBeNull();
  });

  it('scene thumbnail prefers the auto capture and falls back to the poster', async () => {
    files.set('/w/scenes/intro/poster.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"></svg>');
    expect((await loadSceneThumbnail('/w', 'intro'))?.startsWith('data:image/svg+xml')).toBe(true);
    await saveThumbnail('/w', 'intro', 'data:image/png;base64,QUJD');
    expect(await loadSceneThumbnail('/w', 'intro')).toBe('data:image/png;base64,QUJD');
  });

  it('scene thumbnail is null when neither exists', async () => {
    expect(await loadSceneThumbnail('/w', 'missing')).toBeNull();
  });
});
