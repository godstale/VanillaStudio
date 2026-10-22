import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { newScene, type Scene } from '@/lib/scene/schema';

const mocks = vi.hoisted(() => ({ picked: null as string | null, extractError: null as string | null, invoked: [] as { cmd: string; args: Record<string, unknown> }[] }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: async () => mocks.picked }));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    mocks.invoked.push({ cmd, args });
    if (cmd === 'extract_reference_frames') {
      if (mocks.extractError) throw mocks.extractError;
      return { frames: ['a', 'b', 'c'], metaPath: 'm', meta: { duration: 6, width: 1, height: 1, fps: 24, hasAudio: false, videoCodec: 'h264' } };
    }
    if (cmd === 'list_dir') throw new Error('no dir');
  },
}));

import { References } from './References';

const scene = newScene({ id: 'scn_A', name: 'Intro', type: 'motion', template: 'commercial@1' });

function setup(initial: Scene = scene) {
  const onChange = vi.fn();
  render(
    <LanguageProvider>
      <References root="/w" slug="intro" scene={initial} onChange={onChange} />
    </LanguageProvider>,
  );
  return onChange;
}

beforeEach(() => {
  mocks.picked = null;
  mocks.extractError = null;
  mocks.invoked = [];
});

describe('References', () => {
  it('adds a URL reference and rejects non-http URLs', () => {
    const onChange = setup();
    const input = screen.getByLabelText(/레퍼런스 URL|Reference URL/);
    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: /URL 추가|Add URL/ }));
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'https://example.com/ad' } });
    fireEvent.click(screen.getByRole('button', { name: /URL 추가|Add URL/ }));
    const next = onChange.mock.calls[0][0] as Scene;
    expect(next.references).toEqual([{ id: 'ref-1', kind: 'url', path: null, url: 'https://example.com/ad', note: '', analysis: null }]);
  });

  it('copies a picked file and registers it', async () => {
    mocks.picked = 'D:\\Downloads\\look.png';
    const onChange = setup();
    fireEvent.click(screen.getByRole('button', { name: /이미지·영상 추가|Add image or video/ }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(mocks.invoked[0]).toMatchObject({ cmd: 'import_external_file', args: { dest: '/w/scenes/intro/references/ref-1-look.png' } });
    expect((onChange.mock.calls[0][0] as Scene).references[0]).toMatchObject({ kind: 'image', path: 'references/ref-1-look.png' });
  });

  it('does nothing when the dialog is cancelled', async () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole('button', { name: /이미지·영상 추가|Add image or video/ }));
    await Promise.resolve();
    expect(onChange).not.toHaveBeenCalled();
    expect(mocks.invoked).toEqual([]);
  });

  it('edits a note and removes an entry', () => {
    const withRef = { ...scene, references: [{ id: 'ref-1', kind: 'url', path: null, url: 'https://example.com/ad', note: '', analysis: null }] } as Scene;
    const onChange = setup(withRef);
    fireEvent.change(screen.getByLabelText(/ref-1 메모|Note for ref-1/), { target: { value: 'palette' } });
    expect((onChange.mock.calls[0][0] as Scene).references[0].note).toBe('palette');
    fireEvent.click(screen.getByRole('button', { name: /ref-1 삭제|Remove ref-1/ }));
    expect((onChange.mock.calls[1][0] as Scene).references).toEqual([]);
  });

  const withVideo = { ...scene, references: [{ id: 'ref-1', kind: 'video', path: 'references/ref-1-clip.mp4', url: null, note: '', analysis: null }] } as Scene;

  it('extracts keyframes for a video reference and shows the result', async () => {
    setup(withVideo);
    fireEvent.click(screen.getByRole('button', { name: /키프레임 추출|Extract keyframes/ }));
    expect(await screen.findByText(/3장|3 frames/)).toBeTruthy();
    expect(mocks.invoked.find((c) => c.cmd === 'extract_reference_frames')?.args).toMatchObject({ refId: 'ref-1', videoPath: 'references/ref-1-clip.mp4' });
    expect(screen.getByRole('button', { name: /다시 추출|Extract again/ })).toBeTruthy();
  });

  it('points to Doctor when FFmpeg is missing', async () => {
    mocks.extractError = 'ffmpeg-not-installed';
    setup(withVideo);
    fireEvent.click(screen.getByRole('button', { name: /키프레임 추출|Extract keyframes/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Doctor/);
  });

  it('offers extraction for videos only', () => {
    setup({ ...scene, references: [{ id: 'ref-1', kind: 'image', path: 'references/ref-1-a.png', url: null, note: '', analysis: null }] } as Scene);
    expect(screen.queryByRole('button', { name: /키프레임 추출|Extract keyframes/ })).toBeNull();
  });
});
