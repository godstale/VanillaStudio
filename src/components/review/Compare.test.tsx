import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { Compare, CheckpointCompare } from './Compare';

const state = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: state.invoke }));

function renderWithLang(ui: React.ReactElement) {
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

describe('Compare', () => {
  it('shows two shots side by side', () => {
    renderWithLang(
      <Compare
        before={{ src: 'data:image/png;base64,AAA', label: 'abc123', caption: 'R-001 · s1' }}
        after={{ src: null, label: 'def456', caption: null }}
      />,
    );
    expect(screen.getByTestId('compare-before').textContent).toContain('abc123');
    expect(screen.getByTestId('compare-before').textContent).toContain('R-001');
    expect(screen.getByTestId('compare-before').querySelector('img')?.getAttribute('src')).toBe(
      'data:image/png;base64,AAA',
    );
    expect(screen.getByTestId('compare-after').querySelector('img')).toBeNull();
  });
});

describe('CheckpointCompare', () => {
  it('resolves the nearest earlier screenshot per checkpoint', async () => {
    state.invoke.mockImplementation((cmd: string, call: { path: string }) => {
      if (cmd === 'checkpoint_history') {
        return Promise.resolve([
          { id: 'newer', message: 'second', at: '2026-01-02T00:00:00Z' },
          { id: 'older', message: 'first', at: '2026-01-01T00:00:00Z' },
        ]);
      }
      if (cmd === 'list_dir') {
        return Promise.resolve([{ name: 'R-001.md', is_dir: false }, { name: 'R-001.png.b64', is_dir: false }]);
      }
      if (cmd === 'read_text_file') {
        if (call.path.includes('R-001.md')) {
          return Promise.resolve(
            '---\nid: R-001\ntarget: s1\nstatus: applied\ncreatedAt: 2026-01-01T12:00:00Z\nscreenshot: R-001.png.b64\n---\n\nok\n',
          );
        }
        return Promise.resolve('iVBORw==');
      }
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });
    renderWithLang(<CheckpointCompare root="C:/proj" />);
    await waitFor(() => expect(screen.queryByTestId('compare')).not.toBeNull());
    // Newer checkpoint (default right side) shows the R-001 shot; the older
    // one predates it and stays empty.
    const after = screen.getByTestId('compare-after');
    expect(after.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,iVBORw==');
    expect(after.textContent).toContain('R-001');
    expect(screen.getByTestId('compare-before').querySelector('img')).toBeNull();
  });

  it('shows the empty state without checkpoints', async () => {
    state.invoke.mockImplementation((cmd: string) => {
      if (cmd === 'checkpoint_history') return Promise.resolve([]);
      if (cmd === 'list_dir') return Promise.resolve([]);
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });
    renderWithLang(<CheckpointCompare root="C:/proj" />);
    await waitFor(() => expect(screen.queryByTestId('compare')).toBeNull());
  });

  it('switching selections updates both sides', async () => {
    state.invoke.mockImplementation((cmd: string, call: { path: string }) => {
      if (cmd === 'checkpoint_history') {
        return Promise.resolve([
          { id: 'c2', message: 'two', at: '2026-01-03T00:00:00Z' },
          { id: 'c1', message: 'one', at: '2026-01-01T00:00:00Z' },
        ]);
      }
      if (cmd === 'list_dir') return Promise.resolve([]);
      return Promise.reject(new Error(`unexpected ${cmd} ${call?.path ?? ''}`));
    });
    renderWithLang(<CheckpointCompare root="C:/proj" />);
    await waitFor(() => expect(screen.queryByTestId('compare')).not.toBeNull());
    fireEvent.change(screen.getByTestId('compare-select-a'), { target: { value: 'c2' } });
    expect((screen.getByTestId('compare-select-a') as HTMLSelectElement).value).toBe('c2');
  });
});
