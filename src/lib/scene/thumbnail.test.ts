import { beforeEach, describe, expect, it, vi } from 'vitest';

const files = new Map<string, string>();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, a: { path: string; data?: string }) => {
    if (cmd === 'write_binary_base64') files.set(a.path, a.data ?? '');
    else if (cmd === 'read_binary_base64') return files.get(a.path) ?? null;
    else throw new Error(`unexpected ${cmd}`);
  },
}));

import { dataUrlToBase64, loadThumbnail, saveThumbnail, thumbnailRel } from './thumbnail';

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
});
