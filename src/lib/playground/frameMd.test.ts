import { describe, expect, it, vi } from 'vitest';
import { FRAME_MD_FILENAME, loadFrameMd, saveFrameMd, starterFrameMd, validateFrameMd } from './frameMd';

describe('frameMd', () => {
  it('rejects empty notes', () => {
    expect(validateFrameMd('   ')).toEqual({ ok: false, warnings: ['empty'] });
  });

  it('warns on heading-less or tiny notes', () => {
    expect(validateFrameMd('just move things').warnings).toContain('no-heading');
    expect(validateFrameMd('# Title\nmove').warnings).toContain('too-short');
    expect(validateFrameMd(starterFrameMd('Demo'))).toEqual({ ok: true, warnings: [] });
  });

  it('loads and saves through Tauri', async () => {
    const invoke = vi.fn(async (cmd: string) => {
      if (cmd === 'read_text_file') return '# Guide\n\nLong enough motion notes for the video render loop.';
      return null;
    });
    await expect(loadFrameMd('C:/p', invoke)).resolves.toMatchObject({ exists: true });
    await expect(loadFrameMd('C:/p', vi.fn(async () => { throw new Error('missing'); }))).resolves.toEqual({
      text: '',
      exists: false,
    });
    await saveFrameMd('C:/p', starterFrameMd('Demo'), invoke);
    expect(invoke).toHaveBeenCalledWith('write_text_file', {
      path: `C:/p/${FRAME_MD_FILENAME}`,
      contents: expect.any(String),
      workspaceRoot: 'C:/p',
    });
    await expect(saveFrameMd('C:/p', '  ', invoke)).rejects.toThrow('empty-frame');
  });
});
